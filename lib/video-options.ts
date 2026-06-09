export const VIDEO_FRAME_RATE = 24;
export const MAX_VIDEO_FRAMES = 441;
export const DEFAULT_VIDEO_NUM_FRAMES = 25;
export const SAFE_VIDEO_MAX_LONG_EDGE = 1024;

export function normalizeVideoFrameCount(value: number, maxFrames = MAX_VIDEO_FRAMES) {
  const safeValue = Number.isFinite(value) && value > 0 ? value : DEFAULT_VIDEO_NUM_FRAMES;
  const clamped = Math.min(maxFrames, Math.max(25, Math.round(safeValue)));
  return Math.round((clamped - 1) / 8) * 8 + 1;
}

function bytesToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function encodeAgnesImage(bytes: Uint8Array, mime = "image/png") {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}
