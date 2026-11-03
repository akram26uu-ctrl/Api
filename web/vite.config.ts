import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Vercel Analytics only works on Vercel (it loads /_vercel/insights/script.js).
      // Vercel sets VERCEL=1 during builds; the Docker/EC2 build leaves it unset.
      __ORDIUM_VERCEL_ANALYTICS__: JSON.stringify(Boolean(process.env.VERCEL) || process.env.VITE_ENABLE_VERCEL_ANALYTICS === 'true'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: (import.meta as any).env?.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: (import.meta as any).env?.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
