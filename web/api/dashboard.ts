/**
 * Same-origin dashboard proxy for Vercel.
 *
 * Dashboard API calls must keep the browser session cookie on the Web origin.
 * This server-side route forwards only the Control Plane dashboard API surface;
 * the Control Plane then applies session auth and proxies to the core API using
 * its server-side dashboard credential.
 *
 * Configure ORDIUM_CONTROL_PLANE_URL as a server-side Vercel environment
 * variable (the same target used by /api/account).
 */
const ALLOWED_PATHS = [
  /^api\/v1\/dashboard\/orders(?:\/[0-9a-fA-F-]{36})?(?:\/outcome|\/confirmation-attempts)?$/,
  /^api\/v1\/dashboard\/order-confirmations\/metrics$/,
  /^api\/v1\/dashboard\/metrics\/(?:summary|risk-performance|risk-calibration|risk-attribution|risk-backtest|risk-quality)$/,
  /^api\/v1\/dashboard\/api-keys(?:\/[0-9a-fA-F-]{36}\/(?:revoke|rotate))?$/,
  /^api\/v1\/dashboard\/stores(?:\/[0-9a-fA-F-]{36})?$/,
  /^api\/v1\/dashboard\/webhooks(?:\/[0-9a-fA-F-]{36}\/(?:disable|test))?$/,
  /^api\/v1\/dashboard\/(?:risk-profile|usage|risk-features|identity-graph|notifications|audit-logs)$/,
  /^api\/v1\/dashboard\/notifications\/[0-9a-fA-F-]{36}\/read$/,
  /^api\/v1\/dashboard\/notifications\/read-all$/,
];

export default async function handler(req: any, res: any) {
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(String(req.method || "").toUpperCase())) {
    res.setHeader("Allow", "GET, POST, PUT, PATCH, DELETE");
    res.status(405).json({ detail: "Method not allowed" });
    return;
  }

  const rawPath = req.query?.path;
  const path = Array.isArray(rawPath) ? rawPath.join("/") : String(rawPath || "");
  if (
    !ALLOWED_PATHS.some((pattern) => pattern.test(path)) ||
    path.includes("..") ||
    path.includes("\\") ||
    path.includes("%")
  ) {
    res.status(404).json({ detail: "Dashboard endpoint not found" });
    return;
  }

  const base = (
    process.env.ORDIUM_CONTROL_PLANE_URL ||
    process.env.VITE_ORDIUM_CONTROL_PLANE_URL ||
    ""
  ).trim().replace(/\/+$/, "");
  if (!base) {
    res.status(503).json({ detail: "Dashboard proxy is not configured." });
    return;
  }

  let target: URL;
  try {
    target = new URL("/" + path, base);
    const incomingUrl = new URL(req.url || "/", "https://ordium-proxy.invalid");
    incomingUrl.searchParams.delete("path");
    target.search = incomingUrl.search;
    if (target.protocol !== "https:" && process.env.NODE_ENV === "production") {
      res.status(500).json({ detail: "Control Plane must use HTTPS in production." });
      return;
    }
  } catch {
    res.status(500).json({ detail: "Invalid Control Plane configuration." });
    return;
  }

  const headers = new Headers();
  for (const name of [
    "accept",
    "content-type",
    "cookie",
    "origin",
    "x-request-id",
    "x-ordium-environment",
    "x-ordium-store-id",
    "x-ordium-client-version",
    "idempotency-key",
    "x-device-fingerprint",
    "x-simulation-ip",
  ]) {
    const value = req.headers?.[name];
    if (typeof value === "string") headers.set(name, value);
  }

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined) {
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });
    res.status(upstream.status);
    for (const name of [
      "content-type",
      "cache-control",
      "x-request-id",
      "retry-after",
      "www-authenticate",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "x-ratelimit-reset",
    ]) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }

    if (upstream.status === 204 || upstream.status === 304) {
      res.end();
      return;
    }
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).json({ detail: "Unable to reach the ORDIUM dashboard service." });
  }
}
