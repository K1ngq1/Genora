import { AppError } from "./error-codes.ts";
import { apimartHttpRequest } from "./apimart-http.ts";
import {
  APIMART_API_BASE,
  APIMART_DEV_IMAGE_MODEL,
  APIMART_DEV_VIDEO_MODEL,
  isApimartDevModel,
} from "./apimart-models.ts";

export function sanitizeApimartDetail(value: unknown) {
  return String(value ?? "")
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]+/gi, "[REDACTED]")
    .replace(/\b(api[_ -]?key|token)\s*[:=]?\s*[A-Za-z0-9._~-]{12,}/gi, "$1 [REDACTED]")
    .slice(0, 500);
}

function upstreamMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const root = body as { error?: unknown; message?: unknown };
    if (root.error && typeof root.error === "object") {
      const message = (root.error as { message?: unknown }).message;
      if (message) return sanitizeApimartDetail(message);
    }
    if (root.message) return sanitizeApimartDetail(root.message);
  }
  return sanitizeApimartDetail(fallback);
}

type ImagePayloadOptions = {
  model: string;
  prompt: string;
  ratio: string;
  resolution: string;
  imageUrls?: string[];
};

type VideoPayloadOptions = {
  model: string;
  prompt: string;
  negativePrompt?: string;
  ratio: string;
  resolution: string;
  duration: number;
  startFrameUrl?: string;
  endFrameUrl?: string;
  referenceUrls?: string[];
};

export function buildApimartImagePayload(options: ImagePayloadOptions) {
  const payload: Record<string, unknown> = {
    model: options.model,
    prompt: options.prompt,
    size: options.ratio,
    resolution: options.resolution,
    n: 1,
    ...(options.imageUrls?.length ? { image_urls: options.imageUrls } : {}),
  };
  if (options.model === APIMART_DEV_IMAGE_MODEL) payload.quality = "low";
  return payload;
}

export function buildApimartVideoPayload(options: VideoPayloadOptions): Record<string, unknown> {
  if (options.model === APIMART_DEV_VIDEO_MODEL) {
    const imageUrls = [options.startFrameUrl, ...(options.referenceUrls ?? [])].filter((url): url is string => Boolean(url));
    return {
      model: options.model,
      prompt: options.prompt,
      size: options.ratio,
      duration: options.duration,
      quality: options.resolution.toLowerCase(),
      ...(imageUrls.length ? { image_urls: imageUrls.slice(0, 7) } : {}),
    };
  }
  if (options.model === "doubao-seedance-2.0") {
    const imageWithRoles = [
      ...(options.startFrameUrl ? [{ url: options.startFrameUrl, role: "first_frame" }] : []),
      ...(options.endFrameUrl ? [{ url: options.endFrameUrl, role: "last_frame" }] : []),
      ...(options.referenceUrls ?? []).map((url) => ({ url, role: "reference_image" })),
    ];
    return {
      model: options.model, prompt: options.prompt, size: options.ratio, resolution: options.resolution,
      duration: options.duration, generate_audio: false,
      ...(imageWithRoles.length ? { image_with_roles: imageWithRoles } : {}),
    };
  }
  if (options.model === "kling-v3-omni") {
    const imageWithRoles = [
      ...(options.startFrameUrl ? [{ url: options.startFrameUrl, role: "first_frame" }] : []),
      ...(options.endFrameUrl ? [{ url: options.endFrameUrl, role: "last_frame" }] : []),
      ...(options.referenceUrls ?? []).map((url) => ({ url, role: "reference" })),
    ];
    return {
      model: options.model, prompt: options.prompt,
      ...(options.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
      mode: options.resolution.toLowerCase() === "1080p" ? "pro" : "std",
      duration: options.duration, aspect_ratio: options.ratio,
      ...(imageWithRoles.length ? { image_with_roles: imageWithRoles } : {}),
    };
  }
  const referenceUrls = options.referenceUrls ?? [];
  return {
    model: options.model, prompt: options.prompt, resolution: options.resolution.toUpperCase(), duration: options.duration,
    ...(!options.startFrameUrl && !referenceUrls.length ? { size: options.ratio } : {}),
    ...(options.startFrameUrl ? { first_frame_image: options.startFrameUrl } : {}),
    ...(!options.startFrameUrl && referenceUrls.length ? { image_urls: referenceUrls } : {}),
  };
}

export function extractApimartTaskId(value: unknown) {
  const root = value as { data?: unknown; task_id?: unknown; id?: unknown };
  const data = Array.isArray(root?.data) ? root.data[0] : root?.data;
  const item = data as { task_id?: unknown; id?: unknown } | undefined;
  const id = item?.task_id ?? item?.id ?? root?.task_id ?? root?.id;
  if (!id) throw new AppError("APIMART_MISSING_TASK_ID", 502);
  return String(id);
}

function firstUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstUrl(item);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      const found = firstUrl(child);
      if (found) return found;
    }
  }
}

