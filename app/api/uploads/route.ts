import { saveBuffer, storageUrl } from "@/lib/storage";
import { assetUrl } from "@/lib/assets";
import { db } from "@/lib/db";

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const projectId = String(form.get("projectId") ?? "").trim();
  if (!projectId || !await db.project.findUnique({ where: { id: projectId }, select: { id: true } })) {
    return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
  }
  if (!(file instanceof File) || !file.size) {
    return Response.json({ error: "UPLOAD_FILE_REQUIRED" }, { status: 400 });
  }
  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return Response.json({ error: "UNSUPPORTED_UPLOAD_FORMAT" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    return Response.json({ error: "UPLOAD_TOO_LARGE" }, { status: 400 });
  }
  const path = await saveBuffer(
    "uploads",
    `${crypto.randomUUID()}.${extension}`,
    Buffer.from(await file.arrayBuffer()),
  );
  const asset = await db.asset.create({
    data: {
      projectId,
      kind: file.type.startsWith("video/") ? "video" : "image",
      path,
      originalName: file.name,
      mimeType: file.type,
      byteSize: file.size,
      source: "canvas-upload",
    },
  });
  return Response.json({ id: asset.id, url: assetUrl(asset.id), legacyUrl: storageUrl(path), name: file.name, type: file.type });
}
