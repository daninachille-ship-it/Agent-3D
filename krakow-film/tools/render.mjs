// Deterministic frame-by-frame renderer: headless Chromium -> PNG/JPEG frames -> ffmpeg.
// Usage:
//   node tools/render.mjs --stills 1,6,12 --out out/stills         (preview stills)
//   node tools/render.mjs --fps 30 --w 1920 --h 1080 --out out/video.mp4 [--from 0 --to 75]
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]]) : a), []));
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const W = +(args.w || 1920), H = +(args.h || 1080), FPS = +(args.fps || 30);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.m4a': 'audio/mp4', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  try { const p = join(root, decodeURIComponent(req.url.split('?')[0])); const b = await readFile(p.endsWith('/') ? p + 'index.html' : p); res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--js-flags=--max-old-space-size=8192'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('[t]')) console.log('[page]', m.type(), m.text().slice(0, 4000)); });
page.on('pageerror', (e) => { console.log('[pageerror]', e.message); process.exit(2); });
await page.goto(`http://localhost:${port}/index.html?render&w=${W}&h=${H}`);
const tLoad = Date.now();
await page.waitForFunction(() => window.filmReady === true, null, { timeout: 0 });
console.log(`ready in ${((Date.now() - tLoad) / 1000).toFixed(1)}s`);

const shoot = async (t, type = 'png') => {
  await page.evaluate((t) => window.film.renderAt(t), t);
  return page.screenshot({ type, quality: type === 'jpeg' ? 92 : undefined, animations: 'disabled', caret: 'hide' });
};

if (args.stills) {
  const out = resolve(args.out || 'out/stills'); await mkdir(out, { recursive: true });
  for (const t of String(args.stills).split(',').map(Number)) {
    const s = Date.now(); const buf = await shoot(t, 'jpeg'); await writeFile(join(out, `t${t.toFixed(2).padStart(5, '0')}.jpg`), buf);
    console.log(`still t=${t} in ${Date.now() - s} ms`);
  }
} else {
  const out = resolve(args.out || 'out/video.mp4'); await mkdir(dirname(out), { recursive: true });
  const from = +(args.from || 0), to = +(args.to || 75);
  const n = Math.round((to - from) * FPS);
  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', args.preset || 'medium', '-crf', String(args.crf || 16), '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const s0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = from + i / FPS;
    const buf = await shoot(t, 'jpeg');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 30 === 0) { const el = (Date.now() - s0) / 1000; console.log(`frame ${i}/${n} t=${t.toFixed(2)} ${(el / (i + 1)).toFixed(2)} s/frame, ETA ${((n - i) * el / (i + 1) / 60).toFixed(1)} min`); }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('done', out);
}
await browser.close(); server.close();
