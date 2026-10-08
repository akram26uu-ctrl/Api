# ORDIUM Web Production Readiness

- Demo/mock mode is disabled automatically in Vite production builds, even if `VITE_ORDIUM_DEMO_MODE=true` is accidentally supplied.
- Production data access remains through the authenticated Control Plane/API flow.
- The TEST dashboard simulator cannot submit orders to LIVE.

External validation still required: install dependencies with `npm install`, run `npm run lint`, and run `npm run build` in CI.


## v10 audit status

Static production validation passed. Direct `/dashboard` deep-link and Control Plane credential isolation were hardened. Full `npm run lint` / `npm run build` and browser E2E remain external checks because dependencies could not be installed in the current execution environment. See `WEB-PRODUCTION-AUDIT-V10.md`.
