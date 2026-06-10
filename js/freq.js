// Gematria Zipf — log-log rank vs. frequency of gematria values in the
// expanding letter multiset.  One curve per expansion step.

import { LETTER_VALUES } from './gematria.js';

const CANONICAL = 'אבגדהוזחטיכלמנסעפצקרשת';
const VAL_TO_CH = {};
for (const ch of CANONICAL) VAL_TO_CH[LETTER_VALUES[ch]] = ch;

// Collect gematria-value frequency map at each expansion step.
// Step 0 = just the input letters; step n = vals from lt.steps[n-1].
function buildValFreqs(words) {
  const maxSteps = Math.max(0, ...words.flatMap(w => w.letters.map(lt => lt.steps.length)));
  const result = [];

  // Step 0: the raw input letters
  const s0 = {};
  words.forEach(w => w.letters.forEach(lt => {
    if (lt.val) s0[lt.val] = (s0[lt.val] || 0) + 1;
  }));
  if (Object.keys(s0).length) result.push(s0);

  for (let s = 0; s < maxSteps; s++) {
    const comp = {};
    words.forEach(w => w.letters.forEach(lt => {
      if (lt.steps[s]) {
        lt.steps[s].vals.forEach(v => {
          comp[v] = (comp[v] || 0) + 1;
        });
      }
    }));
    if (!Object.keys(comp).length) break;
    result.push(comp);
  }
  return result;
}

export function drawFreq(canvas, ctx, words) {
  const W = canvas.width, H = canvas.height;
  const ML = 62, MR = 28, MT = 36, MB = 52;
  const PW = W - ML - MR, PH = H - MT - MB;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0806'; ctx.fillRect(0, 0, W, H);

  if (!words.length) return;

  const allFreqs = buildValFreqs(words);
  if (!allFreqs.length) return;

  // Normalize each step and sort by frequency descending
  const ranked = allFreqs.map(freq => {
    const total = Object.values(freq).reduce((a, b) => a + b, 0);
    return Object.entries(freq)
      .map(([v, cnt]) => ({ val: +v, rel: cnt / total }))
      .sort((a, b) => b.rel - a.rel);
  });

  // Axis range: log-log
  const maxRank   = Math.max(...ranked.map(r => r.length));
  const maxRelFreq = Math.max(...ranked.flatMap(r => r.map(p => p.rel)));
  const minRelFreq = Math.min(...ranked.flatMap(r => r.filter(p => p.rel > 0).map(p => p.rel)));

  const logRankMax = Math.log10(maxRank || 1);
  const logFreqMax = Math.log10(maxRelFreq) + 0.15;
  const logFreqMin = Math.log10(minRelFreq)  - 0.3;

  function px(logRank) { return ML + (logRank / logRankMax) * PW; }
  function py(logFreq) { return MT + (1 - (logFreq - logFreqMin) / (logFreqMax - logFreqMin)) * PH; }

  // ── Grid ──
  ctx.lineWidth = 0.5;
  for (let p = Math.ceil(logFreqMin); p <= Math.floor(logFreqMax) + 1; p += 0.5) {
    const y = py(p);
    if (y < MT - 4 || y > MT + PH + 4) continue;
    ctx.strokeStyle = 'rgba(58,46,26,0.4)';
    ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'right'; ctx.direction = 'ltr';
    ctx.fillText((Math.pow(10, p) * 100).toFixed(1) + '%', ML - 4, y + 3);
  }
  for (let r = 1; r <= maxRank; r *= (maxRank < 6 ? 2 : (maxRank < 20 ? 3 : 5))) {
    const x = px(Math.log10(r));
    ctx.strokeStyle = 'rgba(58,46,26,0.4)';
    ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(r, x, MT + PH + 14);
    if (r >= maxRank) break;
  }

  // ── Ideal Zipf reference (slope = −1) ──
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(201,168,76,0.18)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px(0),            py(logFreqMax - 0.1));
  ctx.lineTo(px(logRankMax),   py(logFreqMax - 0.1 - logRankMax));
  ctx.stroke();
  ctx.restore();

  // ── One curve per expansion step ──
  ranked.forEach((pts, si) => {
    if (!pts.length) return;
    const t     = si / Math.max(1, ranked.length - 1);
    const alpha = 0.25 + t * 0.70;
    const hue   = 200 + si * 22;

    ctx.beginPath();
    pts.forEach(({ rel }, i) => {
      const x = px(Math.log10(i + 1));
      const y = py(Math.log10(rel));
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = `hsla(${hue},68%,55%,${alpha})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Step label near end of curve
    const last = pts[pts.length - 1];
    if (last) {
      ctx.font = '8px monospace'; ctx.direction = 'ltr';
      ctx.fillStyle = `hsla(${hue},68%,55%,${alpha + 0.1})`;
      ctx.textAlign = 'left';
      ctx.fillText(`step ${si}`,
        px(Math.log10(pts.length)) + 4,
        py(Math.log10(last.rel)) + 3);
    }
  });

  // ── Dots + labels on the deepest step ──
  const deepest = ranked[ranked.length - 1] || [];
  deepest.forEach(({ val, rel }, i) => {
    const x  = px(Math.log10(i + 1));
    const y  = py(Math.log10(rel));
    const ch = VAL_TO_CH[val];

    // Dot
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(201,168,76,0.85)';
    ctx.fill();

    // Hebrew glyph inside dot
    if (ch) {
      ctx.font = `12px 'EB Garamond', serif`;
      ctx.fillStyle = '#1a1208';
      ctx.textAlign = 'center'; ctx.direction = 'ltr';
      ctx.fillText(ch, x, y + 4);
    }

    // Gematria value above dot
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(201,168,76,0.65)';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(val, x, y - 8);
  });

  // ── Axes ──
  ctx.strokeStyle = 'rgba(58,46,26,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ML, MT);      ctx.lineTo(ML, MT + PH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ML, MT + PH); ctx.lineTo(ML + PW, MT + PH); ctx.stroke();

  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.5)';
  ctx.textAlign = 'center'; ctx.direction = 'ltr';
  ctx.fillText('gematria value rank  (log scale)', ML + PW / 2, H - 8);
  ctx.save();
  ctx.translate(13, MT + PH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('frequency  (log scale)', 0, 0);
  ctx.restore();

  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.38)';
  ctx.textAlign = 'left'; ctx.direction = 'ltr';
  ctx.fillText('gematria value distribution per expansion step  ·  dashed = Zipf', ML, MT - 10);
}
