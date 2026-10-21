// Сервер: раздаёт игры и держит анонимный чат (WebSocket /chat). Запуск: node server.mjs
//
// Переменные окружения:
//   PORT              порт (Railway задаёт сам), по умолчанию 8080
//   ADMIN_TOKEN       секрет для модерации по HTTP; пусто = админ-команды выключены
//   ALLOWED_ORIGINS   через запятую, например https://games.example.com; пусто = только тот же хост
//   TRUST_PROXY=1     включить, если сервер стоит за прокси (Railway): IP берётся из X-Forwarded-For
//   DATA_FILE         файл, где хранятся очки (по умолчанию ./data/scores.json); на Railway укажите путь на томе, например /data/scores.json
//   MAX_CONN_PER_IP   лимит соединений чата с одного адреса (10)
//   FRAME_ANCESTORS   кто может встраивать страницы в iframe (по умолчанию 'self')
//
// Чат анонимный: ник выдаёт сервер по случайному токену из браузера. IP в памяти хранится только
// в виде соленого хэша (для лимитов и мутов), в журнал ничего не пишется. История и муты живут в памяти:
// после перезапуска они сбрасываются.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { WebSocketServer } from 'ws';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = +process.env.PORT || 8080;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const FRAME_ANCESTORS = process.env.FRAME_ANCESTORS || "'self'";
const SALT = crypto.randomBytes(16);
const DATA_FILE = process.env.DATA_FILE || join(ROOT, 'data', 'scores.json');

// общее ядро: то же, что считают страницы (engine.js), здесь оно решает, кто угадал
const engineCtx = {};
vm.runInNewContext(readFileSync(join(ROOT, 'engine.js'), 'utf8'), engineCtx, { timeout: 1000 });
const EN = engineCtx.CPEngine;
const raceCtx = {};
vm.runInNewContext(readFileSync(join(ROOT, 'racecore.js'), 'utf8'), raceCtx, { timeout: 1000 });
const RC = raceCtx.CPRace;
const RACE = { CYC: 40, LOCK: 7, START: 10, LEN: RC.DEFLEN, TMIN: 21, TMAX: 26, PTS: 7 };   // цикл 40 с: ставки до 7-й секунды, гонка с 10-й
RC.setLen(RACE.LEN);
const SCORED = ['chart', 'rekt', 'race'];  // для road очков нет: раунд там конечный и у каждого свой
const GRACE = 0.35;                // запас секунд на задержку сети после закрытия приёма прогнозов

// ---------------- настройки чата ----------------
const GAMES = ['chart', 'rekt', 'road', 'race'];
const LANGS = ['ru', 'en', 'es', 'pt', 'de', 'tr', 'lv', 'lt', 'hr', 'sr'];
const ROOM_RE = new RegExp(`^(${GAMES.join('|')}):(${LANGS.join('|')})$`);
const MAX_LEN = 200;
const HISTORY = 50;
const MIN_GAP_MS = 1500;          // между сообщениями одного пользователя
const BURST = { n: 5, ms: 20000 }; // не больше 5 сообщений за 20 секунд
const MAX_CONN_PER_IP = +process.env.MAX_CONN_PER_IP || 10;
const STRIKES_FOR_MUTE = 3;       // блокировок фильтра за 10 минут до мута
const MUTE_BASE_MS = 10 * 60 * 1000;
const REPORTS_TO_HIDE = 3;

