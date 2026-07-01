// IP-based fixed-window rate limiting for write/generate endpoints.
// In-memory per server instance: sufficient for the current single-instance
// SQLite deployment, but NOT shared across instances. If we scale to multiple
// instances or serverless concurrency, replace `buckets` with a shared store
// such as Redis or Upstash Ratelimit so limits hold globally.

import { providerLog } from "@/lib/provider-log";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? "unknown";
}

/** Fixed-window rate limit. Returns true when allowed, false when over the limit. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

// Guest generation: 3 requests per minute per IP (tune via env if needed).
export const GENERATE_RATE_LIMIT = {
  limit: Number(process.env.GENERATE_RATE_LIMIT ?? 3),
  windowMs: 60_000,
} as const;

export function rateLimitedResponse(): Response {
  return Response.json({ error: "Too many requests, please try again later." }, { status: 429 });
}

/** Returns null when allowed, or a 429 Response when over the generate rate limit. */
export function checkGenerateRateLimit(request: Request): Response | null {
  const ip = getClientIp(request);
  if (rateLimit(`generate:${ip}`, GENERATE_RATE_LIMIT.limit, GENERATE_RATE_LIMIT.windowMs)) return null;
  providerLog("rate-limit", "rejected", { ip });
  return rateLimitedResponse();
}
