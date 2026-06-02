export async function generateImage(prompt: string, size: string, quality: string) {
  if (!process.env.OPENAI_API_KEY) throw new Error("服务端尚未配置 OPENAI_API_KEY");
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-2", prompt, size, quality, output_format: "png" }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`OpenAI 图片生成失败 (${response.status}): ${result.error?.message ?? "未知错误"}`);
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI 图片接口没有返回图像数据");
  return Buffer.from(b64, "base64");
}

export async function generateText(prompt: string) {
  if (!process.env.OPENAI_API_KEY) throw new Error("服务端尚未配置 OPENAI_API_KEY");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-5.5", input: prompt }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`OpenAI 文本生成失败 (${response.status}): ${result.error?.message ?? "未知错误"}`);
  if (!result.output_text) throw new Error("OpenAI 文本接口没有返回内容");
  return String(result.output_text);
}
