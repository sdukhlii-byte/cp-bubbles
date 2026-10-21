// Проверка вёрстки на разных экранах: нет горизонтального скролла, всё помещается, кнопки и чат доступны.
// node test-layout.mjs [--shots папка]  (скриншоты по желанию)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (shots) mkdirSync(shots, { recursive: true });
const SIZES = [
  [320, 568, 'iPhone SE 1'], [360, 640, 'Android small'], [375, 667, 'iPhone SE 2'], [390, 844, 'iPhone 14'],
  [412, 915, 'Pixel'], [430, 932, 'iPhone Pro Max'], [768, 1024, 'iPad'], [1024, 768, 'iPad landscape'],
  [667, 375, 'phone landscape'], [844, 390, 'phone landscape wide'], [1280, 720, 'laptop'], [1440, 900, 'desktop'],
  [1920, 1080, 'full HD'], [2560, 1080, 'ultrawide'], [280, 653, 'Galaxy Fold folded'],
];
const PAGES = ['chart.html', 'rekt.html', 'index.html', 'play.html'];
const PORT = 20000 + Math.floor(Math.random() * 900), BASE = `http://localhost:${PORT}`;
const srv = spawn('node', ['server.mjs'], { env: { ...process.env, PORT: String(PORT), DATA_FILE: '/tmp/layout_scores.json' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res) => srv.stdout.on('data', (d) => String(d).includes('http://') && res()));
const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROME_PATH || undefined });
let bad = 0;
const fail = (m) => { console.log('FAIL ' + m); bad++; };

for (const [w, h, name] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 800, hasTouch: w < 800, deviceScaleFactor: 2 });
  for (const pg of PAGES) {
    for (const chat of pg === 'play.html' ? [false] : [true, false]) {
      const p = await ctx.newPage(); p.setDefaultTimeout(6000);
      const errs = []; p.on('pageerror', (e) => errs.push(e.message));
      const tag = `${name} ${w}x${h} ${pg}${chat ? ' +chat' : ''}`;
      try {
        if (chat) { await p.goto(`${BASE}/${pg}?lang=ru`); if (pg !== 'play.html') await p.waitForSelector('#chat:not([hidden])'); }
        else await p.goto(`file://${process.cwd()}/${pg}?lang=ru`);
        await p.waitForTimeout(400);
        const r = await p.evaluate(() => {
          const de = document.documentElement, vw = window.innerWidth;
          const rect = (s) => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
          const clip = [];
          for (const e of document.querySelectorAll('#status,#btns button,#chat .hd,#chat form,#bot,#site,a.card,h1,.sub')) {
            if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible' && e.clientWidth > 0) clip.push(e.id || e.className || e.tagName);
          }
          const scroller = document.getElementById('app') || document.body;
          return { hs: de.scrollWidth > vw + 1, bodyHs: document.body.scrollWidth > vw + 1, vw, vh: window.innerHeight,
            canvas: rect('canvas'), btn: rect('#btns button'), chat: rect('#chat'), input: rect('#chat input'), ui: rect('#ui'), clip,
            canScroll: scroller.scrollHeight > scroller.clientHeight + 1 || de.scrollHeight > window.innerHeight + 1 };
        });
        if (r.hs || r.bodyHs) fail(`${tag}: горизонтальный скролл`);
        if (pg !== 'play.html') {
          if (!r.canvas || r.canvas.l < -0.5 || r.canvas.r > r.vw + 0.5) fail(`${tag}: канвас выходит за экран ${JSON.stringify(r.canvas)}`);
          if (r.canvas && r.canvas.w < Math.min(150, r.vw * 0.35)) fail(`${tag}: канвас слишком мал (${Math.round(r.canvas.w)}px)`);
          if (r.canvas && r.canvas.h < 180) fail(`${tag}: канвас слишком низкий (${Math.round(r.canvas.h)}px)`);
          if (!r.btn || r.btn.l < -0.5 || r.btn.r > r.vw + 0.5 || r.btn.h < 36) fail(`${tag}: кнопки не помещаются или малы ${JSON.stringify(r.btn)}`);
          if (chat && (!r.chat || r.chat.l < -0.5 || r.chat.r > r.vw + 0.5 || r.chat.h < 200)) fail(`${tag}: чат не помещается ${JSON.stringify(r.chat)}`);
          if (chat && r.input && r.input.h < 30) fail(`${tag}: поле ввода мало`);
          if (r.clip.length) fail(`${tag}: обрезанный текст в ${r.clip.join(',')}`);
          // кнопка и поле ввода должны быть достижимы прокруткой
          if (chat) { await p.locator('#chat input').scrollIntoViewIfNeeded(); const ib = await p.locator('#chat input').boundingBox(); if (!ib || ib.y + ib.height > r.vh + 1 || ib.y < -1) fail(`${tag}: поле ввода недоступно после прокрутки`); }
          await p.locator('#btns button').first().scrollIntoViewIfNeeded(); const bb = await p.locator('#btns button').first().boundingBox();
          if (!bb || bb.y + bb.height > r.vh + 1 || bb.y < -1) fail(`${tag}: кнопка недоступна после прокрутки`);
        } else {
          const cards = await p.evaluate(() => [...document.querySelectorAll('a.card')].map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right, window.innerWidth]; }));
          if (cards.some(([l, rr, vw]) => l < 0 || rr > vw + 1)) fail(`${tag}: карточки выходят за экран`);
        }
        if (errs.length) fail(`${tag}: ошибки ${errs.join('|')}`);
        if (shots && chat && ['iPhone SE 1', 'iPhone 14', 'iPad', 'phone landscape', 'desktop', 'ultrawide', 'Galaxy Fold folded'].includes(name) && (pg === 'chart.html' || (name === 'iPhone 14' && pg !== 'play.html'))) {
          await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: `${shots}/${name.replace(/ /g, '_')}_${w}x${h}_${pg.replace('.html', '')}.png` });
        }
      } catch (e) { fail(`${tag}: ${e.message.split('\n')[0]}`); }
      await p.close();
    }
  }
  await ctx.close();
}

