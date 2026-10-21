/* Внешний вид гонки: 24 локации (фон) и 59 персонажей-шариков. Всё рисуется кодом, картинок нет.
   Выбор детерминирован номером раунда (cycle n), поэтому у всех зрителей в эфире одна и та же сцена.
   RaceVis = {THEMES, THEME_NAMES, themeOf(n), paintBg(...), CHARS, charsFor(names, seed), drawChar(...)} */
(function (root) {
'use strict';
var O = '#0a0c10';
function H(a, b) { var x = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263); x = Math.imul(x ^ (x >>> 13), 1274126177); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
function m32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hex(c) { c = c.replace('#', ''); return [parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16)]; }
function mix(a, b, u) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * u) + ',' + Math.round(a[1] + (b[1] - a[1]) * u) + ',' + Math.round(a[2] + (b[2] - a[2]) * u) + ')'; }

/* ================= ЛОКАЦИИ ================= */
/* слой: d = рисовалка, f = параллакс, n = штук на «плитку» высотой th, s = размер [мин,макс], c = цвета, a = прозрачность, dx = дрейф по x (px/с), fall = сдвиг по y (px/с) */
var THEMES = [
  { id: 'neoncity', name: 'Neon City', stops: ['#0b0420', '#1b0a3a', '#3a0f55'], acc: '#ff4fd8', wall: '#2a1347', dim: 0.16, layers: [
    { d: 'star', f: .04, n: 6, th: 300, s: [1, 2.4], c: ['#ffffff', '#ffd6fa'], a: .8 },
    { d: 'bld', f: .22, n: 3, th: 460, s: [70, 120], c: ['#140a2e', '#1a0c3a'], w: ['#ffd23f', '#4cc9f0', '#ff4fd8'], a: .95 },
    { d: 'bld', f: .5, n: 2, th: 560, s: [90, 150], c: ['#210f4d', '#2a1160'], w: ['#ffd23f', '#4cc9f0', '#ff4fd8', '#3ddc97'], a: .9 },
    { d: 'sign', f: .7, n: 1, th: 380, s: [20, 28], c: ['#ff4fd8', '#4cc9f0', '#ffd23f', '#3ddc97'], words: ['BAR', '24/7', 'HODL', 'CASH', 'DEX', 'ATM', 'OPEN'], a: .95 }] },
  { id: 'daystreet', name: 'Sunny Street', stops: ['#4aa8ee', '#8fd0f5', '#cfe9f7'], acc: '#ff7a1a', wall: '#3c5f78', dim: 0.34, layers: [
    { d: 'cloud', f: .08, n: 3, th: 340, s: [40, 90], c: ['#ffffff'], a: .9, dx: 6 },
    { d: 'bld', f: .3, n: 3, th: 460, s: [70, 120], c: ['#c9d6e2', '#e6d3b8', '#d8b9b9'], w: ['#7fb4d8', '#9cc8e6'], a: .95 },
    { d: 'bld', f: .55, n: 2, th: 520, s: [90, 140], c: ['#a8bccd', '#cdb59a', '#b99a9a'], w: ['#5d97c0', '#ffd23f'], a: .95 },
    { d: 'cloud', f: .9, n: 1, th: 520, s: [40, 70], c: ['#ffffff'], a: .75, dx: 14 }] },
  { id: 'sunset', name: 'Sunset Beach', stops: ['#ff6a3d', '#ff9e5e', '#2aa6c9'], acc: '#ffe14d', wall: '#7a3a2a', dim: 0.3, layers: [
    { d: 'sun', f: .05, n: 1, th: 900, s: [70, 90], c: ['#fff1b0'], a: .95 },
    { d: 'cloud', f: .15, n: 2, th: 380, s: [40, 80], c: ['#ffc7a1', '#ff9a8a'], a: .85, dx: 5 },
    { d: 'palm', f: .55, n: 2, th: 480, s: [60, 100], c: ['#17734a', '#0f5a3a'], a: .95 },
    { d: 'wave', f: .8, n: 3, th: 300, s: [40, 90], c: ['#ffffff'], a: .6, dx: 10 }] },
  { id: 'space', name: 'Deep Space', stops: ['#03030c', '#0a0724', '#150a3a'], acc: '#66e0ff', wall: '#1b1c40', dim: 0.1, layers: [
    { d: 'star', f: .05, n: 12, th: 260, s: [.8, 2.4], c: ['#ffffff', '#cfe3ff', '#ffe2c4'], a: .9 },
    { d: 'planet', f: .25, n: 1, th: 620, s: [40, 80], c: ['#e8825a', '#5aa0e8', '#b78ae8', '#7fe0a0'], a: .95 },
    { d: 'star5', f: .5, n: 2, th: 380, s: [6, 12], c: ['#ffe14d'], a: .8 },
    { d: 'ufo', f: .8, n: 1, th: 900, s: [28, 40], c: ['#9aa7b8'], a: .95, dx: 12 }] },
  { id: 'candles', name: 'Candle Chart', stops: ['#06130f', '#0a1f1a', '#1a0c10'], acc: '#ffd23f', wall: '#12312a', dim: 0.14, layers: [
    { d: 'grid', f: .3, n: 1, th: 120, s: [1, 1], c: ['#1d4a3d'], a: .5 },
    { d: 'candle', f: .35, n: 5, th: 300, s: [9, 16], c: ['#14c78a', '#ff4d6d'], a: .55 },
    { d: 'candle', f: .7, n: 3, th: 340, s: [14, 24], c: ['#14c78a', '#ff4d6d'], a: .75 },
    { d: 'coin', f: .9, n: 1, th: 700, s: [22, 30], c: ['#ffc933'], a: .9 }] },
  { id: 'matrix', name: 'Matrix Rain', stops: ['#000a04', '#001a0a', '#002a12'], acc: '#4dff91', wall: '#06301a', dim: 0.1, layers: [
    { d: 'glyph', f: .2, n: 8, th: 300, s: [14, 20], c: ['#0c6a30', '#119a45'], a: .7, fall: 40 },
    { d: 'glyph', f: .5, n: 6, th: 320, s: [18, 28], c: ['#19c85c', '#4dff91'], a: .8, fall: 90 }] },
  { id: 'lava', name: 'Lava Cave', stops: ['#1a0604', '#2d0a06', '#5a1206'], acc: '#ffb020', wall: '#4a1a10', dim: 0.14, amb: 'embers', layers: [
    { d: 'spike', f: .25, n: 3, th: 380, s: [30, 60], c: ['#2a0f0a', '#35140d'], a: .95 },
    { d: 'lavablob', f: .45, n: 3, th: 340, s: [26, 56], c: ['#ff5a14', '#ff8a1f'], a: .75 },
    { d: 'spike', f: .75, n: 2, th: 460, s: [40, 80], c: ['#3a160c'], a: .95 }] },
  { id: 'ocean', name: 'Deep Ocean', stops: ['#0a6ea0', '#08507c', '#04203d'], acc: '#ffe14d', wall: '#0c3d5f', dim: 0.2, layers: [
    { d: 'beam', f: .1, n: 2, th: 500, s: [90, 150], c: ['#bfeaff'], a: .22 },
    { d: 'fish', f: .35, n: 3, th: 340, s: [10, 18], c: ['#7fd6ff', '#ffb36b', '#c3a6ff'], a: .7, dx: 20 },
    { d: 'bubble', f: .6, n: 5, th: 300, s: [5, 16], c: ['#d8f4ff'], a: .7 },
    { d: 'fish', f: .85, n: 1, th: 560, s: [22, 34], c: ['#ff7a8a', '#ffd23f'], a: .9, dx: -26 }] },
  { id: 'desert', name: 'Desert Ruins', stops: ['#f4b860', '#e89a44', '#9a4b26'], acc: '#1d9bf0', wall: '#7a4a28', dim: 0.3, layers: [
    { d: 'sun', f: .04, n: 1, th: 1000, s: [60, 80], c: ['#fff4c2'], a: .95 },
    { d: 'pyramid', f: .22, n: 2, th: 480, s: [70, 120], c: ['#d98f4a', '#c97a3c'], a: .95 },
    { d: 'cactus', f: .5, n: 2, th: 420, s: [40, 70], c: ['#2f7a3c', '#3b8f48'], a: .95 },
    { d: 'cloud', f: .12, n: 1, th: 600, s: [40, 60], c: ['#ffe6c0'], a: .6, dx: 5 }] },
  { id: 'snow', name: 'Snow Peaks', stops: ['#0f2a4a', '#2a5a86', '#9ec8e6'], acc: '#ff5a5a', wall: '#2f5a80', dim: 0.24, amb: 'snow', layers: [
    { d: 'star', f: .04, n: 5, th: 300, s: [1, 2], c: ['#ffffff'], a: .8 },
    { d: 'pine', f: .35, n: 3, th: 380, s: [34, 60], c: ['#134a3a', '#18604a'], a: .95 },
    { d: 'pine', f: .65, n: 2, th: 460, s: [50, 80], c: ['#0e3a2e'], a: .95 }] },
  { id: 'candy', name: 'Candyland', stops: ['#ffb3e1', '#ffd1f0', '#b6f0ff'], acc: '#e0187a', wall: '#a7487f', dim: 0.3, layers: [
    { d: 'cloud', f: .1, n: 3, th: 340, s: [40, 80], c: ['#ffffff', '#fff0fa'], a: .9, dx: 5 },
    { d: 'lolli', f: .4, n: 3, th: 380, s: [20, 36], c: ['#ff4fa3', '#ffb020', '#4cc9f0', '#8a5cff'], a: .95 },
    { d: 'donut', f: .7, n: 2, th: 420, s: [18, 30], c: ['#ff8fc7', '#c58a5a', '#9be7ff'], a: .95 }] },
  { id: 'haunted', name: 'Haunted Night', stops: ['#0d0820', '#1c0f33', '#2c1245'], acc: '#ff8a1f', wall: '#32204f', dim: 0.14, layers: [
    { d: 'star', f: .04, n: 5, th: 300, s: [1, 2], c: ['#ffffff'], a: .7 },
    { d: 'moon', f: .06, n: 1, th: 1100, s: [50, 60], c: ['#f6f0c8'], a: .95 },
    { d: 'ghost', f: .35, n: 2, th: 420, s: [18, 30], c: ['#e8e4ff'], a: .55, dx: 8 },
    { d: 'bat', f: .6, n: 2, th: 380, s: [12, 20], c: ['#07040f'], a: .95, dx: -18 },
    { d: 'pumpkin', f: .85, n: 1, th: 620, s: [20, 28], c: ['#ff7a14'], a: .95 }] },
  { id: 'casino', name: 'Casino Floor', stops: ['#2a0610', '#4a0a18', '#1c0408'], acc: '#ffd23f', wall: '#5a1424', dim: 0.16, layers: [
    { d: 'lightdots', f: .15, n: 8, th: 260, s: [2, 4], c: ['#ffd23f', '#ff4d6d', '#ffffff'], a: .9 },
    { d: 'suit', f: .4, n: 4, th: 320, s: [14, 26], c: ['#ff3355', '#f1e6d0'], a: .5 },
    { d: 'chip', f: .65, n: 2, th: 380, s: [20, 30], c: ['#e0182e', '#1d6bff', '#18a050', '#222'], a: .9 },
    { d: 'coin', f: .9, n: 1, th: 640, s: [22, 30], c: ['#ffc933'], a: .95 }] },
  { id: 'sakura', name: 'Tokyo Sakura', stops: ['#15102e', '#2a1b4d', '#5a2a60'], acc: '#ff5d8f', wall: '#3b2656', dim: 0.16, layers: [
    { d: 'moon', f: .05, n: 1, th: 1000, s: [44, 56], c: ['#ffe9f2'], a: .9 },
    { d: 'lantern', f: .35, n: 3, th: 340, s: [16, 28], c: ['#ff3d52', '#ff7a2a'], a: .95 },
    { d: 'petal', f: .55, n: 8, th: 300, s: [6, 11], c: ['#ffb3cf', '#ffd2e4', '#ff8fb5'], a: .9, dx: 12 },
    { d: 'petal', f: .9, n: 3, th: 380, s: [10, 16], c: ['#ffb3cf', '#ff8fb5'], a: .95, dx: -14 }] },
  { id: 'jungle', name: 'Jungle', stops: ['#0b3a1c', '#0f5226', '#08301a'], acc: '#ffe14d', wall: '#12522a', dim: 0.18, layers: [
    { d: 'leaf', f: .25, n: 5, th: 300, s: [30, 60], c: ['#14702f', '#1b8a3a', '#0e5a26'], a: .9 },
    { d: 'firefly', f: .5, n: 5, th: 280, s: [3, 6], c: ['#e8ff6a', '#aaff6a'], a: .95 },
    { d: 'leaf', f: .8, n: 3, th: 420, s: [50, 90], c: ['#0c4a1f', '#126b2c'], a: .95 }] },
  { id: 'rave', name: 'Rooftop Rave', stops: ['#080818', '#10102e', '#1a0f3a'], acc: '#3dffd0', wall: '#1d1b45', dim: 0.12, layers: [
    { d: 'beam', f: .2, n: 3, th: 420, s: [100, 190], c: ['#ff4fd8', '#4cc9f0', '#3dffd0', '#ffd23f'], a: .2 },
    { d: 'disco', f: .5, n: 8, th: 260, s: [4, 9], c: ['#ff4fd8', '#4cc9f0', '#3dffd0', '#ffd23f', '#ffffff'], a: .9 },
    { d: 'confetti', f: .9, n: 6, th: 300, s: [5, 9], c: ['#ff4fd8', '#4cc9f0', '#3dffd0', '#ffd23f'], a: .9, dx: 10 }] },
  { id: 'synth', name: 'Synthwave', stops: ['#14003a', '#3a0a6a', '#ff2d95'], acc: '#4cf0ff', wall: '#3a1470', dim: 0.14, layers: [
    { d: 'sun', f: .05, n: 1, th: 900, s: [76, 90], c: ['#ffd23f'], a: .95, stripes: 1 },
    { d: 'grid', f: .45, n: 1, th: 90, s: [1, 1], c: ['#ff4fd8'], a: .35 },
    { d: 'star', f: .05, n: 6, th: 260, s: [1, 2], c: ['#ffffff'], a: .8 },
    { d: 'diamond', f: .75, n: 2, th: 400, s: [10, 18], c: ['#4cf0ff', '#ff4fd8'], a: .8 }] },
  { id: 'moonbase', name: 'Moon Base', stops: ['#0c0e14', '#1a1e28', '#2c3140'], acc: '#ff9a3d', wall: '#2a2f3c', dim: 0.14, layers: [
    { d: 'star', f: .04, n: 8, th: 260, s: [1, 2.2], c: ['#ffffff'], a: .9 },
    { d: 'earth', f: .07, n: 1, th: 1200, s: [44, 54], c: ['#3a8cff'], a: .95 },
    { d: 'crater', f: .4, n: 4, th: 320, s: [24, 56], c: ['#323847'], a: .9 },
    { d: 'crater', f: .7, n: 2, th: 460, s: [40, 80], c: ['#3a4152'], a: .9 }] },
  { id: 'storm', name: 'Thunderstorm', stops: ['#10161f', '#1b2430', '#26323f'], acc: '#ffe14d', wall: '#2b3948', dim: 0.14, amb: 'storm', layers: [
    { d: 'cloud', f: .12, n: 3, th: 340, s: [60, 110], c: ['#2a3340', '#333e4d'], a: .95, dx: 12 },
    { d: 'cloud', f: .4, n: 2, th: 460, s: [70, 130], c: ['#1d252f'], a: .95, dx: -10 }] },
  { id: 'circus', name: 'Circus', stops: ['#3a0f5a', '#6a1560', '#a02050'], acc: '#ffe14d', wall: '#5a1a62', dim: 0.16, layers: [
    { d: 'stripes', f: .2, n: 1, th: 100, s: [1, 1], c: ['#ffffff'], a: .08 },
    { d: 'balloon', f: .45, n: 3, th: 360, s: [16, 28], c: ['#ff4d6d', '#ffd23f', '#4cc9f0', '#3ddc97'], a: .95 },
    { d: 'star5', f: .7, n: 3, th: 340, s: [8, 14], c: ['#ffe14d'], a: .9 },
    { d: 'confetti', f: .9, n: 4, th: 300, s: [5, 9], c: ['#ff4d6d', '#ffd23f', '#4cc9f0', '#3ddc97'], a: .9, dx: 8 }] },
  { id: 'shrooms', name: 'Mushroom Trip', stops: ['#1a0a3a', '#0a3a4a', '#3a0a4a'], acc: '#f7ff4d', wall: '#2a1a5a', dim: 0.14, layers: [
    { d: 'mush', f: .3, n: 3, th: 380, s: [30, 56], c: ['#ff4fa3', '#4cf0ff', '#a76bff', '#ff9d2e'], a: .9 },
    { d: 'eye', f: .55, n: 2, th: 460, s: [16, 26], c: ['#ffffff'], a: .85 },
    { d: 'firefly', f: .8, n: 6, th: 260, s: [3, 6], c: ['#f7ff4d', '#ff9dfc'], a: .95 }] },
  { id: 'heaven', name: 'Heaven', stops: ['#8fc8ff', '#cfe6ff', '#fff4d6'], acc: '#e0a000', wall: '#6a8fb8', dim: 0.3, layers: [
    { d: 'sun', f: .04, n: 1, th: 1000, s: [60, 80], c: ['#fff8d0'], a: .9 },
    { d: 'cloud', f: .2, n: 3, th: 340, s: [50, 100], c: ['#ffffff'], a: .95, dx: 5 },
    { d: 'halo', f: .55, n: 2, th: 420, s: [14, 22], c: ['#ffd23f'], a: .9 },
    { d: 'cloud', f: .85, n: 1, th: 500, s: [50, 80], c: ['#ffffff'], a: .8, dx: 10 }] },
  { id: 'sewer', name: 'Scam Sewer', stops: ['#0d1c0a', '#18300f', '#0a2410'], acc: '#b6ff3d', wall: '#1d3d12', dim: 0.16, layers: [
    { d: 'gear', f: .3, n: 2, th: 420, s: [26, 50], c: ['#2a3a1e', '#33471f'], a: .9 },
    { d: 'barrel', f: .5, n: 2, th: 440, s: [20, 30], c: ['#6a8a1c', '#8aa82a'], a: .95 },
    { d: 'bubble', f: .7, n: 5, th: 280, s: [5, 14], c: ['#b6ff3d'], a: .6 }] },
  { id: 'vault', name: 'Bank Vault', stops: ['#1a1608', '#2a220c', '#3a2e0e'], acc: '#4cc9f0', wall: '#4a3c16', dim: 0.16, layers: [
    { d: 'bar', f: .3, n: 3, th: 360, s: [24, 40], c: ['#ffc933', '#e0a820'], a: .9 },
    { d: 'coin', f: .55, n: 3, th: 340, s: [16, 26], c: ['#ffc933'], a: .9 },
    { d: 'sparkle', f: .8, n: 6, th: 280, s: [4, 9], c: ['#fff4b0'], a: .95 }] }
];
var THEME_NAMES = THEMES.map(function (t) { return t.id; });
THEMES.forEach(function (t, i) { t.i = i; t.sc = t.stops.map(hex); });
function themeIndex(n) {   /* мешок: каждые 24 раунда все темы по разу, в случайном порядке; границы без повтора подряд */
  var L = THEMES.length, b = Math.floor(n / L), pos = n - b * L;
  function bag(bb) { var a = [], i, r = m32(bb * 7919 + 17); for (i = 0; i < L; i++) a.push(i); for (i = L - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var cur = bag(b);
  if (pos === 0) { var prev = bag(b - 1); if (prev[L - 1] === cur[0]) { var t = cur[0]; cur[0] = cur[1]; cur[1] = t; } }
  return cur[pos];
}
function themeOf(n) { return THEMES[themeIndex(n)]; }

/* ---- рисовалки предметов фона ---- */
var PAINT = {
  cloud: function (c, x, y, s, col) { c.fillStyle = col; c.beginPath(); c.arc(x - s * .5, y, s * .35, 0, 6.3); c.arc(x, y - s * .15, s * .45, 0, 6.3); c.arc(x + s * .5, y, s * .35, 0, 6.3); c.fill(); c.fillRect(x - s * .5, y, s, s * .35); },
  star: function (c, x, y, s, col, t, h) { var a = .5 + .5 * Math.sin(t * 2 + h * 40); c.globalAlpha *= (.35 + .65 * a); c.fillStyle = col; c.beginPath(); c.arc(x, y, s * (.6 + .4 * a), 0, 6.3); c.fill(); if (h > .85) { c.fillRect(x - s * 3, y - .5, s * 6, 1); c.fillRect(x - .5, y - s * 3, 1, s * 6); } },
  star5: function (c, x, y, s, col, t, h) { c.fillStyle = col; c.beginPath(); for (var i = 0; i < 10; i++) { var a = -1.5708 + i * .6283 + t * .4 * (h - .5), r = i % 2 ? s * .45 : s; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.fill(); },
  bld: function (c, x, y, s, col, t, h, L) { var w = s * .9, hh = s * 2.4, i, j, x0 = x - w / 2, y0 = y - hh / 2, id = Math.floor(h * 1e4); c.fillStyle = col; c.fillRect(x0, y0, w, hh);
    var cs = Math.max(2, Math.floor(w / 11)), rs = Math.floor(hh / 14); for (i = 0; i < cs; i++) for (j = 0; j < rs; j++) { var q = H(id + i * 31, j); if (q > .55) { c.fillStyle = L.w[Math.floor(q * 97) % L.w.length]; c.globalAlpha *= 1; c.fillRect(x0 + 5 + i * (w - 10) / cs, y0 + 6 + j * 14, 5, 7); } } },
  sign: function (c, x, y, s, col, t, h, L) { var w = L.words[Math.floor(h * 997) % L.words.length], on = Math.sin(t * 3 + h * 30) > -.6 ? 1 : .35; c.save(); c.translate(x, y); c.rotate((h - .5) * .5); c.globalAlpha *= on; c.font = '800 ' + s + 'px system-ui,Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = col; c.shadowBlur = 14; c.fillStyle = col; c.fillText(w, 0, 0); c.restore(); },
  planet: function (c, x, y, s, col, t, h) { var g = c.createRadialGradient(x - s * .3, y - s * .3, s * .1, x, y, s); g.addColorStop(0, col); g.addColorStop(1, '#0a0a18'); c.fillStyle = g; c.beginPath(); c.arc(x, y, s, 0, 6.3); c.fill(); if (h > .4) { c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, s * 1.6, s * .4, -.4, 0, 6.3); c.stroke(); } },
  ufo: function (c, x, y, s, col, t) { c.fillStyle = '#7fe0ff'; c.beginPath(); c.ellipse(x, y - s * .3, s * .45, s * .4, 0, Math.PI, 0); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(x, y, s, s * .32, 0, 0, 6.3); c.fill(); for (var i = -2; i <= 2; i++) { c.fillStyle = (Math.floor(t * 4) + i) % 2 ? '#ffe14d' : '#ff4fd8'; c.beginPath(); c.arc(x + i * s * .38, y + s * .05, s * .07, 0, 6.3); c.fill(); } },
  grid: function (c, x, y, s, col, t, h, L) { c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.moveTo(0, y); c.lineTo(540, y); c.stroke(); if (!L.vg) { L.vg = 1; } for (var i = 0; i <= 540; i += 60) { c.beginPath(); c.moveTo(i, y); c.lineTo(i, y + L.th); c.stroke(); } },
  candle: function (c, x, y, s, col, t, h) { var up = h > .5, cc = up ? col : (c.__alt || col), bh = s * (1 + h * 2); c.fillStyle = cc; c.strokeStyle = cc; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - bh); c.lineTo(x, y + bh); c.stroke(); c.fillRect(x - s * .4, y - bh * .55, s * .8, bh * 1.1); },
  coin: function (c, x, y, s, col, t, h) { var sq = Math.abs(Math.cos(t * 1.5 + h * 9)) * .75 + .25; c.save(); c.translate(x, y); c.scale(sq, 1); var g = c.createRadialGradient(-s * .3, -s * .3, s * .1, 0, 0, s); g.addColorStop(0, '#fff2b0'); g.addColorStop(1, '#c8901a'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, s, 0, 6.3); c.fill(); c.lineWidth = 2; c.strokeStyle = '#7a5410'; c.stroke(); c.fillStyle = '#7a5410'; c.font = '800 ' + (s * 1.2) + 'px system-ui,Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(h > .5 ? 'B' : '$', 0, s * .06); c.restore(); },
  glyph: function (c, x, y, s, col, t, h) { c.fillStyle = col; c.font = '700 ' + s + 'px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; var ch = '01$#%&@ΞΣ'; for (var i = 0; i < 4; i++) { c.globalAlpha *= .8; c.fillText(ch.charAt(Math.floor(H(Math.floor(h * 1e4) + i, Math.floor(t * 3 + i)) * ch.length)), x, y - i * s * 1.1); } },
  spike: function (c, x, y, s, col, t, h) { c.fillStyle = col; c.beginPath(); var d = h > .5 ? 1 : -1; c.moveTo(x - s * .5, y - d * s * .8); c.lineTo(x + s * .5, y - d * s * .8); c.lineTo(x, y + d * s * .9); c.closePath(); c.fill(); },
  lavablob: function (c, x, y, s, col, t, h) { var p = 1 + .12 * Math.sin(t * 2 + h * 20), g = c.createRadialGradient(x, y, 0, x, y, s * p); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,90,20,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, s * p, 0, 6.3); c.fill(); },
  beam: function (c, x, y, s, col, t, h) { c.save(); c.translate(x, y); c.rotate(Math.sin(t * .8 + h * 6) * .35); var g = c.createLinearGradient(0, 0, 0, s * 3); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(-s * .06, 0); c.lineTo(s * .06, 0); c.lineTo(s * .5, s * 3); c.lineTo(-s * .5, s * 3); c.closePath(); c.fill(); c.restore(); },
  fish: function (c, x, y, s, col, t, h) { var d = h > .5 ? 1 : -1; c.save(); c.translate(x, y + Math.sin(t * 2 + h * 9) * 3); c.scale(d, 1); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, s, s * .55, 0, 0, 6.3); c.fill(); c.beginPath(); c.moveTo(-s * .8, 0); c.lineTo(-s * 1.5, -s * .5 + Math.sin(t * 8) * s * .15); c.lineTo(-s * 1.5, s * .5 + Math.sin(t * 8) * s * .15); c.closePath(); c.fill(); c.fillStyle = '#0a0c10'; c.beginPath(); c.arc(s * .5, -s * .1, s * .12, 0, 6.3); c.fill(); c.restore(); },
  bubble: function (c, x, y, s, col, t, h) { c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); c.arc(x + Math.sin(t + h * 20) * 4, y, s, 0, 6.3); c.stroke(); c.fillStyle = col; c.globalAlpha *= .6; c.beginPath(); c.arc(x - s * .35, y - s * .35, s * .22, 0, 6.3); c.fill(); },
  sun: function (c, x, y, s, col, t, h, L) { var g = c.createRadialGradient(x, y, s * .2, x, y, s * 2.2); g.addColorStop(0, 'rgba(255,230,140,.55)'); g.addColorStop(1, 'rgba(255,200,100,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, s * 2.2, 0, 6.3); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(x, y, s, 0, 6.3); c.fill(); if (L.stripes) { c.fillStyle = 'rgba(40,0,70,.55)'; for (var i = 0; i < 5; i++) c.fillRect(x - s, y + s * (-.1 + i * .22), s * 2, s * (.03 + i * .03)); } },
  palm: function (c, x, y, s, col, t, h) { c.save(); c.translate(x, y); c.rotate(t * .08 * (h - .5)); c.fillStyle = col; for (var i = 0; i < 7; i++) { c.save(); c.rotate(i * .8976); c.beginPath(); c.ellipse(0, -s * .55, s * .13, s * .55, 0, 0, 6.3); c.fill(); c.restore(); } c.fillStyle = '#6b4a2a'; c.beginPath(); c.arc(0, 0, s * .1, 0, 6.3); c.fill(); c.restore(); },
  wave: function (c, x, y, s, col, t, h) { c.strokeStyle = col; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath(); c.arc(x, y + s * .7, s, 3.6, 5.8); c.stroke(); },
  pyramid: function (c, x, y, s, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x - s * .8, y + s * .5); c.lineTo(x, y - s * .6); c.lineTo(x + s * .8, y + s * .5); c.closePath(); c.fill(); c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.moveTo(x, y - s * .6); c.lineTo(x + s * .8, y + s * .5); c.lineTo(x, y + s * .5); c.closePath(); c.fill(); },
  cactus: function (c, x, y, s, col) { c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = s * .26; c.beginPath(); c.moveTo(x, y + s * .6); c.lineTo(x, y - s * .6); c.moveTo(x, y + s * .1); c.lineTo(x - s * .3, y + s * .1); c.lineTo(x - s * .3, y - s * .25); c.moveTo(x, y - s * .05); c.lineTo(x + s * .3, y - s * .05); c.lineTo(x + s * .3, y - s * .4); c.stroke(); },
  pine: function (c, x, y, s, col) { c.fillStyle = '#4a2f1a'; c.fillRect(x - s * .07, y + s * .5, s * .14, s * .3); c.fillStyle = col; for (var i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x - s * (.5 - i * .08), y + s * (.55 - i * .45)); c.lineTo(x, y + s * (-.2 - i * .45)); c.lineTo(x + s * (.5 - i * .08), y + s * (.55 - i * .45)); c.closePath(); c.fill(); } c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(x - s * .12, y - s * .85 + s * .25); c.lineTo(x, y - s * 1.1); c.lineTo(x + s * .12, y - s * .85 + s * .25); c.closePath(); c.fill(); },
  lolli: function (c, x, y, s, col, t, h) { c.strokeStyle = '#f4ecff'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + s * .2, y + s * 1.6); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(x, y, s, 0, 6.3); c.fill(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; c.beginPath(); for (var i = 0; i < 40; i++) { var a = i * .4 + t * .5, r = s * i / 44; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.stroke(); },
  donut: function (c, x, y, s, col, t, h) { c.fillStyle = '#d29a62'; c.beginPath(); c.arc(x, y, s, 0, 6.3); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(x, y, s * .92, 0, 6.3); c.fill(); c.fillStyle = 'rgba(8,8,20,.0)'; c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(x, y, s * .32, 0, 6.3); c.fill(); c.globalCompositeOperation = 'source-over'; var cs = ['#fff', '#ffe14d', '#4cc9f0', '#8a5cff']; for (var i = 0; i < 6; i++) { c.fillStyle = cs[i % 4]; c.save(); c.translate(x + Math.cos(i * 1.05 + h * 6) * s * .65, y + Math.sin(i * 1.05 + h * 6) * s * .65); c.rotate(i); c.fillRect(-3, -1, 6, 2.2); c.restore(); } },
  moon: function (c, x, y, s, col) { var g = c.createRadialGradient(x, y, s * .6, x, y, s * 1.8); g.addColorStop(0, 'rgba(255,245,200,.3)'); g.addColorStop(1, 'rgba(255,245,200,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, s * 1.8, 0, 6.3); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(x, y, s, 0, 6.3); c.fill(); c.fillStyle = 'rgba(0,0,0,.1)'; c.beginPath(); c.arc(x - s * .3, y - s * .2, s * .22, 0, 6.3); c.arc(x + s * .35, y + s * .3, s * .16, 0, 6.3); c.fill(); },
  ghost: function (c, x, y, s, col, t, h) { y += Math.sin(t * 1.5 + h * 9) * 5; c.fillStyle = col; c.beginPath(); c.arc(x, y, s, Math.PI, 0); c.lineTo(x + s, y + s * 1.2); for (var i = 3; i >= 0; i--) c.lineTo(x + s * (i / 2 - 1) + (i % 2 ? -s * .25 : 0), y + s * (i % 2 ? 1.0 : 1.3)); c.lineTo(x - s, y + s * 1.2); c.closePath(); c.fill(); c.fillStyle = '#10101c'; c.beginPath(); c.arc(x - s * .35, y - s * .1, s * .15, 0, 6.3); c.arc(x + s * .35, y - s * .1, s * .15, 0, 6.3); c.fill(); },
  bat: function (c, x, y, s, col, t) { var f = Math.sin(t * 9) * .5; c.fillStyle = col; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - s, y - s * (1 + f), x - s * 1.6, y); c.quadraticCurveTo(x - s * .8, y + s * .1, x - s * .4, y + s * .5); c.quadraticCurveTo(x, y + s * .2, x + s * .4, y + s * .5); c.quadraticCurveTo(x + s * .8, y + s * .1, x + s * 1.6, y); c.quadraticCurveTo(x + s, y - s * (1 + f), x, y); c.fill(); },
  pumpkin: function (c, x, y, s, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, s, s * .85, 0, 0, 6.3); c.fill(); c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x - s * .4, y, s * .3, s * .8, 0, 0, 6.3); c.ellipse(x + s * .4, y, s * .3, s * .8, 0, 0, 6.3); c.fill(); c.fillStyle = '#2f7a2f'; c.fillRect(x - 2, y - s * 1.1, 4, s * .3); },
  lightdots: function (c, x, y, s, col, t, h) { c.globalAlpha *= (Math.sin(t * 4 + h * 50) > 0 ? 1 : .35); c.fillStyle = col; c.beginPath(); c.arc(x, y, s, 0, 6.3); c.fill(); },
  suit: function (c, x, y, s, col, t, h) { c.fillStyle = col; c.save(); c.translate(x, y); c.rotate((h - .5) * .8); var k = Math.floor(h * 997) % 3; if (k === 0) { c.beginPath(); c.moveTo(0, s * .8); c.bezierCurveTo(-s * 1.4, -s * .2, -s * .5, -s, 0, -s * .3); c.bezierCurveTo(s * .5, -s, s * 1.4, -s * .2, 0, s * .8); c.fill(); } else if (k === 1) { c.beginPath(); c.moveTo(0, -s); c.lineTo(s * .7, 0); c.lineTo(0, s); c.lineTo(-s * .7, 0); c.closePath(); c.fill(); } else { c.beginPath(); c.arc(0, -s * .4, s * .38, 0, 6.3); c.arc(-s * .4, s * .15, s * .38, 0, 6.3); c.arc(s * .4, s * .15, s * .38, 0, 6.3); c.fill(); c.fillRect(-s * .08, 0, s * .16, s * .9); } c.restore(); },
  chip: function (c, x, y, s, col, t, h) { c.save(); c.translate(x, y); c.rotate(t * .3 + h * 6); c.fillStyle = col; c.beginPath(); c.arc(0, 0, s, 0, 6.3); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = s * .2; c.setLineDash([s * .45, s * .45]); c.beginPath(); c.arc(0, 0, s * .8, 0, 6.3); c.stroke(); c.setLineDash([]); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, s * .45, 0, 6.3); c.stroke(); c.restore(); },
  lantern: function (c, x, y, s, col, t, h) { y += Math.sin(t + h * 8) * 4; c.strokeStyle = '#ffd7a0'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - s * 1.6); c.lineTo(x, y - s); c.stroke(); var g = c.createRadialGradient(x, y, 0, x, y, s * 1.8); g.addColorStop(0, 'rgba(255,170,80,.4)'); g.addColorStop(1, 'rgba(255,170,80,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, s * 1.8, 0, 6.3); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(x, y, s * .7, s, 0, 0, 6.3); c.fill(); c.fillStyle = '#3a1a10'; c.fillRect(x - s * .35, y - s * 1.05, s * .7, s * .15); c.fillRect(x - s * .35, y + s * .9, s * .7, s * .15); },
  petal: function (c, x, y, s, col, t, h) { c.save(); c.translate(x + Math.sin(t + h * 12) * 10, y); c.rotate(t * (h - .5) * 2 + h * 6); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, s, s * .55, 0, 0, 6.3); c.fill(); c.restore(); },
  leaf: function (c, x, y, s, col, t, h) { c.save(); c.translate(x, y); c.rotate((h - .5) * 2.4 + Math.sin(t * .8 + h * 9) * .08); c.fillStyle = col; c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(s * .7, -s * .2, 0, s); c.quadraticCurveTo(-s * .7, -s * .2, 0, -s); c.fill(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -s); c.lineTo(0, s); c.stroke(); c.restore(); },
  firefly: function (c, x, y, s, col, t, h) { var b = .4 + .6 * Math.abs(Math.sin(t * 1.3 + h * 30)); x += Math.sin(t * .7 + h * 9) * 12; y += Math.cos(t * .9 + h * 7) * 8; var g = c.createRadialGradient(x, y, 0, x, y, s * 5); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,150,0)'); c.globalAlpha *= b; c.fillStyle = g; c.beginPath(); c.arc(x, y, s * 5, 0, 6.3); c.fill(); },
  disco: function (c, x, y, s, col, t, h) { c.save(); c.translate(x, y); c.rotate(t * 2 * (h - .5) * 3); c.globalAlpha *= (.4 + .6 * Math.abs(Math.sin(t * 3 + h * 20))); c.fillStyle = col; c.fillRect(-s / 2, -s / 2, s, s); c.restore(); },
  confetti: function (c, x, y, s, col, t, h) { c.save(); c.translate(x, y); c.rotate(t * 3 * (h - .5) * 2 + h * 9); c.fillStyle = col; c.fillRect(-s / 2, -s / 4, s, s / 2); c.restore(); },
  diamond: function (c, x, y, s, col, t, h) { c.save(); c.translate(x, y); c.rotate(t * .6 * (h - .5)); c.fillStyle = col; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * .7, 0); c.lineTo(0, s); c.lineTo(-s * .7, 0); c.closePath(); c.fill(); c.restore(); },
  earth: function (c, x, y, s, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, s, 0, 6.3); c.fill(); c.fillStyle = '#4cbf6a'; c.beginPath(); c.arc(x - s * .3, y - s * .2, s * .35, 0, 6.3); c.arc(x + s * .35, y + s * .25, s * .28, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x + s * .1, y - s * .5, s * .4, s * .1, .3, 0, 6.3); c.fill(); },
  crater: function (c, x, y, s, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, s, s * .7, 0, 0, 6.3); c.fill(); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, s, s * .7, 0, 0, 6.3); c.stroke(); },
  balloon: function (c, x, y, s, col, t, h) { y += Math.sin(t * 1.2 + h * 9) * 6; c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y + s * 1.2); c.quadraticCurveTo(x + 6, y + s * 2, x - 2, y + s * 2.8); c.stroke(); c.fillStyle = col; c.beginPath(); c.ellipse(x, y, s * .8, s, 0, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(x - s * .3, y - s * .35, s * .15, s * .28, .4, 0, 6.3); c.fill(); },
  stripes: function (c, x, y, s, col) { c.fillStyle = col; for (var i = 0; i < 540; i += 60) c.fillRect(i, y - 50, 30, 100); },
  mush: function (c, x, y, s, col, t, h) { c.fillStyle = '#f4ecd8'; c.fillRect(x - s * .16, y, s * .32, s * .6); c.fillStyle = col; c.beginPath(); c.ellipse(x, y, s * .7, s * .5, 0, Math.PI, 0); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(x - s * .3, y - s * .2, s * .1, 0, 6.3); c.arc(x + s * .2, y - s * .3, s * .12, 0, 6.3); c.arc(x + s * .05, y - s * .1, s * .07, 0, 6.3); c.fill(); },
  eye: function (c, x, y, s, col, t, h) { var lx = Math.sin(t * .7 + h * 9) * s * .25; c.fillStyle = col; c.beginPath(); c.ellipse(x, y, s, s * .62, 0, 0, 6.3); c.fill(); c.fillStyle = '#6a2cff'; c.beginPath(); c.arc(x + lx, y, s * .36, 0, 6.3); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(x + lx, y, s * .16, 0, 6.3); c.fill(); },
  halo: function (c, x, y, s, col, t, h) { y += Math.sin(t + h * 9) * 4; c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.ellipse(x, y, s, s * .35, 0, 0, 6.3); c.stroke(); },
  gear: function (c, x, y, s, col, t, h) { c.save(); c.translate(x, y); c.rotate(t * .4 * (h > .5 ? 1 : -1)); c.fillStyle = col; for (var i = 0; i < 8; i++) { c.rotate(.7854); c.fillRect(-s * .12, -s * 1.12, s * .24, s * .3); } c.beginPath(); c.arc(0, 0, s, 0, 6.3); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(0, 0, s * .35, 0, 6.3); c.fill(); c.restore(); },
  barrel: function (c, x, y, s, col, t, h) { c.save(); c.translate(x, y); c.rotate((h - .5) * .7); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, s * .8, s, 0, 0, 6.3); c.fill(); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-s * .8, -s * .4, s * 1.6, s * .14); c.fillRect(-s * .8, s * .3, s * 1.6, s * .14); c.fillStyle = '#d6ff3a'; c.beginPath(); c.arc(0, 0, s * .22, 0, 6.3); c.fill(); c.restore(); },
  bar: function (c, x, y, s, col, t, h) { c.save(); c.translate(x, y); c.rotate((h - .5) * .5); c.fillStyle = col; c.beginPath(); c.moveTo(-s, s * .4); c.lineTo(-s * .7, -s * .4); c.lineTo(s * .7, -s * .4); c.lineTo(s, s * .4); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(-s * .6, -s * .3, s * 1.2, s * .12); c.restore(); },
  sparkle: function (c, x, y, s, col, t, h) { var a = Math.abs(Math.sin(t * 2 + h * 30)); c.globalAlpha *= a; c.fillStyle = col; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * .22, y - s * .22); c.lineTo(x + s, y); c.lineTo(x + s * .22, y + s * .22); c.lineTo(x, y + s); c.lineTo(x - s * .22, y + s * .22); c.lineTo(x - s, y); c.lineTo(x - s * .22, y - s * .22); c.closePath(); c.fill(); }
};

