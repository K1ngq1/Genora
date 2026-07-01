import { generateAgnesImage, generateAgnesMessages, generateAgnesMessagesWithTools, generateAgnesText, isAgnesConfigured } from "@/lib/agnes";
import { AppError, errorCodeFromUnknown, errorResponse } from "@/lib/error-codes";
import { providerLog } from "@/lib/provider-log";
import { checkGenerateRateLimit } from "@/lib/rate-limit";
import { promptLengthResponse } from "@/lib/payload-limits";
import { saveBuffer, storageUrl } from "@/lib/storage";

const TEXT_MODEL = "agnes-2.0-flash";
const IMAGE_MODEL = "agnes-image-2.1-flash";

export async function POST(request: Request) {
  const limited = checkGenerateRateLimit(request);
  if (limited) return limited;
  if (!isAgnesConfigured("text") && !isAgnesConfigured("image")) {
    return errorResponse(new AppError("MISSING_AGNES_API_KEY", 503), 503);
  }
  const body = await request.json();
  const model = String(body.model ?? TEXT_MODEL);
  const prompt = String(body.prompt ?? "").trim();
  const messages = Array.isArray(body.messages) ? body.messages : undefined;
  if (!prompt && !messages?.length) return errorResponse(new AppError("EMPTY_AGENT_PROMPT", 400), 400);
  const tooLong = promptLengthResponse(prompt);
  if (tooLong) return tooLong;
  try {
    if (model === TEXT_MODEL) {
      const tools = Array.isArray(body.tools) ? body.tools : undefined;
      if (tools?.length && messages?.length) {
        const message = await generateAgnesMessagesWithTools(messages, tools);
        return Response.json({ model, text: message.content, tool_calls: message.tool_calls, raw: message.raw });
      }
      const text = messages?.length ? await generateAgnesMessages(messages) : await generateAgnesText(prompt);
      return Response.json({ model, text });
    }
    if (model === IMAGE_MODEL) {
      const outputPath = await saveBuffer("images", `agent-${crypto.randomUUID()}.png`, await generateAgnesImage(prompt));
      return Response.json({ model, outputUrl: storageUrl(outputPath) });
    }
    return errorResponse(new AppError("UNSUPPORTED_AGENT_MODEL", 400), 400);
  } catch (error) {
    providerLog("generate", "error", { route: "agent", code: errorCodeFromUnknown(error) });
    return errorResponse(error, 502);
  }
}