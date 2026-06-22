export const APIMART_API_BASE = "https://api.apimart.ai/v1";

export const APIMART_DEV_IMAGE_MODEL = "gpt-image-2-official";
export const APIMART_DEV_VIDEO_MODEL = "grok-imagine-1.5-video-apimart";

export const APIMART_DEV_MODELS = new Set([
  APIMART_DEV_IMAGE_MODEL,
  APIMART_DEV_VIDEO_MODEL,
]);

export function isApimartDevModel(model?: string) {
  return Boolean(model && APIMART_DEV_MODELS.has(model));
}
