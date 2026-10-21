// Пакетная запись роликов: Playwright (покадровый рендер страницы) + ffmpeg (H.264).
//
// Примеры:
//   node record.mjs --game chart --seeds 1-10 --langs es,en --audio
//   node record.mjs --game chart --seeds 3 --langs es --rounds 3        # длинный ролик, 3 раунда подряд
//   node record.mjs --game road --seeds 5,9,12 --langs ru --mode question
//
// Параметры:
//   --game       chart (график, бесконечные раунды) | rekt (Чад и суперкар) | road (машинка), по умолчанию chart
//   rekt:   --episodes N  сколько эпизодов подряд (1 эпизод = 12 с, ролик = N*12+1 с)
//           --episode E   конкретный эпизод; без него берётся первый обычный (Чад разбивается)
//           --survive     взять первый эпизод, где Чад выжил (бывает примерно в 1 из 17)
//   --seeds      номера seed: "1-10" или "5,9,12"
//   --langs      языки: ru,en,es,pt,de,tr,lv,lt,hr,sr (по умолчанию en)
//   --skin       gold | cyan | violet | mono (по умолчанию выбирается по seed)
//   --bonus      вторая строка на билборде (по умолчанию "unlock the daily bonus")
//   --url        текст билборда целиком, например coinplay.com/tt (по умолчанию coinplay.com)
//   --platforms  tt,th,ig,yt,x  отдельный рендер под каждую платформу: билборд coinplay.com/<метка>
//   --showtag    писать метку платформы в тексте на экране (coinplay.com/tt); по умолчанию на экране только домен, метка идёт в имя файла и manifest
//   --domain     домен для меток платформ (coinplay.com)
//   --account    метка аккаунта: coinplay.com/tt-es1 (то же самое, но с аккаунтом), попадает в имя файла и manifest
//   --fps        кадров в секунду (30)
//   --audio      добавить простые звуки
//   --out        папка результата (out)
//   race:   --swear bleep|full|off  мат в репликах шариков: bleep (по умолчанию) = f*ck и писк цензуры, full = как есть, off = без реплик
//           --bpm N      темп (по умолчанию 120);  --names a,b,c  имена участников (до 8)
//   chart:  --chad       вернуть Чада (по умолчанию его нет)
//           --series     серия: Чад с 3 жизнями, N раундов подряд (по умолчанию 4, ролик ≈57 с), сплошной звуковой фон
//           --hook       добавить крупную подпись-крючок сверху (по умолчанию выключена: меньше текста)
//           --brand subtle|billboard|off  как показывать coinplay.com: subtle (по умолчанию) = мелкая подпись в шапке графика, billboard = большой билборд, off = нигде
//           --arc survive|rekt  чем кончается серия (по умолчанию survive)
//           --rounds N   сколько раундов подряд в ролике (1 раунд = 14 с, ролик = N*14+1 с)
//           --round R    взять конкретный раунд; без него берётся первый раунд с понятным результатом
//           --minmargin  минимальный разрыв между линией и ценой в конце раунда (6)
//           --pair       подпись пары на графике (COIN/USDT)
//   road:   --mode full | question
import { chromium } from 'playwright';
import { makeTrack } from './music.mjs';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const key = a.slice(2);
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[key] = true;
  else { args[key] = next; i++; }
}

function parseSeeds(s = '1') {
  const out = [];
  for (const part of String(s).split(',')) {
    const m = part.match(/^(\d+)-(\d+)$/);
    if (m) for (let n = +m[1]; n <= +m[2]; n++) out.push(n);
    else if (/^\d+$/.test(part)) out.push(+part);
  }
  return out;
}

