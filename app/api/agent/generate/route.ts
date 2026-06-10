import { generateAgnesImage, generateAgnesMessages, generateAgnesText, isAgnesConfigured } from "@/lib/agnes";
import { AppError, errorResponse } from "@/lib/error-codes";
import { saveBuffer, storageUrl } from "@/lib/storage";

const TEXT_MODEL = "agnes-2.0-flash";
const IMAGE_MODEL = "agnes-image-2.1-flash";

export async function POST(request: Request) {
  if (!isAgnesConfigured("text") && !isAgnesConfigured("image")) {
    return errorResponse(new AppError("MISSING_AGNES_API_KEY", 503), 503);
  }
  const body = await request.json();
  const model = String(body.model ?? TEXT_MODEL);
  const prompt = String(body.prompt ?? "").trim();
  const messages = Array.isArray(body.messages) ? body.messages : undefined;
  if (!prompt && !messages?.length) return errorResponse(new AppError("EMPTY_AGENT_PROMPT", 400), 400);
  try {
    if (model === TEXT_MODEL) {
      const text = messages?.length ? await generateAgnesMessages(messages) : await generateAgnesText(prompt);
      return Response.json({ model, text });
    }
    if (model === IMAGE_MODEL) {
      const outputPath = await saveBuffer("images", `agent-${crypto.randomUUID()}.png`, await generateAgnesImage(prompt));
      return Response.json({ model, outputUrl: storageUrl(outputPath) });
    }
    return errorResponse(new AppError("UNSUPPORTED_AGENT_MODEL", 400), 400);
  } catch (error) {
    return errorResponse(error, 502);
  }
}