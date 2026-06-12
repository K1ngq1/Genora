import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([".git", ".next", ".next-build", ".netlify", "node_modules", "storage", "vendor", ".venv-ideogram"]);
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".md", ".json", ".prisma"]);
const suspiciousPatterns = [
  /\uFFFD/,
  /[ÃÂ]{1,2}[\u0080-\u00bf]/,
  /[鎶锛銆鈥闈瑙鐢鍥绱璇濡榧婊浣]{2,}/,
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = await walk(root);
const hits = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  if (path.relative(root, file) === path.join("scripts", "check-encoding.mjs")) continue;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/疑似乱码的内容.*例如/.test(line)) return;
    if (suspiciousPatterns.some((pattern) => pattern.test(line))) {
      hits.push(`${path.relative(root, file)}:${index + 1}: ${line.trim().slice(0, 160)}`);
    }
  });
}

if (hits.length) {
  console.error("Possible mojibake was found:");
  console.error(hits.join("\n"));
  process.exit(1);
}

console.log(`Encoding check passed for ${files.length} text files.`);