function paintBg(c, th, o) {
  /* o: {W,H,camY,SC,LEN,t,seed} — рисует фон на весь холст. Дальше поверх идёт затемнение дорожки. */
  var W = o.W, Hh = o.H, p = Math.max(0, Math.min(1, o.camY / o.LEN)), s = th.sc, i, k, L, lay;
  function at(q) { return q < .5 ? [mix(s[0], s[1], q * 2)] : [mix(s[1], s[2], (q - .5) * 2)]; }
  var g = c.createLinearGradient(0, 0, 0, Hh), q0 = p * .7, q1 = Math.min(1, p * .7 + .3);
  g.addColorStop(0, at(q0)[0]); g.addColorStop(1, at(q1)[0]); c.fillStyle = g; c.fillRect(0, 0, W, Hh);
  var base = (o.seed | 0) * 13 + th.i * 1009;
  for (lay = 0; lay < th.layers.length; lay++) {
    L = th.layers[lay];
    var scroll = o.camY * o.SC * L.f - (L.fall || 0) * o.t, tile = L.th, smax = L.s[1] * 2.2;
    var t0 = Math.floor((scroll - 140) / tile) - 1, t1 = Math.floor((scroll + Hh + 140) / tile);
    var QUIET = { confetti: 1, lightdots: 1, disco: 1, sparkle: 1, firefly: 1, suit: 1 }, kmax = L.d === 'grid' || L.d === 'stripes' ? L.n : Math.max(1, Math.round(L.n * (QUIET[L.d] ? 0.3 : 0.5)));
    for (var ti = t0; ti <= t1; ti++) for (k = 0; k < kmax; k++) {
      var sd = ti * 131 + k * 17 + lay * 1013 + base, h1 = H(sd, 1), h2 = H(sd, 2), h3 = H(sd, 3), h4 = H(sd, 4);
      var sz = L.s[0] + (L.s[1] - L.s[0]) * h3, x = h1 * (W + 2 * smax) - smax;
      if (L.dx) { var span = W + 2 * smax; x = (((x + smax + L.dx * o.t) % span) + span) % span - smax; }
      var y = ti * tile + h2 * tile - scroll;
      if (y < -smax - 60 || y > Hh + smax + 60) continue;
      if (L.d === 'grid') { y = ti * tile - scroll; }
      c.save(); c.globalAlpha = L.a * 0.85; c.lineCap = 'round';
      if (L.d === 'candle') { c.__alt = L.c[1]; }
      PAINT[L.d](c, x, y, sz, L.c[Math.floor(h4 * L.c.length) % L.c.length], o.t, h3 * .5 + h1 * .5, L);
      c.restore();
    }
  }
  /* затемнение под дорожкой задаёт вызывающий код; здесь только «погода» */
  if (th.amb) ambient(c, th, o);
}
function ambient(c, th, o) {
  var W = o.W, Hh = o.H, t = o.t, i, a = th.amb;
  if (a === 'snow') { c.fillStyle = '#fff'; for (i = 0; i < 28; i++) { var x = (H(i, 1) * W + Math.sin(t * .8 + i) * 14 + W) % W, y = (H(i, 2) * Hh + t * (30 + H(i, 3) * 50)) % Hh; c.globalAlpha = .55 + .4 * H(i, 4); c.beginPath(); c.arc(x, y, 1.2 + 2 * H(i, 3), 0, 6.3); c.fill(); } c.globalAlpha = 1; }
  else if (a === 'embers') { for (i = 0; i < 16; i++) { var x2 = (H(i, 5) * W + Math.sin(t + i) * 10 + W) % W, y2 = Hh - ((H(i, 6) * Hh + t * (40 + H(i, 7) * 70)) % Hh); c.fillStyle = H(i, 8) > .5 ? '#ffb020' : '#ff5a14'; c.globalAlpha = .4 + .5 * H(i, 9); c.beginPath(); c.arc(x2, y2, 1 + 2 * H(i, 7), 0, 6.3); c.fill(); } c.globalAlpha = 1; }
  else if (a === 'storm') { c.strokeStyle = 'rgba(180,200,230,.45)'; c.lineWidth = 1.2; c.beginPath(); for (i = 0; i < 40; i++) { var x3 = (H(i, 1) * (W + 80) + t * 60) % (W + 80) - 40, y3 = (H(i, 2) * Hh + t * 520) % Hh; c.moveTo(x3, y3); c.lineTo(x3 - 5, y3 + 16); } c.stroke();
    var ph = (t % 4.3), fl = ph < .12 ? (1 - ph / .12) : (ph > .3 && ph < .38 ? (1 - (ph - .3) / .08) * .6 : 0); if (fl > 0) { c.fillStyle = 'rgba(220,235,255,' + (fl * .35) + ')'; c.fillRect(0, 0, W, Hh); c.strokeStyle = 'rgba(255,255,220,' + fl + ')'; c.lineWidth = 3; c.beginPath(); var bx = 80 + H(Math.floor(t / 4.3), 3) * (W - 160), by = 0; c.moveTo(bx, by); for (i = 1; i < 8; i++) { bx += (H(Math.floor(t / 4.3) + i, 4) - .5) * 60; by += 70; c.lineTo(bx, by); } c.stroke(); } }
}

