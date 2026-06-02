import { saveBuffer } from "@/lib/storage";

const API_BASE = "https://apihub.agnes-ai.com/v1";
const SUCCESS = new Set(["completed", "complete", "succeeded", "success", "done"]);
const FAILURE = new Set(["failed", "error", "cancelled", "canceled"]);
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_RETRIES = 3;

function key() {
  const value = process.env.AGNES_API_KEY?.trim();
  if (!value) throw new Error("服务端尚未配置 AGNES_API_KEY");
  return value;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request(url: string, init?: RequestInit) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json", ...init?.headers },
    });
    const text = await response.text();
    if (response.ok) return JSON.parse(text);
    if (text.includes("data:") || text.includes("image_url")) {
      throw new Error("Agnes 无法读取本地图片数据。当前本地版需要接入公网对象存储后再使用该图片。");
    }
    if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_RETRIES) {
      const retryNote = RETRYABLE_STATUS.has(response.status) ? `，已自动重试 ${MAX_RETRIES} 次` : "";
      throw new Error(`Agnes API 请求失败 (${response.status}${retryNote}): ${text.slice(0, 300)}`);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
  }
  throw new Error("Agnes API 请求失败");
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
  if (!id) throw new Error("Agnes API 没有返回任务 ID");
  return String(id);
}

export async function syncAgnesVideo(remoteTaskId: string, localTaskId: string) {
  const result = await request(`${API_BASE}/videos/${remoteTaskId}`);
  const status = String(findValue(result, new Set(["status", "state"])) ?? "").toLowerCase();
  if (FAILURE.has(status)) return { status: "failed", error: `Agnes 视频生成失败: ${JSON.stringify(result).slice(0, 500)}` };
  const videoUrl = findValue(result, new Set(["video_url", "output_url", "download_url", "url"]));
  if (SUCCESS.has(status) || typeof videoUrl === "string") {
    if (typeof videoUrl !== "string" || !videoUrl.startsWith("http")) throw new Error("Agnes 任务已完成，但没有返回视频地址");
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error("视频下载失败");
    const outputPath = await saveBuffer("videos", `${localTaskId}.mp4`, Buffer.from(await response.arrayBuffer()));
    return { status: "completed", outputPath };
  }
  return { status: "processing" };
}
