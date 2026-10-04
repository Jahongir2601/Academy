// Maketni headless brauzerda ochib, GLB faylga eksport qiladi: exports/akademiya-kampus.glb
// Foydalanish: npm run build && npx vite preview --port 4173 &  so‘ng  npm run export:glb
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] || 'http://localhost:4173/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.ui && window.ui.exportGLB, null, { timeout: 180000 });
const b64 = await page.evaluate(async () => {
  const buf = await window.ui.exportGLB();
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
});
fs.mkdirSync('exports', { recursive: true });
const out = 'exports/akademiya-kampus.glb';
fs.writeFileSync(out, Buffer.from(b64, 'base64'));
console.log(`${out}: ${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB`);
await browser.close();
