// Галерея для проверки: node gallery.mjs  -> out/gallery_themes.png (все локации) и out/gallery_chars.png (все персонажи)
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = resolve('out'); mkdirSync(out, { recursive: true });
const br = await chromium.launch(); const page = await br.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(pathToFileURL(resolve('race.html')).href + '?mode=record');
await page.waitForFunction(() => window.__ready);
const which = process.argv[2] || 'all';
if (which === 'all' || which === 'themes') {
  const data = await page.evaluate(async () => {
    const ids = ['daystreet','neoncity','heaven','vault','matrix','candy','sunset','storm'], W = 270, H = 480, cols = 8, rows = Math.ceil(ids.length / cols);
    const big = document.createElement('canvas'); big.width = W * cols; big.height = H * rows; const bc = big.getContext('2d');
    for (let i = 0; i < ids.length; i++) {
      const info = window.setup({ seed: 3 + i, skin: ids[i], short: true });
      window.renderFrame(4*(60/170)+2.0);
      bc.drawImage(document.getElementById('c'), (i % cols) * W, Math.floor(i / cols) * H, W, H);
      bc.fillStyle = '#fff'; bc.font = '700 14px sans-serif'; bc.fillText(ids[i], (i % cols) * W + 6, Math.floor(i / cols) * H + 14);
    }
    return big.toDataURL('image/png');
  });
  writeFileSync(out + '/gallery_themes.png', Buffer.from(data.split(',')[1], 'base64'));
}
if (which === 'all' || which === 'chars') {
  const data = await page.evaluate(() => {
    const n = RaceVis.CHARS.length, cols = 10, cell = 130, rows = Math.ceil(n / cols);
    const c = document.createElement('canvas'); c.width = cols * cell; c.height = rows * cell; const x = c.getContext('2d');
    x.fillStyle = '#1b2230'; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < n; i++) {
      const px = (i % cols) * cell + cell / 2, py = Math.floor(i / cols) * cell + cell / 2 + 6;
      RaceVis.drawChar(x, i, px, py, 32, { col: ['#ff4d6d', '#ffd23f', '#3ddc97', '#4cc9f0', '#b388ff', '#ff9f1c', '#e8e8e8', '#ff6ec7'][i % 8], lx: 0, ly: 1, vx: 0, vy: 0, t: 1 });
      x.fillStyle = '#fff'; x.font = '700 12px sans-serif'; x.textAlign = 'center'; x.fillText(RaceVis.CHARS[i][0], px, py + 52);
    }
    return c.toDataURL('image/png');
  });
  writeFileSync(out + '/gallery_chars.png', Buffer.from(data.split(',')[1], 'base64'));
}
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'ok');
await br.close();
