import { db } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/error-codes";
import { getUserId } from "@/lib/get-user-id";
import { saveBuffer } from "@/lib/storage";
import { publicTask } from "@/lib/tasks";
import { scheduleVideoTask } from "@/lib/video-task-runner";
import { ensureBackgroundVideoPolling } from "@/lib/video-task-sync";
import { isApimartConfigured } from "@/lib/apimart";
import { estimateCredits, getModelDefinition, normalizeModelOptions } from "@/lib/model-catalog";
import { isSupabasePublicStorageConfigured } from "@/lib/supabase-storage";
import { getVideoDimensions, videoQualityFallbacks } from "@/lib/generation-quality";

const MAX_UPLOAD = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_NUM_FRAMES = 441;
const SAFE_VIDEO_MAX_FRAMES = 121;
const DEFAULT_NUM_FRAMES = 121;
const DEFAULT_FRAME_RATE = 24;

async function saveImageUpload(upload: File) {
  if (!ALLOWED.has(upload.type)) throw new AppError("INVALID_IMAGE_FORMAT", 400);
  if (upload.size > MAX_UPLOAD) throw new AppError("IMAGE_UPLOAD_TOO_LARGE", 400);
  const extension = upload.type === "image/png" ? "png" : upload.type === "image/webp" ? "webp" : "jpg";
  const path = await saveBuffer("uploads", `${crypto.randomUUID()}.${extension}`, Buffer.from(await upload.arrayBuffer()));
  return { path, mime: upload.type, originalName: upload.name };
}

function normalizeNumFrames(value: number) {
  const safeValue = Number.isFinite(value) && value > 0 ? value : DEFAULT_NUM_FRAMES;
  const clamped = Math.min(MAX_NUM_FRAMES, Math.max(25, Math.round(safeValue)));
  return Math.round((clamped - 1) / 8) * 8 + 1;
}

export async function POST(request: Request) {
  const userId = await getUserId();
  const form = await request.formData();
  const prompt = String(form.get("prompt") ?? "").trim();
  const negativePrompt = String(form.get("negativePrompt") ?? "").trim();
  if (!prompt) return errorResponse(new AppError("EMPTY_VIDEO_PROMPT", 400), 400);

  const modelId = String(form.get("model") ?? "kling-v3-omni");
  let model;
  try {
    model = getModelDefinition(modelId);
    if (model.kind !== "video") throw new AppError("UNSUPPORTED_MODEL_OPTIONS", 400);
    if (model.provider === "apimart" && !isApimartConfigured("video", model.id)) throw new AppError(model.keyScope === "dev" ? "MISSING_APIMART_DEV_KEY" : "MISSING_APIMART_VIDEO_KEY", 503);
  } catch (error) {
    return errorResponse(error, error instanceof AppError ? error.status : 400);
  }
  const normalized = normalizeModelOptions(model.id, {
    ratio: String(form.get("aspectRatio") ?? form.get("ratio") ?? "16:9"),
    resolution: String(form.get("quality") ?? form.get("resolution") ?? model.defaultResolution),
    duration: Number(form.get("duration") ?? 5),
  });

  const videoSize = getVideoDimensions(normalized.ratio, normalized.resolution);
  const { width, height } = videoSize;

  const requestedFrames = normalizeNumFrames(Number(form.get("numFrames") ?? form.get("frames") ?? DEFAULT_NUM_FRAMES));
  const numFrames = Math.min(requestedFrames, SAFE_VIDEO_MAX_FRAMES);
  const frameRate = Number(form.get("frameRate") ?? DEFAULT_FRAME_RATE);

  let startFramePath: string | undefined;
  let endFramePath: string | undefined;
  let startFrameName: string | undefined;
  let endFrameName: string | undefined;
  let inputPath: string | undefined;
  const referenceImages: Array<{ path: string; mime: string; originalName: string }> = [];

  try {
    const startFrameUpload = form.get("startFrame");
    const endFrameUpload = form.get("endFrame");
    if (startFrameUpload && startFrameUpload instanceof File && startFrameUpload.size > 0) {
      const saved = await saveImageUpload(startFrameUpload);
      startFramePath = saved.path;
      startFrameName = saved.originalName;
    }
    if (endFrameUpload && endFrameUpload instanceof File && endFrameUpload.size > 0) {
      const saved = await saveImageUpload(endFrameUpload);
      endFramePath = saved.path;
      endFrameName = saved.originalName;
    }
    const refUploads = form.getAll("referenceImages");
    for (const item of refUploads) {
      if (item instanceof File && item.size > 0) {
        referenceImages.push(await saveImageUpload(item));
      }
    }
  } catch (error) {
    return errorResponse(error, 400);
  }

  if (!startFramePath && referenceImages[0]) {
    startFramePath = referenceImages[0].path;
    startFrameName = referenceImages[0].originalName;
  }
  if (!endFramePath && referenceImages[1]) {
    endFramePath = referenceImages[1].path;
    endFrameName = referenceImages[1].originalName;
  }
  if (startFramePath || (!inputPath && endFramePath)) inputPath = startFramePath ?? endFramePath;

  if (startFramePath && !model.supportsStartFrame) return errorResponse(new AppError("UNSUPPORTED_MODEL_OPTIONS", 400), 400);
  if (endFramePath && !model.supportsEndFrame) return errorResponse(new AppError("UNSUPPORTED_MODEL_OPTIONS", 400), 400);
  if (model.provider === "apimart" && endFramePath && !startFramePath) return errorResponse(new AppError("UNSUPPORTED_MODEL_OPTIONS", 400), 400);
  if (referenceImages.length && !model.supportsReferences) return errorResponse(new AppError("UNSUPPORTED_MODEL_OPTIONS", 400), 400);
  if (model.id === "happyhorse-1.0" && startFramePath && referenceImages.length > 1) {
    return errorResponse(new AppError("UNSUPPORTED_MODEL_OPTIONS", 400), 400);
  }
  if (model.provider === "agnes" && (startFramePath || endFramePath || referenceImages.length) && !isSupabasePublicStorageConfigured()) {
    return errorResponse(new AppError("MISSING_PUBLIC_IMAGE_STORAGE", 503), 503);
  }
  const estimatedCredits = estimateCredits({
    model: model.id,
    resolution: normalized.resolution,
    duration: normalized.duration,
    hasImageInput: Boolean(startFramePath || endFramePath || referenceImages.length),
  });

  const task = await db.task.create({
    data: {
      userId,
      type: inputPath ? "image-to-video" : "text-to-video",
      status: "pending",
      prompt,
      params: JSON.stringify({
        provider: model.provider,
        width,
        height,
        numFrames,
        frameRate,
        model: model.id,
        ratio: normalized.ratio,
        aspectRatio: normalized.ratio,
        resolution: normalized.resolution,
        quality: normalized.resolution,
        actualQuality: normalized.resolution,
        qualityFallbacks: videoQualityFallbacks(normalized.resolution).filter((quality) => model.resolutions.includes(quality)),
        finalSize: videoSize.finalSize,
        duration: normalized.duration,
        negativePrompt: negativePrompt || undefined,
        startFramePath,
        startFrameName,
        endFramePath,
        endFrameName,
        referencePaths: referenceImages.map((item) => item.path),
        referenceNames: referenceImages.map((item) => item.originalName),
        estimatedCredits,
      }),
      inputPath,
    },
  });

  scheduleVideoTask(task.id);
  ensureBackgroundVideoPolling();

  return Response.json(publicTask(task));
}