// ---------------- фильтры (стартовый набор, дополняйте под свою аудиторию) ----------------
const TLD = 'com|net|org|io|me|ru|xyz|bet|gg|co|app|link|top|club|site|online|cc|ly|to|tk|ml|ga|cf|gq|info|win|vip|pro|live|casino|ink|click|fun|store|shop|one|lt|lv|es|hr|rs|de|tr|pt';
const LINK_RES = [
  /https?:|www\./,
  new RegExp(`\\b[a-z0-9-]{2,}\\.(${TLD})\\b`),
  /t\.me|telegram|whatsapp|wa\.me|discord\.gg|signal\.me|viber|instagram\.com|tiktok\.com/,
  /(^|\s)@[a-z0-9_]{4,}/,
  /\+?\d(?:[\s()-]?\d){8,}/,                    // телефоны и длинные числа (цены вида 1008.32 не задеваются)
  /\b(0x[a-f0-9]{20,}|bc1[a-z0-9]{20,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|t[a-z0-9]{33})\b/i, // адреса кошельков
];
const SPAM_RES = [
  /\b(signals?|pump\s*group|guaranteed\s*(profit|income|win)|dm\s*me|inbox\s*me|double\s*your|giveaway|airdrop|recover(y)?\s*(funds|crypto|wallet)|seed\s*phrase|private\s*key)\b/i,
  /(сигнал(ы|ов)|пиши(те)?\s*в\s*(лс|личку)|гарантирован\w+\s*(доход|заработок|профит)|раздач[аи]|удвоим|восстановлени\w+\s*(средств|кошельк))/i,
  /(se[ñn]ales\s*de\s*trading|ganancias\s*garantizadas|escr[ií]beme\s*al\s*privado|sorteo\s*de\s*cripto)/i,
];
function normalize(text) {
  return String(text)
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function deobfuscate(t) {
  return t.toLowerCase()
    .replace(/\s*[\[({]\s*(dot|punto|точка)\s*[\])}]\s*/g, '.')   // coinplay(dot)com
    .replace(/\s+(dot|punto|точка)\s+/g, '.')                      // coinplay dot com
    .replace(/\s*[\[({]\s*\.\s*[\])}]\s*/g, '.');               // coinplay[.]com
}
function checkText(raw) {
  let t = normalize(raw);
  if (!t) return { ok: false, code: 'empty' };
  if (t.length > MAX_LEN) t = t.slice(0, MAX_LEN);
  t = t.replace(/(.)\1{5,}/gu, '$1$1$1$1$1');                 // «аааааааа» превращается в «ааааа»
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length > 12 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) t = t.toLowerCase();
  const d = deobfuscate(t);
  if (LINK_RES.some((re) => re.test(d))) return { ok: false, code: 'link', strike: true };
  // обход «c o i n p l a y (dot) com»: если текст маскировали, склеиваем и проверяем домены ещё раз
  if (d !== t.toLowerCase() || /(?:(?:^|\s)\p{L}(?=\s)){4,}/u.test(d)) {
    const sq = d.replace(/\s+/g, '');
    if (LINK_RES[1].test(sq) || LINK_RES[2].test(sq)) return { ok: false, code: 'link', strike: true };
  }
  if (SPAM_RES.some((re) => re.test(d))) return { ok: false, code: 'spam', strike: true };
  return { ok: true, text: t };
}

// ---------------- состояние ----------------
const ADJ = ['Brave', 'Calm', 'Lucky', 'Sneaky', 'Swift', 'Sleepy', 'Bold', 'Witty', 'Cosmic', 'Neon', 'Golden', 'Silent', 'Wild', 'Chill', 'Sharp', 'Rapid'];
const ANI = ['Fox', 'Wolf', 'Otter', 'Hawk', 'Panda', 'Lynx', 'Bull', 'Bear', 'Falcon', 'Shark', 'Tiger', 'Koala', 'Raven', 'Gecko', 'Moose', 'Cobra'];
const rooms = new Map();                 // room -> { clients:Set, history:[], reports:Map }
const users = new Map();                 // token -> { nick, strikes:[ts], mutes:n, mutedUntil, last, recent:[ts], lastText, lastTextAt, repAt:[ts] }
const ipConns = new Map();               // ipHash -> число соединений
const ipMute = new Map();                // ipHash -> mutedUntil
const nickToToken = new Map();
let msgSeq = 1;

const sha = (s) => crypto.createHash('sha256').update(s).digest();
const ipHash = (ip) => crypto.createHash('sha256').update(SALT).update(String(ip)).digest('hex').slice(0, 16);
function nickFor(token) {
  const h = sha(token);
  return ADJ[h[0] % ADJ.length] + ANI[h[1] % ANI.length] + (h[2] % 100);
}
function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, { game: name.split(':')[0], clients: new Set(), history: [], reports: new Map() });
  return rooms.get(name);
}
function getUser(token) {
  let u = users.get(token);
  if (!u) {
    if (users.size > 50000) pruneUsers(true);
    u = { nick: nickFor(token), strikes: [], mutes: 0, mutedUntil: 0, last: 0, recent: [], lastText: '', lastTextAt: 0, repAt: [], seen: Date.now() };
    users.set(token, u);
    nickToToken.set(u.nick, token);
  }
  u.seen = Date.now();
  return u;
}
function pruneUsers(force) {
  const now = Date.now();
  for (const [tok, u] of users) {
    if (now - u.seen > 6 * 3600 * 1000 && u.mutedUntil < now || force && now - u.seen > 600000 && u.mutedUntil < now) {
      users.delete(tok);
      if (nickToToken.get(u.nick) === tok) nickToToken.delete(u.nick);
    }
  }
  for (const [k, until] of ipMute) if (until < now) ipMute.delete(k);
}
setInterval(pruneUsers, 10 * 60 * 1000).unref();

