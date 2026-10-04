// dist/index.html → artifact/akademiya-3d.html
// claude.ai Artifact sahifa skeletini o‘zi qo‘shadi, shuning uchun bu yerda faqat
// <title>, shrift havolasi, inline <style>, ildiz element va inline <script> qoladi.
import fs from 'node:fs';
import path from 'node:path';

const dist = 'dist';
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const pick = (re) => {
  const m = html.match(re);
  if (!m) throw new Error(`Topilmadi: ${re}`);
  return m;
};
const title = pick(/<title>[\s\S]*?<\/title>/)[0];
const fonts = [...html.matchAll(/<link[^>]+fonts\.googleapis\.com\/css2[^>]*>/g)].map((m) => m[0]).join('\n');
const cssHref = pick(/<link[^>]+rel="stylesheet"[^>]+href="(\.\/assets\/[^"]+\.css)"[^>]*>/)[1];
const jsSrc = pick(/<script[^>]+src="(\.\/assets\/[^"]+\.js)"[^>]*><\/script>/)[1];
const css = fs.readFileSync(path.join(dist, cssHref), 'utf8');
let js = fs.readFileSync(path.join(dist, jsSrc), 'utf8');
js = js.replace(/<\/script/gi, '<\\/script');

const out = `${title}
${fonts}
<style>
${css}
</style>
<div id="app"></div>
<script type="module">
${js}
</script>
`;
fs.mkdirSync('artifact', { recursive: true });
const file = path.join('artifact', 'akademiya-3d.html');
fs.writeFileSync(file, out);
console.log(`${file}: ${(out.length / 1024).toFixed(0)} KB`);