export function parseApimartTask(value: unknown) {
  const root = value as { data?: unknown };
  const data = (root?.data ?? root) as {
    status?: unknown; credits_cost?: unknown; result?: unknown; error?: { message?: unknown } | unknown;
  };
  const status = String(data.status ?? "processing").toLowerCase();
  return {
    status,
    creditsCost: Number.isFinite(Number(data.credits_cost)) ? Number(data.credits_cost) : undefined,
    outputUrl: firstUrl(data.result),
    error: data.error && typeof data.error === "object" ? String((data.error as { message?: unknown }).message ?? "APIMART_TASK_FAILED") : undefined,
  };
}

export function apimartKeyEnv(service: "image" | "video", model?: string) {
  if (isApimartDevModel(model)) return "APIMART_KEY_DEV" as const;
  return service === "image" ? "APIMART_KEY_IMAGE" as const : "APIMART_KEY_VIDEO" as const;
}

function apiKey(service: "image" | "video", model?: string) {
  const envName = apimartKeyEnv(service, model);
  const value = process.env[envName]?.trim();
  if (!value) throw new AppError(envName === "APIMART_KEY_DEV" ? "MISSING_APIMART_DEV_KEY" : service === "image" ? "MISSING_APIMART_IMAGE_KEY" : "MISSING_APIMART_VIDEO_KEY", 503);
  return value;
}

type ApimartRequestInit = { method?: string; headers?: Record<string, string>; body?: Buffer | string };

async function request(path: string, service: "image" | "video", model?: string, init?: ApimartRequestInit) {
  let response;
  try {
    response = await apimartHttpRequest(`${APIMART_API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey(service, model)}`, ...init?.headers },
    });
  } catch (error) {
    throw new AppError("APIMART_UPSTREAM_ERROR", 502, sanitizeApimartDetail(error instanceof Error ? error.message : error));
  }
  const text = response.body.toString("utf8");
  let body: unknown;
  try { body = text ? JSON.parse(text) : {}; } catch { throw new AppError("INVALID_JSON_RESPONSE", 502); }
  if (response.status < 200 || response.status >= 300) {
    const code = response.status === 402 ? "APIMART_INSUFFICIENT_CREDITS" : response.status === 429 ? "APIMART_RATE_LIMIT" : "APIMART_UPSTREAM_ERROR";
    throw new AppError(code, response.status, upstreamMessage(body, text));
  }
  return body;
}

export async function uploadApimartImage(file: Blob, filename: string, service: "image" | "video", model?: string) {
  const boundary = `----Genora${crypto.randomUUID().replaceAll("-", "")}`;
  const safeName = filename.replace(/["\r\n]/g, "-");
  const prefix = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`);
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([prefix, Buffer.from(await file.arrayBuffer()), suffix]);
  const result = await request("/uploads/images", service, model, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const url = (result as { url?: unknown }).url;
  if (!url) throw new AppError("APIMART_UPLOAD_FAILED", 502);
  return String(url);
}

export async function createApimartImage(options: ImagePayloadOptions) {
  return extractApimartTaskId(await request("/images/generations", "image", options.model, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildApimartImagePayload(options)),
  }));
}

export async function createApimartVideo(options: VideoPayloadOptions) {
  return extractApimartTaskId(await request("/videos/generations", "video", options.model, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildApimartVideoPayload(options)),
  }));
}

export async function getApimartTask(taskId: string, service: "image" | "video", model?: string) {
  return parseApimartTask(await request(`/tasks/${encodeURIComponent(taskId)}?language=zh`, service, model));
}

export async function downloadApimartFile(url: string) {
  const response = await apimartHttpRequest(url, { timeoutMs: 180_000 });
  if (response.status < 200 || response.status >= 300) throw new AppError("DOWNLOAD_FAILED", response.status || 502);
  return response.body;
}

export function isApimartConfigured(service: "image" | "video", model?: string) {
  try { apiKey(service, model); return true; } catch { return false; }
}
