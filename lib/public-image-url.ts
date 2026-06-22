import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "./error-codes.ts";

export const PUBLIC_IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
type LookupResult = { address: string; family: number };
type Lookup = (hostname: string) => Promise<LookupResult[]>;
type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type PublicUrlDependencies = { lookup?: Lookup };
export type PublicImagePreflightResult = { url: string; status: number; contentType: string };
type PreflightDependencies = PublicUrlDependencies & {
  fetch?: Fetch;
  timeoutMs?: number;
  maxRedirects?: number;
  onResponse?: (result: PublicImagePreflightResult) => void;
};
const defaultLookup: Lookup = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

function isPublicIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIpv6(address: string) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::" || normalized === "::1") return false;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return false;
  if (/^fe[89ab]/.test(normalized) || normalized.startsWith("ff") || normalized.startsWith("2001:db8")) return false;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mapped ? isPublicIpv4(mapped) : true;
}

export function isPublicIpAddress(address: string) {
  const normalized = address.replace(/^\[|\]$/g, "");
  const family = isIP(normalized);
  if (family === 4) return isPublicIpv4(normalized);
  if (family === 6) return isPublicIpv6(normalized);
  return false;
}

export async function assertPublicImageUrl(value: string, dependencies: PublicUrlDependencies = {}) {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError("INVALID_PUBLIC_IMAGE_URL", 400, "图片地址不是有效 URL"); }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new AppError("INVALID_PUBLIC_IMAGE_URL", 400, "图片地址必须是无认证信息的 HTTPS URL");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new AppError("INVALID_PUBLIC_IMAGE_URL", 400, "禁止使用本机图片地址");
  }
  if (isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) throw new AppError("INVALID_PUBLIC_IMAGE_URL", 400, "禁止使用内网或保留 IP");
    return url;
  }
  let addresses: LookupResult[];
  try { addresses = await (dependencies.lookup ?? defaultLookup)(hostname); }
  catch (error) { throw new AppError("INVALID_PUBLIC_IMAGE_URL", 400, `图片域名解析失败: ${String(error)}`); }
  if (!addresses.length || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new AppError("INVALID_PUBLIC_IMAGE_URL", 400, "图片域名解析到了内网或保留 IP");
  }
  return url;
}

export async function preflightPublicImageUrl(value: string, dependencies: PreflightDependencies = {}) {
  const request = dependencies.fetch ?? fetch;
  const maxRedirects = dependencies.maxRedirects ?? 3;
  let current = await assertPublicImageUrl(value, dependencies);
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    let response: Response;
    try {
      response = await request(current, {
        method: "GET", redirect: "manual", headers: { Accept: "image/jpeg,image/png,image/webp" },
        signal: AbortSignal.timeout(dependencies.timeoutMs ?? 10_000),
      });
    } catch (error) {
      throw new AppError("PUBLIC_IMAGE_PREFLIGHT_FAILED", 502, `图片 URL 预检请求失败: ${String(error)}`);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirectCount === maxRedirects) {
        throw new AppError("PUBLIC_IMAGE_PREFLIGHT_FAILED", 502, "图片 URL 重定向次数过多或缺少 Location");
      }
      current = await assertPublicImageUrl(new URL(location, current).toString(), dependencies);
      continue;
    }
    const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
    const result = { url: current.toString(), status: response.status, contentType };
    dependencies.onResponse?.(result);
    await response.body?.cancel();
    if (response.status !== 200 || !PUBLIC_IMAGE_CONTENT_TYPES.has(contentType)) {
      throw new AppError("PUBLIC_IMAGE_PREFLIGHT_FAILED", 502, `图片 URL 预检失败: HTTP ${response.status}, Content-Type ${contentType || "missing"}`);
    }
    return result;
  }
  throw new AppError("PUBLIC_IMAGE_PREFLIGHT_FAILED", 502, "图片 URL 预检失败");
}
