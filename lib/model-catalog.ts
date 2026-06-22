import { APIMART_DEV_IMAGE_MODEL, APIMART_DEV_VIDEO_MODEL } from "./apimart-models.ts";

export type GenerationKind = "image" | "video";
export type ModelProvider = "apimart" | "agnes" | "ideogram";
export type CanvasRatio = "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
export type CanvasResolution = "480p" | "720p" | "1080p" | "1k" | "2k" | "4k";

type FreePricing = { type: "free" };
type FixedPricing = {
  type: "fixed";
  credits: Partial<Record<CanvasResolution, number>>;
  inputCredits?: Partial<Record<CanvasResolution, number>>;
};
type PerSecondPricing = {
  type: "per-second";
  credits: Partial<Record<CanvasResolution, number>>;
  inputCredits?: Partial<Record<CanvasResolution, number>>;
};

export type ModelDefinition = {
  id: string;
  label: string;
  kind: GenerationKind;
  provider: ModelProvider;
  keyScope?: "dev";
  free: boolean;
  ratios: CanvasRatio[];
  resolutions: CanvasResolution[];
  defaultRatio: CanvasRatio;
  defaultResolution: CanvasResolution;
  minDuration?: number;
  maxDuration?: number;
  supportsStartFrame: boolean;
  supportsEndFrame: boolean;
  supportsReferences: boolean;
  supportsNegativePrompt: boolean;
  pricing: FreePricing | FixedPricing | PerSecondPricing;
};

const ALL_RATIOS: CanvasRatio[] = ["1:1", "4:3", "3:4", "16:9", "9:16"];

export const MODEL_CATALOG: ModelDefinition[] = [
  {
    id: "gemini-2.5-flash-image-preview", label: "Gemini 2.5 Flash", kind: "image", provider: "apimart", free: false,
    ratios: ALL_RATIOS, resolutions: ["1k"], defaultRatio: "1:1", defaultResolution: "1k",
    supportsStartFrame: false, supportsEndFrame: false, supportsReferences: true, supportsNegativePrompt: false,
    pricing: { type: "fixed", credits: { "1k": 0.125 } },
  },
  {
    id: "gpt-image-2", label: "GPT Image 2", kind: "image", provider: "apimart", free: false,
    ratios: ALL_RATIOS, resolutions: ["1k", "2k", "4k"], defaultRatio: "1:1", defaultResolution: "1k",
    supportsStartFrame: false, supportsEndFrame: false, supportsReferences: true, supportsNegativePrompt: false,
    pricing: { type: "fixed", credits: { "1k": 0.06, "2k": 0.12, "4k": 0.18 } },
  },
  {
    id: APIMART_DEV_IMAGE_MODEL, label: "GPT Image 2 Official · Dev", kind: "image", provider: "apimart", keyScope: "dev", free: false,
    ratios: ["1:1"], resolutions: ["1k"], defaultRatio: "1:1", defaultResolution: "1k",
    supportsStartFrame: false, supportsEndFrame: false, supportsReferences: true, supportsNegativePrompt: false,
    pricing: { type: "fixed", credits: { "1k": 0.0488 }, inputCredits: { "1k": 0.08508 } },
  },
  {
    id: "doubao-seedance-2.0", label: "Seedance 2.0", kind: "video", provider: "apimart", free: false,
    ratios: ALL_RATIOS, resolutions: ["480p", "720p", "1080p"], defaultRatio: "16:9", defaultResolution: "720p",
    minDuration: 4, maxDuration: 15, supportsStartFrame: true, supportsEndFrame: true, supportsReferences: true, supportsNegativePrompt: false,
    pricing: {
      type: "per-second",
      credits: { "480p": 0.7256, "720p": 1.5616, "1080p": 3.52 },
      inputCredits: { "480p": 0.44, "720p": 0.944, "1080p": 2.136 },
    },
  },
  {
    id: "kling-v3-omni", label: "Kling v3 Omni", kind: "video", provider: "apimart", free: false,
    ratios: ["1:1", "16:9", "9:16"], resolutions: ["720p", "1080p"], defaultRatio: "16:9", defaultResolution: "720p",
    minDuration: 3, maxDuration: 15, supportsStartFrame: true, supportsEndFrame: true, supportsReferences: true, supportsNegativePrompt: true,
    pricing: { type: "per-second", credits: { "720p": 0.672, "1080p": 0.896 } },
  },
  {
    id: "happyhorse-1.0", label: "HappyHorse 1.0", kind: "video", provider: "apimart", free: false,
    ratios: ALL_RATIOS, resolutions: ["720p", "1080p"], defaultRatio: "16:9", defaultResolution: "720p",
    minDuration: 3, maxDuration: 15, supportsStartFrame: true, supportsEndFrame: false, supportsReferences: true, supportsNegativePrompt: false,
    pricing: { type: "per-second", credits: { "720p": 1.3, "1080p": 2.3 } },
  },
  {
    id: APIMART_DEV_VIDEO_MODEL, label: "Grok Imagine 1.5 Video · Dev", kind: "video", provider: "apimart", keyScope: "dev", free: false,
    ratios: ["1:1", "16:9", "9:16"], resolutions: ["480p", "720p"], defaultRatio: "16:9", defaultResolution: "480p",
    minDuration: 6, maxDuration: 30, supportsStartFrame: true, supportsEndFrame: false, supportsReferences: true, supportsNegativePrompt: false,
    pricing: { type: "per-second", credits: { "480p": 0.07, "720p": 0.07 } },
  },
  {
    id: "agnes-image-2.1-flash", label: "Agnes Image 2.1 Flash", kind: "image", provider: "agnes", free: true,
    ratios: ALL_RATIOS, resolutions: ["720p", "1k", "2k", "4k"], defaultRatio: "1:1", defaultResolution: "2k",
    supportsStartFrame: false, supportsEndFrame: false, supportsReferences: false, supportsNegativePrompt: false, pricing: { type: "free" },
  },
  {
    id: "ideogram-4-nf4", label: "Ideogram 4 nf4", kind: "image", provider: "ideogram", free: true,
    ratios: ALL_RATIOS, resolutions: ["720p", "1k", "2k", "4k"], defaultRatio: "1:1", defaultResolution: "2k",
    supportsStartFrame: false, supportsEndFrame: false, supportsReferences: false, supportsNegativePrompt: false, pricing: { type: "free" },
  },
  {
    id: "ideogram-4-fp8", label: "Ideogram 4 fp8", kind: "image", provider: "ideogram", free: true,
    ratios: ALL_RATIOS, resolutions: ["720p", "1k", "2k", "4k"], defaultRatio: "1:1", defaultResolution: "2k",
    supportsStartFrame: false, supportsEndFrame: false, supportsReferences: false, supportsNegativePrompt: false, pricing: { type: "free" },
  },
  {
    id: "agnes-video-v2.0", label: "Agnes Video V2.0", kind: "video", provider: "agnes", free: true,
    ratios: ALL_RATIOS, resolutions: ["720p", "1k"], defaultRatio: "16:9", defaultResolution: "1k",
    minDuration: 1, maxDuration: 18, supportsStartFrame: true, supportsEndFrame: true, supportsReferences: true, supportsNegativePrompt: true, pricing: { type: "free" },
  },
];

