import { AppError, errorResponse } from "@/lib/error-codes";
import { generateAgnesText } from "@/lib/agnes";

export async function POST(request: Request) {
  if (!process.env.AGNES_API_KEY?.trim()) {
    return errorResponse(new AppError("MISSING_AGNES_API_KEY", 503), 503);
  }

  const body = await request.json();
  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) return errorResponse(new AppError("EMPTY_TEXT_PROMPT", 400), 400);

  try {
    return Response.json({ text: await generateAgnesText(prompt), model: "agnes-2.0-flash" });
  } catch (error) {
    return errorResponse(error, 502);
  }
}
