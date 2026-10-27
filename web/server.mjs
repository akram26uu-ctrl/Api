import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDirectAccountRequest, parseProxyRequest } from "./proxy-utils.mjs";

const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "dist");
const port = Number.parseInt(process.env.PORT || "8080", 10);
const maxBodyBytes = Number.parseInt(process.env.MAX_PROXY_BODY_BYTES || "1048576", 10);

app.disable("x-powered-by");
app.use(express.raw({ type: () => true, limit: maxBodyBytes }));

function getControlPlaneBase() {
  const raw = (process.env.ORDIUM_CONTROL_PLANE_URL || "http://control-plane:8010").trim();
  const base = new URL(raw);
  const approvedInternalHttp = base.protocol === "http:"
    && base.hostname === "control-plane" && base.port === "8010";
  if (process.env.NODE_ENV === "production" && base.protocol !== "https:" && !approvedInternalHttp) {
    throw new Error("Control Plane must use HTTPS unless it is the private Compose service");
  }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) {
    throw new Error("Control Plane URL is invalid");
  }
  return base;
}

function copyRequestHeaders(req, names, bodyPresent) {
  const headers = new Headers();
  for (const name of names) {
    const value = req.headers[name];
    if (typeof value === "string") headers.set(name, value);
  }
  if (bodyPresent && !headers.has("content-type")) headers.set("content-type", "application/json");
  return headers;
}

function setProxyResponseHeaders(upstream, res, mode) {
  const names = mode === "dashboard"
    ? ["content-type", "cache-control", "x-request-id", "retry-after", "www-authenticate",
       "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"]
    : ["content-type", "cache-control", "x-request-id", "www-authenticate"];

  for (const name of names) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }

  if (mode === "account") {
    const cookies = typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : (upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie")] : []);
    if (cookies.length) res.setHeader("set-cookie", cookies);
  }
}

async function proxyRequest(req, res, mode, directAccountRoute = false) {
  const allowedMethods = mode === "dashboard"
    ? new Set(["GET", "POST", "PUT", "PATCH", "DELETE"])
    : new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

  if (!allowedMethods.has(req.method)) {
    res.setHeader("Allow", [...allowedMethods].join(", "));
    res.status(405).json({ detail: "Method not allowed" });
    return;
  }

  let parsed;
  try {
    parsed = directAccountRoute
      ? parseDirectAccountRequest(req.originalUrl)
      : parseProxyRequest(mode, req.originalUrl);
  } catch {
    res.status(404).json({ detail: mode === "dashboard" ? "Dashboard endpoint not found" : "Not found" });
    return;
  }

  let base;
  try {
    base = getControlPlaneBase();
  } catch {
    res.status(503).json({ detail: "ORDIUM account service proxy is not configured." });
    return;
  }

  const target = new URL(parsed.path, base);
  target.search = parsed.search;
  const accountHeaders = ["accept", "content-type", "cookie", "origin", "x-request-id"];
  const dashboardHeaders = [
    "accept", "content-type", "cookie", "origin", "x-request-id",
    "x-ordium-environment", "x-ordium-store-id", "x-ordium-client-version",
    "idempotency-key", "x-device-fingerprint", "x-simulation-ip",
  ];
  const hasBody = !["GET", "HEAD"].includes(req.method) && Buffer.isBuffer(req.body) && req.body.length > 0;
  const headers = copyRequestHeaders(req, mode === "account" ? accountHeaders : dashboardHeaders, hasBody);

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });

    res.status(upstream.status);
    setProxyResponseHeaders(upstream, res, mode);
    if (req.method === "HEAD" || [204, 304].includes(upstream.status)) {
      res.end();
      return;
    }
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).json({
      detail: mode === "dashboard"
        ? "Unable to reach the ORDIUM dashboard service."
        : "Unable to reach the ORDIUM account service.",
    });
  }
}

app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));

app.get("/readyz", async (_req, res) => {
  const services = [
    ["control-plane", "http://control-plane:8010/healthz"],
    ["api", "http://api:8000/readyz"],
  ];
  const checks = await Promise.all(services.map(async ([name, url]) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
      return { name, ok: response.ok };
    } catch {
      return { name, ok: false };
    }
  }));
  const ready = checks.every((item) => item.ok);
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready", checks });
});

app.all("/api/account", (req, res) => proxyRequest(req, res, "account"));
app.all("/api/account/*", (req, res) => proxyRequest(req, res, "account", true));
app.all("/api/dashboard", (req, res) => proxyRequest(req, res, "dashboard"));
app.use("/api", (_req, res) => res.status(404).json({ detail: "Not found" }));
app.use(express.static(dist, { index: false, maxAge: "1h" }));

app.get("*", (req, res, next) => {
  if (req.method !== "GET" || !req.accepts("html")) {
    res.status(404).end();
    return;
  }
  res.sendFile(path.join(dist, "index.html"), (error) => {
    if (error) next(error);
  });
});

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large") {
    res.status(413).json({ detail: "Request body is too large." });
    return;
  }
  res.status(500).json({ detail: "Internal server error." });
});

app.listen(port, "0.0.0.0", () => {
  console.log("ORDIUM web server listening on port " + port);
});