/* ================= ПЕРСОНАЖИ ================= */
/* ctx уже сдвинут в центр шарика, единица = радиус r. Каждый персонаж: [id, цвет тела, [части...], теги, высота шляпы (для короны)] */
var CS;   /* рабочий контекст на время отрисовки */
function ci(x, y, rad, f, lw) { CS.beginPath(); CS.arc(x, y, Math.max(.1, rad), 0, 6.3); if (f) { CS.fillStyle = f; CS.fill(); } if (lw !== 0) { CS.lineWidth = lw || 1.6; CS.strokeStyle = O; CS.stroke(); } }
function el(x, y, rx, ry, f, lw, rot) { CS.beginPath(); CS.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot || 0, 0, 6.3); if (f) { CS.fillStyle = f; CS.fill(); } if (lw !== 0) { CS.lineWidth = lw || 1.6; CS.strokeStyle = O; CS.stroke(); } }
function pg(pts, f, lw) { CS.beginPath(); for (var i = 0; i < pts.length; i += 2) { if (i) CS.lineTo(pts[i], pts[i + 1]); else CS.moveTo(pts[0], pts[1]); } CS.closePath(); if (f) { CS.fillStyle = f; CS.fill(); } if (lw !== 0) { CS.lineWidth = lw || 1.6; CS.strokeStyle = O; CS.lineJoin = 'round'; CS.stroke(); } }
function ln(x1, y1, x2, y2, col, lw) { CS.beginPath(); CS.moveTo(x1, y1); CS.lineTo(x2, y2); CS.strokeStyle = col || O; CS.lineWidth = lw || 2; CS.lineCap = 'round'; CS.stroke(); }
function sc(a, r) { var o = []; for (var i = 0; i < a.length; i++) o.push(a[i] * r); return o; }

