import { get } from "node:https";
import { AppError } from "@/lib/error-codes";
import { saveBuffer } from "@/lib/storage";

const API_BASE = "https://apihub.agnes-ai.com/v1";
const SUCCESS = new Set(["completed", "complete", "succeeded", "success", "done"]);
const FAILURE = new Set(["failed", "error", "cancelled", "canceled"]);
const RETRYABLE_STATUS = new Set([429, 500, 520, 522, 524, 503]);
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = Number(process.env.AGNES_REQUEST_TIMEOUT_MS ?? 180_000);

function apiKey() {
  const value = process.env.AGNES_API_KEY?.trim();
  if (!value) throw new AppError("MISSING_AGNES_API_KEY", 503);
  return value;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function stripHtml(text: string) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function agnesErrorCode(status: number, text: string) {
  if (status === 429) return "AGNES_RATE_LIMIT";
  if (/service busy|tasks:\s*\d+/i.test(text)) return "AGNES_SERVICE_BUSY";
  if (status === 520) return "AGNES_CLOUDFLARE_520";
  if (/cuda out of memory|out of memory/i.test(text)) return "AGNES_OUT_OF_MEMORY";
  if (/no deployments available|deployment/i.test(text)) return "AGNES_NO_DEPLOYMENT";
  if (/do_request_failed|upstream error/i.test(text)) return "AGNES_UPSTREAM_ERROR";
  return "AGNES_UPSTREAM_ERROR";
}

async function parseJson(text: string) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("INVALID_JSON_RESPONSE", 502, stripHtml(text).slice(0, 500));
  }
}

async function downloadBuffer(url: string) {
  try {
    const response = await fetch(url);
    if (response.ok) return Buffer.from(await response.arrayBuffer());
  } catch {
    // Fall through to the Node https fallback below.
  }

  return new Promise<Buffer>((resolve, reject) => {
    get(url, (response) => {
      if ((response.statusCode ?? 500) >= 400) {
        reject(new AppError("DOWNLOAD_FAILED", 502, String(response.statusCode)));
        response.resume();
        return;
      }
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    }).on("error", reject);
  });
}

async function request(url: string, init?: RequestInit) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(Number.isFinite(REQUEST_TIMEOUT_MS) ? REQUEST_TIMEOUT_MS : 45_000),
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "AbortError" || /timeout/i.test(error.message))) {
        throw new AppError("AGNES_REQUEST_TIMEOUT", 504, "Agnes request timed out");
      }
      throw error;
    }
    const text = await response.text();
    if (response.ok) return parseJson(text);

    if (text.includes("data:") || text.includes("image_url")) {
      throw new AppError("AGNES_LOCAL_IMAGE_UNSUPPORTED", 502, stripHtml(text).slice(0, 500));
    }

    if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_RETRIES) {
      const detail = stripHtml(text).slice(0, 500);
      throw new AppError(agnesErrorCode(response.status, text), response.status, detail);
    }

    const retryAfter = Number(response.headers.get("retry-after"));
    await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1200 * 2 ** attempt);
  }

  throw new AppError("AGNES_UPSTREAM_ERROR", 502);
}

export async function generateAgnesText(prompt: string) {
  return generateAgnesMessages([{ role: "user", content: prompt }]);
}

export async function generateAgnesMessages(messages: unknown[]) {
  const result = await request(`${API_BASE}/chat/completions`, {
    method: "POST",
    body: JSON.stringify({ model: "agnes-2.0-flash", messages }),
  });
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new AppError("AGNES_EMPTY_TEXT", 502, JSON.stringify(result).slice(0, 300));
  return String(content);
}

export async function generateAgnesImage(prompt: string) {
  const result = await request(`${API_BASE}/images/generations`, {
    method: "POST",
    body: JSON.stringify({ model: "agnes-image-2.1-flash", prompt }),
  });
  const image = result.data?.[0];
  if (image?.b64_json) return Buffer.from(String(image.b64_json), "base64");
  if (image?.url) return downloadBuffer(String(image.url));
  throw new AppError("AGNES_EMPTY_IMAGE", 502, JSON.stringify(result).slice(0, 300));
}

function findValue(value: unknown, keys: Set<string>): unknown {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findValue(child, keys);
      if (found !== undefined && found !== null && found !== "") return found;
    }
  } else if (value && typeof value === "object") {
    for (const [name, child] of Object.entries(value)) {
      if (keys.has(name.toLowerCase()) && child !== undefined && child !== null && child !== "") return child;
    }
    for (const child of Object.values(value)) {
      const found = findValue(child, keys);
      if (found !== undefined && found !== null && found !== "") return found;
    }
  }
}

export async function createAgnesVideo(payload: Record<string, unknown>) {
  const result = await request(`${API_BASE}/videos`, { method: "POST", body: JSON.stringify(payload) });
  const id = findValue(result, new Set(["task_id", "id"]));
  if (!id) throw new AppError("AGNES_MISSING_TASK_ID", 502, JSON.stringify(result).slice(0, 300));
  return String(id);
}

export async function syncAgnesVideo(remoteTaskId: string, localTaskId: string) {
  const result = await request(`${API_BASE}/videos/${remoteTaskId}`);
  const status = String(findValue(result, new Set(["status", "state"])) ?? "").toLowerCase();
  if (FAILURE.has(status)) {
    return { status: "failed", error: "AGNES_VIDEO_FAILED" };
  }

  const videoUrl = findValue(result, new Set(["video_url", "output_url", "download_url", "url", "remixed_from_video_id"]));
  if (SUCCESS.has(status) || typeof videoUrl === "string") {
    if (typeof videoUrl !== "string" || !videoUrl.startsWith("http")) {
      throw new AppError("AGNES_VIDEO_MISSING_URL", 502, JSON.stringify(result).slice(0, 300));
    }
    const outputPath = await saveBuffer("videos", `${localTaskId}.mp4`, await downloadBuffer(videoUrl));
    return { status: "completed", outputPath };
  }

  return { status: "processing" };
}
