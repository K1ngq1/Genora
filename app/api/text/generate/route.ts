import { AppError, errorCodeFromUnknown, errorResponse } from "@/lib/error-codes";
import { providerLog } from "@/lib/provider-log";
import { generateAgnesText, isAgnesConfigured } from "@/lib/agnes";
import { checkGenerateRateLimit } from "@/lib/rate-limit";
import { promptLengthResponse } from "@/lib/payload-limits";

export async function POST(request: Request) {
  const limited = checkGenerateRateLimit(request);
  if (limited) return limited;
  if (!isAgnesConfigured("text")) {
    return errorResponse(new AppError("MISSING_AGNES_API_KEY", 503), 503);
  }
  const body = await request.json();
  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) return errorResponse(new AppError("EMPTY_TEXT_PROMPT", 400), 400);
  const tooLong = promptLengthResponse(prompt);
  if (tooLong) return tooLong;
  try {
    return Response.json({ text: await generateAgnesText(prompt), model: "agnes-2.0-flash" });
  } catch (error) {
    providerLog("generate", "error", { route: "text", code: errorCodeFromUnknown(error) });
    return errorResponse(error, 502);
  }
}