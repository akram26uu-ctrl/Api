<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# ORDIUM Web

Official ORDIUM frontend. This application is the presentation/dashboard layer and communicates with the ORDIUM API and Control Plane.

This project preserves the existing ORDIUM visual system, 3D experience, localization, and API integration.

View your app in AI Studio: https://ai.studio/apps/1300f672-94cc-4218-aba5-95b11b6a0d46

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the ORDIUM frontend environment variables in a local `.env.local` file.

Required variables:
- `VITE_ORDIUM_API_URL`
- `VITE_ORDIUM_CONTROL_PLANE_URL`
- `VITE_ORDIUM_DEMO_MODE=false` (optional; set to `true` only for an explicit local UI demo without backend data)
3. Run the app:
   `npm run dev`
