import { AppError } from "./error-codes.ts";

export const DEFAULT_AGNES_BUCKET = "agnes-inputs";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type SupabaseStorageConfig = { url: string; serviceRoleKey: string; bucket: string; fetch?: Fetch };

export function supabasePublicStorageConfig(): SupabaseStorageConfig {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
    bucket: process.env.SUPABASE_AGNES_BUCKET?.trim() || DEFAULT_AGNES_BUCKET,
  };
}

export function isSupabasePublicStorageConfigured(config = supabasePublicStorageConfig()) {
  try { return Boolean(new URL(config.url).protocol === "https:" && config.serviceRoleKey && config.bucket); }
  catch { return false; }
}

const encodeObjectPath = (path: string) => path.split("/").map(encodeURIComponent).join("/");
const extensionFor = (contentType: string) => contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";

export function createSupabasePublicStorage(config = supabasePublicStorageConfig()) {
  if (!isSupabasePublicStorageConfigured(config)) {
    throw new AppError("MISSING_PUBLIC_IMAGE_STORAGE", 503, "缺少 SUPABASE_SERVICE_ROLE_KEY 或 Supabase Storage 配置");
  }
  const baseUrl = config.url.replace(/\/+$/, "");
  const request = config.fetch ?? fetch;
  const authHeaders = { Authorization: `Bearer ${config.serviceRoleKey}`, apikey: config.serviceRoleKey };
  const bucketPayload = {
    id: config.bucket,
    name: config.bucket,
    public: true,
    file_size_limit: 10 * 1024 * 1024,
    allowed_mime_types: [...ALLOWED_IMAGE_TYPES],
  };
  return {
    async ensurePublicBucket() {
      const existing = await request(`${baseUrl}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`, { headers: authHeaders });
      if (existing.ok) {
        const current = await existing.json().catch(() => ({})) as { public?: boolean };
        if (current.public === true) return;
        const updated = await request(`${baseUrl}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`, {
          method: "PUT",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify(bucketPayload),
        });
        if (!updated.ok) throw new AppError("PUBLIC_IMAGE_UPLOAD_FAILED", 502, `更新 Supabase Bucket 失败: HTTP ${updated.status}`);
        return;
      }
      if (existing.status !== 404) throw new AppError("PUBLIC_IMAGE_UPLOAD_FAILED", 502, `检查 Supabase Bucket 失败: HTTP ${existing.status}`);
      const created = await request(`${baseUrl}/storage/v1/bucket`, {
        method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(bucketPayload),
      });
      if (!created.ok && created.status !== 409) {
        throw new AppError("PUBLIC_IMAGE_UPLOAD_FAILED", 502, `创建 Supabase Bucket 失败: HTTP ${created.status}`);
      }
    },
    async uploadImage(input: { data: Uint8Array; contentType: string; originalName: string }) {
      if (!ALLOWED_IMAGE_TYPES.has(input.contentType)) throw new AppError("INVALID_IMAGE_FORMAT", 400);
      const day = new Date().toISOString().slice(0, 10);
      const objectPath = `agnes/${day}/${crypto.randomUUID()}.${extensionFor(input.contentType)}`;
      const encodedPath = encodeObjectPath(objectPath);
      const response = await request(`${baseUrl}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodedPath}`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": input.contentType, "x-upsert": "false", "x-original-filename": encodeURIComponent(input.originalName) },
        body: new Blob([new Uint8Array(input.data)], { type: input.contentType }),
      });
      if (!response.ok) throw new AppError("PUBLIC_IMAGE_UPLOAD_FAILED", 502, `上传 Supabase Storage 失败: HTTP ${response.status}`);
      return { objectPath, publicUrl: `${baseUrl}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${encodedPath}` };
    },
  };
}
