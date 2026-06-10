// Letter-frequency convergence — starts from the actual Torah letter distribution
// and applies the expansion morphism M repeatedly, showing convergence to the
// Perron eigenvector (λ₁ ≈ 2.443).  Input text letters are highlighted.

import { LETTER_VALUES, LETTER_NAMES } from './gematria.js?v=b2ab823';

const CANONICAL = 'אבגדהוזחטיכלמנסעפצקרשת';

const VAL_TO_CH = {};
for (const ch of CANONICAL) VAL_TO_CH[LETTER_VALUES[ch]] = ch;

// Torah letter counts, Five Books of Moses (~304,805 total letters).
const TORAH = {
  'א':27059,'ב':16345,'ג':2109,'ד':7032,'ה':28056,'ו':30513,
  'ז':2198, 'ח':7189, 'ט':1804,'י':31531,'כ':11968,'ל':21570,
  'מ':25090,'נ':14128,'ס':1564,'ע':11484,'פ':8904, 'צ':3195,
  'ק':4707, 'ר':18255,'ש':15892,'ת':14212,
};

const N_STEPS = 20;

function letterHue(ch) { return (CANONICAL.indexOf(ch) * 360 / 22) % 360; }

// Apply expansion morphism once: each letter → letters of its Hebrew name
function expand(freq) {
  const next = {};
  for (const [ch, cnt] of Object.entries(freq)) {
    const name = LETTER_NAMES[ch];
    if (!name) continue;
    for (const c of name) {
      const canon = VAL_TO_CH[LETTER_VALUES[c]];
      if (canon) next[canon] = (next[canon] || 0) + cnt;
    }
  }
  return next;
}

// Build N_STEPS steps from Torah distribution, normalize each to relative freq
function buildSteps() {
  const raw = [{ ...TORAH }];
  for (let i = 0; i < N_STEPS - 1; i++) raw.push(expand(raw[raw.length - 1]));
  return raw.map(s => {
    const tot = Object.values(s).reduce((a, b) => a + b, 0);
    const r = {};
    for (const [ch, cnt] of Object.entries(s)) r[ch] = cnt / tot;
    return r;
  });
}

const STEPS = buildSteps(); // pre-compute — independent of input

export function drawFreq(canvas, ctx, words) {
  const W = canvas.width, H = canvas.height;
  const ML = 58, MR = 52, MT = 36, MB = 52;
  const PW = W - ML - MR, PH = H - MT - MB;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0806'; ctx.fillRect(0, 0, W, H);

  // Letters from the current input, for highlighting
  const inputChars = new Set(
    words.flatMap(w => w.letters.map(lt => VAL_TO_CH[lt.val])).filter(Boolean)
  );

  const maxFreq = Math.max(...Object.values(STEPS[0]));

  function px(s)    { return ML + (s / (N_STEPS - 1)) * PW; }
  function py(freq) { return MT + (1 - freq / maxFreq) * PH; }

  // ── Grid ──
  ctx.lineWidth = 0.5;
  [0.02, 0.05, 0.1, 0.15, 0.2].forEach(f => {
    if (f > maxFreq + 0.01) return;
    const y = py(f);
    ctx.strokeStyle = 'rgba(58,46,26,0.35)';
    ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'right'; ctx.direction = 'ltr';
    ctx.fillText(Math.round(f * 100) + '%', ML - 4, y + 3);
  });
  [0, 5, 10, 15, 19].forEach(s => {
    const x = px(s);
    ctx.strokeStyle = 'rgba(58,46,26,0.35)';
    ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.35)';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(s === 0 ? 'Torah' : s, x, MT + PH + 14);
  });

  // ── Lines — background letters first, then input letters on top ──
  [false, true].forEach(doInput => {
    CANONICAL.split('').forEach(ch => {
      if (inputChars.has(ch) !== doInput) return;
      const hue   = letterHue(ch);
      const alpha = doInput ? 0.90 : 0.30;
      const lw    = doInput ? 2.2  : 0.8;

      ctx.beginPath();
      STEPS.forEach((r, s) => {
        const x = px(s), y = py(r[ch] || 0);
        s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = `hsla(${hue},72%,58%,${alpha})`;
      ctx.lineWidth = lw;
      ctx.stroke();
    });
  });

  // ── Right-edge labels with anti-collision ──
  // Compute natural y for each letter at final step
  const labels = CANONICAL.split('').map(ch => ({
    ch,
    naturalY: py(STEPS[N_STEPS - 1][ch] || 0),
    isInput: inputChars.has(ch),
  }));
  labels.sort((a, b) => a.naturalY - b.naturalY);

  // Nudge labels apart (top-down pass)
  const MIN_SP = 13;
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].naturalY - labels[i - 1].naturalY < MIN_SP) {
      labels[i].naturalY = labels[i - 1].naturalY + MIN_SP;
    }
  }
  labels.forEach(l => { l.naturalY = Math.max(MT + 6, Math.min(MT + PH, l.naturalY)); });

  const rx = px(N_STEPS - 1);
  labels.forEach(({ ch, naturalY: ly, isInput }) => {
    const hue   = letterHue(ch);
    const alpha = isInput ? 0.92 : 0.45;

    // Dot at actual final position
    const dotY = py(STEPS[N_STEPS - 1][ch] || 0);
    ctx.beginPath();
    ctx.arc(rx, dotY, isInput ? 3.5 : 2, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue},72%,62%,${alpha})`;
    ctx.fill();

    // Label at nudged position
    ctx.font = `${isInput ? 16 : 13}px 'EB Garamond', serif`;
    ctx.fillStyle = `hsla(${hue},72%,${isInput ? 76 : 58}%,${alpha})`;
    ctx.textAlign = 'left'; ctx.direction = 'ltr';
    ctx.fillText(ch, rx + 7, ly + 5);
  });

  // ── Glow on input chars at step 0 ──
  inputChars.forEach(ch => {
    const hue = letterHue(ch);
    ctx.save();
    ctx.shadowColor = `hsla(${hue},80%,62%,0.7)`;
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.arc(px(0), py(STEPS[0][ch] || 0), 5, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue},80%,74%,0.9)`;
    ctx.fill();
    ctx.restore();
  });

  // ── Axes ──
  ctx.strokeStyle = 'rgba(58,46,26,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ML, MT);      ctx.lineTo(ML, MT + PH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ML, MT + PH); ctx.lineTo(ML + PW, MT + PH); ctx.stroke();

  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.5)';
  ctx.textAlign = 'center'; ctx.direction = 'ltr';
  ctx.fillText('expansion iterations applied to Torah distribution', ML + PW / 2, H - 8);
  ctx.save();
  ctx.translate(13, MT + PH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('fraction of all letters', 0, 0);
  ctx.restore();

  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.38)';
  ctx.textAlign = 'left'; ctx.direction = 'ltr';
  ctx.fillText('Torah → Perron eigenvector  ·  bright = input letters', ML, MT - 10);
}
