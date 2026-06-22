import { spawnSync } from "node:child_process";
import { APIMART_API_BASE } from "./apimart-models.ts";

type ProxyEnvironment = Record<string, string | undefined>;
const TARGET_HOST = "api.apimart.ai";

function normalizeProxy(value?: string) {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function isNoProxy(hostname: string, value?: string) {
  return String(value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean).some((entry) => {
    if (entry === "*") return true;
    const host = entry.split(":")[0].replace(/^\./, "");
    return hostname === host || hostname.endsWith(`.${host}`);
  });
}

export function proxyFromEnvironment(env: ProxyEnvironment = process.env) {
  if (isNoProxy(TARGET_HOST, env.NO_PROXY ?? env.no_proxy)) return undefined;
  return normalizeProxy(env.APIMART_PROXY_URL ?? env.HTTPS_PROXY ?? env.https_proxy ?? env.HTTP_PROXY ?? env.http_proxy);
}

function windowsSystemProxy() {
  if (process.platform !== "win32") return undefined;
  const command = [
    `$uri=[uri]'${APIMART_API_BASE}/models'`,
    "$proxy=[System.Net.WebRequest]::GetSystemWebProxy()",
    "if(-not $proxy.IsBypassed($uri)){ $proxy.GetProxy($uri).AbsoluteUri }",
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8",
    timeout: 5_000,
    windowsHide: true,
  });
  return result.status === 0 ? normalizeProxy(result.stdout.trim()) : undefined;
}

let cachedProxy: string | undefined | null = null;

export function resolveApimartProxy() {
  if (cachedProxy !== null) return cachedProxy;
  cachedProxy = proxyFromEnvironment() ?? windowsSystemProxy();
  return cachedProxy;
}
