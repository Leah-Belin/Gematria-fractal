// Gematria Zipf — expand every input letter to convergence, accumulate all
// occurrences into one dictionary, then plot rank vs. frequency log-log.

import { LETTER_VALUES } from './gematria.js?v=da378df';

const CANONICAL = 'אבגדהוזחטיכלמנסעפצקרשת';
const VAL_TO_CH = {};
for (const ch of CANONICAL) VAL_TO_CH[LETTER_VALUES[ch]] = ch;

// Expand each input letter to its deepest step, accumulate into one dict.
function buildDict(words) {
  const dict = {};
  words.forEach(w => w.letters.forEach(lt => {
    const finalStep = lt.steps.length > 0 ? lt.steps[lt.steps.length - 1] : null;
    const vals = finalStep ? finalStep.vals : [lt.val];
    vals.forEach(v => {
      const ch = VAL_TO_CH[v];
      if (ch) dict[ch] = (dict[ch] || 0) + 1;
    });
  }));
  return dict;
}

export function drawFreq(canvas, ctx, words) {
  const W = canvas.width, H = canvas.height;
  const ML = 62, MR = 28, MT = 36, MB = 52;
  const PW = W - ML - MR, PH = H - MT - MB;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0806'; ctx.fillRect(0, 0, W, H);

  if (!words.length) return;

  const dict = buildDict(words);
  const entries = Object.entries(dict)
    .map(([ch, cnt]) => ({ ch, cnt }))
    .sort((a, b) => b.cnt - a.cnt);

  if (!entries.length) return;

  const inputChars = new Set(
    words.flatMap(w => w.letters.map(lt => VAL_TO_CH[lt.val])).filter(Boolean)
  );

  const total      = entries.reduce((s, e) => s + e.cnt, 0);
  const maxRel     = entries[0].cnt / total;
  const minRel     = entries[entries.length - 1].cnt / total;
  const logRankMax = Math.log10(entries.length);
  const logFreqMax = Math.log10(maxRel) + 0.2;
  const logFreqMin = Math.log10(minRel) - 0.4;

  function px(logRank) { return ML + (logRank / logRankMax) * PW; }
  function py(logFreq) { return MT + (1 - (logFreq - logFreqMin) / (logFreqMax - logFreqMin)) * PH; }

  // ── Grid ──
  ctx.lineWidth = 0.5;
  for (let p = Math.floor(logFreqMin); p <= Math.ceil(logFreqMax); p += 0.5) {
    const y = py(p);
    if (y < MT - 4 || y > MT + PH + 4) continue;
    ctx.strokeStyle = 'rgba(58,46,26,0.4)';
    ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'right'; ctx.direction = 'ltr';
    ctx.fillText((Math.pow(10, p) * 100).toFixed(1) + '%', ML - 4, y + 3);
  }
  entries.forEach((_, i) => {
    if (i === 0 || (i + 1) % 3 !== 0) return;
    const x = px(Math.log10(i + 1));
    ctx.strokeStyle = 'rgba(58,46,26,0.4)';
    ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(i + 1, x, MT + PH + 14);
  });
  // Always label rank 1
  {
    const x = px(0);
    ctx.strokeStyle = 'rgba(58,46,26,0.4)';
    ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(1, x, MT + PH + 14);
  }

  // ── Ideal Zipf reference (slope = −1) ──
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(201,168,76,0.18)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px(0),            py(Math.log10(maxRel)));
  ctx.lineTo(px(logRankMax),   py(Math.log10(maxRel / entries.length)));
  ctx.stroke();
  ctx.restore();

  // ── Connector line through all dots ──
  ctx.beginPath();
  entries.forEach(({ cnt }, i) => {
    const x = px(Math.log10(i + 1));
    const y = py(Math.log10(cnt / total));
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = 'rgba(201,168,76,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── Dots + labels ──
  entries.forEach(({ ch, cnt }, i) => {
    const x       = px(Math.log10(i + 1));
    const y       = py(Math.log10(cnt / total));
    const isInput = inputChars.has(ch);
    const r       = isInput ? 9 : 7;

    // Glow for input letters
    if (isInput) {
      ctx.save();
      ctx.shadowColor = 'rgba(232,197,106,0.55)';
      ctx.shadowBlur  = 14;
      ctx.beginPath();
      ctx.arc(x, y, r + 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232,197,106,0.92)';
      ctx.fill();
      ctx.restore();
    }

    // Circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = isInput ? 'rgba(232,197,106,0.92)' : 'rgba(201,168,76,0.80)';
    ctx.fill();

    // Hebrew glyph inside
    ctx.font = `${isInput ? 15 : 13}px 'EB Garamond', serif`;
    ctx.fillStyle = '#1a1208';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(ch, x, y + 5);

    // Gematria value above
    ctx.font = '8px monospace';
    ctx.fillStyle = isInput ? 'rgba(232,197,106,0.75)' : 'rgba(201,168,76,0.55)';
    ctx.fillText(LETTER_VALUES[ch], x, y - r - 3);
  });

  // ── Axes ──
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
  ctx.fillText('expanded letter dictionary  ·  bright = input letters  ·  dashed = Zipf', ML, MT - 10);
}
