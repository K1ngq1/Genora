import { readFile } from "node:fs/promises";
import { createAgnesVideo } from "@/lib/agnes";
import { db } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/error-codes";
import { mimeFromName, saveBuffer } from "@/lib/storage";
import { errorMessage, publicTask } from "@/lib/tasks";

const MAX_UPLOAD = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_NUM_FRAMES = 441;
const SAFE_VIDEO_MAX_LONG_EDGE = 1024;
const SAFE_VIDEO_MAX_FRAMES = 121;
const DEFAULT_NUM_FRAMES = 121;
const DEFAULT_FRAME_RATE = 24;

async function saveImageUpload(upload: File) {
  if (!ALLOWED.has(upload.type)) {
    throw new AppError("INVALID_IMAGE_FORMAT", 400);
  }
  if (upload.size > MAX_UPLOAD) {
    throw new AppError("IMAGE_UPLOAD_TOO_LARGE", 400);
  }
  const extension = upload.type === "image/png" ? "png" : upload.type === "image/webp" ? "webp" : "jpg";
  const path = await saveBuffer("uploads", `${crypto.randomUUID()}.${extension}`, Buffer.from(await upload.arrayBuffer()));
  return { path, mime: upload.type };
}

async function imageDataUrl(path: string, mime?: string) {
  return `data:${mime ?? mimeFromName(path)};base64,${(await readFile(path)).toString("base64")}`;
}

function publicFileUrl(path: string) {
  const base = process.env.PUBLIC_ASSET_BASE_URL?.trim();
  if (!base) return undefined;
  const normalized = path.replace(/\\/g, "/");
  const match = normalized.match(/\/storage\/(uploads|images|videos)\/([^/]+)$/);
  if (!match) return undefined;
  return `${base.replace(/\/$/, "")}/api/files/${match[1]}/${match[2]}`;
}

function normalizeNumFrames(value: number) {
  const safeValue = Number.isFinite(value) && value > 0 ? value : DEFAULT_NUM_FRAMES;
  const clamped = Math.min(MAX_NUM_FRAMES, Math.max(25, Math.round(safeValue)));
  return Math.round((clamped - 1) / 8) * 8 + 1;
}

function normalizeDimensions(width: number, height: number) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1280;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 720;
  const longEdge = Math.max(safeWidth, safeHeight);
  if (longEdge <= SAFE_VIDEO_MAX_LONG_EDGE) {
    return {
      width: Math.max(16, Math.round(safeWidth / 16) * 16),
      height: Math.max(16, Math.round(safeHeight / 16) * 16),
      downgraded: false,
    };
  }
  const scale = SAFE_VIDEO_MAX_LONG_EDGE / longEdge;
  return {
    width: Math.max(16, Math.round((safeWidth * scale) / 16) * 16),
    height: Math.max(16, Math.round((safeHeight * scale) / 16) * 16),
    downgraded: true,
  };
}

