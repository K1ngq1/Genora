import assert from "node:assert/strict";
import { proxyFromEnvironment, resolveApimartProxy } from "../lib/apimart-proxy.ts";

assert.equal(proxyFromEnvironment({ APIMART_PROXY_URL: "http://127.0.0.1:7897" }), "http://127.0.0.1:7897/");
assert.equal(proxyFromEnvironment({ HTTPS_PROXY: "http://proxy.example:8080" }), "http://proxy.example:8080/");
assert.equal(proxyFromEnvironment({ NO_PROXY: "api.apimart.ai", HTTPS_PROXY: "http://proxy.example:8080" }), undefined);

if (process.platform === "win32") {
  const proxy = resolveApimartProxy();
  assert.ok(proxy === undefined || /^https?:\/\//.test(proxy));
}

console.log("APIMart proxy checks passed.");
