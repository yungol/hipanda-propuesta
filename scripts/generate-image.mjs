import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Cliente para el generador local de imágenes (stable-diffusion.cpp detrás de
// llama-swap). Contrato completo en scripts/images-api-contract.md.
//
// Un solo GPU, un solo modelo residente a la vez: las llamadas deben ser
// secuenciales. No lanzar generaciones en paralelo.

const DEFAULT_BASE_URL = "http://192.168.0.109:4001";
const DEFAULT_MODEL = "juggernaut-z";
const DEFAULT_SIZE = "576x1024";

const MODEL_DEFAULTS = {
  "juggernaut-z": { steps: 20, guidance: 1 },
  "flux2-klein": { steps: 4, guidance: 1 },
  sdxl: { steps: 20, guidance: 7.5 },
};

export class LocalImageError extends Error {
  constructor(message) {
    super(message);
    this.name = "LocalImageError";
  }
}

// Estilo obligatorio de este repo: todo mockup se genera a mano alzada
// (wireframe/sketch), nunca foto-realista ni UI digital pulida.
// La instrucción de estilo va en inglés porque el modelo la sigue mejor así.
const MOCKUP_STYLE =
  "Hand-drawn UI mockup sketch, loose freehand black marker or pencil lines " +
  "on plain white paper, low-fidelity wireframe style, imperfect hand-drawn " +
  "boxes and arrows, doodle annotations, whiteboard sketch aesthetic, " +
  "no color or a single accent color at most, no photorealism, no 3D render, " +
  "no clean vector lines, no polished digital UI.";

const MOCKUP_NEGATIVE_BASE =
  "photorealistic, photograph, 3d render, glossy, polished UI, clean vector " +
  "lines, digital flat design, gradient, drop shadow, high fidelity, " +
  "screenshot, watermark, signature, blurry, low quality, deformed";

/**
 * Envuelve una descripción en inglés con el estilo obligatorio de mockup a
 * mano alzada. Si el mockup necesita mostrar texto (labels, botones,
 * títulos), ese texto va SIEMPRE en español — es lo único que se le pide en
 * español al modelo, porque es lo que terminaría visible en la imagen.
 *
 * @param {string} description descripción de la escena/layout, en inglés
 * @param {string[]} [texts] textos en español que deben aparecer en la imagen
 * @returns {string}
 */
export function mockupPrompt(description, texts = []) {
  const base = String(description ?? "").trim().replace(/[\s]+$/, "");
  const dot = /[.!?]$/.test(base) ? "" : ".";
  const textInstruction = texts.length
    ? `Include the following text exactly as written, in Spanish: ${texts
        .map((t) => `"${t}"`)
        .join(", ")}.`
    : "No legible text, no lettering, no labels.";
  return `${base}${dot} ${MOCKUP_STYLE} ${textInstruction}`;
}

export function mockupNegativePrompt(hasText) {
  return hasText
    ? MOCKUP_NEGATIVE_BASE
    : `${MOCKUP_NEGATIVE_BASE}, text, words, letters, typography`;
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function slug(s, max = 40) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

/**
 * Genera una imagen en el servidor local.
 *
 * El seed se resuelve del lado del cliente para que quede registrado el
 * valor exacto que produjo la imagen y así poder reproducirla.
 *
 * @param {{
 *   prompt: string, outputPath?: string, model?: string, size?: string,
 *   steps?: number, guidance?: number, negativePrompt?: string,
 *   seed?: number, baseUrl?: string, timeoutMs?: number
 * }} opts
 * @returns {Promise<{ path: string, bytes: number, seed: number }>}
 */
export async function generateImage({
  prompt,
  outputPath,
  model = DEFAULT_MODEL,
  size = DEFAULT_SIZE,
  steps,
  guidance,
  negativePrompt = "",
  seed,
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = 300_000, // arranque en frío + cambio de modelo se mide en minutos
}) {
  const resolvedPath = outputPath || `output-${stamp()}.png`;
  const defaults = MODEL_DEFAULTS[model] || MODEL_DEFAULTS[DEFAULT_MODEL];
  const resolvedSeed =
    seed == null || seed < 0 ? Math.floor(Math.random() * 2147483647) : seed;

  const extraArgs = {
    seed: resolvedSeed,
    negative_prompt: negativePrompt,
    sample_params: {
      sample_steps: steps ?? defaults.steps,
      guidance: { txt_cfg: guidance ?? defaults.guidance },
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `${prompt} <sd_cpp_extra_args>${JSON.stringify(extraArgs)}</sd_cpp_extra_args>`,
        size,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(sin cuerpo)");
      const hint =
        res.status === 502
          ? " — llama-swap no está disponible (el backend responde, el motor no)"
          : "";
      throw new LocalImageError(
        `Servidor local ${res.status}${hint}: ${body.slice(0, 200)}`,
      );
    }

    const json = await res.json();
    const base64 = json?.data?.[0]?.b64_json;
    if (!base64) throw new LocalImageError("La respuesta local no trae b64_json");

    const buf = Buffer.from(base64, "base64");
    ensureDir(dirname(resolvedPath));
    writeFileSync(resolvedPath, buf);
    return { path: resolvedPath, bytes: buf.length, seed: resolvedSeed };
  } catch (e) {
    if (e.name === "AbortError") {
      throw new LocalImageError(
        `Timeout (${timeoutMs / 1000}s) generando imagen en ${baseUrl}. ` +
          "Un arranque en frío o un cambio de modelo puede tardar minutos.",
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// --- CLI ---
// node scripts/generate-image.mjs --prompt "..." [--text "Label uno||Label dos"]
//   [--model juggernaut-z] [--size 576x1024] [--out ruta.png] [--raw]
//
// --prompt va en inglés (el modelo lo sigue mejor así). El estilo de mockup a
// mano alzada se aplica siempre salvo --raw. --text lleva los textos en
// español que deben quedar dibujados dentro de la imagen (separados por "||").
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const prompt = args.prompt || args._.join(" ");
  if (!prompt) {
    console.error('Falta --prompt "descripción de la imagen, en inglés"');
    process.exit(1);
  }
  const out = resolve(args.out || `assets/img/${stamp()}-${slug(prompt)}.png`);
  const texts = args.text ? String(args.text).split("||").map((t) => t.trim()).filter(Boolean) : [];
  const useRaw = args.raw === true || args.raw === "true";
  const finalPrompt = useRaw ? prompt : mockupPrompt(prompt, texts);
  const negativePrompt = args.negative ?? (useRaw ? "" : mockupNegativePrompt(texts.length > 0));

  console.log(`🎨 Generando mockup a mano alzada (${args.model || DEFAULT_MODEL})…`);
  try {
    const { path, bytes, seed } = await generateImage({
      prompt: finalPrompt,
      outputPath: out,
      model: args.model,
      size: args.size,
      negativePrompt,
      seed: args.seed ? Number(args.seed) : undefined,
      baseUrl: args.baseUrl,
    });
    console.log(`✅ Imagen lista: ${path} (${(bytes / 1024).toFixed(1)} KB) · seed=${seed}`);
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
}
