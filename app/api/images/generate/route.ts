import path from "node:path";
import { isAgnesConfigured } from "@/lib/agnes";
import { isApimartConfigured } from "@/lib/apimart";
import { db } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/error-codes";
import { scheduleImageTask } from "@/lib/image-task-runner";
import { estimateCredits, getModelDefinition, normalizeModelOptions } from "@/lib/model-catalog";
import { saveBuffer } from "@/lib/storage";
import { publicTask } from "@/lib/tasks";

const DEFAULT_MODEL = "gpt-image-2";
const MAX_REFERENCE_SIZE = 20 * 1024 * 1024;

async function persistReference(url: string, requestUrl: string) {
  const resolved = new URL(url, requestUrl);
  if (!new Set(["http:", "https:", "data:"]).has(resolved.protocol)) throw new AppError("INVALID_IMAGE_FORMAT", 400);
  const response = await fetch(resolved);
  if (!response.ok) throw new AppError("DOWNLOAD_FAILED", 400);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_REFERENCE_SIZE) throw new AppError("IMAGE_UPLOAD_TOO_LARGE", 400);
  const mime = response.headers.get("content-type")?.split(";")[0] ?? "image/png";
  const extension = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
  const sourceExtension = resolved.protocol === "data:" ? "" : path.extname(resolved.pathname);
  return saveBuffer("uploads", `${crypto.randomUUID()}${sourceExtension || `.${extension}`}`, bytes);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = String(body.prompt ?? "").trim();
    const modelId = String(body.model ?? DEFAULT_MODEL);
    if (!prompt) return errorResponse(new AppError("EMPTY_IMAGE_PROMPT", 400), 400);

    const model = getModelDefinition(modelId);
    if (model.kind !== "image") throw new AppError("UNKNOWN_ERROR", 400, "Model is not an image model");
    if (model.provider === "apimart" && !isApimartConfigured("image")) throw new AppError("MISSING_APIMART_IMAGE_KEY", 503);
    if (model.provider === "agnes" && !isAgnesConfigured("image")) throw new AppError("MISSING_AGNES_API_KEY", 503);

    const normalized = normalizeModelOptions(model.id, {
      ratio: String(body.ratio ?? (String(body.size ?? "").includes(":") ? body.size : model.defaultRatio)),
      resolution: String(body.resolution ?? body.quality ?? model.defaultResolution),
      duration: 0,
    });
    const sourceUrls = Array.isArray(body.referenceUrls) ? body.referenceUrls.map(String).filter(Boolean) : [];
    if (sourceUrls.length && !model.supportsReferences) throw new AppError("IDEOGRAM_IMG2IMG_UNSUPPORTED", 400);
    const referencePaths: string[] = [];
    for (const url of sourceUrls.slice(0, 16)) referencePaths.push(await persistReference(url, request.url));
    const estimatedCredits = estimateCredits({ model: model.id, resolution: normalized.resolution, duration: 0, hasImageInput: referencePaths.length > 0 });

    const task = await db.task.create({
      data: {
        type: "image",
        status: "pending",
        prompt,
        params: JSON.stringify({
          provider: model.provider,
          model: model.id,
          ratio: normalized.ratio,
          resolution: normalized.resolution,
          size: String(body.size ?? "1024x1024"),
          seed: Number(body.seed ?? 0),
          referencePaths,
          estimatedCredits,
        }),
      },
    });
    scheduleImageTask(task.id);
    return Response.json(publicTask(task));
  } catch (error) {
    return errorResponse(error, error instanceof AppError ? error.status : 502);
  }
}