function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(room, obj) { const s = JSON.stringify(obj); for (const c of room.clients) if (c.readyState === 1) c.send(s); }
function publicMsg(m) { return { id: m.id, nick: m.nick, text: m.text, ts: m.ts, pk: m.pk || undefined }; }

function addStrike(u, ws) {
  const now = Date.now();
  u.strikes = u.strikes.filter((t) => now - t < 10 * 60 * 1000);
  u.strikes.push(now);
  if (u.strikes.length >= STRIKES_FOR_MUTE) {
    u.strikes = [];
    u.mutes++;
    const dur = Math.min(24 * 3600 * 1000, MUTE_BASE_MS * 3 ** (u.mutes - 1));
    u.mutedUntil = now + dur;
    // мут по IP только для повторных нарушителей и не дольше часа: за одним IP может сидеть много людей (мобильные сети)
    if (ws && ws._ip && u.mutes >= 2) ipMute.set(ws._ip, now + Math.min(dur, 3600000));
    return dur;
  }
  return 0;
}
function isMuted(u, ws) {
  const now = Date.now();
  return Math.max(u.mutedUntil, (ws._ip && ipMute.get(ws._ip)) || 0) > now
    ? Math.max(u.mutedUntil, ipMute.get(ws._ip) || 0) : 0;
}

// ---------------- очки, прогнозы, таблица лидеров ----------------
const board = { chart: new Map(), rekt: new Map(), race: new Map() };    // ключ = обрезанный хэш токена
const pending = { chart: new Map(), rekt: new Map(), race: new Map() }; // раунд -> Map(токен -> +1/-1)
const lastResolved = { chart: null, rekt: null, race: null };
const standing = { chart: { top: [], rank: new Map() }, rekt: { top: [], rank: new Map() }, race: { top: [], rank: new Map() } };
const userSockets = new Map();                          // токен -> набор соединений
let dirty = false;
const dayKey = () => new Date().toISOString().slice(0, 10);   // день по UTC
const tkey = (token) => sha(token).toString('hex').slice(0, 16);
const nickOf = (token) => (users.get(token) && users.get(token).nick) || nickFor(token);
function freshDay(r) { const d = dayKey(); if (r.day !== d) { r.day = d; r.dpts = 0; r.dw = 0; r.dn = 0; } return r; }
function peekRec(game, token) { const r = board[game].get(tkey(token)); return r ? freshDay(r) : null; }
function getRec(game, token) {
  const k = tkey(token);
  let r = board[game].get(k);
  if (!r) { r = { nick: nickOf(token), w: 0, n: 0, streak: 0, best: 0, pts: 0, day: dayKey(), dpts: 0, dw: 0, dn: 0, seen: 0 }; board[game].set(k, r); }
  r.nick = nickOf(token); r.seen = Date.now();
  return freshDay(r);
}
// статистический фильтр: если ответы раунда вычисляет скрипт, точность будет нереальной (случайный игрок даёт ~50% в chart и ~1 очко за прогноз в rekt)
function suspicious(game, r) {
  if (game === 'chart') return r.n >= 50 && r.w / r.n > 0.8;
  if (game === 'race') return r.n >= 60 && r.w / r.n > 0.45;   // случайный игрок угадывает 1 из 8 (12,5%)
  return r.n >= 60 && r.pts / r.n > 1.6;
}
function rebuild(game) {
  const rows = [];
  for (const [k, r] of board[game]) { freshDay(r); if (r.dn > 0 && !suspicious(game, r)) rows.push([k, r]); }
  rows.sort((a, b) => b[1].dpts - a[1].dpts || b[1].dw - a[1].dw || a[1].dn - b[1].dn || a[1].seen - b[1].seen);
  const rank = new Map(); rows.forEach(([k], i) => rank.set(k, i + 1));
  standing[game] = { rank, top: rows.slice(0, 10).map(([, r]) => ({ nick: r.nick, pts: r.dpts, w: r.dw, n: r.dn, streak: r.streak })) };
}
function meMsg(game, token) {
  const r = peekRec(game, token);
  const rank = r && standing[game].rank.get(tkey(token));
  return { t: 'me', game, pts: r ? r.dpts : 0, w: r ? r.dw : 0, n: r ? r.dn : 0, streak: r ? r.streak : 0, best: r ? r.best : 0, rank: rank || null };
}
function sendToUser(token, obj) { const set = userSockets.get(token); if (set) for (const w of set) send(w, obj); }
function broadcastGame(game, obj) { for (const room of rooms.values()) if (room.game === game) broadcast(room, obj); }

