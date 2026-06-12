import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");
const route = await readFile("app/api/videos/generate/route.ts", "utf8");

const checks = [
  ["start frame field matches route", page.includes('appendImageFromUrl(form, "startFrame"') && route.includes('form.get("startFrame")')],
  ["end frame field matches route", page.includes('appendImageFromUrl(form, "endFrame"') && route.includes('form.get("endFrame")')],
  ["reference image field matches route", page.includes('appendImageFromUrl(form, "referenceImages"') && route.includes('form.getAll("referenceImages")')],
  ["obsolete singular field removed", !page.includes('appendImageFromUrl(form, "referenceImage"')],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  for (const [name] of failed) console.error(`Missing: ${name}`);
  process.exit(1);
}

console.log("Video reference field checks passed.");
