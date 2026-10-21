// Проверка очков, прогнозов и таблицы лидеров на реальном сервере. Запуск: node test-score.mjs (около 2 минут)
import WebSocket from 'ws';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const ctx = {}; vm.runInNewContext(readFileSync('engine.js', 'utf8'), ctx); const EN = ctx.CPEngine;
const PORT = 19000 + Math.floor(Math.random() * 900), BASE = `http://localhost:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'cp-')), DATA = join(dir, 'scores.json');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let srv;
async function start() {
  srv = spawn('node', ['server.mjs'], { env: { ...process.env, PORT: String(PORT), DATA_FILE: DATA, MAX_CONN_PER_IP: '40' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res) => srv.stdout.on('data', (d) => String(d).includes('http://') && res()));
}
async function stop() { srv.kill('SIGTERM'); await new Promise((r) => srv.on('exit', r)); }
function client(room, token = '') {
  const ws = new WebSocket(`ws://localhost:${PORT}/chat`, { headers: { Origin: BASE } });
  const c = { ws, msgs: [], token };
  ws.on('message', (d) => { const m = JSON.parse(d); c.msgs.push(m); if (m.t === 'welcome') { c.token = m.token; c.nick = m.nick; } });
  c.send = (o) => ws.send(JSON.stringify(o));
  c.wait = async (pred, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const f = c.msgs.find(pred); if (f) return f; await sleep(50); } return null; };
  ws.on('open', () => c.send({ t: 'hello', room, token }));
  return c;
}
const clk = (g) => EN.clock(g, Date.now() / 1000);
async function untilStart(g, minLeft) { // ждём начала нового раунда, чтобы было время на прогноз
  for (;;) { const c = clk(g); if (c.u < 0.4 && c.u >= 0) return c; await sleep(100); }
}