function acceptPick(ws, pick) {
  const game = ws._room.game;
  if (game === 'race') return acceptRacePick(ws, pick);
  if (!SCORED.includes(game)) return 'noscore';
  const c = EN.clock(game, Date.now() / 1000), d = EN[game];
  if (c.u >= d.lock + GRACE) return 'late';
  let m = pending[game].get(c.r);
  if (!m) pending[game].set(c.r, (m = new Map()));
  if (m.has(ws._token)) return 'pickdup';
  m.set(ws._token, pick);
  return 'ok';
}
function resolveRound(game, r) {
  const d = EN[game], outcome = d.outcome(EN.LIVE_SEED, r), picks = pending[game].get(r);
  pending[game].delete(r);
  if (!picks || !picks.size) return;
  const pts = d.points(outcome);
  for (const [token, pick] of picks) {
    const rec = getRec(game, token);
    rec.n++; rec.dn++;
    if (pick === outcome) { rec.w++; rec.dw++; rec.pts += pts; rec.dpts += pts; rec.streak++; rec.best = Math.max(rec.best, rec.streak); }
    else rec.streak = 0;
  }
  dirty = true;
  rebuild(game);
  for (const [token, pick] of picks) sendToUser(token, { t: 'result', game, r, win: pick === outcome, pts: pick === outcome ? pts : 0, outcome });
  for (const token of picks.keys()) sendToUser(token, meMsg(game, token));
  broadcastGame(game, { t: 'lb', game, top: standing[game].top });
}
setInterval(() => {
  const now = Date.now() / 1000;
  for (const game of SCORED) {
    if (game === 'race') continue;
    const c = EN.clock(game, now), d = EN[game];
    const target = c.u >= d.resolveAt ? c.r : c.r - 1;
    if (lastResolved[game] === null) { lastResolved[game] = target; continue; }
    for (let r = lastResolved[game] + 1; r <= target && r <= lastResolved[game] + 5; r++) resolveRound(game, r);
    lastResolved[game] = target;
    for (const k of [...pending[game].keys()]) if (k < target - 3) pending[game].delete(k);
  }
}, 200).unref();

