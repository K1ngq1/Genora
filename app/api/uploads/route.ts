import { saveBuffer, storageUrl } from "@/lib/storage";

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
  return Response.json({ url: storageUrl(path), name: file.name, type: file.type });
}
