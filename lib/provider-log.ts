const SECRET_PATTERN = /\b(api[_-]?key|apikey|service[_-]?role(?:[_-]?key)?|serviceRoleKey|token|secret)\s*[:=]\s*([^\s,}]+)/gi;
const JSON_SECRET_PATTERN = /(["']?(?:api[_-]?key|apikey|service[_-]?role(?:[_-]?key)?|serviceRoleKey|token|secret)["']?\s*:\s*)["'][^"']*["']/gi;

export function sanitizeLogDetail(value: unknown) {
  return String(value ?? "")
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(JSON_SECRET_PATTERN, (_match, prefix: string) => `${prefix}"[REDACTED]"`)
    .replace(SECRET_PATTERN, (_match, name: string) => `${name}=[REDACTED]`);
}

export function providerLog(namespace: string, section: string, detail: Record<string, unknown>) {
  const safeDetail = Object.fromEntries(Object.entries(detail).map(([key, value]) => [key, sanitizeLogDetail(value)]));
  console.log(`[${new Date().toISOString()}] [${namespace}] ${section} ${JSON.stringify(safeDetail)}`);
}