// ---------------- гонка: общий эфир 24/7 ----------------
// Цикл RACE.CYC секунд по общим часам: 0..LOCK ставки (имена участников известны), в LOCK выдаётся seed и приём ставок закрывается,
// с START идёт гонка, после финиша показывается итог. Участники: слова из чата прошлого цикла (по числу разных авторов), победитель прошлой гонки остаётся.
// До закрытия ставок seed скрыт, поэтому победителя нельзя вычислить заранее.
const NAME_RE = /^[a-z0-9_]{2,10}$/;
const NAME_BLOCK = /(nigg|fagg|kike|chink|spic|retard|nazi|hitler|rape|pedo|cunt|whore|slut|bitch|fuck|shit|dick|cock|porn|isis|suicid|^sex|^kill)/;
const NAME_SKIP = new Set(['admin', 'mod', 'mods', 'moderator', 'up', 'down', 'gm', 'lol', 'lmao', 'ez', 'wtf', 'bruh', 'ok', 'no', 'yes', 'hi', 'hello', 'the', 'and', 'you']);
let race = null;                       // текущий цикл
let raceWords = new Map();             // слово -> Set(токены): кандидаты на следующий цикл
let prevWinner = null;
const raceCycle = (nowMs) => Math.floor((nowMs - EN.EPOCH * 1000) / (RACE.CYC * 1000));
function raceNominate(token, word) {
  if (!NAME_RE.test(word) || /^[0-9_]+$/.test(word) || NAME_BLOCK.test(word) || NAME_SKIP.has(word)) return;
  let set = raceWords.get(word);
  if (!set) { if (raceWords.size >= 300) return; raceWords.set(word, (set = new Set())); }
  if (set.size < 1000) set.add(token);
}
function raceRoster(n, words) {
  const names = [];
  if (prevWinner) names.push(prevWinner);       // чемпион прошлой гонки остаётся
  const ranked = [...words].map(([w, set]) => [w, set.size, RC.mulberry32(n * 2654435761 ^ w.length * 97 ^ w.charCodeAt(0))()])
    .sort((a, b) => b[1] - a[1] || a[2] - b[2]);
  for (const [w] of ranked) if (names.length < 8 && !names.includes(w)) names.push(w);
  const rnd = RC.mulberry32(n * 40503 + 7), pool = RC.DEFNAMES.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  for (const w of pool) if (names.length < 8 && !names.includes(w)) names.push(w);
  return names;
}
function raceMsg(r) { return { t: 'round', n: r.n, names: r.names, startMs: EN.EPOCH * 1000 + r.n * RACE.CYC * 1000, cyc: RACE.CYC, lock: RACE.LOCK, start: RACE.START, len: RACE.LEN, champ: r.champ }; }
function raceLockMsg(r) { return { t: 'rlock', n: r.n, simSeed: r.plan.simSeed, len: RACE.LEN }; }
function raceEndMsg(r) { return { t: 'rend', n: r.n, win: r.names[r.plan.win], tf: r.plan.tf }; }
function raceBroadcast(obj) { broadcastGame('race', obj); }
function raceBegin(n, late) {
  if (late) { race = { n, names: [], champ: -1, picks: new Map(), plan: null, locked: true, ended: true, skip: true, it: null }; return; }   // сервер стартовал посреди цикла: этот цикл пропускаем, чтобы не считать гонку в спешке
  const names = raceRoster(n, raceWords);
  raceWords = new Map();
  race = { n, names, champ: prevWinner && names[0] === prevWinner ? 0 : -1, picks: new Map(), plan: null, locked: false, ended: false, it: RC.planIter(n, names, { tmin: RACE.TMIN, tmax: RACE.TMAX, max: 40 }) };
  const step = () => { if (!race || race.n !== n || race.plan) return; race.it.next(); if (race.it.done) racePlanDone(race); else setImmediate(step); };
  setImmediate(step);
  raceBroadcast(raceMsg(race));
}
function racePlanDone(r) {
  const b = r.it.best;
  r.plan = { simSeed: b.simSeed, win: b.a.win, tf: b.a.tf, gap: b.a.gap, extra: RC.warpOf(b.a, true).extra };
}
function raceTick() {
  const nowMs = Date.now(), n = raceCycle(nowMs);
  const u = (nowMs - EN.EPOCH * 1000) / 1000 - n * RACE.CYC;
  if (!race || race.n !== n) { if (race && !race.ended) raceFinish(race); raceBegin(n, u > 2.5); }
  if (race.skip) return;
  if (!race.locked && u >= RACE.LOCK) {
    race.it.max = Math.min(race.it.max, race.it.v + 6);
    while (!race.plan) { race.it.next(); if (race.it.done) racePlanDone(race); }   // на случай, если перебор не успел (не больше 6 вариантов подряд)
    race.locked = true; raceBroadcast(raceLockMsg(race));
  }
  if (race.locked && !race.ended && u >= RACE.START + race.plan.tf + race.plan.extra + 0.4) raceFinish(race);
}
function raceFinish(r) {
  if (r.ended) return; r.ended = true;
  if (!r.plan) { while (!r.plan) { r.it.next(); if (r.it.done) racePlanDone(r); } }
  const win = r.plan.win; prevWinner = r.names[win];
  if (r.picks.size) {
    for (const [token, idx] of r.picks) {
      const rec = getRec('race', token); rec.n++; rec.dn++;
      if (idx === win) { rec.w++; rec.dw++; rec.pts += RACE.PTS; rec.dpts += RACE.PTS; rec.streak++; rec.best = Math.max(rec.best, rec.streak); }
      else rec.streak = 0;
    }
    dirty = true; rebuild('race');
    for (const [token, idx] of r.picks) sendToUser(token, { t: 'result', game: 'race', r: r.n, win: idx === win, pts: idx === win ? RACE.PTS : 0, outcome: r.names[win] });
    for (const token of r.picks.keys()) sendToUser(token, meMsg('race', token));
    broadcastGame('race', { t: 'lb', game: 'race', top: standing.race.top });
  }
  raceBroadcast(raceEndMsg(r));
}
function acceptRacePick(ws, idx) {
  if (!race || race.locked || (Date.now() - EN.EPOCH * 1000) / 1000 - race.n * RACE.CYC >= RACE.LOCK) return 'late';
  if (!Number.isInteger(idx) || idx < 0 || idx > 7) return 'noscore';
  if (race.picks.has(ws._token)) return 'pickdup';
  race.picks.set(ws._token, idx);
  return 'ok';
}
function raceSendState(ws) {
  if (!race || race.skip) return;
  send(ws, raceMsg(race));
  if (race.locked) send(ws, raceLockMsg(race));
  if (race.ended) send(ws, raceEndMsg(race));
  const idx = race.picks.get(ws._token);
  if (idx !== undefined) send(ws, { t: 'picked', ok: true, d: idx + 1, name: race.names[idx] });
}
setInterval(raceTick, 200).unref();

