// Capture image par image + encodage par scène.
//   node render.mjs stills 4.5,6.4,10.5      -> out/checks/t_<t>.jpg (pleine taille)
//   node render.mjs scenes                   -> les 6 scènes
//   node render.mjs scenes C,E               -> seulement les scènes indiquées
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const FPS = 30;
// [nom, première image, image de fin exclue] — frontières 6.4 / 12.4 / 29.2 / 34.5 / 39.5 / 45
const SCENES = [['A', 0, 192], ['B', 192, 372], ['C', 372, 876], ['D', 876, 1035], ['E', 1035, 1185], ['F', 1185, 1350]];
const CONCURRENCY = 3;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.woff2': 'font/woff2', '.css': 'text/css' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function openPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => window.ready);
  return page;
}

async function shot(page, t, file) {
  await page.evaluate(tt => window.render(tt), t);
  await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
}

function run(cmd, args) {
  return new Promise(res => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', d => { err += d; });
    p.on('close', code => res({ code, err }));
  });
}

async function renderScene(browser, url, [name, f0, f1]) {
  const dir = path.join(OUT, 'frames', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const page = await openPage(browser, url);
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await shot(page, f / FPS, path.join(dir, String(f - f0).padStart(5, '0') + '.jpg'));
  }
  await page.close();
  const tmp = path.join(OUT, 'scenes', `${name}.tmp.mp4`), fin = path.join(OUT, 'scenes', `${name}.mp4`);
  const { code, err } = await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp]);
  if (code !== 0) { console.error(`ffmpeg a échoué pour ${name} (code ${code})\n${err}`); fs.rmSync(tmp, { force: true }); return false; }
  fs.renameSync(tmp, fin);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`scène ${name} : ${f1 - f0} images en ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${path.relative(ROOT, fin)}`);
  return true;
}

const [mode = 'scenes', arg = ''] = process.argv.slice(2);
const srv = await serve();
const url = `http://127.0.0.1:${srv.address().port}/index.html`;
const browser = await chromium.launch();
let ok = true;
try {
  if (mode === 'stills') {
    const dir = path.join(OUT, 'checks'); fs.mkdirSync(dir, { recursive: true });
    const page = await openPage(browser, url);
    for (const t of arg.split(',').map(Number)) {
      const file = path.join(dir, `t_${t.toFixed(2)}.jpg`);
      await shot(page, t, file);
      console.log(path.relative(ROOT, file));
    }
  } else {
    fs.mkdirSync(path.join(OUT, 'scenes'), { recursive: true });
    const wanted = arg ? arg.split(',') : SCENES.map(s => s[0]);
    const queue = SCENES.filter(s => wanted.includes(s[0]));
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) { const sc = queue.shift(); if (!(await renderScene(browser, url, sc))) ok = false; }
    });
    await Promise.all(workers);
  }
} finally {
  await browser.close();
  srv.close();
}
process.exit(ok ? 0 : 1);
