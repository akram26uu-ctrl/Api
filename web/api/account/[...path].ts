/**
 * Same-origin account-service proxy for Vercel.
 * Set ORDIUM_CONTROL_PLANE_URL as a server-side Vercel environment variable.
 */
export default async function handler(req: any, res: any) {
  const rawPath = req.query?.path;
  const path = Array.isArray(rawPath) ? rawPath.join("/") : String(rawPath || "");

  // Limit this proxy to authentication endpoints only.
  if (!path.startsWith("api/v1/auth/") || path.includes("..") || path.includes("\\")) {
    res.status(404).json({ detail: "Not found" });
    return;
  }

  const base = (process.env.ORDIUM_CONTROL_PLANE_URL || process.env.VITE_ORDIUM_CONTROL_PLANE_URL || "").trim().replace(/\/+$/, "");
  if (!base) {
    res.status(503).json({ detail: "Account service proxy is not configured." });
    return;
  }

  let target: URL;
  try {
    target = new URL("/" + path, base);
    const incomingUrl = new URL(req.url || "/", "https://ordium-proxy.invalid");
    target.search = incomingUrl.search;
    if (target.protocol !== "https:" && process.env.NODE_ENV === "production") {
      res.status(500).json({ detail: "Account service must use HTTPS in production." });
      return;
    }
  } catch {
    res.status(500).json({ detail: "Invalid account service configuration." });
    return;
  }

  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie", "origin", "x-request-id"]) {
    const value = req.headers?.[name];
    if (typeof value === "string") headers.set(name, value);
  }

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined) {
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }

  try {
    const upstream = await fetch(target, { method: req.method, headers, body, redirect: "manual" });
    res.status(upstream.status);
    for (const name of ["content-type", "cache-control", "x-request-id", "www-authenticate"]) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }

    // Preserve separate Set-Cookie headers; combining them can corrupt attributes.
    const getSetCookie = (upstream.headers as any).getSetCookie;
    const cookies = typeof getSetCookie === "function"
      ? getSetCookie.call(upstream.headers)
      : (upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie")] : []);
    if (cookies.length) res.setHeader("set-cookie", cookies);

    if (req.method === "HEAD" || upstream.status === 204 || upstream.status === 304) {
      res.end();
      return;
    }
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).json({ detail: "Unable to reach the ORDIUM account service." });
  }
}
