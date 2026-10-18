/**
 * Same-origin account-service proxy for Vercel.
 *
 * Keeps the HttpOnly session cookie on the frontend origin so browsers with
 * third-party-cookie restrictions (notably Safari) can retain and send it.
 * Set ORDIUM_CONTROL_PLANE_URL in the Vercel runtime environment to the
 * deployed Control Plane base URL (for example, the service origin only).
 */
export default async function handler(req: any, res: any) {
  const rawPath = req.query?.path;
  const path = Array.isArray(rawPath) ? rawPath.join("/") : String(rawPath || "");

  // This proxy is intentionally limited to account authentication endpoints.
  if (!path.startsWith("api/v1/auth/") || path.includes("..") || path.includes("\\\\")) {
    res.status(404).json({ detail: "Not found" });
    return;
  }

  const base = (process.env.ORDIUM_CONTROL_PLANE_URL || process.env.VITE_ORDIUM_CONTROL_PLANE_URL || "").trim().replace(/\\/+$/, "");
  if (!base) {
    res.status(503).json({ detail: "Account service proxy is not configured." });
    return;
  }

  let target: URL;
  try {
    target = new URL("/" + path, base);
    // Preserve query parameters while avoiding forwarding the frontend proxy path.
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
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });

    res.status(upstream.status);
    for (const name of ["content-type", "cache-control", "x-request-id", "www-authenticate"]) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }

    // Forward every Set-Cookie header separately; combining them can corrupt
    // cookie attributes and break session persistence.
    const getSetCookie = (upstream.headers as any).getSetCookie;
    const cookies = typeof getSetCookie === "function"
      ? getSetCookie.call(upstream.headers)
      : (upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie")] : []);
    if (cookies.length) res.setHeader("set-cookie", cookies);

    if (req.method === "HEAD" || upstream.status === 204 || upstream.status === 304) {
      res.end();
      return;
    }
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.send(payload);
  } catch {
    res.status(502).json({ detail: "Unable to reach the ORDIUM account service." });
  }
}