/* части. a = аргументы, r = радиус, o = состояние (взгляд, время) */
var PT = {
  /* ---- сзади ---- */
  earsR: function (r, a) { ci(-.78 * r, -.82 * r, .3 * r, a[0]); ci(.78 * r, -.82 * r, .3 * r, a[0]); if (a[1]) { ci(-.78 * r, -.82 * r, .15 * r, a[1], 0); ci(.78 * r, -.82 * r, .15 * r, a[1], 0); } },
  earsP: function (r, a) { [-1, 1].forEach(function (s) { pg(sc([s * .88, -.3, s * .8, -1.2, s * .2, -.88], r), a[0]); if (a[1]) pg(sc([s * .72, -.5, s * .68, -.98, s * .35, -.8], r), a[1], 0); }); },
  earsL: function (r, a) { [-1, 1].forEach(function (s) { el(s * .4 * r, -1.2 * r, .2 * r, .62 * r, a[0], null, s * .15); if (a[1]) el(s * .4 * r, -1.2 * r, .09 * r, .46 * r, a[1], 0, s * .15); }); },
  earsF: function (r, a) { [-1, 1].forEach(function (s) { el(s * .95 * r, -.1 * r, .22 * r, .5 * r, a[0], null, s * .3); }); },
  earsBig: function (r, a) { [-1, 1].forEach(function (s) { ci(s * 1.0 * r, -.15 * r, .5 * r, a[0]); ci(s * 1.0 * r, -.15 * r, .3 * r, a[1] || a[0], 0); }); },
  horns: function (r, a) { [-1, 1].forEach(function (s) { pg(sc([s * .6, -.8, s * .95, -1.45, s * .2, -.98], r), a[0]); }); },
  bull: function (r, a) { [-1, 1].forEach(function (s) { CS.lineCap = 'round'; CS.beginPath(); CS.moveTo(s * .55 * r, -.75 * r); CS.quadraticCurveTo(s * 1.35 * r, -.75 * r, s * 1.2 * r, -1.45 * r); CS.strokeStyle = O; CS.lineWidth = .3 * r; CS.stroke(); CS.strokeStyle = a[0]; CS.lineWidth = .2 * r; CS.stroke(); }); },
  spikes: function (r, a) { for (var i = -3; i <= 3; i++) { var an = -1.5708 + i * .38; pg([Math.cos(an - .16) * r * .9, Math.sin(an - .16) * r * .9, Math.cos(an) * r * 1.4, Math.sin(an) * r * 1.4, Math.cos(an + .16) * r * .9, Math.sin(an + .16) * r * .9], a[0]); } },
  wings: function (r, a) { [-1, 1].forEach(function (s) { el(s * 1.05 * r, .1 * r, .38 * r, .22 * r, a[0], null, s * -.5); }); },
  fin: function (r, a) { pg(sc([-.25, -.85, .35, -1.5, .5, -.8], r), a[0]); },
  antenna: function (r, a) { ln(0, -.9 * r, .1 * r, -1.4 * r, O, 2); ci(.1 * r, -1.5 * r, .14 * r, a[0]); },
  antennaT: function (r, a) { [-1, 1].forEach(function (s) { ln(s * .35 * r, -.85 * r, s * .55 * r, -1.3 * r, O, 2); ci(s * .55 * r, -1.35 * r, .12 * r, a[0]); }); },
  tail: function (r, a) { ln(.9 * r, .5 * r, 1.4 * r, .1 * r, O, 4); ln(.9 * r, .5 * r, 1.4 * r, .1 * r, a[0], 2.2); },
  /* ---- на теле ---- */
  belly: function (r, a) { el(0, .38 * r, .55 * r, .5 * r, a[0], 0); },
  snout: function (r, a) { el(0, .32 * r, .5 * r, .36 * r, a[0]); ci(0, .2 * r, .1 * r, a[1] || O, 0); },
  pigsnout: function (r, a) { el(0, .32 * r, .42 * r, .3 * r, a[0]); ci(-.13 * r, .32 * r, .06 * r, O, 0); ci(.13 * r, .32 * r, .06 * r, O, 0); },
  beak: function (r, a) { pg(sc([-.28, .1, .28, .1, 0, .55], r), a[0]); },
  duckbill: function (r, a) { el(0, .35 * r, .5 * r, .2 * r, a[0]); },
  trunk: function (r, a) { CS.lineCap = 'round'; CS.beginPath(); CS.moveTo(0, .1 * r); CS.quadraticCurveTo(.05 * r, .7 * r, .35 * r, .85 * r); CS.strokeStyle = O; CS.lineWidth = .42 * r; CS.stroke(); CS.strokeStyle = a[0]; CS.lineWidth = .3 * r; CS.stroke(); },
  cheeks: function (r, a) { CS.globalAlpha *= .75; ci(-.62 * r, .22 * r, .15 * r, a[0], 0); ci(.62 * r, .22 * r, .15 * r, a[0], 0); CS.globalAlpha /= .75; },
  stripes: function (r, a) { for (var i = 0; i < 3; i++) { ln(-.95 * r, (-.55 + i * .33) * r, -.62 * r, (-.5 + i * .33) * r, a[0], 3); ln(.95 * r, (-.55 + i * .33) * r, .62 * r, (-.5 + i * .33) * r, a[0], 3); } ln(0, -.98 * r, 0, -.62 * r, a[0], 3); },
  spots: function (r, a) { ci(-.5 * r, -.55 * r, .17 * r, a[0], 0); ci(.55 * r, .45 * r, .2 * r, a[0], 0); ci(.2 * r, -.78 * r, .12 * r, a[0], 0); ci(-.6 * r, .5 * r, .13 * r, a[0], 0); },
  eyepatch: function (r, a) { el(-.36 * r, -.12 * r, .3 * r, .38 * r, a[0], 0, .4); el(.36 * r, -.12 * r, .3 * r, .38 * r, a[0], 0, -.4); },
  maskband: function (r, a) { CS.save(); CS.beginPath(); CS.arc(0, 0, r, 0, 6.3); CS.clip(); CS.fillStyle = a[0]; CS.fillRect(-r, -.45 * r, 2 * r, .6 * r); CS.restore(); },
  hood: function (r, a) { CS.save(); CS.beginPath(); CS.arc(0, 0, r, 0, 6.3); CS.clip(); CS.fillStyle = a[0]; CS.fillRect(-r, -r, 2 * r, 2 * r); CS.fillStyle = a[1]; CS.beginPath(); CS.ellipse(0, .02 * r, .7 * r, .62 * r, 0, 0, 6.3); CS.fill(); CS.restore(); ci(0, .02 * r, 0.001, null, 0); el(0, .02 * r, .7 * r, .62 * r, null, 1.4); },
  scars: function (r, a) { ln(-.7 * r, -.5 * r, -.35 * r, -.05 * r, a[0], 2); for (var i = 0; i < 3; i++) ln((-.6 + i * .12) * r, (-.42 + i * .14) * r, (-.5 + i * .12) * r, (-.28 + i * .14) * r, a[0], 1.5); },
  bandages: function (r, a) { CS.save(); CS.beginPath(); CS.arc(0, 0, r, 0, 6.3); CS.clip(); CS.strokeStyle = a[0]; CS.lineWidth = .16 * r; for (var i = -4; i <= 4; i++) { CS.beginPath(); CS.moveTo(-r, i * .27 * r - .1 * r); CS.lineTo(r, i * .27 * r + .15 * r); CS.stroke(); } CS.restore(); },
  pumpridges: function (r, a) { el(-.5 * r, 0, .28 * r, .95 * r, null, 1.2); el(.5 * r, 0, .28 * r, .95 * r, null, 1.2); ln(0, -.95 * r, 0, -1.2 * r, '#2f7a2f', 5); },
  /* ---- глаза ---- */
  eyes: function (r, a, o) { eyes(r, o, a[0]); },
  /* ---- рты ---- */
  smile: function (r, a) { CS.strokeStyle = O; CS.lineWidth = Math.max(1.8, r * .07); CS.lineCap = 'round'; CS.beginPath(); CS.arc(0, .15 * r, .38 * r, .25, 2.9); CS.stroke(); },
  grin: function (r, a) { CS.beginPath(); CS.moveTo(-.4 * r, .3 * r); CS.quadraticCurveTo(0, .85 * r, .4 * r, .3 * r); CS.closePath(); CS.fillStyle = a[0] || '#7a1020'; CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); CS.fillStyle = '#fff'; CS.fillRect(-.3 * r, .3 * r, .6 * r, .1 * r); },
  open: function (r, a) { el(0, .42 * r, .17 * r, .2 * r, '#7a1020'); },
  fangs: function (r, a) { PT.smile(r, a); pg(sc([-.22, .33, -.12, .33, -.17, .55], r), '#fff', 1.2); pg(sc([.22, .33, .12, .33, .17, .55], r), '#fff', 1.2); },
  flat: function (r, a) { ln(-.25 * r, .42 * r, .25 * r, .42 * r, O, Math.max(1.8, r * .07)); },
  tongue: function (r, a) { PT.smile(r, a); el(.05 * r, .55 * r, .12 * r, .16 * r, '#ff6a8a'); },
  smirk: function (r, a) { CS.strokeStyle = O; CS.lineWidth = Math.max(1.8, r * .07); CS.lineCap = 'round'; CS.beginPath(); CS.moveTo(-.25 * r, .42 * r); CS.quadraticCurveTo(.1 * r, .5 * r, .32 * r, .3 * r); CS.stroke(); },
  buck: function (r, a) { PT.smile(r, a); CS.fillStyle = '#fff'; CS.fillRect(-.14 * r, .4 * r, .13 * r, .2 * r); CS.fillRect(.01 * r, .4 * r, .13 * r, .2 * r); CS.strokeStyle = O; CS.lineWidth = 1; CS.strokeRect(-.14 * r, .4 * r, .13 * r, .2 * r); CS.strokeRect(.01 * r, .4 * r, .13 * r, .2 * r); },
  mustache: function (r, a) { CS.fillStyle = a[0]; CS.beginPath(); CS.moveTo(0, .28 * r); CS.quadraticCurveTo(-.3 * r, .1 * r, -.55 * r, .38 * r); CS.quadraticCurveTo(-.25 * r, .38 * r, 0, .38 * r); CS.quadraticCurveTo(.25 * r, .38 * r, .55 * r, .38 * r); CS.quadraticCurveTo(.3 * r, .1 * r, 0, .28 * r); CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.3; CS.stroke(); },
  beard: function (r, a) { CS.save(); CS.beginPath(); CS.arc(0, 0, r, 0, 6.3); CS.clip(); CS.fillStyle = a[0]; CS.beginPath(); CS.ellipse(0, .78 * r, .9 * r, .6 * r, 0, 0, 6.3); CS.fill(); CS.restore(); PT.smile(r, a); },
  /* ---- шляпы (верх y = -1) ---- */
  cap: function (r, a) { CS.beginPath(); CS.arc(0, -.35 * r, .98 * r, Math.PI, 0); CS.closePath(); CS.fillStyle = a[0]; CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); el(.5 * r, -.36 * r, .6 * r, .12 * r, a[1] || a[0]); },
  tophat: function (r, a) { el(0, -.88 * r, .85 * r, .14 * r, a[0]); CS.fillStyle = a[0]; CS.fillRect(-.5 * r, -1.8 * r, r, .95 * r); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.strokeRect(-.5 * r, -1.8 * r, r, .95 * r); CS.fillStyle = a[1] || '#c1121f'; CS.fillRect(-.5 * r, -1.2 * r, r, .2 * r); },
  beanie: function (r, a) { CS.beginPath(); CS.arc(0, -.35 * r, .98 * r, Math.PI, 0); CS.closePath(); CS.fillStyle = a[0]; CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); el(0, -.42 * r, .98 * r, .16 * r, a[1] || '#fff'); ci(0, -1.4 * r, .2 * r, a[1] || '#fff'); },
  hardhat: function (r, a) { CS.beginPath(); CS.arc(0, -.3 * r, .95 * r, Math.PI, 0); CS.closePath(); CS.fillStyle = a[0]; CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); CS.fillStyle = a[0]; CS.fillRect(-1.05 * r, -.35 * r, 2.1 * r, .12 * r); CS.strokeRect(-1.05 * r, -.35 * r, 2.1 * r, .12 * r); },
  cowboy: function (r, a) { el(0, -.62 * r, 1.35 * r, .2 * r, a[0]); CS.beginPath(); CS.moveTo(-.65 * r, -.65 * r); CS.quadraticCurveTo(-.6 * r, -1.55 * r, 0, -1.3 * r); CS.quadraticCurveTo(.6 * r, -1.55 * r, .65 * r, -.65 * r); CS.closePath(); CS.fillStyle = a[0]; CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); CS.fillStyle = a[1] || '#5a3a1a'; CS.fillRect(-.63 * r, -.82 * r, 1.26 * r, .12 * r); },
  wizard: function (r, a) { el(0, -.7 * r, 1.05 * r, .17 * r, a[0]); pg(sc([-.7, -.7, .05, -2.1, .7, -.7], r), a[0]); ci(.05 * r, -1.0 * r, .1 * r, '#ffe14d', 0); ci(-.2 * r, -1.4 * r, .08 * r, '#ffe14d', 0); },
  chef: function (r, a) { ci(-.5 * r, -1.15 * r, .4 * r, '#fff'); ci(.5 * r, -1.15 * r, .4 * r, '#fff'); ci(0, -1.4 * r, .5 * r, '#fff'); CS.fillStyle = '#fff'; CS.fillRect(-.7 * r, -1.0 * r, 1.4 * r, .45 * r); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.strokeRect(-.7 * r, -1.0 * r, 1.4 * r, .45 * r); },
  party: function (r, a) { pg(sc([-.45, -.78, 0, -1.9, .45, -.78], r), a[0]); ci(0, -1.95 * r, .13 * r, a[1] || '#ffe14d'); ln(-.35 * r, -1.0 * r, .3 * r, -1.35 * r, '#fff', 2.5); },
  santa: function (r, a) { CS.beginPath(); CS.moveTo(-.95 * r, -.5 * r); CS.quadraticCurveTo(-.5 * r, -1.9 * r, .8 * r, -1.2 * r); CS.lineTo(.95 * r, -.5 * r); CS.closePath(); CS.fillStyle = '#d61f2c'; CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); el(0, -.48 * r, 1.0 * r, .18 * r, '#fff'); ci(.85 * r, -1.2 * r, .2 * r, '#fff'); },
  headband: function (r, a) { CS.save(); CS.beginPath(); CS.arc(0, 0, r, 0, 6.3); CS.clip(); CS.fillStyle = a[0]; CS.fillRect(-r, -.72 * r, 2 * r, .26 * r); CS.restore(); ln(.9 * r, -.6 * r, 1.4 * r, -.3 * r, a[0], 4); ln(.9 * r, -.6 * r, 1.45 * r, -.75 * r, a[0], 4); },
  bandana: function (r, a) { CS.save(); CS.beginPath(); CS.arc(0, 0, r, 0, 6.3); CS.clip(); CS.fillStyle = a[0]; CS.beginPath(); CS.moveTo(-r, -.35 * r); CS.lineTo(r, -.35 * r); CS.lineTo(r, -r); CS.lineTo(-r, -r); CS.fill(); CS.fillStyle = a[1] || '#fff'; for (var i = 0; i < 4; i++) CS.fillRect((-.7 + i * .45) * r, -.7 * r, .12 * r, .12 * r); CS.restore(); ln(-.9 * r, -.45 * r, -1.4 * r, -.2 * r, a[0], 4); },
  helmet: function (r, a) { CS.beginPath(); CS.arc(0, -.15 * r, 1.0 * r, Math.PI, 0); CS.closePath(); CS.fillStyle = a[0]; CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); pg(sc([-.12, -1.1, .12, -1.1, .12, -1.55, -.12, -1.55], r), a[1] || a[0]); },
  afro: function (r, a) { ci(-.6 * r, -.85 * r, .55 * r, a[0]); ci(.6 * r, -.85 * r, .55 * r, a[0]); ci(0, -1.1 * r, .7 * r, a[0]); },
  spiky: function (r, a) { for (var i = -2; i <= 2; i++) pg(sc([i * .32 - .2, -.78 - Math.abs(i) * -.04, i * .32, -1.55 + Math.abs(i) * .25, i * .32 + .2, -.78 - Math.abs(i) * -.04], r), a[0]); },
  slick: function (r, a) { CS.beginPath(); CS.arc(0, -.15 * r, 1.0 * r, Math.PI, 0); CS.quadraticCurveTo(.4 * r, -.55 * r, -.95 * r, -.2 * r); CS.closePath(); CS.fillStyle = a[0]; CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); },
  curls: function (r, a) { for (var i = -2; i <= 2; i++) ci(i * .42 * r, (-.92 + Math.abs(i) * .12) * r, .3 * r, a[0]); },
  sombrero: function (r, a) { el(0, -.7 * r, 1.5 * r, .22 * r, a[0]); CS.beginPath(); CS.moveTo(-.5 * r, -.7 * r); CS.lineTo(-.3 * r, -1.55 * r); CS.lineTo(.3 * r, -1.55 * r); CS.lineTo(.5 * r, -.7 * r); CS.closePath(); CS.fillStyle = a[0]; CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); CS.fillStyle = a[1] || '#ff3d6e'; CS.fillRect(-.45 * r, -.95 * r, .9 * r, .15 * r); },
  viking: function (r, a) { CS.beginPath(); CS.arc(0, -.25 * r, .98 * r, Math.PI, 0); CS.closePath(); CS.fillStyle = a[0]; CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); PT.horns(r * 1.05, ['#f1e6c8']); },
  pirate: function (r, a) { CS.beginPath(); CS.moveTo(-1.1 * r, -.55 * r); CS.quadraticCurveTo(0, -1.9 * r, 1.1 * r, -.55 * r); CS.quadraticCurveTo(0, -.8 * r, -1.1 * r, -.55 * r); CS.fillStyle = a[0]; CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); ci(0, -1.0 * r, .13 * r, '#fff', 0); ln(-.2 * r, -.82 * r, .2 * r, -.82 * r, '#fff', 1.5); },
  knight: function (r, a) { CS.beginPath(); CS.arc(0, -.05 * r, 1.0 * r, Math.PI, 0); CS.lineTo(1.0 * r, .55 * r); CS.lineTo(-1.0 * r, .55 * r); CS.closePath(); CS.fillStyle = a[0]; CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); CS.fillStyle = '#0a0c10'; CS.fillRect(-.7 * r, -.3 * r, 1.4 * r, .22 * r); pg(sc([-.1, -1.0, .1, -1.0, .2, -1.6, -.2, -1.6], r), '#d61f2c'); },
  cop: function (r, a) { CS.beginPath(); CS.arc(0, -.35 * r, .98 * r, Math.PI, 0); CS.closePath(); CS.fillStyle = a[0]; CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); el(.35 * r, -.38 * r, .9 * r, .12 * r, '#111'); ci(0, -.8 * r, .15 * r, '#ffd23f', 1.2); },
  halo2: function (r, a) { CS.strokeStyle = O; CS.lineWidth = 7; CS.beginPath(); CS.ellipse(0, -1.25 * r, .6 * r, .18 * r, 0, 0, 6.3); CS.stroke(); CS.strokeStyle = '#ffe14d'; CS.lineWidth = 4; CS.stroke(); },
  headset: function (r, a) { CS.strokeStyle = O; CS.lineWidth = 6; CS.beginPath(); CS.arc(0, 0, r * 1.02, Math.PI, 0); CS.stroke(); CS.strokeStyle = a[0]; CS.lineWidth = 3.5; CS.stroke(); el(-r, .05 * r, .18 * r, .38 * r, a[0]); el(r, .05 * r, .18 * r, .38 * r, a[0]); ln(-r, .35 * r, -.5 * r, .62 * r, O, 3); ci(-.5 * r, .62 * r, .09 * r, a[0]); },
  glasses: function (r, a) { ci(-.36 * r, -.12 * r, .34 * r, null, 2.4); ci(.36 * r, -.12 * r, .34 * r, null, 2.4); ln(-.02 * r, -.12 * r, .02 * r, -.12 * r, O, 2.4); },
  chain: function (r, a) { CS.strokeStyle = '#ffc933'; CS.lineWidth = 3.2; CS.beginPath(); CS.arc(0, .55 * r, .75 * r, .3, 2.84); CS.stroke(); ci(0, 1.3 * r, .13 * r, '#ffc933', 1.2); },
  earring: function (r, a) { ci(-.97 * r, .12 * r, .1 * r, '#ffc933', 1); },
  pacifier: function (r, a) { ci(0, .45 * r, .16 * r, '#ff6ec7'); ci(0, .45 * r, .06 * r, '#fff', 0); },
  tuft: function (r, a) { ln(0, -.95 * r, .05 * r, -1.35 * r, O, 4); ln(0, -.95 * r, .05 * r, -1.35 * r, a[0], 2); },
  bow: function (r, a) { pg(sc([.45, -.95, .95, -1.25, .95, -.7], r), a[0]); pg(sc([.45, -.95, -.05, -1.25, -.05, -.7], r), a[0]); ci(.45 * r, -.95 * r, .12 * r, a[0]); },
  bun: function (r, a) { CS.save(); CS.beginPath(); CS.arc(0, 0, r, 0, 6.3); CS.clip(); CS.fillStyle = a[0]; CS.fillRect(-r, -r, 2 * r, .55 * r); CS.restore(); ci(0, -1.15 * r, .32 * r, a[0]); },
  tinfoil: function (r, a) { pg(sc([-.6, -.8, -.3, -1.5, 0, -1.0, .3, -1.7, .6, -.8], r), '#c9d1db'); },
  crownK: function (r, a) { pg(sc([-.6, -.85, -.65, -1.5, -.3, -1.2, 0, -1.6, .3, -1.2, .65, -1.5, .6, -.85], r), '#ffd23f'); },
  bolt: function (r, a) { pg(sc([.1, -.7, -.3, -.15, -.02, -.15, -.15, .4, .35, -.25, .05, -.25], r), a[0], 0); },
  stitches: function (r, a) { ln(-.6 * r, .55 * r, .6 * r, .55 * r, O, 2); for (var i = -3; i <= 3; i++) ln(i * .17 * r, .48 * r, i * .17 * r, .62 * r, O, 1.6); },
  nose: function (r, a) { ci(0, .12 * r, .13 * r, a[0]); },
  carrot: function (r, a) { pg(sc([-.1, .08, .1, .08, .75, .28], r), '#ff8a1f'); },
  buttons: function (r, a) { ci(0, .45 * r, .09 * r, O, 0); ci(0, .75 * r, .09 * r, O, 0); },
  coinB: function (r, a) { CS.strokeStyle = '#7a5410'; CS.lineWidth = Math.max(2, r * .09); CS.beginPath(); CS.arc(0, 0, r * .86, 0, 6.3); CS.stroke(); },
  glyph: function (r, a) { CS.fillStyle = a[0]; CS.font = '800 ' + Math.round(r * 1.1) + 'px system-ui,Arial,sans-serif'; CS.textAlign = 'center'; CS.textBaseline = 'middle'; CS.fillText(a[1], 0, .38 * r); },
  gem: function (r, a) { pg(sc([0, -.9, .3, -.55, 0, -.2, -.3, -.55], r), a[0], 1.4); },
  rays: function (r, a) { for (var i = 0; i < 10; i++) { var an = i * .6283 + (CS.__t || 0) * .6; pg([Math.cos(an - .12) * r * 1.02, Math.sin(an - .12) * r * 1.02, Math.cos(an) * r * 1.4, Math.sin(an) * r * 1.4, Math.cos(an + .12) * r * 1.02, Math.sin(an + .12) * r * 1.02], a[0]); } },
  sesame: function (r, a) { el(-.4 * r, -.55 * r, .09 * r, .05 * r, a[0], 0, .5); el(.35 * r, .35 * r, .09 * r, .05 * r, a[0], 0, -.5); el(.5 * r, -.4 * r, .09 * r, .05 * r, a[0], 0, .8); el(-.5 * r, .4 * r, .09 * r, .05 * r, a[0], 0, -.2); el(0, -.75 * r, .09 * r, .05 * r, a[0], 0, 0); },
  holes: function (r, a) { ci(-.4 * r, -.5 * r, .14 * r, a[0], 0); ci(.45 * r, .4 * r, .18 * r, a[0], 0); ci(.25 * r, -.55 * r, .1 * r, a[0], 0); ci(-.55 * r, .4 * r, .1 * r, a[0], 0); },
  sprinkles: function (r, a) { var cs = ['#fff', '#ffe14d', '#4cc9f0', '#8a5cff']; for (var i = 0; i < 9; i++) { var an = i * .7 + .3; CS.save(); CS.translate(Math.cos(an) * r * (.45 + .3 * ((i * 7) % 3) / 3), Math.sin(an) * r * (.5 + .25 * ((i * 5) % 3) / 3) - .1 * r); CS.rotate(i); CS.fillStyle = cs[i % 4]; CS.fillRect(-r * .1, -r * .035, r * .2, r * .07); CS.restore(); } },
  seeds: function (r, a) { for (var i = 0; i < 7; i++) el((-.55 + (i % 4) * .36) * r, (.12 + Math.floor(i / 4) * .38) * r, .06 * r, .1 * r, '#111', 0); },
  melon: function (r, a) { CS.save(); CS.beginPath(); CS.arc(0, 0, r, 0, 6.3); CS.clip(); CS.strokeStyle = a[0]; CS.lineWidth = .16 * r; for (var i = -3; i <= 3; i++) { CS.beginPath(); CS.moveTo(i * .3 * r - .2 * r, -r); CS.quadraticCurveTo(i * .5 * r, 0, i * .3 * r - .2 * r, r); CS.stroke(); } CS.restore(); },
  crack: function (r, a) { CS.strokeStyle = O; CS.lineWidth = 2; CS.beginPath(); CS.moveTo(-.8 * r, -.7 * r); for (var i = 0; i < 6; i++) CS.lineTo((-.8 + (i + 1) * .27) * r, (-.7 + (i % 2 ? .12 : -.1)) * r); CS.stroke(); },
  dollarEyes: function (r, a) { /* см. eyes('dollar') */ }
};
/* глаза: kind = null | 'shades' | 'visor' | 'cyclops' | 'angry' | 'sleepy' | 'hearts' | 'dollar' | 'red' | 'dots' | 'big' | 'x' | 'closed' */
function eyes(r, o, kind) {
  var lx = o.lx || 0, ly = o.ly || 1, ex = .36 * r, ey = -.12 * r, e, sg;
  if (o.dead) kind = 'x';
  if (kind === 'shades') { CS.fillStyle = O; CS.fillRect(-.78 * r, ey - .2 * r, 1.56 * r, .4 * r); CS.fillRect(-.08 * r, ey - .14 * r, .16 * r, .1 * r); CS.fillStyle = 'rgba(255,255,255,.35)'; CS.fillRect(-.6 * r, ey - .14 * r, .22 * r, .06 * r); CS.fillRect(.18 * r, ey - .14 * r, .22 * r, .06 * r); return; }
  if (kind === 'visor') { CS.fillStyle = a2('#4cc9f0'); rrect(-.82 * r, ey - .26 * r, 1.64 * r, .52 * r, .26 * r); CS.fill(); CS.strokeStyle = O; CS.lineWidth = 1.6; CS.stroke(); CS.fillStyle = 'rgba(255,255,255,.5)'; CS.fillRect(-.6 * r, ey - .17 * r, .5 * r, .07 * r); return; }
  if (kind === 'cyclops') { ci(0, ey, .5 * r, '#fff', 1.6); ci(lx * .14 * r, ey + ly * .14 * r, .22 * r, O, 0); ci(lx * .14 * r - .06 * r, ey + ly * .14 * r - .06 * r, .06 * r, '#fff', 0); return; }
  if (kind === 'x') { for (sg = -1; sg <= 1; sg += 2) { ln(sg * ex - .2 * r, ey - .2 * r, sg * ex + .2 * r, ey + .2 * r, O, 2.6); ln(sg * ex + .2 * r, ey - .2 * r, sg * ex - .2 * r, ey + .2 * r, O, 2.6); } return; }
  if (kind === 'closed') { for (sg = -1; sg <= 1; sg += 2) { CS.strokeStyle = O; CS.lineWidth = 2.2; CS.lineCap = 'round'; CS.beginPath(); CS.arc(sg * ex, ey, .2 * r, .2, 2.9); CS.stroke(); } return; }
  if (kind === 'dots') { for (sg = -1; sg <= 1; sg += 2) ci(sg * ex + lx * .05 * r, ey + ly * .05 * r, .12 * r, O, 0); return; }
  for (sg = -1; sg <= 1; sg += 2) {
    var rad = (kind === 'big' ? .34 : .27) * r;
    ci(sg * ex, ey, rad, kind === 'red' ? '#2a0a0a' : '#fff', 1.4);
    if (kind === 'hearts') { CS.fillStyle = '#ff3d6e'; heart(sg * ex, ey, rad * .8); }
    else if (kind === 'dollar') { CS.fillStyle = '#12a150'; CS.font = '800 ' + Math.round(rad * 1.8) + 'px system-ui,Arial,sans-serif'; CS.textAlign = 'center'; CS.textBaseline = 'middle'; CS.fillText('$', sg * ex, ey + rad * .08); }
    else if (kind === 'red') { ci(sg * ex + lx * rad * .3, ey + ly * rad * .3, rad * .45, '#ff2d2d', 0); }
    else ci(sg * ex + lx * rad * .42, ey + ly * rad * .42, rad * .5, O, 0);
    if (kind === 'sleepy') { CS.fillStyle = o.body || '#ccc'; CS.fillRect(sg * ex - rad - 2, ey - rad - 2, 2 * rad + 4, rad + 2); ln(sg * ex - rad, ey - 1, sg * ex + rad, ey - 1, O, 2); }
    if (kind === 'angry') { ln(sg * ex - sg * .32 * r, ey - .42 * r, sg * ex + sg * .18 * r, ey - .24 * r, O, 3); }
  }
}
function a2(c) { return c; }
function rrect(x, y, w, h, rd) { CS.beginPath(); CS.moveTo(x + rd, y); CS.lineTo(x + w - rd, y); CS.quadraticCurveTo(x + w, y, x + w, y + rd); CS.lineTo(x + w, y + h - rd); CS.quadraticCurveTo(x + w, y + h, x + w - rd, y + h); CS.lineTo(x + rd, y + h); CS.quadraticCurveTo(x, y + h, x, y + h - rd); CS.lineTo(x, y + rd); CS.quadraticCurveTo(x, y, x + rd, y); CS.closePath(); }
function heart(x, y, s) { CS.beginPath(); CS.moveTo(x, y + s * .8); CS.bezierCurveTo(x - s * 1.4, y - s * .2, x - s * .5, y - s, x, y - s * .3); CS.bezierCurveTo(x + s * .5, y - s, x + s * 1.4, y - s * .2, x, y + s * .8); CS.fill(); }

