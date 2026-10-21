// Проверка чата: два браузера, фильтры, лимиты, жалобы, админ, защита. Запуск: node test-chat.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://localhost:${PORT}`;
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn('node', ['server.mjs'], { env: { ...process.env, PORT: String(PORT), ADMIN_TOKEN: 'secret123', MAX_CONN_PER_IP: '30' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res) => srv.stdout.on('data', (d) => String(d).includes('http://') && res()));

const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROME_PATH || undefined });
async function open(lang = 'en', game = 'chart') {
  const ctx = await b.newContext({ viewport: { width: 400, height: 800 } });
  const p = await ctx.newPage(); p.setDefaultTimeout(4000);
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && p.errs.push(m.text()));
  await p.goto(`${BASE}/${game}.html?lang=${lang}`);
  await p.waitForSelector('#chat:not([hidden])', { timeout: 5000 });
  return p;
}
const say = async (p, t) => { await p.fill('#chat input', t); await p.press('#chat input', 'Enter'); };
const texts = (p) => p.$$eval('#chat .m', (n) => n.map((x) => x.textContent));

const a = await open('en'), c = await open('en'), es = await open('es');
ok(await a.evaluate(() => document.body.classList.contains('has-chat')), 'чат появился на странице с сервера');
ok(a.errs.length === 0 && c.errs.length === 0, 'нет ошибок консоли и CSP при подключении по ws ' + a.errs.join('|'));
await say(a, 'UP all the way');
await c.waitForFunction(() => document.querySelector('#chat .ls').textContent.includes('UP all the way'), null, { timeout: 3000 }).then(() => ok(true, 'сообщение дошло до второго браузера'), () => ok(false, 'сообщение дошло до второго браузера'));
ok((await texts(es)).join('').includes('UP all the way') === false, 'другая комната (es) не видит чужой язык');
await sleep(1600);
for (const [t, why] of [['visit coinplay.com now', 'ссылка'], ['write t.me/scamchan', 'telegram'], ['c o i n p l a y (dot) com', 'обход dot'], ['dm me for signals', 'спам'], ['call +34 600 123 456', 'телефон'], ['send to 0x1234567890abcdef1234567890abcdef12345678', 'кошелёк']]) {
  const before = (await texts(a)).length;
  await say(a, t); await sleep(250);
  ok((await texts(a)).length === before, `блок: ${why}`);
  await sleep(1550);
  if (await a.isDisabled('#chat input')) break;
}
ok(await a.isDisabled('#chat input'), 'после серии нарушений пользователь заглушен');
// цены и обычные фразы не блокируются
await say(c, 'level 1008.32 so it is going up. Then down'); await sleep(400);
ok((await texts(c)).join('').includes('1008.32'), 'цены и обычные предложения проходят');
await sleep(1600); await say(c, 'DOWN!!!!!!!!!!!!'); await sleep(300);
ok((await texts(c)).some((t) => t.includes('DOWN!!!!!') && !t.includes('!!!!!!')), 'повтор символов сжимается');
await say(c, 'DOWN!!!!!!!!!!!!'); await sleep(300);
ok(await c.$eval('#chat .nt', (n) => n.textContent.length > 0), 'слишком частые и повторные сообщения отклоняются');
// жалобы
const r1 = await open('en'), r2 = await open('en'), r3 = await open('en'), author = await open('en');
await say(author, 'spammy offer'); await sleep(500);
for (const r of [r1, r2, r3]) { await r.hover('#chat .m:last-child'); await r.click('#chat .m:last-child .rp'); await sleep(150); }
await sleep(400);
ok(!(await texts(c)).join('').includes('spammy offer'), '3 жалобы скрывают сообщение у всех');
// защита: чужой Origin
const wsEvil = new WebSocket(`ws://localhost:${PORT}/chat`, { headers: { Origin: 'https://evil.example' } });
const evil = await new Promise((res) => { wsEvil.on('open', () => res('open')); wsEvil.on('error', () => res('rejected')); wsEvil.on('unexpected-response', () => res('rejected')); });
ok(evil === 'rejected', 'WebSocket с чужого Origin отклонён');
const wsNo = new WebSocket(`ws://localhost:${PORT}/chat`);
ok(await new Promise((res) => { wsNo.on('open', () => res(false)); wsNo.on('error', () => res(true)); wsNo.on('unexpected-response', () => res(true)); }), 'WebSocket без Origin отклонён');
// плохой hello и огромное сообщение
const wsBad = new WebSocket(`ws://localhost:${PORT}/chat`, { headers: { Origin: BASE } });
await new Promise((r) => wsBad.on('open', r)); wsBad.send(JSON.stringify({ t: 'hello', room: '../etc', token: 'x' }));
ok(await new Promise((res) => { wsBad.on('close', () => res(true)); setTimeout(() => res(false), 1500); }), 'неизвестная комната закрывает соединение');
const wsBig = new WebSocket(`ws://localhost:${PORT}/chat`, { headers: { Origin: BASE } });
await new Promise((r) => wsBig.on('open', r)); wsBig.send('x'.repeat(5000));
ok(await new Promise((res) => { wsBig.on('close', () => res(true)); setTimeout(() => res(false), 1500); }), 'слишком большой пакет закрывает соединение');
// админка
const adm = (path, body, token) => fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
ok((await adm('/admin/mute', { nick: 'x' })).status === 401, 'админ без токена: 401');
ok((await adm('/admin/mute', { nick: 'x' }, 'wrong')).status === 401, 'админ с неверным токеном: 401');
await sleep(1600); await say(c, 'hello admin');
await sleep(300);
const myNick = await c.$eval('#chat .m.me b', (n) => n.textContent.replace(/ \(.*\)$/, ''));
ok((await adm('/admin/mute', { nick: myNick, minutes: 5 }, 'secret123')).status === 200, 'админ мутит по нику');
await sleep(1600); await say(c, 'still here?'); await sleep(300);
ok(await c.isDisabled('#chat input'), 'после админ-мута ввод отключён');
// статика: лишние файлы не отдаются
for (const f of ['/server.mjs', '/package.json', '/../etc/passwd', '/node_modules/ws/package.json', '/record.mjs']) {
  const r = await fetch(BASE + f); ok(r.status === 404, `${f} не отдаётся`);
}
// без сервера чата страница работает как раньше
const f = await b.newPage(); const ferr = []; f.on('pageerror', (e) => ferr.push(e.message));
await f.goto('file:///home/claude/coinplay-road/chart.html?lang=en'); await f.waitForTimeout(500);
ok(await f.$eval('#chat', (n) => n.hidden).catch(() => true) && ferr.length === 0, 'file://: чата нет, игра без ошибок');
for (const g of ['rekt', 'index']) { const p = await open('ru', g); ok(await p.isVisible('#chat'), `${g}.html: чат подключается`); }
await b.close(); srv.kill();
console.log(bad ? `\nПровалено: ${bad}` : '\nВсё прошло');
process.exit(bad ? 1 : 0);
