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

function createQuery(incoming, embeddedQuery = "") {
  const query = new URLSearchParams(embeddedQuery);
  for (const [key, value] of incoming.searchParams) {
    if (key !== "path") query.append(key, value);
  }
  return query.toString();
}

/** Parse the same-origin query-parameter proxy contract used by the Vercel functions. */
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

  return {
    path: "/" + path,
    search: createQuery(incoming, mode === "dashboard" ? embeddedQuery : ""),
  };
}

/**
 * Compatibility route for the Vercel catch-all account function, used by a
 * small number of existing frontend calls such as account export.
 */
export function parseDirectAccountRequest(rawUrl) {
  const incoming = new URL(rawUrl, "http://ordium-proxy.invalid");
  const prefix = "/api/account/";
  if (!incoming.pathname.startsWith(prefix)) {
    throw new Error("Not an account catch-all path");
  }

  let path;
  try {
    path = decodeURIComponent(incoming.pathname.slice(prefix.length));
  } catch {
    throw new Error("Invalid encoded path");
  }

  if (!isSafeAccountPath(path)) throw new Error("Proxy path is not allowed");
  return { path: "/" + path, search: incoming.searchParams.toString() };
}
