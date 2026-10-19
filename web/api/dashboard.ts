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
function isSafeDashboardPath(path: string): boolean {
  return path.startsWith("api/v1/dashboard/") &&
    path.length <= 512 &&
    /^[a-zA-Z0-9_./-]+$/.test(path) &&
    !path.includes("..") &&
    !path.includes("//") &&
    !path.endsWith("/");
}

export default async function handler(req: any, res: any) {
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(String(req.method || "").toUpperCase())) {
    res.setHeader("Allow", "GET, POST, PUT, PATCH, DELETE");
    res.status(405).json({ detail: "Method not allowed" });
    return;
  }

  // ordiumFetch currently serializes the endpoint (including its query string)
  // into the "path" parameter, e.g.:
  //   path=api/v1/dashboard/webhooks?store_id=<uuid>
  // Split it before validating so a legitimate query string isn't mistaken for
  // an unsafe path. Query parameters are encoded again by URLSearchParams below.
  const rawTarget = req.query?.path;
  const serializedTarget = Array.isArray(rawTarget) ? rawTarget.join("/") : String(rawTarget || "");
  const queryIndex = serializedTarget.indexOf("?");
  const path = queryIndex >= 0 ? serializedTarget.slice(0, queryIndex) : serializedTarget;
  const embeddedQuery = queryIndex >= 0 ? serializedTarget.slice(queryIndex + 1) : "";

  if (!isSafeDashboardPath(path)) {
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

    // Preserve query params serialized inside "path" and any normal query
    // params supplied to this proxy, without allowing either to alter the path.
    const mergedQuery = new URLSearchParams(embeddedQuery);
    for (const [key, value] of incomingUrl.searchParams) mergedQuery.append(key, value);
    target.search = mergedQuery.toString() ? `?${mergedQuery.toString()}` : "";

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