// хранение очков: файл JSON, ключи только хэши токенов; записи старше 30 дней удаляются
function loadScores() {
  try {
    const j = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    for (const g of SCORED) for (const [k, r] of Object.entries(j[g] || {})) board[g].set(k, r);
    for (const g of SCORED) rebuild(g);
    console.log(`очки загружены: ${SCORED.map((g) => g + ' ' + board[g].size).join(', ')}`);
  } catch (e) { if (e.code !== 'ENOENT') console.warn('не удалось прочитать', DATA_FILE, e.message); }
}
function saveScores() {
  if (!dirty) return;
  try {
    const cut = Date.now() - 30 * 86400000, out = { v: 1 };
    for (const g of SCORED) {
      for (const [k, r] of board[g]) if (r.seen < cut) board[g].delete(k);
      out[g] = Object.fromEntries([...board[g]].sort((a, b) => b[1].seen - a[1].seen).slice(0, 5000));
    }
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    writeFileSync(DATA_FILE + '.tmp', JSON.stringify(out));
    renameSync(DATA_FILE + '.tmp', DATA_FILE);
    dirty = false;
  } catch (e) { console.warn('не удалось сохранить очки:', e.message); }
}
loadScores();
setInterval(saveScores, 30000).unref();
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { saveScores(); process.exit(0); });

function onMessage(ws, text) {
  const u = ws._user, room = ws._room, now = Date.now();
  const mutedUntil = isMuted(u, ws);
  if (mutedUntil) return send(ws, { t: 'err', code: 'muted', until: mutedUntil });
  u.recent = u.recent.filter((t) => now - t < BURST.ms);
  if (now - u.last < MIN_GAP_MS || u.recent.length >= BURST.n) return send(ws, { t: 'err', code: 'slow' });
  const r = checkText(text);
  if (!r.ok) {
    if (r.strike) {
      const dur = addStrike(u, ws);
      send(ws, dur ? { t: 'err', code: 'muted', until: now + dur } : { t: 'err', code: r.code });
    } else send(ws, { t: 'err', code: r.code });
    return;
  }
  let pk = room.game === 'race' ? 0 : EN.parsePick(room.game, r.text);   // «UP», «ВНИЗ», «REKT» и т. п. считаются прогнозом
  if (room.game === 'race') {
    const w = r.text.toLowerCase();
    const ix = race ? race.names.indexOf(w) : -1;
    if (ix >= 0) pk = ix + 1;                    // слово совпало с именем участника: это ставка
    raceNominate(ws._token, w);                  // любое одиночное слово — кандидат в участники следующей гонки
  }
  if (!pk && r.text === u.lastText && now - u.lastTextAt < 30000) return send(ws, { t: 'err', code: 'dup' });
  u.last = now; u.recent.push(now); u.lastText = r.text; u.lastTextAt = now;
  const m = { id: msgSeq++, nick: u.nick, token: ws._token, text: r.text, ts: now };
  if (pk) {
    const res = acceptPick(ws, room.game === 'race' ? pk - 1 : pk);
    if (res === 'ok') { m.pk = pk; send(ws, { t: 'picked', ok: true, d: pk, name: room.game === 'race' ? race.names[pk - 1] : undefined }); }
    else if (res !== 'noscore') send(ws, { t: 'err', code: res });
  }
  room.history.push(m);
  if (room.history.length > HISTORY) { const old = room.history.shift(); room.reports.delete(old.id); }
  broadcast(room, { t: 'msg', m: publicMsg(m) });
}