const str = (v) => (typeof v === 'string' ? v : undefined);
const game = ['road', 'rekt', 'coin', 'drive', 'race'].includes(args.game) ? args.game : 'chart';
const seeds = parseSeeds(args.seeds);
const langs = String(args.langs || 'en').split(',');
const mode = args.mode === 'question' ? 'question' : 'full';
const fps = +args.fps || 30;
const withAudio = !!args.audio;
const outDir = resolve(String(args.out || 'out'));
const domain = str(args.domain) || 'coinplay.com';
const account = str(args.account) ? String(args.account).replace(/[^A-Za-z0-9_-]/g, '') : '';
const platforms = args.platforms ? String(args.platforms).split(',').map((p) => p.replace(/[^A-Za-z0-9_-]/g, '')).filter(Boolean) : [null];
const setupBase = {
  skin: str(args.skin),
  bonus: str(args.bonus),
  url: str(args.url),
  pair: str(args.pair),
  series: !!args.series,
  chad: !!args.chad,
  hook: !!args.hook,
  brand: ['off', 'billboard'].includes(args.brand) ? args.brand : 'subtle',
  arc: args.arc === 'rekt' ? 'rekt' : 'survive',
  rounds: args.rounds ? +args.rounds : (args.series ? 4 : 1),
  round: args.round !== undefined ? +args.round : undefined,
  minmargin: args.minmargin !== undefined ? +args.minmargin : undefined,
  episodes: args.episodes ? +args.episodes : 1,
  episode: args.episode !== undefined ? +args.episode : undefined,
  survive: !!args.survive,
  mode,
};
mkdirSync(outDir, { recursive: true });

// --- проверки до запуска ---
function fail(msg) { console.error('Ошибка: ' + msg); process.exit(1); }
if (spawnSync('ffmpeg', ['-version']).error) fail('ffmpeg не найден в PATH (нужен для сборки mp4)');
if (!seeds.length) fail('не указан ни один seed, пример: --seeds 1-10 или --seeds 5,9,12');
if (!Number.isFinite(fps) || fps < 1 || fps > 120) fail('--fps должен быть числом от 1 до 120');
const BRAND_RE = /^coinplay\.com(\/[A-Za-z0-9_-]{1,24})?$/;  // то же правило, что и на странице; иначе страница молча подставит coinplay.com
if (platforms[0] === null && setupBase.url !== undefined && !BRAND_RE.test(setupBase.url)) {
  fail(`--url "${setupBase.url}" не подходит: допустимы только coinplay.com или coinplay.com/метка (буквы, цифры, _ и -, до 24 знаков)`);
}
if (platforms[0] !== null) {
  if (setupBase.url) console.warn('Предупреждение: --url игнорируется, потому что задан --platforms');
  if (domain !== 'coinplay.com') fail('--domain: на билборде допустим только coinplay.com (проверка на странице)');
  for (const p of platforms) {
    const tag = p + (account ? '-' + account : '');
    if (!BRAND_RE.test(`${domain}/${tag}`)) fail(`метка "${tag}" длиннее 24 знаков, сократите платформу или --account`);
  }
}
if (args.account && !account) fail('--account после очистки пуст (разрешены буквы, цифры, _ и -)');

// Звуки для режима road (chart отдаёт свой список прямо из страницы).
function roadTones() {
  const list = [
    { f: 1000, at: 6.6, d: 0.07 },
    { f: 1000, at: 7.6, d: 0.07 },
    { f: 1000, at: 8.6, d: 0.07 },
  ];
  if (mode === 'question') list.push({ f: 300, at: 9.6, d: 0.3 });
  else {
    list.push({ f: 1500, at: 9.6, d: 0.15 });
    list.push({ f: 880, at: 13.0, d: 0.25 });
    list.push({ f: 1320, at: 13.12, d: 0.3 });
  }
  return list;
}

