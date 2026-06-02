import { generateText } from "@/lib/openai";
import { errorMessage } from "@/lib/tasks";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY?.trim()) return Response.json({ error: "尚未配置 OPENAI_API_KEY，请在 .env 中填写后重启服务" }, { status: 503 });
  const body = await request.json();
  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) return Response.json({ error: "请输入文本提示词" }, { status: 400 });
  try {
    return Response.json({ text: await generateText(prompt), model: "gpt-5.5" });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 502 });
  }
}
