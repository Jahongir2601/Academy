// Maketni headless Chromium’da ochib, bir nechta ko‘rinishdan skrinshot oladi.
// Foydalanish: node scripts/screenshots.mjs [url] [outDir] [js-ifodalar...]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || 'shots';
const steps = process.argv.slice(4);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: Number(process.env.VW || 1440), height: Number(process.env.VH || 900) },
  deviceScaleFactor: 1,
  isMobile: !!process.env.MOBILE,
  hasTouch: !!process.env.MOBILE,
});
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.app && window.app.buildings, null, { timeout: 120000 });
await page.waitForTimeout(1500);

let i = 0;
for (const step of steps.length ? steps : ['null']) {
  if (step !== 'null') await page.evaluate(step);
  await page.waitForTimeout(2500);
  const file = `${out}/shot-${String(i++).padStart(2, '0')}.png`;
  await page.screenshot({ path: file });
  console.log('saved', file);
}
console.log(logs.filter((l) => !l.includes('GPU stall')).slice(0, 40).join('\n'));
await browser.close();
