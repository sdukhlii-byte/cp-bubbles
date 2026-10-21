// Живая гонка на сервере: цикл, ставки, закрытие, итог, очки, детерминизм. Запуск: node test-race.mjs (около 1.5 минуты)
import WebSocket from 'ws';
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
const ctx = {}; vm.runInNewContext(readFileSync('engine.js', 'utf8'), ctx); const EN = ctx.CPEngine;
const rc = {}; vm.runInNewContext(readFileSync('racecore.js', 'utf8'), rc); const RC = rc.CPRace; RC.setLen(RC.DEFLEN);
const PORT = 19900 + Math.floor(Math.random() * 90), BASE = `http://localhost:${PORT}`;
const DATA = join(mkdtempSync(join(tmpdir(), 'cpr-')), 's.json');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn('node', ['server.mjs'], { env: { ...process.env, PORT: String(PORT), DATA_FILE: DATA, MAX_CONN_PER_IP: '40' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res) => srv.stdout.on('data', (d) => String(d).includes('http://') && res()));
function client(token = '') {
  const ws = new WebSocket(`ws://localhost:${PORT}/chat`, { headers: { Origin: BASE } });
  const c = { ws, msgs: [], token };
  ws.on('message', (d) => { const m = JSON.parse(d); c.msgs.push(m); if (m.t === 'welcome') c.token = m.token; });
  c.send = (o) => ws.send(JSON.stringify(o));
  c.wait = async (p, ms = 50000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const f = c.msgs.find(p); if (f) return f; await sleep(50); } return null; };
  ws.on('open', () => c.send({ t: 'hello', room: 'race:en', token }));
  return c;
}
const cyc = () => { const T = Date.now() / 1000 - EN.EPOCH; return { n: Math.floor(T / 40), u: T % 40 }; };
// ждём начала цикла с запасом на ставки
for (;;) { const c = cyc(); if (c.u > 0.5 && c.u < 3) break; await sleep(100); }
const A = client(), B = client();
const rA = await A.wait((m) => m.t === 'round'); await B.wait((m) => m.t === 'round');
ok(rA && rA.names.length === 8 && new Set(rA.names).size === 8, 'раунд: 8 разных участников');
ok(!A.msgs.some((m) => m.t === 'rlock'), 'до закрытия ставок simSeed не раскрыт');
const win0 = rA.names;
A.send({ t: 'pick', d: 2 }); B.send({ t: 'pick', d: 99 });
const pk = await A.wait((m) => m.t === 'picked');
ok(pk && pk.name === win0[2], 'ставка по индексу принята: ' + (pk && pk.name));
A.send({ t: 'pick', d: 3 }); await sleep(300);
ok(A.msgs.filter((m) => m.t === 'picked').length === 1, 'повторная ставка отклонена');
ok(!B.msgs.some((m) => m.t === 'picked'), 'неверный индекс не принят');
const lock = await A.wait((m) => m.t === 'rlock');
ok(lock && Number.isInteger(lock.simSeed), 'после 7 с выдан simSeed');
A.send({ t: 'pick', d: 4 }); await sleep(300);
ok(A.msgs.filter((m) => m.t === 'picked').length === 1, 'ставка после закрытия не принята');
// детерминизм: клиент по simSeed получает тот же победитель, что объявил сервер
const an = RC.analyze(lock.simSeed, rA.names.map((n) => RC.persOf(n) === 'degen'));
const end = await A.wait((m) => m.t === 'rend');
ok(end && end.win === rA.names[an.win], `итог сервера = пересчёт клиента (${end && end.win})`);
ok(end && Math.abs(end.tf - an.tf) < 1e-9 && end.tf >= 21 && end.tf <= 28.5, 'длительность гонки в окне 21–28 с: ' + (end && end.tf.toFixed(1)));
const res = await A.wait((m) => m.t === 'result' && m.game === 'race', 5000);
ok(res && res.win === (rA.names[2] === end.win), 'результат ставки совпадает с победителем');
// поздний вход получает состояние
const L = client(); const lr = await L.wait((m) => m.t === 'round');
ok(lr && lr.n >= rA.n, 'поздний зритель получает текущий цикл');
// слова чата становятся участниками следующего цикла
for (const w of ['zorp', 'zorp', 'blip']) { const x = client(); await x.wait((m) => m.t === 'welcome'); await sleep(1300); x.send({ t: 'msg', text: w }); }
await sleep(500);
const next = await A.wait((m) => m.t === 'round' && m.n > rA.n, 45000);
ok(next && next.names.includes('zorp') && next.names.includes(end.win), 'следующий цикл: слово из чата + чемпион ' + (next && next.names.join(',')));
srv.kill('SIGTERM');
console.log(bad ? `FAILED: ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
