// Gematria Zipf — run the dictionary expansion algorithm, then plot rank vs. frequency.
// Two modes:
//   All Letters — start with all 22 Hebrew letters (count 1 each), expand to depth.
//   Input       — start with the letters from the current input text, expand to depth.

import { LETTER_VALUES, LETTER_NAMES } from './gematria.js';

const CANONICAL = 'אבגדהוזחטיכלמנסעפצקרשת';
const VAL_TO_CH = {};
for (const ch of CANONICAL) VAL_TO_CH[LETTER_VALUES[ch]] = ch;

// ── Core algorithm ────────────────────────────────────────────────────────────
// At each step: every letter in the dict expands to the letters of its Hebrew name.
// Those letters are added back into the dict (their counts accumulate).
// Repeat for maxDepth steps. Final dict → Zipf plot.

function iterateExpansion(startDict, maxDepth) {
  let current = { ...startDict };
  for (let d = 0; d < maxDepth; d++) {
    const next = {};
    for (const [ch, cnt] of Object.entries(current)) {
      const name = LETTER_NAMES[ch];
      if (!name) continue;
      for (const c of name) {
        const canon = VAL_TO_CH[LETTER_VALUES[c]];
        if (canon) next[canon] = (next[canon] || 0) + cnt;
      }
    }
    if (!Object.keys(next).length) break;
    current = next;
  }
  return current;
}

function buildAllDict(maxDepth) {
  const start = {};
  for (const ch of CANONICAL) start[ch] = 1;   // all 22 letters, equal weight
  return iterateExpansion(start, maxDepth);
}

function buildInputDict(words, maxDepth) {
  const start = {};
  words.forEach(w => w.letters.forEach(lt => {
    const ch = VAL_TO_CH[lt.val];
    if (ch) start[ch] = (start[ch] || 0) + 1;
  }));
  return iterateExpansion(start, maxDepth);
}

// ── Module state ──────────────────────────────────────────────────────────────

let _mode     = 'all';
let _canvas   = null;
let _clickFn  = null;
let _btnRects = [];

// ── Toggle buttons ────────────────────────────────────────────────────────────

