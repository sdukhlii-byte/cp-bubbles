// Генератор саундтрека: фонк-бит (kick, 808, хэты, колокольчик) плюс звуки событий гонки. Всё синтезируется в коде, чужой музыки нет.
// makeTrack({bpm, tstart, fin, duration, seed, events}) -> Buffer с WAV (моно, 16 бит, 44100 Гц)
const SR = 44100;

function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

export function makeTrack({ bpm = 140, tstart = 1.7, fin = 14, duration = 19, seed = 1, events = [], beatOn = true }) {
  const N = Math.ceil(duration * SR), buf = new Float32Array(N);
  const rnd = lcg(seed * 7919 + 13);
  const beat = 60 / bpm, step = beat / 4;
  const add = (t, fn, len) => {
    const i0 = Math.max(0, Math.floor(t * SR)), i1 = Math.min(N, i0 + Math.ceil(len * SR));
    for (let i = i0; i < i1; i++) buf[i] += fn((i - i0) / SR);
  };
  const noise = () => rnd() * 2 - 1;

  /* голоса */
  const kick2 = (t, v = 1) => { let ph = 0; add(t, (x) => { const f = 48 + 120 * Math.exp(-x * 34); ph += 2 * Math.PI * f / SR; return Math.sin(ph) * Math.exp(-x * 8) * v; }, 0.45); };
  const snare = (t, v = 1) => add(t, (x) => (noise() * 0.7 * Math.exp(-x * 16) + Math.sin(2 * Math.PI * 190 * x) * 0.5 * Math.exp(-x * 24)) * v * 0.7, 0.28);
  const hat = (t, v = 1, open = false) => { let p = 0; add(t, (x) => { const n = noise(); const o = n - p; p = n; return o * Math.exp(-x * (open ? 14 : 70)) * v * 0.32; }, open ? 0.3 : 0.07); };
  const sub808 = (t, f, len = 0.38, v = 1) => { let ph = 0; add(t, (x) => { const ff = f * (1 + 1.4 * Math.exp(-x * 30)); ph += 2 * Math.PI * ff / SR; return Math.tanh(Math.sin(ph) * 2.2) * Math.exp(-x * (3.2 / len * 0.9)) * v * 0.62; }, len + 0.1); };
  const bell = (t, f, v = 1) => add(t, (x) => (Math.sin(2 * Math.PI * f * x) + 0.7 * Math.sin(2 * Math.PI * f * 1.504 * x) + 0.4 * Math.sign(Math.sin(2 * Math.PI * f * 2.01 * x))) * Math.exp(-x * 22) * v * 0.16, 0.2);
  const tone = (t, f, len, v = 1, decay = 8) => add(t, (x) => Math.sin(2 * Math.PI * f * x) * Math.exp(-x * decay) * v * 0.3, len);
  const sweep = (t, f0, f1, len, v = 0.3, vib = 0) => { let ph = 0; add(t, (x) => { const u = x / len, f = f0 + (f1 - f0) * u + (vib ? Math.sin(x * 40) * vib : 0); ph += 2 * Math.PI * f / SR; return Math.sin(ph) * v * Math.min(1, x * 80) * (1 - u); }, len); };
  const whoosh = (t, len, v = 0.3, up = true) => { let p = 0; add(t, (x) => { const u = x / len, n = noise(), o = n - p * (up ? 0.6 : 0.2); p = n; return o * v * (up ? u : 1 - u) * Math.min(1, x * 60) * Math.min(1, (len - x) * 25); }, len); };
  const horn = (t, len, v = 0.3) => add(t, (x) => (Math.sign(Math.sin(2 * Math.PI * 440 * x)) + Math.sign(Math.sin(2 * Math.PI * 554 * x))) * 0.5 * v * (0.8 + 0.2 * Math.sin(x * 60)) * Math.exp(-x * 3), len);
  const crash = (t, len = 1.4, v = 0.5) => { let p = 0; add(t, (x) => { const n = noise(), o = n - p; p = n; return o * Math.exp(-x * 3.2) * v; }, len); };

  /* музыка: до старта только отсчёт, с «GO» включается бит */
  const F = [43.65, 51.91, 58.27, 65.41];          // F1 Ab1 Bb1 C2
  const BELL = [698, 831, 1047, 932, 831, 698, 622, 698];
  const bars = Math.ceil((duration - tstart) / (step * 16)) + 1;
  const bassPat = [0, 0, 1, 0, 2, 0, 3, 1].map((k) => k);
  // шаблон мелодии колокольчика, зависит от seed
  const bellSteps = [];
  for (let s = 0; s < 16; s++) bellSteps.push(rnd() < (s % 4 === 2 ? 0.7 : s % 2 === 0 ? 0.45 : 0.18) ? Math.floor(rnd() * BELL.length) : -1);
  for (let bar = 0; beatOn && bar < bars; bar++) {
    for (let s = 0; s < 16; s++) {
      const t = tstart + (bar * 16 + s) * step;
      if (t >= duration - 0.2) break;
      const alt = bar % 2 === 1;
      if (s === 0 || s === 6 || s === 10 || (alt && s === 3) || (bar % 4 === 3 && s === 14)) {
        kick2(t, 1);
        const f = F[bassPat[(bar * 3 + s) % bassPat.length]];
        sub808(t, f, s === 0 ? 0.5 : 0.28, 1);
      }
      if (s === 8) snare(t, 1);
      if (s % 2 === 0) hat(t, s % 4 === 0 ? 0.8 : 0.5);
      if (s === 6 && alt) hat(t, 0.9, true);
      if (bar % 4 === 3 && s >= 12) { hat(t, 0.6); hat(t + step / 2, 0.35); }
      if (bellSteps[s] >= 0 && bar >= 1) bell(t, BELL[bellSteps[s]], 0.9);
    }
  }
  /* вступление: счёт на кликах и подъём шума перед стартом */
  for (let k = 1; k <= 3; k++) { tone(beat * k, 700, 0.1, 1, 30); kick2(beat * k, 0.55); }
  whoosh(Math.max(0, tstart - beat), beat, 0.35, true);
  crash(tstart, 1.0, 0.4); kick2(tstart, 1.2); sub808(tstart, F[0], 0.6, 1.1);
  tone(tstart, 1400, 0.25, 0.8, 12);

  /* события гонки */
  const NOTE = [523, 587, 659, 784, 880, 1047, 1175, 1319];
  for (const e of events) {
    const t = e.t;
    if (t < tstart - 0.05 || t > duration - 0.2) continue;
    if (e.k === 'hit') tone(t, NOTE[e.id % 8], 0.14, Math.min(1, 0.45 + (e.mag || 100) / 400), 18);
    else if (e.k === 'over') sweep(t, 1900, 380, 0.14, 0.22);
    else if (e.k === 'warp') { sweep(t, 300, 1700, 0.35, 0.3); whoosh(t, 0.3, 0.25, true); }
    else if (e.k === 'oops') { sweep(t, 950, 110, 0.5, 0.32, 18); whoosh(t, 0.4, 0.2, false); }
    else if (e.k === 'boost') whoosh(t, 0.22, 0.3, true);
    else if (e.k === 'allin') horn(t, 0.55, 0.3);
    else if (e.k === 'stab') { crash(t, 0.5, 0.5); sweep(t, 1400, 90, 0.3, 0.4, 25); kick2(t, 1.1); }
    else if (e.k === 'scam') { sweep(t, 520, 160, 0.45, 0.32, 14); sweep(t + 0.22, 440, 120, 0.45, 0.3, 14); }
    else if (e.k === 'slow') { sweep(t, 900, 70, 0.6, 0.35); whoosh(t, 0.5, 0.3, false); }
    else if (e.k === 'knife') { tone(t, 1568, 0.2, 0.9, 10); tone(t + 0.08, 2093, 0.2, 0.8, 10); }
    else if (e.k === 'bleep') tone(t, 1000, 0.3, 0.9, 1.5);
    else if (e.k === 'grunt') sweep(t, 150, 95, 0.26, 0.4);
  }
  /* финиш: удар и аккорд на ближайшую долю */
  const ft = Math.ceil(fin / beat) * beat;
  crash(ft, 1.6, 0.6); kick2(ft, 1.3); sub808(ft, F[0], 0.8, 1.2);
  if (beatOn) for (const f of [349, 415, 523, 698]) tone(ft, f, 0.9, 0.9, 3.2);

  /* лимитер и запись */
  let peak = 0;
  for (let i = 0; i < N; i++) { buf[i] = Math.tanh(buf[i] * 1.2); if (Math.abs(buf[i]) > peak) peak = Math.abs(buf[i]); }
  const g = peak > 0 ? 0.8 / peak : 1;
  const out = Buffer.alloc(44 + N * 2);
  out.write('RIFF', 0); out.writeUInt32LE(36 + N * 2, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 2, 40);
  const fadeN = Math.floor(0.4 * SR);
  for (let i = 0; i < N; i++) {
    const fade = i > N - fadeN ? (N - i) / fadeN : 1;
    out.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(buf[i] * g * fade * 32767))), 44 + i * 2);
  }
  return out;
}
