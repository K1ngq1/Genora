import path from "node:path";
import { isAgnesConfigured } from "@/lib/agnes";
import { isApimartConfigured } from "@/lib/apimart";
import { db } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/error-codes";
import { scheduleImageTask } from "@/lib/image-task-runner";
import { estimateCredits, getModelDefinition, normalizeModelOptions } from "@/lib/model-catalog";
import { preflightPublicImageUrl } from "@/lib/public-image-url";
import { checkGenerateRateLimit } from "@/lib/rate-limit";
import { saveBuffer } from "@/lib/storage";
import { publicTask } from "@/lib/tasks";
import { ensureVisitorId } from "@/lib/visitor";
import { getImageSize, imageQualityFallbacks, normalizeImageQuality } from "@/lib/generation-quality";

const DEFAULT_MODEL = "gpt-image-2";
const MAX_REFERENCE_SIZE = 20 * 1024 * 1024;

async function persistReference(url: string, requestUrl: string) {
  const resolved = new URL(url, requestUrl);
  if (resolved.protocol === "data:") {
    // Inline base64 image: no network request, no SSRF — decode directly with size cap.
    const dataMatch = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(resolved.href);
    if (!dataMatch) throw new AppError("INVALID_IMAGE_FORMAT", 400);
    const bytes = Buffer.from(dataMatch[2], "base64");
    if (bytes.length > MAX_REFERENCE_SIZE) throw new AppError("IMAGE_UPLOAD_TOO_LARGE", 400);
    const mime = dataMatch[1].toLowerCase();
    const extension = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
    return saveBuffer("uploads", `${crypto.randomUUID()}.${extension}`, bytes);
  }
  // http/https reference: enforce public HTTPS with per-redirect SSRF check + content-type validation.
  const preflight = await preflightPublicImageUrl(resolved.toString());
  const response = await fetch(preflight.url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new AppError("DOWNLOAD_FAILED", 400);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_REFERENCE_SIZE) throw new AppError("IMAGE_UPLOAD_TOO_LARGE", 400);
  const extension = preflight.contentType === "image/jpeg" ? "jpg" : preflight.contentType === "image/webp" ? "webp" : "png";
  const sourceExtension = path.extname(new URL(preflight.url).pathname);
  return saveBuffer("uploads", `${crypto.randomUUID()}${sourceExtension || `.${extension}`}`, bytes);
}

export async function POST(request: Request) {
  const limited = checkGenerateRateLimit(request);
  if (limited) return limited;
  const responseHeaders = new Headers();
  const visitorId = ensureVisitorId(request, responseHeaders);
  try {
    const body = await request.json();
    const prompt = String(body.prompt ?? "").trim();
    const modelId = String(body.model ?? DEFAULT_MODEL);
    if (!prompt) return errorResponse(new AppError("EMPTY_IMAGE_PROMPT", 400), 400);

    const model = getModelDefinition(modelId);
    if (model.kind !== "image") throw new AppError("UNKNOWN_ERROR", 400, "Model is not an image model");
    if (model.provider === "apimart" && !isApimartConfigured("image", model.id)) throw new AppError(model.keyScope === "dev" ? "MISSING_APIMART_DEV_KEY" : "MISSING_APIMART_IMAGE_KEY", 503);
    if (model.provider === "agnes" && !isAgnesConfigured("image")) throw new AppError("MISSING_AGNES_API_KEY", 503);

    const normalized = normalizeModelOptions(model.id, {
      ratio: String(body.aspectRatio ?? body.ratio ?? (String(body.size ?? "").includes(":") ? body.size : model.defaultRatio)),
      resolution: String(body.quality ?? body.resolution ?? model.defaultResolution),
      duration: 0,
    });
    const actualQuality = normalizeImageQuality(normalized.resolution);
    const qualityFallbacks = imageQualityFallbacks(actualQuality);
    const finalSize = getImageSize(normalized.ratio, actualQuality);
    const sourceUrls = Array.isArray(body.referenceUrls) ? body.referenceUrls.map(String).filter(Boolean) : [];
    if (sourceUrls.length && !model.supportsReferences) throw new AppError("UNSUPPORTED_MODEL_OPTIONS", 400);
    const referencePaths: string[] = [];
    for (const url of sourceUrls.slice(0, 16)) referencePaths.push(await persistReference(url, request.url));
    const estimatedCredits = estimateCredits({ model: model.id, resolution: normalized.resolution, duration: 0, hasImageInput: referencePaths.length > 0 });

    const task = await db.task.create({
      data: {
        type: "image",
        status: "pending",
        visitorId,
        prompt,
        params: JSON.stringify({
          provider: model.provider,
          model: model.id,
          ratio: normalized.ratio,
          aspectRatio: normalized.ratio,
          resolution: normalized.resolution,
          quality: normalized.resolution,
          actualQuality,
          qualityFallbacks,
          finalSize,
          size: finalSize,
          seed: Number(body.seed ?? 0),
          referencePaths,
          estimatedCredits,
        }),
      },
    });
    scheduleImageTask(task.id);
    return Response.json(publicTask(task), { headers: responseHeaders });
  } catch (error) {
    return errorResponse(error, error instanceof AppError ? error.status : 502);
  }
}
