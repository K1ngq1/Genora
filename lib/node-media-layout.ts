export type AdaptiveMediaLayout = {
  aspectRatio: number;
  width: number;
};

export function getAdaptiveMediaLayout(sourceWidth: number, sourceHeight: number): AdaptiveMediaLayout {
  const validSize = Number.isFinite(sourceWidth) && Number.isFinite(sourceHeight) && sourceWidth > 0 && sourceHeight > 0;
  const aspectRatio = validSize ? sourceWidth / sourceHeight : 1;
  if (aspectRatio >= 1.45) return { aspectRatio, width: 520 };
  if (aspectRatio <= 0.7) return { aspectRatio, width: 260 };
  if (aspectRatio < 1) return { aspectRatio, width: 300 };
  return { aspectRatio, width: 340 };
}
