// Генератор трекинговых ссылок (CSV): платформа x аккаунт x серия.
//   node links.mjs --base https://games.example.com --bot https://t.me/your_bot \
//        --platforms tt,th,ig,yt,x --accounts es1,en1 --series rekt,chart,road --withaccount --out links.csv
//
// Колонки:
//   platform, account, series, src         метка источника (tt_es1); игра добавляет к ней серию (tt_es1_rekt)
//   billboard_text                         что писать на билборде в ролике (record.mjs --platforms/--account даёт то же самое)
//   redirect_target                        куда на стороне сайта/трекера вести coinplay.com/<метка> (UTM-ссылка на coinplay.com)
//   hub_link, game_link                    ссылки на хаб и на конкретную игру со всеми параметрами (для link in bio)
//   bot_link                               deep link в бота с параметром start
// Редиректы coinplay.com/<метка> настраиваются на вашей стороне (сервер, Keitaro и т.п.).
import { writeFileSync } from 'node:fs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = next; i++; }
}
const clean = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
const list = (v, d) => String(typeof v === 'string' ? v : d).split(',').map(clean).filter(Boolean);

const domain = typeof args.domain === 'string' ? args.domain : 'coinplay.com';
const base = (typeof args.base === 'string' ? args.base : 'https://example.com').replace(/\/+$/, '');
const bot = typeof args.bot === 'string' ? args.bot : '';
const platforms = list(args.platforms, 'tt,th,ig,yt,x');
const accounts = list(args.accounts, 'main');
const series = list(args.series, 'rekt,chart,road');
const withAccount = !!args.withaccount;
function fail(msg) { console.error('Ошибка: ' + msg); process.exit(1); }
if (!/^https:\/\/[^/\s]+/.test(base)) fail('--base должен быть https-адресом, например https://games.example.com');
if (domain !== 'coinplay.com') fail('--domain: допустим только coinplay.com');
if (bot) { try { const u = new URL(bot); if (u.protocol !== 'https:' || !['t.me', 'telegram.me'].includes(u.hostname)) throw 0; } catch { fail('--bot должен быть https-ссылкой на t.me или telegram.me (игра другие не примет)'); } }
const KNOWN = Object.keys({ rekt: 1, chart: 1, road: 1 });
for (const s of series) if (!KNOWN.includes(s)) fail(`серия "${s}" неизвестна, доступны: ${KNOWN.join(', ')}`);
for (const p of platforms) if (p.includes('_')) fail(`платформа "${p}": знак _ зарезервирован как разделитель платформы и аккаунта`);
for (const [name, arr] of [['platforms', platforms], ['accounts', accounts], ['series', series]]) {
  if (new Set(arr).size !== arr.length) fail(`в --${name} есть повторы`);
}
const out = typeof args.out === 'string' ? args.out : 'links.csv';
const gamePage = { rekt: 'rekt.html', chart: 'chart.html', road: 'index.html' };

const q = (o) => Object.entries(o).filter(([, v]) => v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;

const rows = [['platform', 'account', 'series', 'src', 'billboard_text', 'redirect_target', 'hub_link', 'game_link', 'bot_link']];
for (const p of platforms) for (const acc of accounts) for (const s of series) {
  const tag = p + (withAccount ? '-' + acc : '');
  const src = clean(`${p}_${acc}`);          // игра сама добавляет серию: start=<src>_<игра>
  const start = clean(`${src}_${s}`);
  if (withAccount && `${domain}/${tag}`.length - domain.length - 1 > 24) fail(`метка билборда "${tag}" длиннее 24 знаков`);
  const params = { src, ...(bot ? { bot } : {}) };
  rows.push([
    p, acc, s, src,
    `${domain}/${tag}`,
    `https://${domain}/?${q({ utm_source: p, utm_medium: 'video', utm_campaign: s, utm_content: acc })}`,
    `${base}/play.html?${q(params)}`,
    `${base}/${gamePage[s] || s + '.html'}?${q(params)}`,
    bot ? `${bot}${bot.includes('?') ? '&' : '?'}start=${encodeURIComponent(start)}` : '',
  ]);
}
writeFileSync(out, rows.map((r) => r.map(csv).join(',')).join('\n') + '\n');
console.log(`Готово: ${rows.length - 1} ссылок в ${out}`);
