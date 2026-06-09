export const ERROR_MESSAGES_ZH = {
  UNKNOWN_ERROR: "发生未知错误，请稍后重试。",
  INVALID_JSON_RESPONSE: "服务返回了非 JSON 内容，已阻止乱码直接显示。",
  MISSING_OPENAI_API_KEY: "尚未配置 OPENAI_API_KEY，请在 .env 中填写后重启服务。",
  MISSING_AGNES_API_KEY: "尚未配置 AGNES_API_KEY，请在 .env 中填写后重启服务。",
  EMPTY_TEXT_PROMPT: "请输入文本提示词。",
  EMPTY_IMAGE_PROMPT: "请输入图片提示词。",
  EMPTY_VIDEO_PROMPT: "请输入视频提示词。",
  EMPTY_AGENT_PROMPT: "请输入 Agent 提示词。",
  UNSUPPORTED_AGENT_MODEL: "不支持的 Agent 模型。",
  INVALID_IMAGE_FORMAT: "图片仅支持 PNG、JPEG 或 WebP 格式。",
  IMAGE_UPLOAD_TOO_LARGE: "上传图片不能超过 10 MB。",
  IMAGE_TASK_NOT_FOUND: "找不到所选图片。",
  INTERRUPTED_BY_USER: "任务已被用户打断。",
  TASK_NOT_FOUND: "任务不存在。",
  AGNES_LOCAL_IMAGE_UNSUPPORTED: "Agnes 暂时无法读取本地图片数据。当前本地 MVP 需要接入公网对象存储后再使用该图片。",
  AGNES_RATE_LIMIT: "Agnes 当前上游负载较高或请求过多，请稍后重试。",
  AGNES_SERVICE_BUSY: "Agnes 视频队列仍被远端任务占用，当前无法提交新任务。请等待远端 queued 任务结束，或更换/重置 Agnes API Key 后再试。",
  AGNES_REQUEST_TIMEOUT: "Agnes 视频接口长时间没有返回，通常是远端队列繁忙或任务卡在排队中。",
  AGNES_OUT_OF_MEMORY: "Agnes 上游显存不足，请使用 720p/1K、缩短时长，或稍后再试。",
  AGNES_CLOUDFLARE_520: "Agnes 上游网关异常 520。通常是上游服务或 Cloudflare 临时异常，不是本地参数错误。",
  AGNES_UPSTREAM_ERROR: "Agnes 上游服务请求失败。系统已自动重试，请稍后再试；如果持续失败，请降低画质或更换提示词。",
  AGNES_NO_DEPLOYMENT: "当前 Agnes 模型暂无可用部署，请检查模型名称或等待上游恢复。",
  AGNES_EMPTY_TEXT: "Agnes 2.0 Flash 没有返回文本内容。",
  AGNES_EMPTY_IMAGE: "Agnes Image 2.1 Flash 没有返回图片数据。",
  AGNES_MISSING_TASK_ID: "Agnes API 没有返回任务 ID。",
  AGNES_VIDEO_FAILED: "Agnes 视频生成失败。",
  AGNES_VIDEO_MISSING_URL: "Agnes 任务已完成，但没有返回视频地址。",
  IDEOGRAM_MISSING_HF_TOKEN: "尚未配置 HF_TOKEN，无法下载 Ideogram 4 gated 权重。",
  IDEOGRAM_MODEL_ACCESS_DENIED: "无法访问 Ideogram 4 权重。请先在 Hugging Face 接受模型协议，并确认 HF_TOKEN 有权限。",
  IDEOGRAM_NOT_INSTALLED: "Ideogram 4 本地 Python 环境尚未安装。请先在 vendor/ideogram4 中执行 pip install -e .。",
  IDEOGRAM_NF4_REQUIRES_CUDA: "Ideogram 4 nf4 需要 CUDA 显卡环境。当前是 CPU 环境，请改用 Ideogram 4 fp8 或切换到 CUDA 版 Python/PyTorch。",
  IDEOGRAM_INFERENCE_FAILED: "Ideogram 4 本地推理失败，请检查 Python 环境、显存和模型权限。",
  IDEOGRAM_IMG2IMG_UNSUPPORTED: "Ideogram 4 开源推理仓库目前只提供文生图入口，暂不支持图生图。",
  DOWNLOAD_FAILED: "下载生成结果失败，请稍后重试。",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES_ZH;

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  detail?: string;

  constructor(code: ErrorCode, status = 500, detail?: string) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in ERROR_MESSAGES_ZH;
}

export function errorCodeFromUnknown(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code;
  if (error && typeof error === "object" && "code" in error && isErrorCode((error as { code?: unknown }).code)) {
    return (error as { code: ErrorCode }).code;
  }
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (isErrorCode(message)) return message;
  if (/cuda out of memory|out of memory/i.test(message)) return "AGNES_OUT_OF_MEMORY";
  if (/no deployments available|deployment/i.test(message)) return "AGNES_NO_DEPLOYMENT";
  if (/429|rate|too many/i.test(message)) return "AGNES_RATE_LIMIT";
  if (/520|cloudflare|web server is returning an unknown error/i.test(message)) return "AGNES_CLOUDFLARE_520";
  if (/do_request_failed|upstream error|500|502|503|504/i.test(message)) return "AGNES_UPSTREAM_ERROR";
  if (/GatedRepoError|not authorized|restricted/i.test(message)) return "IDEOGRAM_MODEL_ACCESS_DENIED";
  if (/ModuleNotFoundError|No module named|ImportError/i.test(message)) return "IDEOGRAM_NOT_INSTALLED";
  if (/CUDA|bitsandbytes|nf4/i.test(message)) return "IDEOGRAM_NF4_REQUIRES_CUDA";
  if (/ENOENT|spawn|python/i.test(message)) return "IDEOGRAM_NOT_INSTALLED";
  if (/download/i.test(message)) return "DOWNLOAD_FAILED";

  return "UNKNOWN_ERROR";
}

export function errorDetail(error: unknown) {
  if (error instanceof AppError) return error.detail;
  if (error && typeof error === "object" && "detail" in error) {
    return String((error as { detail?: unknown }).detail ?? "").slice(0, 500);
  }
  if (error instanceof Error) return error.message.slice(0, 500);
  return String(error ?? "").slice(0, 500);
}

export function errorResponse(error: unknown, fallbackStatus = 502) {
  const code = errorCodeFromUnknown(error);
  const status = error instanceof AppError ? error.status : fallbackStatus;
  return Response.json({ error: code, errorCode: code, detail: errorDetail(error) }, { status });
}
