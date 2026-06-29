import {
  MODEL_CATALOG,
  modelsForKind,
  type CanvasRatio,
  type CanvasResolution,
  type GenerationKind,
} from "@/lib/model-catalog";

export type HomeMode = Extract<GenerationKind, "image" | "video">;
export { modelsForKind };

export const HOME_LOGO = "/assets/genora-logo.png";
export const MODEL_COUNT = MODEL_CATALOG.length;
export const RATIOS: CanvasRatio[] = ["1:1", "4:3", "3:4", "16:9", "9:16"];
export const RESOLUTIONS: CanvasResolution[] = ["480p", "720p", "1080p", "1k", "2k", "4k", "adaptive"];
export const MOTION_PRESETS = [
  { id: "auto", label: "自动镜头" },
  { id: "push-in", label: "缓慢推进" },
  { id: "pull-out", label: "缓慢拉远" },
  { id: "pan-left", label: "向左横移" },
  { id: "pan-right", label: "向右横移" },
  { id: "orbit-left", label: "左侧环绕" },
  { id: "orbit-right", label: "右侧环绕" },
];

export function modeLabel(mode: HomeMode) {
  return mode === "image" ? "图像生成" : "视频生成";
}

export function selectedModelFor(mode: HomeMode, modelId: string) {
  return modelsForKind(mode).find((model) => model.id === modelId) ?? modelsForKind(mode)[0];
}

export function optionLabel(value: CanvasResolution) {
  return value === "adaptive" ? "自适应" : value.toUpperCase();
}

export function statusLabel(status: string) {
  switch (status) {
    case "pending": return "等待提交";
    case "submitting": return "提交中";
    case "queued": return "排队中";
    case "processing": return "生成中";
    case "downloading": return "下载结果";
    case "completed": return "已完成";
    case "failed": return "生成失败";
    case "cancelled": return "已取消";
    case "timeout": return "生成超时";
    default: return String(status || "生成中");
  }
}

export function responseError(body: Record<string, unknown>, fallback: string) {
  return String(body.errorCode ?? body.error ?? body.detail ?? fallback);
}