/* [id, тело, части (рисуются по порядку; 'eyes' — глаза), теги, высота верха для короны, тело2 (низ градиента, необяз.)] */
var CHARS = [
  ['pig', '#ffa6c1', [['earsP', '#ff8fb0'], ['pigsnout', '#ff8fb0'], ['eyes'], ['cheeks', '#ff6a8a']], ['pig', 'oink'], 1.05],
  ['doge', '#e8b86a', [['earsF', '#b9833a'], ['belly', '#fff0d0'], ['snout', '#fff0d0', O], ['eyes'], ['tongue']], ['doge', 'shiba', 'dog'], 1.05],
  ['cat', '#f2a65a', [['earsP', '#f2a65a', '#ffb6c8'], ['stripes', '#c97a2a'], ['snout', '#ffe3c2', '#ff7a9a'], ['eyes'], ['smile']], ['cat', 'kitty'], 1.2],
  ['frog', '#58c86a', [['earsR', '#58c86a'], ['belly', '#c8f0a8'], ['eyes', 'big'], ['grin']], ['pepe', 'frog'], 1.1],
  ['bear', '#8a5a34', [['earsR', '#8a5a34', '#c49a6c'], ['snout', '#d9b48a'], ['eyes'], ['flat']], ['bear'], 1.1],
  ['bull', '#7a4a2a', [['bull', '#f1e6c8'], ['snout', '#e8b9a0'], ['eyes', 'angry'], ['flat']], ['bull'], 1.45],
  ['fox', '#f27a2a', [['earsP', '#f27a2a', '#2a1a10'], ['belly', '#fff4e6'], ['snout', '#fff4e6'], ['eyes'], ['smirk']], ['fox'], 1.2],
  ['panda', '#f4f4f4', [['earsR', '#1a1a1a'], ['eyepatch', '#1a1a1a'], ['snout', '#f4f4f4', O], ['eyes', 'dots'], ['flat']], ['panda'], 1.1],
  ['monkey', '#a9733c', [['earsBig', '#a9733c', '#e8c9a0'], ['belly', '#e8c9a0'], ['eyes'], ['grin']], ['monkey', 'ape'], 1.05],
  ['bunny', '#f4f0ea', [['earsL', '#f4f0ea', '#ffb6c8'], ['cheeks', '#ffc2cf'], ['eyes'], ['buck']], ['bunny', 'rabbit'], 1.85],
  ['penguin', '#1f2430', [['belly', '#f4f4f4'], ['beak', '#ffb020'], ['eyes'], ['cheeks', '#ff8a6a']], ['penguin'], 1.05],
  ['chicken', '#fff4de', [['beak', '#ffb020'], ['eyes'], ['cheeks', '#ff8a8a'], ['tuft', '#e0182e']], ['chicken'], 1.4],
  ['owl', '#9a6a3c', [['earsP', '#9a6a3c'], ['belly', '#e8d0a0'], ['eyes', 'big'], ['beak', '#ffb020']], ['owl'], 1.15],
  ['tiger', '#ff9a2a', [['earsR', '#ff9a2a', '#fff'], ['stripes', '#1a1208'], ['snout', '#fff0d0'], ['eyes'], ['fangs']], ['tiger'], 1.1],
  ['lion', '#e8b04a', [['spikes', '#b9742a'], ['snout', '#fff0c8'], ['eyes'], ['smile']], ['lion'], 1.5],
  ['hamster', '#f0c890', [['earsR', '#f0c890', '#ffb6c8'], ['belly', '#fff4e0'], ['cheeks', '#ffb6a0'], ['eyes', 'big'], ['buck']], ['hamster'], 1.1],
  ['whale', '#4f9bd8', [['belly', '#d8ecf8'], ['spikes', '#7fd0ff'], ['eyes'], ['smile']], ['whale', 'shark'], 1.45],
  ['duck', '#ffd23a', [['tuft', '#ffd23a'], ['duckbill', '#ff9a1f'], ['eyes'], ['cheeks', '#ffb070']], ['duck'], 1.15],
  ['elephant', '#9aa7b8', [['earsBig', '#9aa7b8', '#ffb6c8'], ['eyes'], ['trunk', '#9aa7b8']], ['elephant'], 1.05],
  ['cow', '#f4f4f4', [['earsF', '#222'], ['spots', '#222'], ['snout', '#ffb6c8'], ['eyes'], ['flat']], ['cow'], 1.05],
  ['ninja', '#252a36', [['maskband', '#e8c9a0'], ['eyes', 'angry'], ['headband', '#d61f2c']], ['ninja'], 1.05],
  ['mazhor', '#f0c8a0', [['slick', '#3a2a1a'], ['eyes', 'shades'], ['smirk'], ['chain'], ['earring']], ['mazhor', 'rich', 'lambo'], 1.1],
  ['pirate', '#e8c09a', [['bandana', '#c1121f'], ['eyes'], ['grin', '#7a1020'], ['earring'], ['pirate', '#1a1a22']], ['pirate'], 1.5],
  ['cowboy', '#e8c09a', [['eyes'], ['mustache', '#6a4a2a'], ['cowboy', '#9a6a3a', '#5a3a1a']], ['cowboy'], 1.45],
  ['chef', '#f0c8a0', [['eyes'], ['mustache', '#2a1a10'], ['chef']], ['chef'], 2.0],
  ['wizard', '#e8c9a0', [['beard', '#e6e6ee'], ['eyes'], ['wizard', '#4a2a9a']], ['wizard'], 2.0],
  ['astronaut', '#e8eef5', [['eyes', 'visor'], ['antenna', '#ff3d6e']], ['astronaut', 'moon'], 1.6],
  ['robot', '#9aa7b8', [['antenna', '#ff3d6e'], ['eyes', 'red'], ['stitches']], ['robot', 'bot'], 1.55],
  ['alien', '#7ee05a', [['antennaT', '#7ee05a'], ['eyes', 'big'], ['smile']], ['alien'], 1.45],
  ['zombie', '#9bc88a', [['scars', '#4a6a3a'], ['eyes', 'sleepy'], ['stitches']], ['zombie'], 1.05],
  ['vampire', '#e6dff0', [['slick', '#14101c'], ['eyes', 'red'], ['fangs']], ['vampire'], 1.1],
  ['ghost', '#eef0ff', [['eyes', 'big'], ['open']], ['ghost'], 1.05],
  ['clown', '#f6e4d0', [['curls', '#ff3d6e'], ['eyes'], ['nose', '#e0182e'], ['grin', '#c1121f']], ['clown'], 1.4],
  ['viking', '#e8c09a', [['beard', '#c9772a'], ['eyes', 'angry'], ['viking', '#8a949f']], ['viking'], 1.6],
  ['knight', '#c8d2dc', [['eyes', 'dots'], ['knight', '#8a949f']], ['knight'], 1.6],
  ['cop', '#e8c09a', [['eyes', 'shades'], ['flat'], ['cop', '#1f3a8a']], ['cop'], 1.1],
  ['hacker', '#e8c09a', [['hood', '#14181f', '#e8c09a'], ['glasses'], ['eyes'], ['smirk']], ['hacker', 'dev'], 1.05],
  ['rapper', '#a9754a', [['cap', '#d61f2c', '#d61f2c'], ['eyes', 'shades'], ['chain'], ['smirk']], ['rapper', 'degen'], 1.05],
  ['granny', '#f0cfb0', [['bun', '#e6e6ee'], ['glasses'], ['eyes'], ['smile'], ['cheeks', '#ff9a9a']], ['granny'], 1.5],
  ['nerd', '#f0c8a0', [['slick', '#6a4a2a'], ['glasses'], ['eyes'], ['buck']], ['nerd'], 1.1],
  ['devil', '#e0242a', [['horns', '#ffb3b3'], ['eyes', 'angry'], ['fangs']], ['devil', 'rekt'], 1.45],
  ['angel', '#fff0e0', [['wings', '#ffffff'], ['eyes'], ['smile'], ['halo2']], ['angel', 'wagmi'], 1.7],
  ['pumpkin', '#ff8a1f', [['pumpridges'], ['eyes', 'angry'], ['grin', '#ffe14d']], ['pumpkin'], 1.2],
  ['snowman', '#f4f8ff', [['eyes', 'dots'], ['carrot'], ['buttons'], ['beanie', '#2a6ad8', '#fff']], ['snowman'], 1.85],
  ['mummy', '#e8dcc0', [['bandages', '#b9ab88'], ['eyes', 'dots']], ['mummy'], 1.05],
  ['cyclops', '#7a5ad8', [['eyes', 'cyclops'], ['fangs']], ['cyclops'], 1.05],
  ['skull', '#f0f0e8', [['eyes', 'x'], ['stitches']], ['skull'], 1.05],
  ['poop', '#7a4a22', [['tuft', '#7a4a22'], ['eyes', 'big'], ['grin']], ['poop', 'shit'], 1.4],
  ['bitcoin', '#ffb61e', [['coinB'], ['glyph', '#7a4a00', 'B'], ['eyes', 'dots']], ['bitcoin', 'btc', 'sats'], 1.05],
  ['ethereum', '#8a9bff', [['eyes', 'big'], ['gem', '#d6dcff'], ['smile']], ['ethereum', 'eth'], 1.05],
  ['dollar', '#58c878', [['eyes', 'dollar'], ['grin']], ['dollar', 'usd', 'tether', 'cash', 'pump'], 1.05],
  ['diamond', '#7fe6ff', [['gem', '#ffffff'], ['eyes'], ['smile']], ['diamond', 'hodl', 'gem'], 1.05],
  ['moon', '#f3e8a8', [['holes', '#d8c986'], ['eyes', 'sleepy'], ['smile']], ['moon', 'moonboy'], 1.05],
  ['sun', '#ffd02a', [['rays', '#ffb020'], ['eyes'], ['smile'], ['cheeks', '#ff8a4a']], ['sun'], 1.5],
  ['burger', '#d8933c', [['sesame', '#fff4c8'], ['eyes'], ['tongue']], ['burger'], 1.05],
  ['donut', '#ff8fc7', [['sprinkles'], ['eyes'], ['smile']], ['donut'], 1.05],
  ['egg', '#fff4e0', [['eyes'], ['cheeks', '#ffb0a0'], ['smile'], ['crack']], ['egg'], 1.05],
  ['melon', '#e04a5a', [['melon', '#2f9a4a'], ['seeds'], ['eyes'], ['grin', '#7a1020']], ['melon', 'watermelon'], 1.05]
];
var CHAR_IDS = CHARS.map(function (c) { return c[0]; });

