import { readFile } from "node:fs/promises";
import { db } from "@/lib/db";
import { createAgnesVideo } from "@/lib/agnes";
import { mimeFromName, saveBuffer } from "@/lib/storage";
import { errorMessage, publicTask } from "@/lib/tasks";

const MAX_UPLOAD = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  const form = await request.formData();
  const prompt = String(form.get("prompt") ?? "").trim();
  if (!prompt) return Response.json({ error: "请输入视频提示词" }, { status: 400 });
  const width = Number(form.get("width") ?? 1280);
  const height = Number(form.get("height") ?? 720);
  const frames = Number(form.get("frames") ?? 81);
  const frameRate = Number(form.get("frameRate") ?? 16);
  const seedText = String(form.get("seed") ?? "").trim();
  const imageTaskId = String(form.get("imageTaskId") ?? "").trim();
  const upload = form.get("image");
  let inputPath: string | undefined;
  let inputMime: string | undefined;
  if (upload instanceof File && upload.size > 0) {
    if (!ALLOWED.has(upload.type)) return Response.json({ error: "图片仅支持 PNG、JPEG 或 WebP 格式" }, { status: 400 });
    if (upload.size > MAX_UPLOAD) return Response.json({ error: "上传图片不能超过 10 MB" }, { status: 400 });
    const extension = upload.type === "image/png" ? "png" : upload.type === "image/webp" ? "webp" : "jpg";
    inputPath = await saveBuffer("uploads", `${crypto.randomUUID()}.${extension}`, Buffer.from(await upload.arrayBuffer()));
    inputMime = upload.type;
  } else if (imageTaskId) {
    const imageTask = await db.task.findUnique({ where: { id: imageTaskId } });
    if (!imageTask?.outputPath || imageTask.type !== "image") return Response.json({ error: "找不到所选图片" }, { status: 400 });
    inputPath = imageTask.outputPath;
    inputMime = mimeFromName(inputPath);
  }
  const params = { width, height, frames, frameRate, seed: seedText ? Number(seedText) : undefined, model: "agnes-video-v2.0" };
  const task = await db.task.create({ data: { type: inputPath ? "image-to-video" : "text-to-video", status: "pending", prompt, params: JSON.stringify(params), inputPath } });
  try {
    const payload: Record<string, unknown> = { model: "agnes-video-v2.0", prompt, width, height, frames, frame_rate: frameRate };
    if (params.seed !== undefined) payload.seed = params.seed;
    if (inputPath) payload.image_url = `data:${inputMime};base64,${(await readFile(inputPath)).toString("base64")}`;
    const remoteTaskId = await createAgnesVideo(payload);
    return Response.json(publicTask(await db.task.update({ where: { id: task.id }, data: { status: "processing", remoteTaskId } })));
  } catch (error) {
    const message = errorMessage(error);
    await db.task.update({ where: { id: task.id }, data: { status: "failed", error: message } });
    return Response.json({ error: message, taskId: task.id }, { status: 502 });
  }
}