export async function POST(request: Request) {
  if (!process.env.AGNES_API_KEY?.trim()) {
    return errorResponse(new AppError("MISSING_AGNES_API_KEY", 503), 503);
  }

  const form = await request.formData();
  const prompt = String(form.get("prompt") ?? "").trim();
  if (!prompt) return errorResponse(new AppError("EMPTY_VIDEO_PROMPT", 400), 400);

  const requestedWidth = Number(form.get("width") ?? 1280);
  const requestedHeight = Number(form.get("height") ?? 720);
  const videoSize = normalizeDimensions(requestedWidth, requestedHeight);
  const requestedFrames = normalizeNumFrames(Number(form.get("numFrames") ?? form.get("frames") ?? DEFAULT_NUM_FRAMES));
  const numFrames = Math.min(SAFE_VIDEO_MAX_FRAMES, requestedFrames);
  const width = videoSize.width;
  const height = videoSize.height;
  const frameRate = Number(form.get("frameRate") ?? DEFAULT_FRAME_RATE);
  const seedText = String(form.get("seed") ?? "").trim();
  const imageTaskId = String(form.get("imageTaskId") ?? "").trim();
  const upload = form.get("image");
  const startUpload = form.get("startImage");
  const endUpload = form.get("endImage");
  const referenceUploads = form.getAll("referenceImage");
  const motionPreset = String(form.get("motionPreset") ?? "auto").trim();
  const motionPrompt = String(form.get("motionPrompt") ?? "").trim();
  let inputPath: string | undefined;
  let inputMime: string | undefined;
  let startFramePath: string | undefined;
  let startFrameMime: string | undefined;
  let endFramePath: string | undefined;
  let endFrameMime: string | undefined;
  const referenceImages: Array<{ path: string; mime: string }> = [];

  try {
    if (upload instanceof File && upload.size > 0) {
      const saved = await saveImageUpload(upload);
      inputPath = saved.path;
      inputMime = saved.mime;
    } else if (imageTaskId) {
      const imageTask = await db.task.findUnique({ where: { id: imageTaskId } });
      if (!imageTask?.outputPath || imageTask.type !== "image") {
        return errorResponse(new AppError("IMAGE_TASK_NOT_FOUND", 400), 400);
      }
      inputPath = imageTask.outputPath;
      inputMime = mimeFromName(inputPath);
    }
    if (startUpload instanceof File && startUpload.size > 0) {
      const saved = await saveImageUpload(startUpload);
      startFramePath = saved.path;
      startFrameMime = saved.mime;
    }
    if (endUpload instanceof File && endUpload.size > 0) {
      const saved = await saveImageUpload(endUpload);
      endFramePath = saved.path;
      endFrameMime = saved.mime;
    }
    for (const item of referenceUploads) {
      if (item instanceof File && item.size > 0) {
        referenceImages.push(await saveImageUpload(item));
      }
    }
  } catch (error) {
    return errorResponse(error, 400);
  }
  if (!startFramePath && referenceImages[0]) {
    startFramePath = referenceImages[0].path;
    startFrameMime = referenceImages[0].mime;
  }
  if (!endFramePath && referenceImages[1]) {
    endFramePath = referenceImages[1].path;
    endFrameMime = referenceImages[1].mime;
  }
  if (startFramePath || (!inputPath && endFramePath)) {
    inputPath = startFramePath ?? endFramePath;
    inputMime = startFrameMime ?? endFrameMime;
  }

  const params = {
    width,
    height,
    numFrames,
    frameRate,
    seed: seedText ? Number(seedText) : undefined,
    model: "agnes-video-v2.0",
    requestedWidth,
    requestedHeight,
    requestedFrames,
    hasStartFrame: Boolean(startFramePath),
    hasEndFrame: Boolean(endFramePath),
    referenceImageCount: referenceImages.length,
    motionPreset,
    downgraded: videoSize.downgraded || requestedFrames !== numFrames,
  };
  const motionInstruction = motionPrompt ? `\n\nScene motion control: ${motionPrompt}` : "";
  const effectivePrompt = `${prompt}${motionInstruction}`;
  const task = await db.task.create({
    data: {
      type: inputPath ? "image-to-video" : "text-to-video",
      status: "pending",
      prompt: effectivePrompt,
      params: JSON.stringify(params),
      inputPath,
    },
  });

  try {
    const payload: Record<string, unknown> = {
      model: "agnes-video-v2.0",
      prompt: effectivePrompt,
      width,
      height,
      num_frames: numFrames,
      frame_rate: frameRate,
    };
    if (params.seed !== undefined) payload.seed = params.seed;
    if (inputPath) {
      payload.image = await imageDataUrl(inputPath, inputMime);
    }
    const publicReferences = [startFramePath, endFramePath, ...referenceImages.slice(2).map((item) => item.path)]
      .filter((value): value is string => Boolean(value))
      .map(publicFileUrl)
      .filter((value): value is string => Boolean(value));
    if (publicReferences.length > 1) {
      payload.extra_body = {
        image: publicReferences,
      };
      payload.prompt = `${effectivePrompt}\n\nUse the provided multiple reference images to guide subject, style, scene consistency, and camera motion.`;
    } else if (startFramePath && endFramePath) {
      payload.prompt = `${effectivePrompt}\n\nUse the uploaded first image as the main Image-to-Video reference. The additional local reference image should guide visual consistency, subject identity, and intended motion.`;
    }
    console.info("[Genora] Agnes video payload", {
      mode: publicReferences.length > 1 ? "multi-image" : inputPath ? "image" : "text",
      hasImage: Boolean(inputPath),
      hasStartFrame: Boolean(startFramePath),
      hasEndFrame: Boolean(endFramePath),
      referenceImageCount: referenceImages.length,
      publicReferenceCount: publicReferences.length,
      motionPreset,
      width,
      height,
      numFrames,
      frameRate,
    });
    const remoteTaskId = await createAgnesVideo(payload);
    return Response.json(publicTask(await db.task.update({ where: { id: task.id }, data: { status: "processing", remoteTaskId } })));
  } catch (error) {
    const code = errorMessage(error);
    await db.task.update({ where: { id: task.id }, data: { status: "failed", error: code } });
    return errorResponse(error, 502);
  }
}
