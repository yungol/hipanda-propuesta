# Image Generation API — Consumption Contract

**Service:** Text-to-image (stable-diffusion.cpp via llama-swap)
**Compatibility:** OpenAI Images API (partial — see Parameters)
**Base URL:** `http://192.168.0.109:4001/v1`
**Auth:** none

> **Do not use port `5173`.** That is the Vite dev server, which only proxies
> `/v1` to the backend while `npm run dev` is running. The API itself is the
> Express server on port `4001`, bound to `0.0.0.0`.

---

## Endpoint

```
POST /v1/images/generations
Content-Type: application/json
```

## Parameters (JSON body)

| Field | Required | Type | Description |
|---|:---:|---|---|
| `model` | yes | string | `juggernaut-z`, `flux2-klein`, `sdxl` |
| `prompt` | yes | string | The prompt, optionally with an `<sd_cpp_extra_args>` tag |
| `size` | no | string | `"WxH"`, e.g. `"576x1024"`. Defaults to the model's own default |
| `n` | no | integer | Number of images. Defaults to `1` |
| `output_format` | no | string | `png` (default) |

**Only these fields are read.** `seed`, `steps`, `cfg` and `negative_prompt` at
the top level of the body are silently ignored — sd-server's OpenAI-compatible
route does not parse them. They must be passed through the extra-args tag below.

`size` takes precedence over `width`/`height`, which are ignored over HTTP.

### The `<sd_cpp_extra_args>` tag

Append a tag to the end of the prompt containing a JSON object. sd-server parses
it, applies the settings, and strips the tag from the text before generation.

```
<sd_cpp_extra_args>{"seed":463132037,"negative_prompt":"","sample_params":{"sample_steps":20,"guidance":{"txt_cfg":1}}}</sd_cpp_extra_args>
```

| Key | Type | Description |
|---|---|---|
| `seed` | integer | Fix it to make a generation reproducible |
| `negative_prompt` | string | What to avoid. Ignored by `flux2-klein` |
| `sample_params.sample_steps` | integer | Denoising steps |
| `sample_params.guidance.txt_cfg` | number | CFG scale |

Resolve a random seed **client-side** rather than omitting it. That way the
value that produced the image is known and the run can be reproduced.

### Per-model defaults

| Model | Steps | CFG | Default size | Negative prompt |
|---|---:|---:|---|---|
| `juggernaut-z` | 20 | 1 | 576x1024 | honored |
| `flux2-klein` | 4 | 1.0 | 576x1024 | ignored by the architecture |
| `sdxl` | 20 | 7.5 | 576x1024 | honored |

`GET /api/models` on the Express server lists every installed model with a
`type` field; image models are `type: "image"`.

## Response `200`

```json
{ "data": [{ "b64_json": "iVBORw0KGgoAAAANSUhEUg..." }] }
```

**Base64 PNG bytes, not a URL.** Decoding and storing the file is the caller's
responsibility. The `/images/*` static route on this server only serves images
already saved through the web UI's own gallery; it is not part of this contract.

## Errors

The proxy forwards the upstream status and body unchanged.

| Code | Cause |
|---|---|
| `400` | Unknown model, malformed body |
| `500` | Generation failed upstream |
| `502` | llama-swap unavailable — the backend is up but the engine is not |

---

## Example — curl

```bash
curl -s http://192.168.0.109:4001/v1/images/generations \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "juggernaut-z",
    "prompt": "Anthropomorphic panda character, cute cartoon style, vector illustration, bold outlines, isolated on a plain solid gray background <sd_cpp_extra_args>{\"seed\":463132037,\"negative_prompt\":\"\",\"sample_params\":{\"sample_steps\":20,\"guidance\":{\"txt_cfg\":1}}}</sd_cpp_extra_args>",
    "size": "576x1024"
  }' | jq -r '.data[0].b64_json' | base64 -d > out.png
```

## Example — Node

