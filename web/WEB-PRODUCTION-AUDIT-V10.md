# ORDIUM Web Production Audit — v10

Date: 2026-09-28

## Completed in source

- Production demo/mock mode remains explicitly gated behind `!import.meta.env.PROD`.
- `/dashboard` deep-link now initializes directly into authenticated dashboard mode instead of rendering the marketing shell.
- Control Plane authentication endpoints no longer receive the dashboard API credential from `sessionStorage`.
- Public browser configuration is documented in `.env.example`; no secrets are included.
- Added `npm run validate:web` static production validation.
- Verified the expected Web source/configuration files exist.
- Verified the production demo guard is present.
- Verified the dashboard deep-link guard is present.
- Verified Control Plane credential isolation is present.
- No `.env` secret file is included in the Web tree.
- No dangerous `innerHTML`, `dangerouslySetInnerHTML`, `eval`, or `new Function` usage was found in application source (excluding mock data source from the search where appropriate).
- No fake authentication/localStorage JWT flow was found.

## Environment validation

- Node: `v22.16.0`
- npm: `10.9.2`
- Chromium: `/usr/bin/chromium`
- `node_modules` is not present in the supplied release.
- `npm ci` cannot run because the release intentionally contains Bun's `bun.lock` but no `package-lock.json`.
- `npm install --ignore-scripts --no-audit --no-fund --prefer-offline` was attempted twice and timed out after 120s and 300s.

Therefore these commands could not be truthfully executed in this environment:

- `npm run lint`
- `npm run build`
- Browser E2E against the compiled Vite application

This is an environment/dependency installation limitation, not a reported source-code failure.

## Existing Web architecture retained

- Marketing website and authenticated dashboard remain in the same React/Vite application.
- Authentication is handled through the Control Plane session cookie.
- Dashboard API requests use the environment-specific dashboard credential.
- TEST simulator cannot create LIVE orders.
- Production builds cannot enable demo/mock mode through `VITE_ORDIUM_DEMO_MODE`.

## Remaining external release checks

Before public production deployment, run in CI or a clean developer machine:

```bash
npm install
npm run validate:web
npm run lint
npm run build
```

Then serve the production build and execute browser E2E for:

1. `/`
2. `/login`
3. `/register`
4. `/verify-email`
5. direct `/dashboard` deep-link
6. login → dashboard → orders
7. logout → protected-route rejection
8. TEST simulator → risk evaluation
9. API key creation/revocation/rotation
10. webhook creation/disable
11. API/Control Plane network failure states
12. mobile/responsive dashboard navigation

## Release assessment

The Web source has been hardened and statically validated for the audited items. It should be treated as **Pre-Production** until the dependency installation, TypeScript build, Vite production build, and browser E2E checks above are executed in a network-enabled CI/development environment.
## Responsive/Profile UX hardening — 2026-09-28

- Added a viewport-safe account/profile menu to the authenticated dashboard header.
- The menu is anchored to the viewport (`position: fixed`) instead of relying on an upward-opening local popover, preventing top-edge clipping on short displays and RTL layouts.
- Added `max-height` + internal scrolling based on `100dvh`, so the menu remains reachable on short phones and landscape mode.
- Added outside-click and Escape-key dismissal.
- Added a responsive account-settings dialog with `100dvh` bounds and internal scrolling.
- Dashboard shell now uses `100dvh` rather than `100vh` to handle mobile browser chrome more reliably.
- Mobile dashboard sidebar is independently scrollable and uses `100dvh`.
- Global `box-sizing`, horizontal overflow protection, and mobile tap/viewport adjustments were added.
- Added Arabic/French/English translations for the profile menu.

### Validation

- Static production validation: PASS.
- TypeScript parser/syntax validation: PASS after the UI patch; full type-check cannot complete in this offline workspace because `node_modules` is not installed.
- Browser E2E/build remain environment-dependent until dependencies can be installed.

