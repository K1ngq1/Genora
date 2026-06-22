export const IMAGE_ASPECT_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16"] as const;
export const IMAGE_QUALITIES = ["1k", "2k"] as const;

export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];
export type RequestedImageQuality = ImageQuality | "adaptive" | "standard" | "hd" | "ultra" | "720p" | "1080p" | "4k";

// Gemini-native output sizes. These preserve each aspect ratio while quality changes.
const IMAGE_SIZE_MAP: Record<ImageAspectRatio, Record<ImageQuality, string>> = {
  "1:1": { "1k": "1024x1024", "2k": "2048x2048" },
  "4:3": { "1k": "1184x864", "2k": "2368x1728" },
  "3:4": { "1k": "864x1184", "2k": "1728x2368" },
  "16:9": { "1k": "1344x768", "2k": "2688x1536" },
  "9:16": { "1k": "768x1344", "2k": "1536x2688" },
};

export function normalizeImageAspectRatio(value: unknown): ImageAspectRatio {
  const candidate = String(value ?? "16:9") as ImageAspectRatio;
  return IMAGE_ASPECT_RATIOS.includes(candidate) ? candidate : "16:9";
}

export function normalizeImageQuality(value: unknown): ImageQuality {
  const candidate = String(value ?? "1k").toLowerCase() as RequestedImageQuality;
  if (candidate === "2k" || candidate === "hd" || candidate === "ultra" || candidate === "4k" || candidate === "adaptive") return "2k";
  return "1k";
}

export function getImageSize(aspectRatio: unknown, quality: unknown) {
  const ratio = normalizeImageAspectRatio(aspectRatio);
  return IMAGE_SIZE_MAP[ratio][normalizeImageQuality(quality)];
}

export function imageQualityFallbacks(quality: unknown): ImageQuality[] {
  return normalizeImageQuality(quality) === "2k" ? ["2k", "1k"] : ["1k"];
}

export function nextImageQuality(quality: unknown): ImageQuality | null {
  return normalizeImageQuality(quality) === "2k" ? "1k" : null;
}

export type VideoQuality = "480p" | "720p" | "1080p";

export function videoQualityFallbacks(quality: unknown): VideoQuality[] {
  const candidate = String(quality ?? "720p").toLowerCase();
  if (candidate === "1080p" || candidate === "ultra") return ["1080p", "720p", "480p"];
  if (candidate === "720p" || candidate === "hd" || candidate === "standard") return ["720p", "480p"];
  return ["480p"];
}

export function getVideoDimensions(aspectRatio: unknown, quality: unknown) {
  const ratio = normalizeImageAspectRatio(aspectRatio);
  const level = videoQualityFallbacks(quality)[0];
  const sizes: Record<ImageAspectRatio, Record<VideoQuality, [number, number]>> = {
    "1:1": { "480p": [480, 480], "720p": [720, 720], "1080p": [1080, 1080] },
    "4:3": { "480p": [640, 480], "720p": [960, 720], "1080p": [1440, 1080] },
    "3:4": { "480p": [480, 640], "720p": [720, 960], "1080p": [1080, 1440] },
    "16:9": { "480p": [854, 480], "720p": [1280, 720], "1080p": [1920, 1080] },
    "9:16": { "480p": [480, 854], "720p": [720, 1280], "1080p": [1080, 1920] },
  };
  const [width, height] = sizes[ratio][level];
  return { width, height, finalSize: `${width}x${height}`, quality: level, aspectRatio: ratio };
}

export function isQualityRelatedError(error: unknown) {
  const text = typeof error === "string"
    ? error
    : error instanceof Error
      ? `${error.name} ${error.message} ${"detail" in error ? String((error as Error & { detail?: unknown }).detail ?? "") : ""}`
      : JSON.stringify(error ?? "");
  const normalized = text.toLowerCase();
  if (/auth|unauthori[sz]ed|api.?key|credit|balance|payment|rate.?limit|too many requests|moderation|safety|policy|forbidden/.test(normalized)) return false;
  return /resolution|image.?size|invalid.?size|unsupported.?size|dimensions?|width|height|pixel|out of memory|oom|cuda/.test(normalized);
}

export function normalizeGenerationSpec(options: { aspectRatio?: unknown; quality?: unknown; kind: "image" | "video" }) {
  const aspectRatio = normalizeImageAspectRatio(options.aspectRatio);
  const quality = normalizeImageQuality(options.quality);
  return { aspectRatio, quality, finalSize: getImageSize(aspectRatio, quality) };
}
