// Screenshots of the Roblox stage previews (stage.html). Needs `npm run dev`.
// Usage: node scripts/stage-shots.mjs [baseUrl] [stageId ...]   env: OUT_DIR, CAM="x,y,z,tx,ty,tz", SUFFIX
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const ids = process.argv.slice(3).length ? process.argv.slice(3) : ['mines', 'fort', 'wreck', 'zen'];
const out = process.env.OUT_DIR || 'screenshots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
for (const id of ids) {
  const cam = process.env.CAM ? `&cam=${process.env.CAM}` : '';
  await page.goto(`${base}stage.html?capture=1&t=${process.env.T || 5}&stage=${id}${cam}`);
  await page.waitForFunction(() => window.__stageReady === true, null, { timeout: 240000 });
  await page.waitForTimeout(1200);
  console.log(id, JSON.stringify(await page.evaluate(() => window.__stage.stats())));
  await page.screenshot({ path: `${out}/stage_${id}${process.env.SUFFIX || ''}.png` });
}
await browser.close();
