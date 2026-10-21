// Быстрая проверка трекинга и защиты в живых страницах: node test.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROME_PATH || undefined });
const url = (f, qs = '') => pathToFileURL(resolve(f)).href + qs;

for (const [file, game] of [['rekt.html', 'rekt'], ['chart.html', 'chart'], ['index.html', 'road']]) {
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const bot = encodeURIComponent('https://t.me/mybot?start=old');
  await p.goto(url(file, `?src=tt_es1!x&lang=es&bot=${bot}&bonus=HACK&seed=abc`));
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => ({
    bot: document.getElementById('bot').href, site: document.getElementById('site').href,
    ev: window.dataLayer.map((x) => x.event), rg: document.body.lastElementChild.textContent,
  }));
  const bu = new URL(r.bot), su = new URL(r.site);
  ok(bu.searchParams.getAll('start').length === 1 && bu.searchParams.get('start') === `tt_es1_x_${game}`, `${file}: start у бота один и верный`);
  ok(su.searchParams.get('utm_source') === 'tt' && su.searchParams.get('utm_content') === 'es1_x' && su.searchParams.get('utm_campaign') === game, `${file}: utm разложен source/content/campaign`);
  ok(r.ev.includes('cp_view'), `${file}: событие view`);
  ok(/Solo \+18/.test(r.rg), `${file}: строка 18+ на языке страницы`);
  ok(errs.length === 0, `${file}: нет ошибок консоли/CSP ${errs.join(' | ')}`);
  await p.goto(url(file, `?bot=${encodeURIComponent('https://evil.com/x')}&site=${encodeURIComponent('https://coinplay.com@evil.com/')}`));
  await p.waitForTimeout(300);
  const e = await p.evaluate(() => ({ botShown: document.getElementById('bot').style.display, site: document.getElementById('site').href }));
  ok(e.botShown !== 'block' && new URL(e.site).hostname === 'coinplay.com', `${file}: чужие bot/site отвергнуты`);
  await p.goto(url(file, '?lang=en'));
  await p.evaluate((k) => localStorage.setItem(k, '{"w":"x","n":-5}'), { rekt: 'cpRekt', chart: 'cpChart', road: 'cpRoad' }[game]);
  await p.reload(); await p.waitForTimeout(300);
  ok(/^0 \/ 0$/.test(await p.evaluate(() => document.getElementById('score').textContent)), `${file}: битый localStorage не ломает счёт`);
  await p.close();
}
const h = await b.newPage();
await h.goto(url('play.html', '?src=th_en1&lang=ru'));
const hub = await h.evaluate(() => ({ cards: [...document.querySelectorAll('a.card')].map((a) => a.getAttribute('href')), bonus: document.getElementById('bonus').href }));
ok(hub.cards.every((c) => c.includes('src=th_en1')), 'hub: параметры проброшены в карточки');
ok(new URL(hub.bonus).searchParams.get('utm_source') === 'th' && new URL(hub.bonus).searchParams.get('utm_content') === 'en1', 'hub: utm как в играх');
await b.close();
console.log(bad ? `\nПровалено: ${bad}` : '\nВсё прошло');
process.exit(bad ? 1 : 0);
