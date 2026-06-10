import { readFile } from "node:fs/promises";
import { createAgnesVideo } from "@/lib/agnes";
import { combineGenerationPrompts } from "@/lib/prompt-options";
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
  if (!ALLOWED.has(upload.type)) throw new AppError("INVALID_IMAGE_FORMAT", 400);
  if (upload.size > MAX_UPLOAD) throw new AppError("IMAGE_UPLOAD_TOO_LARGE", 400);
  const extension = upload.type === "image/png" ? "png" : upload.type === "image/webp" ? "webp" : "jpg";
  const path = await saveBuffer("uploads", `${crypto.randomUUID()}.${extension}`, Buffer.from(await upload.arrayBuffer()));
  return { path, mime: upload.type };
}

async function imageDataUrl(path: string, mime?: string) {
  return `data:${mime ?? mimeFromName(path)};base64,${(await readFile(path)).toString("base64")}`;
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
    return { width: Math.max(16, Math.round(safeWidth / 16) * 16), height: Math.max(16, Math.round(safeHeight / 16) * 16), downgraded: false };
  }
  const scale = SAFE_VIDEO_MAX_LONG_EDGE / longEdge;
  return {
    width: Math.max(16, Math.round((safeWidth * scale) / 16) * 16),
    height: Math.max(16, Math.round((safeHeight * scale) / 16) * 16),
    downgraded: true,
  };
}

export async function POST(request: Request) {
  const form = await request.formData();
  const prompt = String(form.get("prompt") ?? "").trim();
  const negativePrompt = String(form.get("negativePrompt") ?? "").trim();
  if (!prompt) return errorResponse(new AppError("EMPTY_VIDEO_PROMPT", 400), 400);

  const requestedWidth = Number(form.get("width") ?? 1280);
  const requestedHeight = Number(form.get("height") ?? 720);
  const videoSize = normalizeDimensions(requestedWidth, requestedHeight);
  const { width, height } = videoSize;

  const requestedFrames = normalizeNumFrames(Number(form.get("numFrames") ?? form.get("frames") ?? DEFAULT_NUM_FRAMES));
  const numFrames = Math.min(requestedFrames, SAFE_VIDEO_MAX_FRAMES);
  const frameRate = Number(form.get("frameRate") ?? DEFAULT_FRAME_RATE);

  const startFrameUpload = form.get("startFrame");
  const endFrameUpload = form.get("endFrame");
  let startFramePath: string | undefined;
  let endFramePath: string | undefined;
  let inputPath: string | undefined;
  const referenceImages: Array<{ path: string; mime: string }> = [];

  try {
    if (startFrameUpload && startFrameUpload instanceof File && startFrameUpload.size > 0) {
      startFramePath = (await saveImageUpload(startFrameUpload)).path;
    }
    if (endFrameUpload && endFrameUpload instanceof File && endFrameUpload.size > 0) {
      endFramePath = (await saveImageUpload(endFrameUpload)).path;
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

  if (!startFramePath && referenceImages[0]) startFramePath = referenceImages[0].path;
  if (!endFramePath && referenceImages[1]) endFramePath = referenceImages[1].path;
  if (startFramePath || (!inputPath && endFramePath)) inputPath = startFramePath ?? endFramePath;

  const task = await db.task.create({
    data: {
      type: inputPath ? "image-to-video" : "text-to-video",
      status: "pending",
      prompt,
      params: JSON.stringify({ width, height, numFrames, frameRate, model: "agnes-video-v2.0", negativePrompt: negativePrompt || undefined }),
      inputPath,
    },
  });

  try {
    const combinedPrompt = combineGenerationPrompts(prompt, negativePrompt);
    const payload: Record<string, unknown> = {
      model: "agnes-video-v2.0",
      prompt: combinedPrompt,
      width,
      height,
      num_frames: numFrames,
      frame_rate: frameRate,
    };
    if (negativePrompt) payload.negative_prompt = negativePrompt;
    if (inputPath) payload.image = await imageDataUrl(inputPath);

    const remoteTaskId = await createAgnesVideo(payload);
    return Response.json(publicTask(await db.task.update({ where: { id: task.id }, data: { status: "queued", remoteTaskId } })));
  } catch (error) {
    const code = errorMessage(error);
    await db.task.update({ where: { id: task.id }, data: { status: "failed", error: code } });
    return errorResponse(error, 502);
  }
}