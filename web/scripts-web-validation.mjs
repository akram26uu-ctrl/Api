import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const required = [
  'package.json',
  'vite.config.ts',
  'tsconfig.json',
  'src/main.tsx',
  'src/App.tsx',
  'src/lib/api/client.ts',
  'src/lib/api/controlPlane.ts',
  '.env.example',
];

const failures = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing: ${file}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const script of ['dev', 'build', 'preview', 'lint']) {
  if (!pkg.scripts?.[script]) failures.push(`missing npm script: ${script}`);
}

const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const client = fs.readFileSync(path.join(root, 'src/lib/api/client.ts'), 'utf8');
const cp = fs.readFileSync(path.join(root, 'src/lib/api/controlPlane.ts'), 'utf8');

if (!app.includes("window.location.pathname === '/dashboard'")) failures.push('dashboard deep-link guard missing');
if (!client.includes("!(import.meta as any).env?.PROD")) failures.push('demo mode is not production-gated');
if (!cp.includes("endpoint.startsWith('/api/v1/auth/')")) failures.push('control-plane auth credential isolation missing');
if (client.includes('VITE_ORDIUM_DEMO_MODE === \'true\'')) {
  // The flag is intentionally supported for local development, but must remain production-gated.
  if (!client.includes('!(import.meta as any).env?.PROD &&')) failures.push('demo mode flag lacks production guard');
}

if (failures.length) {
  console.error('Web validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Web static validation passed (${required.length} required files + production guards).`);