// ---- race.html: чат виден / скрыт / снова виден ----
for (const [w, h, name] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 800, hasTouch: w < 800, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.setDefaultTimeout(6000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const tag = `${name} ${w}x${h} race.html`;
  try {
    await p.goto(`${BASE}/race.html`); await p.waitForSelector('#chat:not([hidden])'); await p.waitForTimeout(600);
    const snap = () => p.evaluate(() => {
      const R = (s) => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
      const de = document.documentElement;
      return { vw: innerWidth, vh: innerHeight, hs: de.scrollWidth > innerWidth + 1, canvas: R('canvas'), btn: R('#btns button:nth-child(8)'), chat: R('#chat'), input: R('#chat input'), tog: R('#chtog') };
    });
    const inV = (r, r_) => r && r.l >= -0.5 && r.r <= r_.vw + 0.5;
    let r = await snap();
    if (r.hs) fail(`${tag}: горизонтальный скролл (чат открыт)`);
    if (!inV(r.canvas, r) || !inV(r.chat, r) || !inV(r.btn, r)) fail(`${tag}: элементы выходят по ширине ${JSON.stringify([r.canvas, r.chat, r.btn])}`);
    if (!r.tog) fail(`${tag}: нет кнопки скрытия чата`);
    if (r.canvas && r.canvas.h < 180) fail(`${tag}: канвас слишком низкий ${Math.round(r.canvas.h)}`);
    if (r.btn && r.btn.h < 34) fail(`${tag}: кнопки ставок малы ${Math.round(r.btn.h)}`);
    if (r.chat && r.chat.h < 150) fail(`${tag}: чат слишком низкий ${Math.round(r.chat.h)}`);
    if (w < 800 && h > w) { // портрет: всё в экране без прокрутки
      for (const [n, el] of [['canvas', r.canvas], ['кнопки', r.btn], ['чат', r.chat], ['ввод', r.input]]) if (!el || el.b > r.vh + 1 || el.t < -1) fail(`${tag}: ${n} вне экрана ${JSON.stringify(el)}`);
    }
    await p.click('#chtog'); await p.waitForTimeout(300);
    r = await snap();
    if (r.chat) fail(`${tag}: чат не скрылся`);
    if (r.hs) fail(`${tag}: горизонтальный скролл (чат скрыт)`);
    if (!inV(r.canvas, r) || !inV(r.btn, r)) fail(`${tag}: при скрытом чате элементы выходят ${JSON.stringify([r.canvas, r.btn])}`);
    if (w < 800 && h > w && (!r.canvas || r.canvas.b > r.vh + 1 || r.canvas.h < 250 || !r.btn || r.btn.b > r.vh + 1)) fail(`${tag}: скрытый чат: не помещается ${JSON.stringify([r.canvas, r.btn])}`);
    if (!r.tog) fail(`${tag}: кнопка «Chat» пропала`);
    await p.click('#chtog'); await p.waitForTimeout(300);
    r = await snap();
    if (!r.chat || !r.input) fail(`${tag}: чат не открылся обратно`);
    if (r.hs || !inV(r.chat, r)) fail(`${tag}: после открытия чата вёрстка поплыла`);
    if (errs.length) fail(`${tag}: ошибки ${errs.join('|')}`);
    if (shots && ['iPhone SE 1', 'iPhone 14', 'desktop', 'phone landscape'].includes(name)) await p.screenshot({ path: `${shots}/race_${name.replace(/ /g, '_')}.png` });
  } catch (e) { fail(`${tag}: ${e.message.split('\n')[0]}`); }
  await ctx.close();
}
await b.close(); srv.kill();
console.log(bad ? `\nПровалено: ${bad}` : `\nВсё прошло (${SIZES.length} размеров экрана)`); process.exit(bad ? 1 : 0);