function drawToggle(ctx, W, MT) {
  const labels = ['All Letters', 'Input'];
  const modes  = ['all', 'input'];
  const bW = 76, bH = 20, gap = 6;
  let bx = W - (labels.length * bW + (labels.length - 1) * gap) - 8;
  const by = MT - 30;

  _btnRects = [];
  labels.forEach((label, i) => {
    const active = _mode === modes[i];
    ctx.beginPath(); ctx.rect(bx, by, bW, bH);
    ctx.fillStyle   = active ? 'rgba(201,168,76,0.22)' : 'rgba(10,8,6,0.6)';
    ctx.fill();
    ctx.strokeStyle = active ? 'rgba(232,197,106,0.85)' : 'rgba(58,46,26,0.65)';
    ctx.lineWidth   = active ? 1.5 : 1;
    ctx.stroke();

    ctx.font      = `${active ? 'bold ' : ''}11px monospace`;
    ctx.fillStyle = active ? 'rgba(232,197,106,0.97)' : 'rgba(201,168,76,0.5)';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(label, bx + bW / 2, by + 13);

    _btnRects.push({ mode: modes[i], x: bx, y: by, w: bW, h: bH });
    bx += bW + gap;
  });
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function drawChart(canvas, ctx, dict, inputChars, title) {
  const W = canvas.width, H = canvas.height;
  const ML = 62, MR = 28, MT = 56, MB = 52;
  const PW = W - ML - MR, PH = H - MT - MB;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0806'; ctx.fillRect(0, 0, W, H);

  drawToggle(ctx, W, MT);

  const entries = Object.entries(dict)
    .map(([ch, cnt]) => ({ ch, cnt }))
    .sort((a, b) => b.cnt - a.cnt);

  if (!entries.length) {
    ctx.font = '13px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.4)';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText('no input text', canvas.width / 2, canvas.height / 2);
    return;
  }

  const total      = entries.reduce((s, e) => s + e.cnt, 0);
  const maxRel     = entries[0].cnt / total;
  const minRel     = entries[entries.length - 1].cnt / total;
  const logRankMax = Math.log10(entries.length);
  const logFreqMax = Math.log10(maxRel) + 0.2;
  const logFreqMin = Math.log10(minRel) - 0.4;

  function px(logRank) { return ML + (logRank / logRankMax) * PW; }
  function py(logFreq) { return MT + (1 - (logFreq - logFreqMin) / (logFreqMax - logFreqMin)) * PH; }

  // Grid
  ctx.lineWidth = 0.5;
  for (let p = Math.floor(logFreqMin); p <= Math.ceil(logFreqMax); p += 0.5) {
    const y = py(p);
    if (y < MT - 4 || y > MT + PH + 4) continue;
    ctx.strokeStyle = 'rgba(58,46,26,0.4)';
    ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'right'; ctx.direction = 'ltr';
    const pv = Math.pow(10, p) * 100;
    const pLabel = pv >= 10 ? pv.toFixed(0) + '%' : pv >= 1 ? pv.toFixed(1) + '%' : pv >= 0.1 ? pv.toFixed(2) + '%' : pv.toFixed(3) + '%';
    ctx.fillText(pLabel, ML - 4, y + 3);
  }
  [1, 3, 6, 10, entries.length].filter((v, i, a) => a.indexOf(v) === i && v <= entries.length)
    .forEach(r => {
      const x = px(Math.log10(r));
      ctx.strokeStyle = 'rgba(58,46,26,0.4)';
      ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
      ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
      ctx.textAlign = 'center'; ctx.direction = 'ltr';
      ctx.fillText(r, x, MT + PH + 14);
    });

  // Ideal Zipf reference (slope = −1)
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(201,168,76,0.18)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px(0),          py(Math.log10(maxRel)));
  ctx.lineTo(px(logRankMax), py(Math.log10(maxRel / entries.length)));
  ctx.stroke();
  ctx.restore();

  // Connector line
  ctx.beginPath();
  entries.forEach(({ cnt }, i) => {
    const x = px(Math.log10(i + 1));
    const y = py(Math.log10(cnt / total));
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = 'rgba(201,168,76,0.25)'; ctx.lineWidth = 1;
  ctx.stroke();

  // Dots + labels
  entries.forEach(({ ch, cnt }, i) => {
    const x       = px(Math.log10(i + 1));
    const y       = py(Math.log10(cnt / total));
    const isInput = inputChars.has(ch);
    const r       = isInput ? 9 : 7;

    if (isInput) {
      ctx.save();
      ctx.shadowColor = 'rgba(232,197,106,0.55)'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232,197,106,0.92)'; ctx.fill();
      ctx.restore();
    }

    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = isInput ? 'rgba(232,197,106,0.92)' : 'rgba(201,168,76,0.80)';
    ctx.fill();

    ctx.font = `${isInput ? 15 : 13}px 'EB Garamond', serif`;
    ctx.fillStyle = '#1a1208';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(ch, x, y + 5);

    ctx.font = '8px monospace';
    ctx.fillStyle = isInput ? 'rgba(232,197,106,0.75)' : 'rgba(201,168,76,0.55)';
    ctx.fillText(LETTER_VALUES[ch], x, y - r - 3);
  });

  // Axes
  ctx.strokeStyle = 'rgba(58,46,26,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ML, MT);      ctx.lineTo(ML, MT + PH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ML, MT + PH); ctx.lineTo(ML + PW, MT + PH); ctx.stroke();

  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.5)';
  ctx.textAlign = 'center'; ctx.direction = 'ltr';
  ctx.fillText('rank', ML + PW / 2, H - 8);
  ctx.save();
  ctx.translate(13, MT + PH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('frequency  (log scale)', 0, 0);
  ctx.restore();

  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.38)';
  ctx.textAlign = 'left'; ctx.direction = 'ltr';
  ctx.fillText(title + '  ·  bright = input letters  ·  dashed = Zipf', ML, MT - 10);
}

// ── Public ────────────────────────────────────────────────────────────────────

export function drawFreq(canvas, ctx, words, maxDepth) {
  if (_canvas && _clickFn) _canvas.removeEventListener('click', _clickFn);
  _canvas = canvas;

  const inputChars = new Set(
    words.flatMap(w => w.letters.map(lt => VAL_TO_CH[lt.val])).filter(Boolean)
  );

  function render() {
    const dict  = _mode === 'all'
      ? buildAllDict(maxDepth)
      : buildInputDict(words, maxDepth);
    const title = _mode === 'all'
      ? 'all 22 letters → expand → dict'
      : 'input letters → expand → dict';
    drawChart(canvas, ctx, dict, inputChars, title);
  }

  _clickFn = (e) => {
    const r  = canvas.getBoundingClientRect();
    const k  = canvas.width / r.width;
    const cx = (e.clientX - r.left) * k;
    const cy = (e.clientY - r.top)  * k;
    for (const btn of _btnRects) {
      if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
        if (_mode !== btn.mode) { _mode = btn.mode; render(); }
        return;
      }
    }
  };

  canvas.addEventListener('click', _clickFn);
  render();

  return function stop() {
    if (_canvas === canvas) {
      canvas.removeEventListener('click', _clickFn);
      _canvas = null; _clickFn = null;
    }
  };
}
