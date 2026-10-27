const INTERNAL_PREFIXES = {
  account: "api/v1/auth/",
  dashboard: "api/v1/dashboard/",
};

export function isSafeAccountPath(path) {
  return typeof path === "string"
    && path.startsWith(INTERNAL_PREFIXES.account)
    && /^[a-zA-Z0-9_/-]+$/.test(path)
    && !path.includes("..")
    && !path.includes("//")
    && !path.endsWith("/");
}

export function isSafeDashboardPath(path) {
  return typeof path === "string"
    && path.startsWith(INTERNAL_PREFIXES.dashboard)
    && path.length <= 512
    && /^[a-zA-Z0-9_./-]+$/.test(path)
    && !path.includes("..")
    && !path.includes("//")
    && !path.endsWith("/");
}

/** Parse the same-origin query-parameter proxy contract used by Vercel. */
export function parseProxyRequest(mode, rawUrl) {
  if (mode !== "account" && mode !== "dashboard") {
    throw new Error("Unsupported proxy mode");
  }

  const incoming = new URL(rawUrl, "http://ordium-proxy.invalid");
  const pathValues = incoming.searchParams.getAll("path");
  if (pathValues.length !== 1 || !pathValues[0]) {
    throw new Error("Exactly one path parameter is required");
  }

  const serializedTarget = pathValues[0];
  let path = serializedTarget;
  let embeddedQuery = "";
  if (mode === "dashboard") {
    const queryIndex = serializedTarget.indexOf("?");
    if (queryIndex >= 0) {
      path = serializedTarget.slice(0, queryIndex);
      embeddedQuery = serializedTarget.slice(queryIndex + 1);
    }
  }

  const isSafe = mode === "account" ? isSafeAccountPath(path) : isSafeDashboardPath(path);
  if (!isSafe) throw new Error("Proxy path is not allowed");

  const query = new URLSearchParams(mode === "dashboard" ? embeddedQuery : "");
  for (const [key, value] of incoming.searchParams) {
    if (key !== "path") query.append(key, value);
  }

  return { path: "/" + path, search: query.toString() };
}