export function getModelDefinition(id: string) {
  const model = MODEL_CATALOG.find((item) => item.id === id);
  if (!model) throw new Error(`UNSUPPORTED_MODEL:${id}`);
  return model;
}

export function modelsForKind(kind: GenerationKind) {
  return MODEL_CATALOG.filter((model) => model.kind === kind);
}

export function normalizeModelOptions(id: string, options: { ratio: string; resolution: string; duration: number }) {
  const model = getModelDefinition(id);
  const ratio = model.ratios.includes(options.ratio as CanvasRatio) ? options.ratio as CanvasRatio : model.defaultRatio;
  const resolution = model.resolutions.includes(options.resolution.toLowerCase() as CanvasResolution)
    ? options.resolution.toLowerCase() as CanvasResolution
    : model.defaultResolution;
  const duration = model.kind === "video"
    ? Math.min(model.maxDuration ?? options.duration, Math.max(model.minDuration ?? options.duration, Math.round(options.duration)))
    : 0;
  return { ratio, resolution, duration };
}

export function estimateCredits(options: { model: string; resolution: string; duration: number; hasImageInput: boolean }) {
  const model = getModelDefinition(options.model);
  if (model.pricing.type === "free") return 0;
  const resolution = options.resolution.toLowerCase() as CanvasResolution;
  if (model.pricing.type === "fixed") {
    const rates = options.hasImageInput && model.pricing.inputCredits ? model.pricing.inputCredits : model.pricing.credits;
    return rates[resolution] ?? 0;
  }
  const rates = options.hasImageInput && model.pricing.inputCredits ? model.pricing.inputCredits : model.pricing.credits;
  return Number(((rates[resolution] ?? 0) * options.duration).toFixed(6));
}

export function modelCapabilityLabel(model: ModelDefinition) {
  const resolution = model.resolutions.map((item) => item.toUpperCase()).join(" / ");
  if (model.kind === "image") return resolution;
  return `${resolution} · ${model.minDuration}-${model.maxDuration}s`;
}
