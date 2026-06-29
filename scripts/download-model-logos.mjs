import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url)).replace(/\\scripts$/, "");
const outDir = join(root, "public", "model-logos");

const logos = [
  {
    name: "OpenAI",
    url: "https://cdn.openai.com/API/images/openai-logomark.svg",
    path: "openai.svg",
  },
  {
    name: "Google / Gemini",
    url: "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_1920x1920.png",
    path: "google-gemini.png",
  },
  {
    name: "ByteDance",
    url: "https://lf1-cdn-tos.bytescm.com/obj/static/ies/bytedance_official/favicon.ico",
    path: "bytedance.ico",
  },
  {
    name: "xAI",
    url: "https://x.ai/favicon.ico",
    path: "xai.ico",
  },
];

await mkdir(outDir, { recursive: true });

for (const logo of logos) {
  try {
    const response = await fetch(logo.url, { redirect: "follow" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(join(outDir, logo.path), buffer);
    console.log(`Downloaded ${logo.name} -> public/model-logos/${logo.path}`);
  } catch (error) {
    console.warn(`Skipped ${logo.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
