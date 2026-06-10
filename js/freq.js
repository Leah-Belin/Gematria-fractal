// Letter-frequency evolution — shows how the composition of the expanding
// letter multiset shifts at each iteration step, converging to the Perron
// eigenvector of the 27×27 expansion matrix M (λ₁ ≈ 2.443).

import { LETTER_VALUES } from './gematria.js';

const CANONICAL = 'אבגדהוזחטיכלמנסעפצקרשת';

function buildValMap() {
  const m = {};
  for (const ch of CANONICAL) m[LETTER_VALUES[ch]] = ch;
  return m;
}

// Stable color per letter based on position in canonical order
function letterHue(ch) {
  return ((CANONICAL.indexOf(ch)) * 360 / 22) % 360;
}

// Collect letter composition at each expansion step.
// Returns array of {char → relative frequency} maps, index 0 = input chars.
function buildCompositions(words, valMap) {
  const maxSteps = Math.max(0, ...words.flatMap(w => w.letters.map(lt => lt.steps.length)));
  const result = [];

  const s0 = {};
  words.forEach(w => w.letters.forEach(lt => {
    const ch = valMap[lt.val];
    if (ch) s0[ch] = (s0[ch] || 0) + 1;
  }));
  result.push(s0);

  for (let s = 0; s < maxSteps; s++) {
    const comp = {};
    words.forEach(w => w.letters.forEach(lt => {
      if (lt.steps[s]) {
        lt.steps[s].vals.forEach(v => {
          const ch = valMap[v];
          if (ch) comp[ch] = (comp[ch] || 0) + 1;
        });
      }
    }));
    if (!Object.keys(comp).length) break;
    result.push(comp);
  }

  // Normalize each step to relative frequencies
  return result.map(comp => {
    const total = Object.values(comp).reduce((a, b) => a + b, 0);
    if (!total) return {};
    const rel = {};
    for (const [ch, cnt] of Object.entries(comp)) rel[ch] = cnt / total;
    return rel;
  });
}

export function drawFreq(canvas, ctx, words) {
  const valMap = buildValMap();
  const W = canvas.width, H = canvas.height;
  const ML = 58, MR = 48, MT = 34, MB = 50;
  const PW = W - ML - MR, PH = H - MT - MB;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0806'; ctx.fillRect(0, 0, W, H);

  if (!words.length) return;

  const relFreqs = buildCompositions(words, valMap);
  const nSteps   = relFreqs.length;
  if (nSteps < 2) return;

  const allChars = new Set(relFreqs.flatMap(r => Object.keys(r)));
  const inputChars = new Set(
    words.flatMap(w => w.letters.map(lt => valMap[lt.val])).filter(Boolean)
  );

  const maxFreq = Math.max(...relFreqs.flatMap(r => Object.values(r)));

  function px(step) { return ML + (step / (nSteps - 1)) * PW; }
  function py(freq)  { return MT + (1 - freq / maxFreq) * PH; }

  // Grid — horizontal frequency lines
  ctx.lineWidth = 0.5;
  const gridTicks = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35].filter(f => f <= maxFreq + 0.01);
  gridTicks.forEach(f => {
    const y = py(f);
    ctx.strokeStyle = 'rgba(58,46,26,0.35)';
    ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'right'; ctx.direction = 'ltr';
    ctx.fillText(Math.round(f * 100) + '%', ML - 4, y + 3);
  });

  // Grid — vertical step lines
  for (let s = 0; s < nSteps; s++) {
    const x = px(s);
    ctx.strokeStyle = 'rgba(58,46,26,0.35)';
    ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.35)';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(s, x, MT + PH + 14);
  }

  // Sort letters by their final-step frequency (top letters on top)
  const sortedChars = [...allChars].sort((a, b) => {
    return (relFreqs[nSteps - 1][b] || 0) - (relFreqs[nSteps - 1][a] || 0);
  });

  // Draw non-input letters first (background layer), then input letters on top
  const layers = [
    sortedChars.filter(ch => !inputChars.has(ch)),
    sortedChars.filter(ch =>  inputChars.has(ch)),
  ];

  layers.forEach(chars => {
    chars.forEach(ch => {
      const hue    = letterHue(ch);
      const isInput = inputChars.has(ch);
      const alpha  = isInput ? 0.92 : 0.38;
      const lw     = isInput ? 2.0  : 0.9;

      ctx.beginPath();
      let started = false;
      relFreqs.forEach((r, s) => {
        if (r[ch] === undefined) return;
        const x = px(s), y = py(r[ch]);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = `hsla(${hue},70%,58%,${alpha})`;
      ctx.lineWidth = lw;
      ctx.stroke();

      // Terminal dot
      const lastVal = relFreqs[nSteps - 1][ch];
      if (lastVal !== undefined) {
        const x = px(nSteps - 1), y = py(lastVal);
        ctx.beginPath();
        ctx.arc(x, y, isInput ? 3.5 : 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},70%,58%,${alpha})`;
        ctx.fill();

        // Right-edge label
        ctx.font = `${isInput ? 14 : 10}px 'EB Garamond', serif`;
        ctx.fillStyle = `hsla(${hue},70%,${isInput ? 72 : 52}%,${alpha})`;
        ctx.textAlign = 'left'; ctx.direction = 'ltr';
        ctx.fillText(ch, x + 7, y + 4);
      }
    });
  });

  // Glowing origin dot for input chars at step 0
  inputChars.forEach(ch => {
    const r0 = relFreqs[0][ch];
    if (r0 === undefined) return;
    const hue = letterHue(ch);
    ctx.save();
    ctx.shadowColor = `hsla(${hue},80%,62%,0.65)`;
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.arc(px(0), py(r0), 5, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue},80%,72%,0.9)`;
    ctx.fill();
    ctx.restore();
  });

  // Axes
  ctx.strokeStyle = 'rgba(58,46,26,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ML, MT); ctx.lineTo(ML, MT + PH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ML, MT + PH); ctx.lineTo(ML + PW, MT + PH); ctx.stroke();

  // Axis labels
  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.5)';
  ctx.textAlign = 'center'; ctx.direction = 'ltr';
  ctx.fillText('expansion step', ML + PW / 2, H - 8);
  ctx.save();
  ctx.translate(13, MT + PH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('fraction of letters in multiset', 0, 0);
  ctx.restore();

  // Title
  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.38)';
  ctx.textAlign = 'left'; ctx.direction = 'ltr';
  ctx.fillText('letter composition convergence  ·  bright = input letters', ML, MT - 10);
}
