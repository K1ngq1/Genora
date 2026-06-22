import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import type { Duplex } from "node:stream";
import { resolveApimartProxy } from "./apimart-proxy.ts";

type HttpResult = { status: number; headers: http.IncomingHttpHeaders; body: Buffer };
type HttpOptions = { method?: string; headers?: Record<string, string>; body?: Buffer | string; timeoutMs?: number; redirects?: number };

const agentCache = new Map<string, https.Agent>();

function createProxyAgent(proxyValue: string) {
  const cached = agentCache.get(proxyValue);
  if (cached) return cached;
  const proxy = new URL(proxyValue);
  const agent = new https.Agent({ keepAlive: true });
  agent.createConnection = ((options: Record<string, unknown>, callback: (error: Error | null, socket?: Duplex) => void) => {
    const hostname = String(options.hostname ?? options.host ?? "");
    const port = Number(options.port ?? 443);
    const headers: Record<string, string> = { Host: `${hostname}:${port}` };
    if (proxy.username || proxy.password) {
      headers["Proxy-Authorization"] = `Basic ${Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString("base64")}`;
    }
    const connector = proxy.protocol === "https:" ? https : http;
    const request = connector.request({
      hostname: proxy.hostname,
      port: Number(proxy.port || (proxy.protocol === "https:" ? 443 : 80)),
      method: "CONNECT",
      path: `${hostname}:${port}`,
      headers,
    });
    request.once("connect", (response, socket, head) => {
      if (response.statusCode !== 200) {
        socket.destroy();
        callback(new Error(`APIMART_PROXY_CONNECT_${response.statusCode ?? 0}`));
        return;
      }
      if (head.length) socket.unshift(head);
      const secureSocket = tls.connect({ socket, servername: hostname });
      secureSocket.once("secureConnect", () => callback(null, secureSocket));
      secureSocket.once("error", (error) => callback(error));
    });
    request.once("error", (error) => callback(error));
    request.setTimeout(10_000, () => request.destroy(new Error("APIMART_PROXY_CONNECT_TIMEOUT")));
    request.end();
    return undefined as unknown as Duplex;
  }) as typeof agent.createConnection;
  agentCache.set(proxyValue, agent);
  return agent;
}

export async function apimartHttpRequest(urlValue: string, options: HttpOptions = {}): Promise<HttpResult> {
  const url = new URL(urlValue);
  const proxy = resolveApimartProxy();
  const body = typeof options.body === "string" ? Buffer.from(options.body) : options.body;
  const headers = { ...options.headers };
  if (body && !Object.keys(headers).some((name) => name.toLowerCase() === "content-length")) headers["Content-Length"] = String(body.length);

  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: options.method ?? "GET",
      headers,
      agent: proxy ? createProxyAgent(proxy) : undefined,
    }, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (location && [301, 302, 303, 307, 308].includes(status) && (options.redirects ?? 3) > 0) {
        response.resume();
        void apimartHttpRequest(new URL(location, url).toString(), { ...options, redirects: (options.redirects ?? 3) - 1 }).then(resolve, reject);
        return;
      }
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => resolve({ status, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.once("error", reject);
    request.setTimeout(options.timeoutMs ?? 180_000, () => request.destroy(new Error("APIMART_REQUEST_TIMEOUT")));
    if (body) request.write(body);
    request.end();
  });
}
