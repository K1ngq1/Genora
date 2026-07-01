// Anonymous visitor id via httpOnly cookie.
// Used to scope tasks to a browser when there is no auth system.

const VISITOR_COOKIE = "genora_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function getVisitorId(request: Request): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)genora_visitor=([^;]+)/);
  return match?.[1];
}

/**
 * Returns the existing visitor id from the cookie, or generates a new one and
 * queues the Set-Cookie header onto `headers` so the caller can pass it to its Response.
 */
export function ensureVisitorId(request: Request, headers: Headers = new Headers()): string {
  const existing = getVisitorId(request);
  if (existing) return existing;
  const id = crypto.randomUUID();
  headers.append(
    "Set-Cookie",
    `${VISITOR_COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${VISITOR_MAX_AGE}`,
  );
  return id;
}
