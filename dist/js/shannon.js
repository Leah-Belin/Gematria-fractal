// Shannon entropy tab — H = −Σ p log₂ p of the expanding letter distribution.
// Two curves converge to the same Perron eigenvector entropy from opposite sides:
// all-22-letters starts near H_uniform (4.459 b) and falls; input starts low and rises.

import { LETTER_VALUES, LETTER_NAMES } from './gematria.js?v=ee4e594';

const CANONICAL = 'אבגדהוזחטיכלמנסעפצקרשת';
const VAL_TO_CH = {};
for (const ch of CANONICAL) VAL_TO_CH[LETTER_VALUES[ch]] = ch;

// Torah letter counts — source: xwalk.ca/lt.html (304,805 letters, all 22 confirmed)
const TORAH_FREQ = {
  'א':27059,'ב':16345,'ג':2109,'ד':7032,'ה':28056,'ו':30513,
  'ז':2198, 'ח':7189, 'ט':1804,'י':31531,'כ':11968,'ל':21570,
  'מ':25090,'נ':14128,'ס':1564,'ע':11484,'פ':8904, 'צ':3195,
  'ק':4707, 'ר':18255,'ש':15892,'ת':14212,
};

// ── Core math ─────────────────────────────────────────────────────────────────

function expandOnce(dict) {
  const next = {};
  for (const [ch, cnt] of Object.entries(dict)) {
    const name = LETTER_NAMES[ch];
    if (!name) continue;
    for (const c of name) {
      const canon = VAL_TO_CH[LETTER_VALUES[c]];
      if (canon) next[canon] = (next[canon] || 0) + cnt;
    }
  }
  return next;
}

function expansionSteps(start, maxDepth) {
  const arr = [{ ...start }];
  let cur = { ...start };
  for (let d = 0; d < maxDepth; d++) {
    const nxt = expandOnce(cur);
    if (!Object.keys(nxt).length) break;
    cur = nxt;
    arr.push({ ...cur });
  }
  return arr;
}

function entropy(dict) {
  const tot = Object.values(dict).reduce((a, b) => a + b, 0);
  if (!tot) return 0;
  return -Object.values(dict).reduce((s, cnt) => {
    const p = cnt / tot;
    return s + (cnt > 0 ? p * Math.log2(p) : 0);
  }, 0);
}

function klDiv(p, q) {
  const pt = Object.values(p).reduce((a, b) => a + b, 0);
  const qt = Object.values(q).reduce((a, b) => a + b, 0);
  if (!pt || !qt) return null;
  let kl = 0;
  for (const ch of CANONICAL) {
    const pi = (p[ch] || 0) / pt;
    const qi = (q[ch] || 0) / qt;
    if (pi > 0 && qi <= 0) return null;
    if (pi > 0) kl += pi * Math.log2(pi / qi);
  }
  return kl;
}

// Perron eigenvector — depth-25 power iteration from uniform start (computed once)
function computeEigenvector() {
  let d = {};
  for (const ch of CANONICAL) d[ch] = 1;
  for (let i = 0; i < 25; i++) {
    const nxt = expandOnce(d);
    if (!Object.keys(nxt).length) break;
    d = nxt;
  }
  return d;
}

const EIGEN    = computeEigenvector();
const H_PERRON = entropy(EIGEN);
const H_TORAH  = entropy(TORAH_FREQ);
const H_UNIF   = Math.log2(22);

// ── Public ────────────────────────────────────────────────────────────────────