function charsFor(names, seed) {
  /* имя совпало с тегом персонажа (doge, pepe, bitcoin...) — получает его; остальные случайно, без повторов */
  var out = [], used = {}, i, j, rnd = m32((seed | 0) * 40503 + 977);
  for (i = 0; i < names.length; i++) { out.push(-1); }
  for (i = 0; i < names.length; i++) { for (j = 0; j < CHARS.length; j++) { if (!used[j] && CHARS[j][3].indexOf(names[i]) >= 0) { out[i] = j; used[j] = 1; break; } } }
  var pool = []; for (j = 0; j < CHARS.length; j++) if (!used[j]) pool.push(j);
  for (i = pool.length - 1; i > 0; i--) { var k = Math.floor(rnd() * (i + 1)), t = pool[i]; pool[i] = pool[k]; pool[k] = t; }
  var p = 0; for (i = 0; i < names.length; i++) if (out[i] < 0) out[i] = pool[p++];
  return out;
}

/* drawChar: c = контекст, ch = индекс персонажа, (px,py) центр, r радиус, o: {col (кольцо), lx,ly (взгляд), vx,vy, t, dead, lose} */
function drawChar(c, ci_, px, py, r, o) {
  var ch = CHARS[ci_], parts = ch[2], i, sp = Math.sqrt((o.vx || 0) * (o.vx || 0) + (o.vy || 0) * (o.vy || 0)), st = Math.min(.28, sp / 1500), ang = Math.atan2(o.vy || 1, o.vx || 0);
  var hasEyes = false, back = [], mid = [], p;
  CS = c; c.save(); c.translate(px, py); c.lineJoin = 'round'; CS.__t = o.t || 0;
  var BACK = { earsR: 1, earsP: 1, earsL: 1, earsF: 1, earsBig: 1, horns: 1, bull: 1, spikes: 1, wings: 1, fin: 1, antenna: 1, antennaT: 1, tail: 1, rays: 1 };
  for (i = 0; i < parts.length; i++) { p = parts[i]; if (BACK[p[0]]) PT[p[0]](r, p.slice(1), o); }
  /* тело */
  c.save(); c.rotate(ang); c.scale(1 + st, 1 - st * .7); c.rotate(-ang);
  var g = c.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.28, ch[1]); g.addColorStop(1, 'rgba(0,0,0,.55)');
  c.fillStyle = ch[1]; c.beginPath(); c.arc(0, 0, r, 0, 6.3); c.fill(); c.fillStyle = g; c.fill(); c.restore();
  /* детали по телу и лицо */
  var oo = { lx: o.lx, ly: o.ly, dead: o.dead, body: ch[1] };
  for (i = 0; i < parts.length; i++) {
    p = parts[i]; if (BACK[p[0]]) continue;
    if (p[0] === 'eyes') { hasEyes = true; eyes(r, oo, p[1] || null); continue; }
    if (o.dead && (p[0] === 'grin' || p[0] === 'smile' || p[0] === 'fangs' || p[0] === 'tongue' || p[0] === 'open' || p[0] === 'buck' || p[0] === 'smirk')) continue;
    PT[p[0]](r, p.slice(1), oo);
  }
  if (!hasEyes) eyes(r, oo, null);
  /* контур и цветное кольцо-метка слота */
  c.lineWidth = 2.2; c.strokeStyle = O; c.beginPath(); c.arc(0, 0, r, 0, 6.3); c.stroke();
  if (o.col) { c.lineWidth = Math.max(2.4, r * .1); c.strokeStyle = o.col; c.beginPath(); c.arc(0, 0, r - c.lineWidth / 2 - 1, 0, 6.3); c.stroke(); }
  c.restore();
  return ch[4];
}

root.RaceVis = { THEMES: THEMES, THEME_NAMES: THEME_NAMES, themeOf: themeOf, themeIndex: themeIndex, paintBg: paintBg, CHARS: CHARS, CHAR_IDS: CHAR_IDS, charsFor: charsFor, drawChar: drawChar };
})(typeof window !== 'undefined' ? window : globalThis);
