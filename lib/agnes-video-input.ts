import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import { isSafeAssetPath, mimeFromName } from "./storage.ts";
import { AppError } from "./error-codes.ts";
import { preflightPublicImageUrl } from "./public-image-url.ts";
import { createSupabasePublicStorage } from "./supabase-storage.ts";
import { providerLog } from "./provider-log.ts";

type PublicImageFields = { startFrameUrl?: string; referenceUrls?: string[]; endFrameUrl?: string };
export type LocalAgnesImage = { path: string; originalName?: string };

export function buildAgnesImagePayloadFields(fields: PublicImageFields): Record<string, unknown> {
  const ordered = [fields.startFrameUrl, ...(fields.referenceUrls ?? []), fields.endFrameUrl].filter((url): url is string => Boolean(url));
  const urls = [...new Set(ordered)];
  if (!urls.length) return {};
  if (urls.length === 1 && !fields.endFrameUrl) return { image: urls[0] };
  return { extra_body: { image: urls } };
}

export async function prepareAgnesPublicImages(input: {
  startFrame?: LocalAgnesImage;
  references?: LocalAgnesImage[];
  endFrame?: LocalAgnesImage;
}) {
  const storage = createSupabasePublicStorage();
  const cache = new Map<string, { url: string; status: number; contentType: string }>();
  const prepare = async (image?: LocalAgnesImage) => {
    if (!image) return undefined;
    if (!isSafeAssetPath(image.path)) throw new AppError("PUBLIC_IMAGE_UPLOAD_FAILED", 400, "图片路径不在受信任的本地存储目录中");
    const cached = cache.get(image.path);
    if (cached) return cached;
    const originalName = image.originalName || basename(image.path);
    const uploaded = await storage.uploadImage({ data: await readFile(image.path), contentType: mimeFromName(image.path), originalName });
    providerLog("agnes-video", "public-image-uploaded", { localFileName: originalName, publicUrl: uploaded.publicUrl });
    const preflight = await preflightPublicImageUrl(uploaded.publicUrl, { onResponse: (result) => {
      providerLog("agnes-video", "public-image-preflight", {
        localFileName: originalName, publicUrl: result.url, status: result.status, contentType: result.contentType,
      });
    } });
    const prepared = { url: preflight.url, status: preflight.status, contentType: preflight.contentType };
    cache.set(image.path, prepared);
    return prepared;
  };
  const startFrame = await prepare(input.startFrame);
  const references = [];
  for (const image of input.references ?? []) references.push(await prepare(image));
  const endFrame = await prepare(input.endFrame);
  return {
    startFrameUrl: startFrame?.url,
    referenceUrls: references.flatMap((item) => item ? [item.url] : []),
    endFrameUrl: endFrame?.url,
    preflight: [startFrame, ...references, endFrame].filter((item): item is NonNullable<typeof item> => Boolean(item)),
  };
}
