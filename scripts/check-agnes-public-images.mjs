import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertPublicImageUrl, preflightPublicImageUrl } from "../lib/public-image-url.ts";
import { buildAgnesImagePayloadFields } from "../lib/agnes-video-input.ts";
import { createSupabasePublicStorage, isSupabasePublicStorageConfigured } from "../lib/supabase-storage.ts";
import { sanitizeLogDetail } from "../lib/provider-log.ts";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];
const rejectsCode = (action, code) => assert.rejects(action, (error) => error?.code === code);

for (const url of [
  "http://cdn.example.com/input.png", "file:///tmp/input.png", "https://localhost/input.png",
  "https://127.0.0.1/input.png", "https://10.1.2.3/input.png", "https://172.16.1.2/input.png",
  "https://192.168.1.2/input.png", "https://[::1]/input.png", "https://[fc00::1]/input.png",
  "https://[fe80::1]/input.png",
]) {
  await rejectsCode(() => assertPublicImageUrl(url, { lookup: publicLookup }), "INVALID_PUBLIC_IMAGE_URL");
}
await rejectsCode(() => assertPublicImageUrl("https://internal.example/input.png", {
  lookup: async () => [{ address: "10.0.0.5", family: 4 }],
}), "INVALID_PUBLIC_IMAGE_URL");

const validPreflight = await preflightPublicImageUrl("https://cdn.example.com/input.png", {
  lookup: publicLookup,
  fetch: async (_url, init) => {
    assert.equal(init?.redirect, "manual");
    return new Response(new Uint8Array([1]), { status: 200, headers: { "Content-Type": "image/png" } });
  },
});
assert.deepEqual(validPreflight, { url: "https://cdn.example.com/input.png", status: 200, contentType: "image/png" });

let failedPreflight;
await rejectsCode(() => preflightPublicImageUrl("https://cdn.example.com/input.png", {
  lookup: publicLookup,
  fetch: async () => new Response("missing", { status: 404, headers: { "Content-Type": "image/png" } }),
  onResponse: (result) => { failedPreflight = result; },
}), "PUBLIC_IMAGE_PREFLIGHT_FAILED");
assert.deepEqual(failedPreflight, { url: "https://cdn.example.com/input.png", status: 404, contentType: "image/png" });
await rejectsCode(() => preflightPublicImageUrl("https://cdn.example.com/input.png", {
  lookup: publicLookup,
  fetch: async () => new Response("not image", { status: 200, headers: { "Content-Type": "text/html" } }),
}), "PUBLIC_IMAGE_PREFLIGHT_FAILED");
await rejectsCode(() => preflightPublicImageUrl("https://cdn.example.com/input.png", {
  lookup: publicLookup,
  fetch: async () => new Response(null, { status: 302, headers: { Location: "https://127.0.0.1/secret" } }),
}), "INVALID_PUBLIC_IMAGE_URL");

assert.deepEqual(buildAgnesImagePayloadFields({ startFrameUrl: "https://cdn.example.com/start.png" }), {
  image: "https://cdn.example.com/start.png",
});
assert.deepEqual(buildAgnesImagePayloadFields({
  startFrameUrl: "https://cdn.example.com/start.png",
  referenceUrls: ["https://cdn.example.com/ref.png", "https://cdn.example.com/start.png"],
  endFrameUrl: "https://cdn.example.com/end.png",
}), { extra_body: { image: [
  "https://cdn.example.com/start.png", "https://cdn.example.com/ref.png", "https://cdn.example.com/end.png",
] } });
assert.deepEqual(buildAgnesImagePayloadFields({ endFrameUrl: "https://cdn.example.com/end.png" }), {
  extra_body: { image: ["https://cdn.example.com/end.png"] },
});

assert.equal(isSupabasePublicStorageConfigured({
  url: "https://project.supabase.co", serviceRoleKey: "service-role-secret", bucket: "agnes-inputs",
}), true);
assert.equal(isSupabasePublicStorageConfigured({
  url: "https://project.supabase.co", serviceRoleKey: "", bucket: "agnes-inputs",
}), false);

let uploadRequest;
const storage = createSupabasePublicStorage({
  url: "https://project.supabase.co", serviceRoleKey: "service-role-secret", bucket: "agnes-inputs",
  fetch: async (url, init) => {
    uploadRequest = { url: String(url), init };
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  },
});
const uploaded = await storage.uploadImage({
  data: Buffer.from([0x89, 0x50, 0x4e, 0x47]), contentType: "image/png", originalName: "本地首帧.png",
});
assert.match(uploaded.objectPath, /^agnes\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.png$/);
assert.equal(uploaded.publicUrl, `https://project.supabase.co/storage/v1/object/public/agnes-inputs/${uploaded.objectPath}`);
assert.equal(uploadRequest.init.method, "POST");
assert.equal(uploadRequest.init.headers.Authorization, "Bearer service-role-secret");
assert.equal(uploadRequest.init.headers["Content-Type"], "image/png");
assert.ok(!uploadRequest.url.includes("service-role-secret"));

const bucketRequests = [];
const bucketStorage = createSupabasePublicStorage({
  url: "https://project.supabase.co", serviceRoleKey: "service-role-secret", bucket: "agnes-inputs",
  fetch: async (url, init = {}) => {
    bucketRequests.push({ url: String(url), init });
    if (!init.method) return new Response(JSON.stringify({ id: "agnes-inputs", public: false }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  },
});
await bucketStorage.ensurePublicBucket();
assert.equal(bucketRequests.length, 2);
assert.equal(bucketRequests[1].init.method, "PUT");
assert.match(String(bucketRequests[1].init.body), /"public":true/);

assert.equal(sanitizeLogDetail("Authorization: Bearer abcdefghijklmnop service_role=super-secret-token"),
  "Authorization: Bearer [REDACTED] service_role=[REDACTED]");
assert.equal(
  sanitizeLogDetail('{"api_key":"top-secret-value","Authorization":"Bearer abcdefghijklmnop"}'),
  '{"api_key":"[REDACTED]","Authorization":"Bearer [REDACTED]"}',
);

const runner = await readFile("lib/video-task-runner.ts", "utf8");
const inputModule = await readFile("lib/agnes-video-input.ts", "utf8");
const route = await readFile("app/api/videos/generate/route.ts", "utf8");
const configRoute = await readFile("app/api/config/route.ts", "utf8");
assert.match(runner, /prepareAgnesPublicImages/);
assert.match(runner, /buildAgnesImagePayloadFields/);
assert.match(runner, /publicImageUrls/);
assert.match(runner, /final-payload/);
assert.doesNotMatch(runner, /payload\.image\s*=\s*await imageDataUrl/);
assert.match(route, /startFrameName/);
assert.match(route, /endFrameName/);
assert.match(route, /referenceNames/);
assert.match(configRoute, /agnesPublicImageStorageConfigured/);
assert.match(inputModule, /isSafeAssetPath/);

console.log("Agnes public image checks passed.");