export function drawShannon(canvas, ctx, words, maxDepth) {
  const W = canvas.width, CH = canvas.height;
  const ML = 62, MR = 28, MT = 52, MB = 52;
  const PW = W - ML - MR, PH = CH - MT - MB;

  ctx.clearRect(0, 0, W, CH);
  ctx.fillStyle = '#0a0806'; ctx.fillRect(0, 0, W, CH);

  // ── Build data ──────────────────────────────────────────────────────────────

  const allStart = {};
  for (const ch of CANONICAL) allStart[ch] = 1;
  const allSteps = expansionSteps(allStart, maxDepth);
  const allH     = allSteps.map(entropy);
  const allKL    = allSteps.map(d => klDiv(d, EIGEN));

  const inStart = {};
  words.forEach(w => w.letters.forEach(lt => {
    const ch = VAL_TO_CH[lt.val];
    if (ch) inStart[ch] = (inStart[ch] || 0) + 1;
  }));
  const hasIn   = Object.keys(inStart).length > 0;
  const inSteps = hasIn ? expansionSteps(inStart, maxDepth) : [];
  const inH     = inSteps.map(entropy);
  const inKL    = inSteps.map(d => klDiv(d, EIGEN));

  // ── Scale ───────────────────────────────────────────────────────────────────

  const allVals = [...allH, ...(hasIn ? inH : []), H_TORAH, H_PERRON];
  const yMin = Math.max(0, Math.min(...allVals) - 0.2);
  const yMax = H_UNIF + 0.12;

  function px(depth) { return ML + (depth / maxDepth) * PW; }
  function py(h)     { return MT + (1 - (h - yMin) / (yMax - yMin)) * PH; }

  // ── Grid ────────────────────────────────────────────────────────────────────

  ctx.lineWidth = 0.5;
  for (let b = Math.ceil(yMin * 2) / 2; b <= yMax + 0.01; b += 0.5) {
    const y = py(b);
    if (y < MT - 4 || y > MT + PH + 4) continue;
    ctx.strokeStyle = 'rgba(58,46,26,0.4)';
    ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'right'; ctx.direction = 'ltr';
    ctx.fillText(b.toFixed(1), ML - 4, y + 3);
  }
  for (let d = 0; d <= maxDepth; d++) {
    const x = px(d);
    ctx.strokeStyle = 'rgba(58,46,26,0.4)';
    ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(d, x, MT + PH + 14);
  }

  // ── Reference lines ─────────────────────────────────────────────────────────

  const refs = [
    { h: H_UNIF,   label: `uniform  ${H_UNIF.toFixed(3)} b`,   dash: [6, 4], a: 0.28 },
    { h: H_TORAH,  label: `Torah    ${H_TORAH.toFixed(3)} b`,   dash: [4, 4], a: 0.50 },
    { h: H_PERRON, label: `Perron   ${H_PERRON.toFixed(3)} b`,  dash: [2, 3], a: 0.40 },
  ];
  refs.forEach(({ h, label, dash, a }) => {
    const y = py(h);
    if (y < MT - 4 || y > MT + PH + 4) return;
    ctx.save();
    ctx.setLineDash(dash);
    ctx.strokeStyle = `rgba(201,168,76,${a})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y); ctx.stroke();
    ctx.restore();
    ctx.font = '8px monospace'; ctx.fillStyle = `rgba(201,168,76,${Math.min(1, a + 0.2)})`;
    ctx.textAlign = 'right'; ctx.direction = 'ltr';
    ctx.fillText(label, ML + PW - 4, y - 3);
  });

  // ── All-22 curve (dim amber) ─────────────────────────────────────────────────

  ctx.beginPath();
  allH.forEach((h, i) => {
    i === 0 ? ctx.moveTo(px(i), py(h)) : ctx.lineTo(px(i), py(h));
  });
  ctx.strokeStyle = 'rgba(201,168,76,0.38)'; ctx.lineWidth = 1.5; ctx.stroke();

  allH.forEach((h, i) => {
    ctx.beginPath(); ctx.arc(px(i), py(h), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(201,168,76,0.45)'; ctx.fill();
  });

  // Endpoint label
  const aLast = allH.length - 1;
  ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.5)';
  ctx.textAlign = 'left'; ctx.direction = 'ltr';
  ctx.fillText(allH[aLast].toFixed(3) + ' b', px(aLast) + 6, py(allH[aLast]) + 3);

  // ── Input curve (bright gold) ────────────────────────────────────────────────

  if (hasIn && inH.length > 0) {
    ctx.beginPath();
    inH.forEach((h, i) => {
      i === 0 ? ctx.moveTo(px(i), py(h)) : ctx.lineTo(px(i), py(h));
    });
    ctx.strokeStyle = 'rgba(232,197,106,0.85)'; ctx.lineWidth = 2; ctx.stroke();

    inH.forEach((h, i) => {
      const x = px(i), y = py(h);
      ctx.save();
      ctx.shadowColor = 'rgba(232,197,106,0.5)'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232,197,106,0.9)'; ctx.fill();
      ctx.restore();
      // Value label above each dot
      ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(232,197,106,0.75)';
      ctx.textAlign = 'center'; ctx.direction = 'ltr';
      ctx.fillText(h.toFixed(2), x, y - 8);
    });
  }

  // ── KL divergence footer ─────────────────────────────────────────────────────

  const footY = MT + PH - 4;
  const lastAllKL = allKL[allKL.length - 1];
  if (lastAllKL !== null) {
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.35)';
    ctx.textAlign = 'left'; ctx.direction = 'ltr';
    ctx.fillText(`D_KL(all 22 → Perron) = ${lastAllKL.toFixed(5)} bits`, ML + 4, footY - 10);
  }
  if (hasIn) {
    const lastInKL = inKL[inKL.length - 1];
    if (lastInKL !== null) {
      ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(232,197,106,0.45)';
      ctx.textAlign = 'left'; ctx.direction = 'ltr';
      ctx.fillText(`D_KL(input → Perron) = ${lastInKL.toFixed(5)} bits`, ML + 4, footY);
    }
  }

  // ── Axes ─────────────────────────────────────────────────────────────────────

  ctx.strokeStyle = 'rgba(58,46,26,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ML, MT);      ctx.lineTo(ML, MT + PH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ML, MT + PH); ctx.lineTo(ML + PW, MT + PH); ctx.stroke();

  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.5)';
  ctx.textAlign = 'center'; ctx.direction = 'ltr';
  ctx.fillText('expansion depth', ML + PW / 2, CH - 8);
  ctx.save();
  ctx.translate(13, MT + PH / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('H  (bits)', 0, 0);
  ctx.restore();

  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.38)';
  ctx.textAlign = 'left'; ctx.direction = 'ltr';
  ctx.fillText('H = −Σ p log₂p  ·  bright = input  ·  dim = all 22  ·  dashed = references', ML, MT - 10);

  return function stop() {};
}
