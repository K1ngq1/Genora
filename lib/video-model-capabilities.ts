import {
  getModelDefinition,
  modelsForKind,
  type CanvasRatio,
  type CanvasResolution,
  type ModelProvider,
} from "./model-catalog";

export type VideoGenerationMode = "text" | "first-frame" | "first-last" | "reference";

export type VideoModelCapability = {
  modelId: string;
  provider: ModelProvider;
  supportedModes: VideoGenerationMode[];
  supportsFirstLastFrame: boolean;
  supportsReferenceImages: boolean;
  maxReferenceImages: number;
  aspectRatios: CanvasRatio[];
  resolutions: CanvasResolution[];
  durations: number[];
  defaultMode: VideoGenerationMode;
  defaultAspectRatio: CanvasRatio;
  defaultResolution: CanvasResolution;
  defaultDuration: number;
};

export const videoModeLabels: Record<VideoGenerationMode, string> = {
  text: "文生视频",
  "first-frame": "首帧",
  "first-last": "首尾帧",
  reference: "参考",
};

const preferredDurations = [5, 10];

function preferredRatio(ratios: CanvasRatio[]) {
  return ratios.includes("16:9") ? "16:9" : ratios[0] ?? "16:9";
}

function preferredResolution(resolutions: CanvasResolution[]) {
  return resolutions.includes("720p") ? "720p" : resolutions[0] ?? "720p";
}

function modelDurations(minDuration = 5, maxDuration = minDuration) {
  const durations = preferredDurations.filter((duration) => duration >= minDuration && duration <= maxDuration);
  return durations.length ? durations : [minDuration];
}

function modesForModel(modelId: string): VideoGenerationMode[] {
  const model = getModelDefinition(modelId);
  const modes: VideoGenerationMode[] = [];
  if (model.supportsStartFrame) modes.push("first-frame");
  if (model.supportsStartFrame && model.supportsEndFrame) modes.push("first-last");
  if (model.supportsReferences) modes.push("reference");
  return modes.length ? modes : ["text"];
}

function defaultModeFor(supportedModes: VideoGenerationMode[]) {
  if (supportedModes.includes("first-last")) return "first-last";
  if (supportedModes.includes("reference")) return "reference";
  return supportedModes[0] ?? "text";
}

function buildVideoModelCapability(modelId: string): VideoModelCapability {
  const model = getModelDefinition(modelId);
  const durations = modelDurations(model.minDuration, model.maxDuration);
  const supportedModes = modesForModel(model.id);
  return {
    modelId: model.id,
    provider: model.provider,
    supportedModes,
    supportsFirstLastFrame: model.supportsStartFrame && model.supportsEndFrame,
    supportsReferenceImages: model.supportsReferences,
    maxReferenceImages: model.supportsReferences ? 7 : 0,
    aspectRatios: model.ratios,
    resolutions: model.resolutions,
    durations,
    defaultMode: defaultModeFor(supportedModes),
    defaultAspectRatio: preferredRatio(model.ratios),
    defaultResolution: preferredResolution(model.resolutions),
    defaultDuration: durations.includes(5) ? 5 : durations[0] ?? 5,
  };
}

export const videoModelCapabilities: Record<string, VideoModelCapability> = Object.fromEntries(
  modelsForKind("video").map((model) => [model.id, buildVideoModelCapability(model.id)]),
);

export function getVideoModelCapabilities(modelId: string) {
  return videoModelCapabilities[modelId] ?? buildVideoModelCapability(modelId);
}

export function sanitizeVideoOptionsForModel(
  modelId: string,
  options: {
    mode?: VideoGenerationMode;
    aspectRatio?: CanvasRatio;
    resolution?: CanvasResolution;
    duration?: number;
    hasStartFrame?: boolean;
    hasEndFrame?: boolean;
    hasImageInput?: boolean;
  },
) {
  const capability = getVideoModelCapabilities(modelId);
  const availableModes = capability.supportedModes;
  const mode = options.mode && availableModes.includes(options.mode)
    ? options.mode
    : capability.defaultMode;
  const aspectRatio = options.aspectRatio && capability.aspectRatios.includes(options.aspectRatio)
    ? options.aspectRatio
    : capability.defaultAspectRatio;
  const resolution = options.resolution && capability.resolutions.includes(options.resolution)
    ? options.resolution
    : capability.defaultResolution;
  const duration = options.duration && capability.durations.includes(options.duration)
    ? options.duration
    : capability.defaultDuration;
  return { mode, aspectRatio, resolution, duration };
}
