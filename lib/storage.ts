import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "storage");

export async function saveBuffer(folder: "images" | "videos" | "uploads", name: string, data: Buffer) {
  const dir = path.join(ROOT, folder);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, name);
  await writeFile(filePath, data);
  return filePath;
}

export function storageUrl(filePath?: string | null) {
  if (!filePath) return null;
  const relative = path.relative(ROOT, filePath).split(path.sep).join("/");
  return `/api/files/${relative}`;
}

export function mimeFromName(name: string) {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  return "application/octet-stream";
}