function ffmpegArgs(file, duration, tones, bed, wav) {
  const a = ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'];
  if (wav) {
    a.push('-i', wav, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '160k');
  } else if (withAudio && tones.length) {
    const off = bed ? 2 : 1;
    if (bed) {
      // непрерывный фон: пульсирующий бас + нарастающий тон перед каждым решением (раунд 14 с)
      const ex = '0.10*sin(2*PI*82*t)*(0.65+0.35*sin(2*PI*2*t))+0.05*sin(2*PI*123*t)+0.035*sin(2*PI*(220+mod(t\\,14)*14)*t)*lt(mod(t\\,14)\\,10)';
      a.push('-f', 'lavfi', '-i', `aevalsrc=${ex}:s=44100:d=${duration}`);
    }
    tones.forEach((x) => a.push('-f', 'lavfi', '-i', `sine=frequency=${x.f}:duration=${x.d}`));
    const parts = tones.map((x, i) => {
      const ms = Math.round(x.at * 1000);
      return `[${i + off}:a]afade=t=out:st=${(x.d / 2).toFixed(3)}:d=${(x.d / 2).toFixed(3)},volume=0.5,adelay=${ms}|${ms}[a${i}]`;
    });
    const mix = (bed ? '[1:a]' : '') + tones.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${tones.length + (bed ? 1 : 0)}:normalize=0,apad[aout]`;
    a.push('-filter_complex', parts.join(';') + ';' + mix, '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '128k');
  } else {
    a.push('-an');
  }
  a.push('-t', String(duration), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file);
  return a;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', (e) => { console.error('Ошибка на странице:', e.message); process.exit(1); });
const pageFile = { chart: 'chart.html', road: 'index.html', rekt: 'rekt.html', coin: 'coin.html', drive: 'drive.html', race: 'race.html' }[game];
await page.goto(pathToFileURL(resolve(pageFile)).href + '?mode=record');
await page.waitForFunction('window.__ready === true');

const manifest = [];
for (const seed of seeds) {
  for (const lang of langs) {
    for (const plat of platforms) {
      const tag = plat ? plat + (account ? '-' + account : '') : '';
      const url = plat ? (args.showtag ? `${domain}/${tag}` : domain) : setupBase.url;
      const info = await page.evaluate((o) => window.setup(o), { ...setupBase, url, seed, lang, short: !!args.short, bpm: args.bpm ? +args.bpm : undefined, swear: str(args.swear), names: args.names ? String(args.names).split(',') : undefined });
      const suffix = plat ? `_${tag}` : '';
      const name = (game === 'race' ? `race_s${seed}_${lang}${args.short ? '_c12' : ''}` : game === 'drive' ? `drive_s${seed}_${lang}` : game === 'coin' ? `coin_s${seed}_${lang}_r${setupBase.rounds}` : game === 'chart'
        ? (setupBase.series ? `chad_s${seed}_${lang}_${setupBase.arc}_r${setupBase.rounds}` : `chart_s${seed}_${lang}_r${setupBase.rounds}`)
        : game === 'rekt'
          ? `rekt_s${seed}_${lang}_${info.fate}_e${setupBase.episodes}`
          : `road_s${seed}_${lang}_${mode}`) + suffix + '.mp4';
      const file = join(outDir, name);
      const frames = Math.round(info.duration * fps);
      const tones = info.tones || roadTones();
      let wav;
      if (withAudio && info.music) { wav = join(outDir, '.' + name + '.wav'); writeFileSync(wav, makeTrack(info.music)); }
      const ff = spawn('ffmpeg', ffmpegArgs(file, info.duration, tones, info.bed, wav), { stdio: ['pipe', 'ignore', 'inherit'] });
      const done = new Promise((res, rej) => { ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))); });
      for (let f = 0; f < frames; f++) {
        const b64 = await page.evaluate((t) => {
          window.renderFrame(t);
          return document.getElementById('c').toDataURL('image/jpeg', 0.94).split(',')[1];
        }, f / fps);
        if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
      }
      ff.stdin.end();
      await done;
      if (wav) { try { unlinkSync(wav); } catch {} }
      console.log(`${name}  ответ: ${info.letter}  skin: ${info.skin}` + (url ? `  билборд: ${url}` : '') + (info.round !== undefined ? `  раунд: ${info.round}  разрыв: ${info.margin}` : ''));
      manifest.push({ file: name, game, seed, lang, platform: plat || undefined, account: account || undefined, billboard: url || 'coinplay.com', answer: info.letter, speech: info.speech, skin: info.skin, duration: info.duration, round: info.round, margin: info.margin });
    }
  }
}
await browser.close();
// manifest дополняется, а не перезаписывается: предыдущие партии в этой папке остаются
const mfile = join(outDir, 'manifest.json');
let prev = [];
if (existsSync(mfile)) { try { prev = JSON.parse(readFileSync(mfile, 'utf-8')); } catch { console.warn('Предупреждение: старый manifest.json повреждён, создаю заново'); } }
const merged = [...prev.filter((x) => !manifest.some((m) => m.file === x.file)), ...manifest];
writeFileSync(mfile, JSON.stringify(merged, null, 2));
console.log(`Готово: ${manifest.length} роликов в ${outDir} (в manifest.json всего ${merged.length})`);
