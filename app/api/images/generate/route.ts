import { db } from "@/lib/db";
import { generateImage } from "@/lib/openai";
import { saveBuffer } from "@/lib/storage";
import { errorMessage, publicTask } from "@/lib/tasks";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY?.trim()) return Response.json({ error: "尚未配置 OPENAI_API_KEY，请在 .env 中填写后重启服务" }, { status: 503 });
  const body = await request.json();
  const prompt = String(body.prompt ?? "").trim();
  const size = String(body.size ?? "1024x1024");
  const quality = String(body.quality ?? "medium");
  if (!prompt) return Response.json({ error: "请输入图片提示词" }, { status: 400 });
  const task = await db.task.create({ data: { type: "image", status: "processing", prompt, params: JSON.stringify({ size, quality, model: "gpt-image-2" }) } });
  try {
    const image = await generateImage(prompt, size, quality);
    const outputPath = await saveBuffer("images", `${task.id}.png`, image);
    return Response.json(publicTask(await db.task.update({ where: { id: task.id }, data: { status: "completed", outputPath } })));
  } catch (error) {
    const message = errorMessage(error);
    await db.task.update({ where: { id: task.id }, data: { status: "failed", error: message } });
    return Response.json({ error: message, taskId: task.id }, { status: 502 });
  }
}