function hideMessage(room, id) {
  const i = room.history.findIndex((m) => m.id === id);
  if (i >= 0) room.history.splice(i, 1);
  room.reports.delete(id);
  broadcast(room, { t: 'hide', id });
}
function onReport(ws, id) {
  const u = ws._user, room = ws._room, now = Date.now();
  u.repAt = u.repAt.filter((t) => now - t < 60000);
  if (u.repAt.length >= 5) return;
  u.repAt.push(now);
  const m = room.history.find((x) => x.id === id);
  if (!m || m.token === ws._token) return;
  let set = room.reports.get(id);
  if (!set) room.reports.set(id, (set = new Set()));
  set.add(ws._token);
  if (set.size >= REPORTS_TO_HIDE) {
    hideMessage(room, id);
    const author = users.get(m.token);
    if (author) addStrike(author, null);
  }
}

// ---------------- HTTP ----------------
const FILES = {
  '/': 'play.html', '/play.html': 'play.html', '/rekt.html': 'rekt.html', '/chart.html': 'chart.html',
  '/index.html': 'index.html', '/chat.js': 'chat.js', '/engine.js': 'engine.js', '/race.html': 'race.html', '/racecore.js': 'racecore.js', '/racevis.js': 'racevis.js',
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const adminHits = new Map();
function clientIp(req) {
  if (TRUST_PROXY) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (xff.length) return xff[xff.length - 1];        // последнее значение добавляет ближайший прокси, его подделать нельзя
  }
  return req.socket.remoteAddress || '';
}
function tokenOk(header) {
  if (!ADMIN_TOKEN) return false;
  const m = /^Bearer (.+)$/.exec(header || '');
  if (!m) return false;
  const a = sha(m[1]), b = sha(ADMIN_TOKEN);
  return crypto.timingSafeEqual(a, b);
}
async function readJson(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 4096) throw new Error('big'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
const server = http.createServer(async (req, res) => {
  const baseHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': `frame-ancestors ${FRAME_ANCESTORS}`,
  };
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/healthz') { res.writeHead(200, baseHeaders); return res.end('ok'); }
    if (req.method === 'POST' && url.pathname.startsWith('/admin/')) {
      const ih = ipHash(clientIp(req)), now = Date.now();
      const hits = (adminHits.get(ih) || []).filter((t) => now - t < 60000);
      if (hits.length >= 10) { res.writeHead(429, baseHeaders); return res.end('slow'); }
      hits.push(now); adminHits.set(ih, hits);
      if (!tokenOk(req.headers.authorization)) { res.writeHead(401, baseHeaders); return res.end('no'); }
      const body = await readJson(req);
      if (url.pathname === '/admin/mute') {
        const token = body.token || nickToToken.get(String(body.nick || ''));
        const u = token && users.get(token);
        if (!u) { res.writeHead(404, baseHeaders); return res.end('not found'); }
        u.mutedUntil = Date.now() + Math.min(7 * 24 * 60, Math.max(1, +body.minutes || 60)) * 60000;
        res.writeHead(200, baseHeaders); return res.end('muted');
      }
      if (url.pathname === '/admin/delete') {
        let n = 0;
        for (const room of rooms.values()) if (room.history.some((m) => m.id === +body.id)) { hideMessage(room, +body.id); n++; }
        res.writeHead(n ? 200 : 404, baseHeaders); return res.end(n ? 'deleted' : 'not found');
      }
      res.writeHead(404, baseHeaders); return res.end('not found');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, baseHeaders); return res.end(); }
    const file = FILES[url.pathname];
    if (!file) { res.writeHead(404, baseHeaders); return res.end('not found'); }
    const data = await readFile(join(ROOT, file));
    res.writeHead(200, { ...baseHeaders, 'Content-Type': TYPES[file.slice(file.lastIndexOf('.'))], 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (e) {
    res.writeHead(400, baseHeaders); res.end('bad request');
  }
});

// ---------------- WebSocket ----------------
const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
server.on('upgrade', (req, socket, head) => {
  const reject = (code) => { socket.write(`HTTP/1.1 ${code}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { return reject('400 Bad Request'); }
  if (url.pathname !== '/chat') return reject('404 Not Found');
  const origin = req.headers.origin;
  if (!origin) return reject('403 Forbidden');
  let ok = false;
  if (ALLOWED_ORIGINS.length) ok = ALLOWED_ORIGINS.includes(origin);
  else { try { ok = new URL(origin).host === req.headers.host; } catch { ok = false; } }
  if (!ok) return reject('403 Forbidden');
  const ih = ipHash(clientIp(req));
  if ((ipConns.get(ih) || 0) >= MAX_CONN_PER_IP) return reject('429 Too Many Requests');
  wss.handleUpgrade(req, socket, head, (ws) => { ws._ip = ih; wss.emit('connection', ws, req); });
});

wss.on('connection', (ws) => {
  ipConns.set(ws._ip, (ipConns.get(ws._ip) || 0) + 1);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  const helloTimer = setTimeout(() => ws.terminate(), 5000);
  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    let msg;
    try { msg = JSON.parse(data.toString('utf8')); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    if (!ws._room) {
      if (msg.t !== 'hello' || !ROOM_RE.test(String(msg.room))) return ws.close(1008, 'bad hello');
      clearTimeout(helloTimer);
      let token = String(msg.token || '');
      if (!/^[a-f0-9]{32}$/.test(token)) token = crypto.randomBytes(16).toString('hex');
      ws._token = token; ws._user = getUser(token); ws._room = getRoom(msg.room);
      ws._room.clients.add(ws);
      if (!userSockets.has(token)) userSockets.set(token, new Set());
      userSockets.get(token).add(ws);
      const scored = SCORED.includes(ws._room.game);
      send(ws, { t: 'welcome', nick: ws._user.nick, token, history: ws._room.history.map(publicMsg), online: ws._room.clients.size, scored, now: Date.now() });
      if (ws._room.game === 'race') raceSendState(ws);
      if (scored) { send(ws, meMsg(ws._room.game, token)); send(ws, { t: 'lb', game: ws._room.game, top: standing[ws._room.game].top }); }
      return;
    }
    if (msg.t === 'msg' && typeof msg.text === 'string') onMessage(ws, msg.text);
    else if (msg.t === 'report' && Number.isInteger(msg.id)) onReport(ws, msg.id);
    else if (msg.t === 'sync' && Number.isFinite(msg.c)) {   // сверка часов: клиент по ответу вычисляет сдвиг с точностью до миллисекунд
      const nowMs = Date.now();
      if (nowMs - (ws._lastSync || 0) > 5000) { ws._lastSync = nowMs; send(ws, { t: 'sync', c: msg.c, s: nowMs }); }
    }
    else if (msg.t === 'pick' && ws._room.game === 'race' && Number.isInteger(msg.d) && msg.d >= 0 && msg.d < 8) {
      const res = acceptRacePick(ws, msg.d);
      if (res === 'ok') send(ws, { t: 'picked', ok: true, d: msg.d + 1, name: race.names[msg.d] });
      else send(ws, { t: 'err', code: res });
    }
    else if (msg.t === 'pick' && (msg.d === 1 || msg.d === -1)) {
      const res = acceptPick(ws, msg.d);
      if (res === 'ok') send(ws, { t: 'picked', ok: true, d: msg.d });
      else if (res !== 'noscore') send(ws, { t: 'err', code: res });
    }
  });
  ws.on('close', () => {
    clearTimeout(helloTimer);
    if (ws._room) ws._room.clients.delete(ws);
    const us = userSockets.get(ws._token);
    if (us) { us.delete(ws); if (!us.size) userSockets.delete(ws._token); }
    const n = (ipConns.get(ws._ip) || 1) - 1;
    if (n <= 0) ipConns.delete(ws._ip); else ipConns.set(ws._ip, n);
  });
  ws.on('error', () => {});
});
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch {} }
  for (const room of rooms.values()) broadcast(room, { t: 'online', n: room.clients.size });
}, 15000).unref();

server.listen(PORT, () => console.log(`coinplay-road: http://localhost:${PORT}  (чат на /chat)` + (ADMIN_TOKEN ? '' : '  админ-команды выключены (нет ADMIN_TOKEN)')));
export { server, checkText };
