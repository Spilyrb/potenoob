// Renders every map headlessly and saves PNG previews to ./screenshots.
// Usage: npm run dev (or preview) in another terminal, then
//   node scripts/screenshots.mjs [baseUrl] [mapId ...]
import { createRequire } from 'node:module';
// CommonJS require so a globally installed Playwright (NODE_PATH) is found too
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:5173/';
const only = process.argv.slice(3);
const out = process.env.OUT_DIR || 'screenshots';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: Number(process.env.DPR || 1) });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`${base}?capture=1&t=${process.env.T || 6}`);
await page.waitForFunction(() => window.__voxelReady === true, null, { timeout: 180000 });
const ids = only.length ? only : await page.evaluate(() => window.__voxel.maps);
for (const id of ids) {
  await page.evaluate((i) => window.__voxel.setMap(i), id);
  if (process.env.CAM) {
    const [px, py, pz, tx, ty, tz] = process.env.CAM.split(',').map(Number);
    await page.evaluate(([a, b, c, d, e, f]) => { window.__voxel.camera.position.set(a, b, c); window.__voxel.controls.target.set(d, e, f); window.__voxel.controls.update(); }, [px, py, pz, tx, ty, tz]);
  }
  await page.waitForTimeout(1500);
  const stats = await page.evaluate(() => window.__voxel.stats());
  console.log(id, JSON.stringify(stats));
  await page.screenshot({ path: `${out}/${id}${process.env.SUFFIX || ''}.png` });
}
await browser.close();
