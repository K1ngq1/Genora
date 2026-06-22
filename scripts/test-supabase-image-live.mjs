import { createSupabasePublicStorage, supabasePublicStorageConfig } from "../lib/supabase-storage.ts";
import { preflightPublicImageUrl } from "../lib/public-image-url.ts";

if (process.env.SUPABASE_STORAGE_LIVE_TEST !== "1") {
  throw new Error("Set SUPABASE_STORAGE_LIVE_TEST=1 to run the real Supabase upload test.");
}

const config = supabasePublicStorageConfig();
const storage = createSupabasePublicStorage(config);
await storage.ensurePublicBucket();
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const uploaded = await storage.uploadImage({ data: onePixelPng, contentType: "image/png", originalName: "genora-storage-check.png" });
const preflight = await preflightPublicImageUrl(uploaded.publicUrl);
console.log(JSON.stringify({ bucket: config.bucket, publicUrl: uploaded.publicUrl, status: preflight.status, contentType: preflight.contentType }));
