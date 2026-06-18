import { AppError } from "./error-codes.ts";

const API_BASE = "https://api.apimart.ai/v1";

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
  return {
    model: options.model,
    prompt: options.prompt,
    size: options.ratio,
    resolution: options.resolution,
    n: 1,
    ...(options.imageUrls?.length ? { image_urls: options.imageUrls } : {}),
  };
}

export function buildApimartVideoPayload(options: VideoPayloadOptions): Record<string, unknown> {
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

function apiKey(service: "image" | "video") {
  const value = (service === "image" ? process.env.APIMART_KEY_IMAGE : process.env.APIMART_KEY_VIDEO)?.trim();
  if (!value) throw new AppError(service === "image" ? "MISSING_APIMART_IMAGE_KEY" : "MISSING_APIMART_VIDEO_KEY", 503);
  return value;
}

async function request(path: string, service: "image" | "video", init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(180_000),
    headers: { Authorization: `Bearer ${apiKey(service)}`, ...init?.headers },
  });
  const text = await response.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : {}; } catch { throw new AppError("INVALID_JSON_RESPONSE", 502); }
  if (!response.ok) {
    const code = response.status === 402 ? "APIMART_INSUFFICIENT_CREDITS" : response.status === 429 ? "APIMART_RATE_LIMIT" : "APIMART_UPSTREAM_ERROR";
    throw new AppError(code, response.status, text.slice(0, 500));
  }
  return body;
}

export async function uploadApimartImage(file: Blob, filename: string, service: "image" | "video") {
  const form = new FormData();
  form.set("file", file, filename);
  const result = await request("/uploads/images", service, { method: "POST", body: form });
  const url = (result as { url?: unknown }).url;
  if (!url) throw new AppError("APIMART_UPLOAD_FAILED", 502);
  return String(url);
}

export async function createApimartImage(options: ImagePayloadOptions) {
  return extractApimartTaskId(await request("/images/generations", "image", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildApimartImagePayload(options)),
  }));
}

export async function createApimartVideo(options: VideoPayloadOptions) {
  return extractApimartTaskId(await request("/videos/generations", "video", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildApimartVideoPayload(options)),
  }));
}

export async function getApimartTask(taskId: string, service: "image" | "video") {
  return parseApimartTask(await request(`/tasks/${encodeURIComponent(taskId)}?language=zh`, service));
}

export function isApimartConfigured(service: "image" | "video") {
  try { apiKey(service); return true; } catch { return false; }
}
