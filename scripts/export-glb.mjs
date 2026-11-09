// Exports every map as a binary glTF (.glb) into ./models using the running app.
// Usage: npm run dev (in another terminal), then  node scripts/export-glb.mjs [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const out = process.env.OUT_DIR || 'models';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${base}?capture=1&t=0`);
await page.waitForFunction(() => window.__voxelReady === true, null, { timeout: 180000 });
const ids = await page.evaluate(() => window.__voxel.maps);
for (const id of ids) {
  const b64 = await page.evaluate((i) => window.__voxel.exportGLB(i), id);
  const buf = Buffer.from(b64, 'base64');
  writeFileSync(`${out}/${id}.glb`, buf);
  console.log(`${out}/${id}.glb  ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
}
await browser.close();
