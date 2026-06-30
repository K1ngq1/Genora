import { getImageSize } from "@/lib/generation-quality";
import { ERROR_TEXT_ZH } from "./workspace-constants";
import type { Quality, Ratio, StoredWorkData, StoredWorkNode, WorkData, WorkNode } from "./workspace-types";

export function imageSize(ratio: Ratio, quality: Quality) {
  return getImageSize(ratio, quality);
}

export function qualityLabel(quality: Quality) {
  return quality === "adaptive" ? "自适应" : quality.toUpperCase();
}

export function randomUuid(): string {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)
  );
}

export async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON_RESPONSE");
  }
}

export function localizeError(value: unknown) {
  const text = String(value ?? "UNKNOWN_ERROR");
  return ERROR_TEXT_ZH[text] ?? text;
}

export function responseError(body: Record<string, unknown>, fallback = "UNKNOWN_ERROR") {
  return localizeError(body.errorCode ?? body.error ?? fallback);
}

export function serializeWorkData(data: WorkData): StoredWorkData {
  const { uploadAsset, update, remove, generate, ...stored } = data;
  void uploadAsset;
  void update;
  void remove;
  void generate;
  return stored;
}

export function serializeWorkNode(node: WorkNode): StoredWorkNode {
  return { ...node, data: serializeWorkData(node.data) };
}

export function statusLabel(status: string): string {
  switch (status) {
    case "pending":
    case "queued":
      return "排队中";
    case "submitting":
      return "提交中";
    case "processing":
      return "生成中";
    case "downloading":
      return "即将完成";
    case "timeout":
      return "查询超时";
    default:
      return "生成中";
  }
}

const ACTIVE_TASK_STATUSES = ["pending", "submitting", "queued", "processing", "running", "downloading"];

export function mapTaskToNodePatch(task: Record<string, unknown>) {
  const status = String(task.status ?? "");
  if ((status === "completed" || status === "succeeded") && typeof task.outputUrl === "string" && task.outputUrl) {
    return {
      patch: {
        busy: false,
        url: task.outputUrl,
        result: undefined,
        error: "",
        canResume: false,
        actualCredits: typeof task.actualCredits === "number" ? task.actualCredits : null,
      } satisfies Partial<StoredWorkData>,
      shouldPoll: false,
      changed: true,
    };
  }
  if (status === "failed" || status === "cancelled") {
    const errorCode = typeof task.errorCode === "string" ? task.errorCode : undefined;
    const error = typeof task.error === "string" ? task.error : undefined;
    return {
      patch: {
        busy: false,
        result: errorCode === "TIMEOUT" ? "已超时" : "生成失败",
        error: errorCode === "TIMEOUT" ? "" : localizeError(errorCode ?? error ?? "AGNES_VIDEO_FAILED"),
        canResume: false,
        lastProviderStatus: typeof task.lastProviderStatus === "string" ? task.lastProviderStatus : status,
      } satisfies Partial<StoredWorkData>,
      shouldPoll: false,
      changed: true,
    };
  }
  if (status === "timeout") {
    const errorCode = typeof task.errorCode === "string" ? task.errorCode : undefined;
    const error = typeof task.error === "string" ? task.error : undefined;
    return {
      patch: {
        busy: false,
        result: task.canResume
          ? "查询超时"
          : `提交超时：${localizeError(errorCode ?? error ?? "AGNES_REQUEST_TIMEOUT")}`,
        error: "",
        canResume: Boolean(task.canResume),
        lastProviderStatus: typeof task.lastProviderStatus === "string" ? task.lastProviderStatus : null,
      } satisfies Partial<StoredWorkData>,
      shouldPoll: false,
      changed: true,
    };
  }
  if (ACTIVE_TASK_STATUSES.includes(status)) {
    return {
      patch: {
        busy: true,
        result: statusLabel(status),
        error: "",
        canResume: false,
        lastProviderStatus: typeof task.lastProviderStatus === "string" ? task.lastProviderStatus : status,
      } satisfies Partial<StoredWorkData>,
      shouldPoll: true,
      changed: true,
    };
  }
  return {
    patch: { busy: true, result: statusLabel(status || "processing") } satisfies Partial<StoredWorkData>,
    shouldPoll: true,
    changed: false,
  };
}
