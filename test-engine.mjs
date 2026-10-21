// Защита общего ядра: исходы раундов не должны меняться, слова-прогнозы должны совпадать с текстами страниц.
// Если вы специально меняете формулы, обновите GOLDEN (и помните: старые ролики перестанут совпадать с эфиром).
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';

const GOLDEN = {
  chart: '6e84968169ac968995261c60dac57ab5e13148e5985b89922e56d06ce51e0927',
  rekt: '8379a93f822edbb9098f6bd1a21cd1d019883b13b4eec9b3d1cfdc12a68edad3',
};
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };

const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROME_PATH || undefined });
for (const g of ['chart', 'rekt']) {
  const p = await b.newPage();
  await p.goto(pathToFileURL(g + '.html').href + '?mode=record');
  await p.waitForFunction('window.__ready===true');
  const res = await p.evaluate((g) => {
    const r = [];
    for (const seed of [1, 2, 7]) for (let i = 0; i < 400; i++) {
      const o = g === 'chart' ? window.setup({ seed, lang: 'en', round: i, rounds: 1 }) : window.setup({ seed, lang: 'en', episode: i, episodes: 1 });
      r.push(seed + ':' + i + ':' + (g === 'chart' ? o.letter + o.margin : o.fate));
    }
    return r.join('|');
  }, g);
  ok(crypto.createHash('sha256').update(res).digest('hex') === GOLDEN[g], `${g}: исходы 1200 раундов не изменились`);
  await p.close();
}
await b.close();

const ctx = {}; vm.runInNewContext(readFileSync('engine.js', 'utf8'), ctx); const EN = ctx.CPEngine;
const chartSrc = readFileSync('chart.html', 'utf8'), rektSrc = readFileSync('rekt.html', 'utf8');
const ups = [...chartSrc.matchAll(/up:'([^']+)',down:'([^']+)',ans:/g)];
ok(ups.length === 10 && ups.every(([, u, d]) => EN.parsePick('chart', u) === 1 && EN.parsePick('chart', d) === -1), 'chart: слова всех 10 языков из страницы распознаются как прогноз');
const oks = [...rektSrc.matchAll(/ok:'([^']+)'/g)];
ok(oks.length === 10 && oks.every(([, w]) => EN.parsePick('rekt', w) === 1) && EN.parsePick('rekt', 'REKT') === -1, 'rekt: слова всех 10 языков распознаются');
ok(EN.parsePick('chart', ' up!! ') === 1 && EN.parsePick('chart', '▼') === -1 && EN.parsePick('chart', 'up or down') === 0 && EN.parsePick('chart', 'I think UP') === 0, 'слово должно стоять одно: обычные фразы не считаются прогнозом');
console.log(bad ? `\nПровалено: ${bad}` : '\nВсё прошло'); process.exit(bad ? 1 : 0);
