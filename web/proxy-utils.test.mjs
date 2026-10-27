import test from "node:test";
import assert from "node:assert/strict";
import { isSafeAccountPath, isSafeDashboardPath, parseProxyRequest } from "./proxy-utils.mjs";

test("account proxy accepts only authentication paths", () => {
  assert.equal(isSafeAccountPath("api/v1/auth/login"), true);
  assert.equal(isSafeAccountPath("api/v1/auth/sessions/0123/revoke"), true);
  assert.equal(isSafeAccountPath("api/v1/dashboard/orders"), false);
  assert.equal(isSafeAccountPath("api/v1/auth/../internal"), false);
  assert.equal(isSafeAccountPath("api/v1/auth//login"), false);
  assert.equal(isSafeAccountPath("api/v1/auth/login?next=/"), false);
});

test("dashboard proxy preserves embedded and outer query parameters", () => {
  assert.equal(isSafeDashboardPath("api/v1/dashboard/webhooks"), true);
  const parsed = parseProxyRequest(
    "dashboard",
    "/api/dashboard?path=api%2Fv1%2Fdashboard%2Fwebhooks%3Fstore_id%3Dabc&page=2",
  );
  assert.equal(parsed.path, "/api/v1/dashboard/webhooks");
  const query = new URLSearchParams(parsed.search);
  assert.equal(query.get("store_id"), "abc");
  assert.equal(query.get("page"), "2");
});

test("dashboard proxy rejects traversal, duplicate separators and unexpected characters", () => {
  assert.equal(isSafeDashboardPath("api/v1/dashboard/../auth"), false);
  assert.equal(isSafeDashboardPath("api/v1/dashboard//orders"), false);
  assert.equal(isSafeDashboardPath("api/v1/dashboard/orders?admin=true"), false);
  assert.throws(() => parseProxyRequest("dashboard", "/api/dashboard?path=api%2Fv1%2Fdashboard%2F..%2Fauth"));
});

test("proxy rejects ambiguous duplicate path parameters", () => {
  assert.throws(() => parseProxyRequest("account", "/api/account?path=api%2Fv1%2Fauth%2Flogin&path=api%2Fv1%2Fauth%2Flogout"));
});
