import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

import { generateImage, mockupPrompt, mockupNegativePrompt } from "./generate-image.mjs";

// Bocetos a mano alzada para instructivoClaveGalco/.
//
// Los bocetos se generan SIN texto a proposito, por dos razones:
//   1. El modelo escribe el espanol con faltas ("Cuddar", "Restablecor") y
//      esta guia se le envia a un usuario final.
//   2. Sin rotulos, el boceto no caduca cuando la interfaz cambie de copy.
// Los textos reales de la pantalla viven en el HTML, donde son verificables
// contra el codigo de front-galco (src/components/core/Login.vue).
//
// Las semillas quedan fijas para que el resultado sea reproducible. Cambiar
// una semilla cambia el dibujo.
//
// El servidor local tiene una sola GPU: las generaciones van en serie.

const OUT_DIR = "instructivoClaveGalco/images";
const SIZE = "1024x576";

const scenes = [
  {
    file: "01-pantalla-ingreso",
    seed: 1518908527,
    description:
      "A web browser window frame containing one centered narrow vertical login card. " +
      "At the top of the card a filled dark rectangle standing in for a company logo. " +
      "Below it a wide empty button outline, then an empty input field box with a small " +
      "envelope icon on its left, then another empty input field box with a small padlock " +
      "icon on its left, then a wide solid filled button. Under the card, outside of it, " +
      "one short horizontal line standing in for a link, circled with a loose hand-drawn " +
      "ellipse and marked with a big curved arrow pointing at it from the right",
  },
  {
    file: "02-formulario-correo",
    seed: 1848784601,
    description:
      "A web browser window frame containing one centered narrow vertical card. " +
      "At the top of the card a filled dark rectangle standing in for a company logo. " +
      "Below it two short horizontal squiggly lines standing in for a sentence, then one " +
      "single wide empty input field box with a small envelope icon on its left, then one " +
      "wide solid filled button at the bottom of the card. A big curved hand-drawn arrow " +
      "points at the filled button",
  },
  {
    file: "03-correo-recibido",
    seed: 1143084768,
    description:
      "A flat hand-drawn wireframe of an email inbox seen straight on: a narrow left sidebar " +
      "column with a few short horizontal lines, and on the right a vertical list of five " +
      "horizontal rectangular message rows, each row containing two short horizontal squiggly " +
      "lines. The topmost message row is circled with a loose hand-drawn ellipse and has one " +
      "big curved arrow pointing at it from the right",
  },
  {
    file: "04-nueva-clave",
    seed: 2001375417,
    description:
      "A web browser window frame containing one small centered form panel. The panel has one " +
      "short horizontal line at the top standing in for a heading, then one wide empty input " +
      "field box, then a second wide empty input field box, then one wide solid filled button " +
      "at the bottom. A big curved hand-drawn arrow points at the filled button",
  },
];

// El HTML embebe WebP en base64: el PNG de 700 KB por boceto haria el archivo
// inservible para enviarlo por correo. Con line art, WebP q82 baja de ~2,9 MB
// a ~90 KB en total sin degradar el trazo.
function toWebp(pngPath) {
  const webpPath = pngPath.replace(/\.png$/, ".webp");
  execFileSync("cwebp", ["-quiet", "-q", "82", "-m", "6", pngPath, "-o", webpPath]);
  rmSync(pngPath);
  return webpPath;
}

for (const scene of scenes) {
  const prompt = mockupPrompt(scene.description);
  process.stdout.write(`🎨 ${scene.file} … `);
  const { path } = await generateImage({
    prompt,
    outputPath: `${OUT_DIR}/${scene.file}.png`,
    size: SIZE,
    seed: scene.seed,
    negativePrompt: mockupNegativePrompt(false),
  });
  const webp = toWebp(path);
  console.log(`ok ${webp} · seed=${scene.seed}`);
}

// El HTML distribuible lleva los bocetos ya incrustados en base64, igual que
// el resto de piezas del repo (no hay paso de build). Si regeneras un boceto,
// reemplaza a mano el data URI correspondiente dentro de
// instructivoClaveGalco/instructivo-restablecer-clave-galco.html.
console.log("\nBocetos listos en", OUT_DIR);