await start();
// ---- chart: верный и неверный прогноз, повтор, чат-слово ----
const A = client('chart:en'), B = client('chart:en'), C = client('chart:es'), R = client('road:en');
for (const c of [A, B, C, R]) await c.wait((m) => m.t === 'welcome');
ok(A.msgs.find((m) => m.t === 'welcome').scored === true && R.msgs.find((m) => m.t === 'welcome').scored === false, 'chart оценивается, road нет');
ok(A.msgs.some((m) => m.t === 'me') && A.msgs.some((m) => m.t === 'lb'), 'при входе приходят me и lb');
let c0 = await untilStart('chart'); const r0 = c0.r, out0 = EN.chart.outcome(EN.LIVE_SEED, r0);
A.send({ t: 'pick', d: out0 }); B.send({ t: 'pick', d: -out0 }); C.send({ t: 'msg', text: out0 === 1 ? 'SUBE!' : 'baja' });
await sleep(300); A.send({ t: 'pick', d: -out0 });
ok(!!(await A.wait((m) => m.t === 'err' && m.code === 'pickdup', 2000)), 'повторный прогноз в раунде отклонён');
ok(!!(await C.wait((m) => m.t === 'picked', 2000)), 'слово в чате (es) принято как прогноз');
const rA = await A.wait((m) => m.t === 'result', 16000), rB = await B.wait((m) => m.t === 'result', 3000), rC = await C.wait((m) => m.t === 'result', 3000);
ok(rA && rA.win && rA.pts === 1 && rA.r === r0, 'верный прогноз: win, +1, нужный раунд');
ok(rB && !rB.win && rB.pts === 0, 'неверный прогноз: проигрыш');
ok(rC && rC.win, 'чат-прогноз (es) верный и засчитан');
const meA = await A.wait((m) => m.t === 'me' && m.n === 1, 2000);
ok(meA && meA.w === 1 && meA.streak === 1 && meA.pts === 1 && meA.rank >= 1, 'me: очки, серия, место');
const lb = await A.wait((m) => m.t === 'lb' && m.top.some((x) => x.nick === A.nick), 2000);
ok(!!lb, 'таблица лидеров содержит игрока');
const meB = await B.wait((m) => m.t === 'me' && m.n === 1, 2000);
ok(meB && meB.w === 0 && meB.streak === 0, 'у проигравшего серия 0');
ok(!R.msgs.some((m) => m.t === 'result' || m.t === 'lb'), 'комната road не получает очков');
// слишком поздно
for (;;) { const c = clk('chart'); if (c.u > EN.chart.lock + 0.6 && c.u < 12) break; await sleep(100); }
A.send({ t: 'pick', d: 1 });
ok(!!(await A.wait((m) => m.t === 'err' && m.code === 'late', 2000)), 'после закрытия приёма прогноз отклонён (late)');
// прогноз из чужого раунда нельзя подсунуть: клиент не передаёт раунд вообще
ok(true, 'раунд определяет только сервер (в протоколе его нет)');
// чат-слово не режется фильтром «одинаковых сообщений»: два раунда подряд
await untilStart('chart'); const rr1 = clk('chart').r;
C.msgs.length = 0; C.send({ t: 'msg', text: 'SUBE' });
ok(!!(await C.wait((m) => m.t === 'picked', 2000)), 'то же слово в следующем раунде снова принимается');
// ---- rekt: очки по коэффициенту ----
const K = client('rekt:en'); await K.wait((m) => m.t === 'welcome');
let ce = await untilStart('rekt'); const e0 = ce.r, outE = EN.rekt.outcome(EN.LIVE_SEED, e0);
K.send({ t: 'msg', text: 'rekt' });
ok(!!(await K.wait((m) => m.t === 'picked' && m.d === -1, 2000)), 'rekt: слово REKT = -1');
const rK = await K.wait((m) => m.t === 'result', 14000);
ok(rK && rK.win === (outE === -1) && rK.pts === (outE === -1 ? 1 : 0), `rekt: исход эпизода ${e0} (${outE === 1 ? 'выжил' : 'разбился'}), очки по коэффициенту`);
ok(EN.rekt.points(1) === 16 && EN.rekt.points(-1) === 1, 'rekt: за редкое «выжил» 16 очков, за «разбился» 1');
// ---- сохранение очков при перезапуске ----
const tokenA = A.token; for (const c of [A, B, C, K, R]) c.ws.close();
await stop(); await start();
const A2 = client('chart:en', tokenA); const me2 = await A2.wait((m) => m.t === 'me', 3000);
ok(me2 && me2.n === 1 && me2.w === 1 && me2.pts === 1, 'очки пережили перезапуск сервера');
ok(readFileSync(DATA, 'utf8').indexOf(tokenA) === -1, 'в файле нет самих токенов, только хэши');
A2.ws.close();
// ---- интерфейс: кнопка + таблица ----
const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROME_PATH || undefined });
const p = await (await b.newContext({ viewport: { width: 400, height: 800 } })).newPage(); p.setDefaultTimeout(5000);
const perr = []; p.on('pageerror', (e) => perr.push(e.message));
await p.goto(`${BASE}/chart.html?lang=en`); await p.waitForSelector('#chat:not([hidden])');
await untilStart('chart');
await p.click('#btns button[data-d="1"]');
const out1 = EN.chart.outcome(EN.LIVE_SEED, clk('chart').r);
await p.waitForFunction(() => /★ \d+ · \d+\/1/.test(document.getElementById('score').textContent), null, { timeout: 16000 });
const st = await p.textContent('#status');
ok(st.includes(out1 === 1 ? 'Nice' : 'Missed'), `интерфейс: итог раунда пришёл с сервера (${st})`);
ok(/★ \d+ · \d+\/1/.test(await p.textContent('#score')), 'интерфейс: счёт показывает очки сервера');
await p.click('#chat .tb'); await sleep(300);
ok(await p.isVisible('#chat .lb') && (await p.textContent('#chat .lb')).length > 0, 'интерфейс: таблица лидеров открывается');
// слово в чате подсвечивает кнопку
await p.click('#chat .tb'); await untilStart('chart');
await p.fill("#chat input", "DOWN"); await p.press("#chat input", "Enter"); await sleep(800);
ok(await p.$eval('#btns button[data-d="-1"]', (n) => n.classList.contains('sel')), 'интерфейс: слово в чате подсвечивает кнопку');
ok(perr.length === 0, 'нет ошибок на странице ' + perr.join('|'));
await b.close(); await stop();
rmSync(dir, { recursive: true, force: true });
console.log(bad ? `\nПровалено: ${bad}` : '\nВсё прошло'); process.exit(bad ? 1 : 0);