```js
import fs from "node:fs/promises";

const BASE_URL = "http://192.168.0.109:4001";

async function generateImage({
  model = "juggernaut-z",
  prompt,
  negativePrompt = "",
  steps = 20,
  guidance = 1,
  seed,
  size = "576x1024",
}) {
  // Resolve the seed here so the exact value is known and reproducible.
  const resolvedSeed =
    seed == null || seed < 0 ? Math.floor(Math.random() * 2147483647) : seed;

  const extraArgs = {
    seed: resolvedSeed,
    negative_prompt: negativePrompt,
    sample_params: {
      sample_steps: steps,
      guidance: { txt_cfg: guidance },
    },
  };

  const response = await fetch(`${BASE_URL}/v1/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: `${prompt} <sd_cpp_extra_args>${JSON.stringify(extraArgs)}</sd_cpp_extra_args>`,
      size,
    }),
    // Model swap plus cold start can take minutes on the first request.
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    throw new Error(`Image generation failed (${response.status}): ${await response.text()}`);
  }

  const { data } = await response.json();
  return { buffer: Buffer.from(data[0].b64_json, "base64"), seed: resolvedSeed };
}

const { buffer, seed } = await generateImage({
  prompt: "Anthropomorphic panda developer, vector sticker illustration",
});
await fs.writeFile(`panda-${seed}.png`, buffer);
```

## Example — Python

```python
import base64
import json
import random

import requests

BASE_URL = "http://192.168.0.109:4001"


def generate_image(prompt, model="juggernaut-z", negative_prompt="",
                   steps=20, guidance=1, seed=None, size="576x1024"):
    resolved_seed = seed if seed is not None and seed >= 0 else random.randint(0, 2147483647)

    extra_args = {
        "seed": resolved_seed,
        "negative_prompt": negative_prompt,
        "sample_params": {
            "sample_steps": steps,
            "guidance": {"txt_cfg": guidance},
        },
    }

    response = requests.post(
        f"{BASE_URL}/v1/images/generations",
        json={
            "model": model,
            "prompt": f"{prompt} <sd_cpp_extra_args>{json.dumps(extra_args)}</sd_cpp_extra_args>",
            "size": size,
        },
        timeout=300,
    )
    response.raise_for_status()

    return base64.b64decode(response.json()["data"][0]["b64_json"]), resolved_seed


image, seed = generate_image("Anthropomorphic panda developer, vector sticker illustration")
with open(f"panda-{seed}.png", "wb") as handle:
    handle.write(image)
```

---

## Notes for the consuming agent

- **Use a timeout of minutes, not seconds.** Every `/v1` request passes through
  a middleware that calls `gpu.requireLlama()`, which stops ComfyUI if it is
  running. llama-swap then loads the requested model if it is not already
  resident. A first request after a cold start or a model switch is far slower
  than a warm one.
- **This is a serialized resource, not a scalable service.** One GPU, 8GB VRAM,
  one model resident at a time. Concurrent requests — or requests issued while
  the chat, video or TTS features are in use — evict each other's models and
  thrash. Queue generations sequentially from the client side.
- **No authentication, no TLS, no rate limiting.** The server binds `0.0.0.0`
  and accepts anything on the LAN. Do not expose port `4001` to the internet as
  it stands.
- **`n > 1` is untested here.** The web UI always requests a single image. If
  batching matters, verify the response shape before relying on it.
- **Prompts work best in English.** `POST /api/enhance-image-prompt` on the
  Express server rewrites a rough idea into a richer English prompt using a
  local LLM, if that is useful to the caller.

---

## Deployment

| Piece | Path |
|---|---|
| Express server | `server/src/index.js` (port `4001`) |
| Proxy route | `server/src/routes/proxy.js` |
| Model registry | `server/src/routes/models.js` |
| Reference client | `client/src/composables/useImageGen.js` |
| Weights | `/home/juan/models/juggernautZ-v10-Q6_K.gguf` |
| Engine | stable-diffusion.cpp server, managed by llama-swap |
