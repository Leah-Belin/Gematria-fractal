// Zipf visualization — log-log rank vs. frequency for Torah letters and words.
// Click the Letters / Words buttons at top-right to switch views.

import { LETTER_VALUES } from './gematria.js?v=7e8b24e';

// ── Torah data ────────────────────────────────────────────────────────────────

// Letter frequency in the Five Books of Moses (~304,805 total letters).
// Confirmed counts (xwalk.ca): א ב ג ד ה ו ז ח ט י כ ל מ נ.
// Remaining 8 (ס ע פ צ ק ר ש ת) estimated to sum correctly.
const TORAH_LETTER_FREQ = {
  'א':27059,'ב':16345,'ג':2109,'ד':7032,'ה':28056,'ו':30513,
  'ז':2198, 'ח':7189, 'ט':1804,'י':31531,'כ':11968,'ל':21570,
  'מ':25090,'נ':14128,'ס':1564,'ע':11484,'פ':8904, 'צ':3195,
  'ק':4707, 'ר':18255,'ש':15892,'ת':14212,
};

// Top Torah word forms by approximate token frequency.
// Excludes clitics (ו- ה- ב- ל- מ- כ-) counted as attached prefixes.
const TORAH_WORDS = [
  { heb:'אֶת',        en:'acc. marker',   freq:10400 },
  { heb:'כִּי',        en:'that/because',  freq:3200  },
  { heb:'אֲשֶׁר',     en:'who/which',      freq:2900  },
  { heb:'אֶל',        en:'to/toward',      freq:2100  },
  { heb:'יְהוָה',     en:'LORD (YHWH)',    freq:1820  },
  { heb:'לֹא',        en:'not',            freq:1420  },
  { heb:'עַל',        en:'on/upon',        freq:1380  },
  { heb:'בְּנֵי',     en:'sons of',        freq:1100  },
  { heb:'כֹּל',       en:'all/every',      freq:900   },
  { heb:'אֱלֹהִים',   en:'God/Elohim',     freq:780   },
  { heb:'מֹשֶׁה',     en:'Moses',          freq:755   },
  { heb:'וַיֹּאמֶר',  en:'and he said',    freq:700   },
  { heb:'בֶּן',       en:'son',            freq:700   },
  { heb:'יִשְׂרָאֵל', en:'Israel',         freq:620   },
  { heb:'אֶרֶץ',      en:'land/earth',     freq:580   },
  { heb:'עַם',        en:'people',         freq:510   },
  { heb:'אִישׁ',      en:'man/each',       freq:510   },
  { heb:'יוֹם',       en:'day',            freq:450   },
  { heb:'גַּם',       en:'also/even',      freq:450   },
  { heb:'לֵאמֹר',     en:'saying',         freq:420   },
  { heb:'אָמַר',      en:'he said',        freq:430   },
  { heb:'כֹּהֵן',     en:'priest',         freq:410   },
  { heb:'שָׁנָה',     en:'year',           freq:390   },
  { heb:'בֵּית',      en:'house/of',       freq:380   },
  { heb:'מִצְרַיִם',  en:'Egypt',          freq:375   },
  { heb:'יָד',        en:'hand',           freq:370   },
  { heb:'מִי',        en:'who?',           freq:360   },
  { heb:'זֶה',        en:'this',           freq:320   },
  { heb:'שֵׁם',       en:'name',           freq:310   },
  { heb:'נֶפֶשׁ',     en:'soul/person',    freq:300   },
  { heb:'נָתַן',      en:'gave',           freq:295   },
  { heb:'בְּרִית',    en:'covenant',       freq:285   },
  { heb:'עָשָׂה',     en:'did/made',       freq:280   },
  { heb:'אַחַד',      en:'one',            freq:270   },
  { heb:'יָצָא',      en:'went out',       freq:265   },
  { heb:'אָכַל',      en:'ate',            freq:255   },
  { heb:'מַיִם',      en:'water',          freq:250   },
  { heb:'אֵשׁ',       en:'fire',           freq:245   },
  { heb:'דָּבָר',     en:'word/thing',     freq:240   },
  { heb:'הָלַךְ',     en:'went/walked',    freq:235   },
  { heb:'קֹדֶשׁ',     en:'holiness',       freq:220   },
  { heb:'אֱמֶת',      en:'truth',          freq:215   },
  { heb:'לֵב',        en:'heart/mind',     freq:205   },
  { heb:'אֵל',        en:'God (El)',       freq:200   },
  { heb:'עֵץ',        en:'tree/wood',      freq:195   },
  { heb:'אָח',        en:'brother',        freq:190   },
  { heb:'שָׁמַיִם',   en:'heavens',        freq:185   },
  { heb:'עֶבֶד',      en:'servant',        freq:180   },
  { heb:'רוּחַ',      en:'spirit/wind',    freq:175   },
  { heb:'צָבָא',      en:'host/army',      freq:170   },
];

// ── Module state ──────────────────────────────────────────────────────────────

let _mode    = 'letters'; // 'letters' | 'words'
let _canvas  = null;
let _clickFn = null;
// Bounding boxes of the two toggle buttons (set during draw)
let _btnRects = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

const CANONICAL = 'אבגדהוזחטיכלמנסעפצקרשת';

function buildValMap() {
  const m = {};
  for (const ch of CANONICAL) m[LETTER_VALUES[ch]] = ch;
  return m;
}

function expansionLetterFreqs(words, valMap) {
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
  return result;
}

// Draw a filled+stroked rectangle (roundRect not universally supported)
function drawRect(ctx, x, y, w, h, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fillStyle = fill;   ctx.fill();
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
}

// ── Toggle buttons ────────────────────────────────────────────────────────────

function drawToggle(ctx, W, MT) {
  const labels  = ['Letters', 'Words'];
  const modes   = ['letters', 'words'];
  const bW = 60, bH = 20, gap = 6;
  const totalW  = labels.length * bW + (labels.length - 1) * gap;
  let bx = W - totalW - 8;
  const by = MT - 28;

  _btnRects = [];
  labels.forEach((label, i) => {
    const active = _mode === modes[i];
    drawRect(
      ctx, bx, by, bW, bH,
      active ? 'rgba(201,168,76,0.22)' : 'rgba(10,8,6,0.6)',
      active ? 'rgba(232,197,106,0.85)' : 'rgba(58,46,26,0.65)',
      active ? 1.5 : 1
    );
    ctx.font = `${active ? 'bold ' : ''}11px monospace`;
    ctx.fillStyle = active ? 'rgba(232,197,106,0.97)' : 'rgba(201,168,76,0.5)';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(label, bx + bW / 2, by + 13);

    _btnRects.push({ mode: modes[i], x: bx, y: by, w: bW, h: bH });
    bx += bW + gap;
  });
}

// ── Letter mode ───────────────────────────────────────────────────────────────

function drawLetterZipf(canvas, ctx, words) {
  const valMap = buildValMap();
  const W = canvas.width, H = canvas.height;
  const ML = 62, MR = 28, MT = 56, MB = 52;
  const PW = W - ML - MR, PH = H - MT - MB;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0806'; ctx.fillRect(0, 0, W, H);

  drawToggle(ctx, W, MT);

  const expFreqs = expansionLetterFreqs(words, valMap);

  const torahTotal = Object.values(TORAH_LETTER_FREQ).reduce((a, b) => a + b, 0);
  const torahSorted = Object.entries(TORAH_LETTER_FREQ)
    .map(([ch, cnt]) => ({ ch, rel: cnt / torahTotal }))
    .sort((a, b) => b.rel - a.rel);

  const logRankMax = Math.log10(22);
  const logFreqMax = Math.log10(torahSorted[0].rel) + 0.15;
  const logFreqMin = Math.log10(torahSorted[torahSorted.length - 1].rel) - 0.3;

  function px(logRank) { return ML + (logRank / logRankMax) * PW; }
  function py(logFreq) { return MT + (1 - (logFreq - logFreqMin) / (logFreqMax - logFreqMin)) * PH; }

  // Grid
  ctx.lineWidth = 0.5;
  for (let p = -3; p <= 0; p += 0.5) {
    const y = py(p);
    if (y < MT - 5 || y > MT + PH + 5) continue;
    ctx.strokeStyle = 'rgba(58,46,26,0.4)';
    ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'right'; ctx.direction = 'ltr';
    ctx.fillText((Math.pow(10, p) * 100).toFixed(1) + '%', ML - 4, y + 3);
  }
  [1, 2, 5, 10, 22].forEach(r => {
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
  ctx.moveTo(px(0), py(Math.log10(torahSorted[0].rel)));
  ctx.lineTo(px(logRankMax), py(Math.log10(torahSorted[0].rel / 22)));
  ctx.stroke();
  ctx.restore();

  // Expansion depth lines (dim → bright)
  expFreqs.forEach((comp, si) => {
    const total = Object.values(comp).reduce((a, b) => a + b, 0);
    if (!total) return;
    const sorted = Object.values(comp).map(c => c / total).sort((a, b) => b - a);
    if (!sorted.length) return;
    const alpha = 0.25 + (si / Math.max(1, expFreqs.length - 1)) * 0.65;
    const hue   = 200 + si * 18;
    ctx.beginPath();
    sorted.forEach((rel, i) => {
      const x = px(Math.log10(i + 1));
      const y = py(Math.log10(rel));
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = `hsla(${hue},65%,55%,${alpha})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    if (si === expFreqs.length - 1 && sorted.length > 1) {
      ctx.font = '8px monospace'; ctx.direction = 'ltr';
      ctx.fillStyle = `hsla(${hue},65%,55%,${alpha + 0.1})`;
      ctx.textAlign = 'left';
      ctx.fillText(`step ${si}`,
        px(Math.log10(sorted.length)) + 3,
        py(Math.log10(sorted[sorted.length - 1])) + 3);
    }
  });

  // Torah letter circles + large glyph labels
  torahSorted.forEach(({ ch, rel }, i) => {
    const x = px(Math.log10(i + 1));
    const y = py(Math.log10(rel));
    // Circle
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(201,168,76,0.85)';
    ctx.fill();
    // Hebrew glyph
    ctx.font = `17px 'EB Garamond', serif`;
    ctx.fillStyle = '#1a1208';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(ch, x, y + 6);
  });

  // Axes
  ctx.strokeStyle = 'rgba(58,46,26,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ML, MT);      ctx.lineTo(ML, MT + PH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ML, MT + PH); ctx.lineTo(ML + PW, MT + PH); ctx.stroke();

  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.5)';
  ctx.textAlign = 'center'; ctx.direction = 'ltr';
  ctx.fillText('letter rank  (log scale)', ML + PW / 2, H - 8);
  ctx.save();
  ctx.translate(13, MT + PH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('frequency  (log scale)', 0, 0);
  ctx.restore();

  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.38)';
  ctx.textAlign = 'left'; ctx.direction = 'ltr';
  ctx.fillText('Torah letters (gold) · expansion steps (blue) · dashed = Zipf', ML, MT - 10);
}

// ── Word mode ─────────────────────────────────────────────────────────────────

function drawWordZipf(canvas, ctx) {
  const W = canvas.width, H = canvas.height;
  const ML = 58, MR = 28, MT = 56, MB = 52;
  const PW = W - ML - MR, PH = H - MT - MB;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0806'; ctx.fillRect(0, 0, W, H);

  drawToggle(ctx, W, MT);

  const sorted  = [...TORAH_WORDS].sort((a, b) => b.freq - a.freq);
  const maxFreq  = sorted[0].freq;
  const logRankMax = Math.log10(sorted.length);
  const logFreqMax = Math.log10(maxFreq) + 0.25;
  const logFreqMin = Math.log10(sorted[sorted.length - 1].freq) - 0.4;

  function px(logRank) { return ML + (logRank / logRankMax) * PW; }
  function py(logFreq) { return MT + (1 - (logFreq - logFreqMin) / (logFreqMax - logFreqMin)) * PH; }

  // Grid
  ctx.lineWidth = 0.5;
  [100, 200, 500, 1000, 2000, 5000, 10000].forEach(v => {
    const y = py(Math.log10(v));
    if (y < MT - 5 || y > MT + PH + 5) return;
    ctx.strokeStyle = 'rgba(58,46,26,0.4)';
    ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'right'; ctx.direction = 'ltr';
    ctx.fillText(v >= 1000 ? (v / 1000) + 'k' : v, ML - 4, y + 3);
  });
  [1, 2, 5, 10, 20, 50].forEach(r => {
    const x = px(Math.log10(r));
    ctx.strokeStyle = 'rgba(58,46,26,0.4)';
    ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(r, x, MT + PH + 14);
  });

  // Ideal Zipf reference
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(201,168,76,0.18)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px(0),            py(Math.log10(maxFreq)));
  ctx.lineTo(px(logRankMax),   py(Math.log10(maxFreq / sorted.length)));
  ctx.stroke();
  ctx.restore();

  // Dots + labels
  const usedY = [];
  sorted.forEach(({ heb, en, freq }, i) => {
    const x = px(Math.log10(i + 1));
    const y = py(Math.log10(freq));
    const labeled = i < 14;
    const r       = labeled ? 4.5 : 2.5;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = labeled ? 'rgba(201,168,76,0.9)' : 'rgba(201,168,76,0.4)';
    ctx.fill();

    if (labeled) {
      const above = usedY.filter(uy => Math.abs(uy - (y - 20)) < 16).length <=
                    usedY.filter(uy => Math.abs(uy - (y + 20)) < 16).length;
      const labelY = above ? y - 14 : y + 20;
      usedY.push(labelY);

      ctx.font = `15px 'EB Garamond', serif`;
      ctx.direction = 'rtl'; ctx.fillStyle = '#c9a84c';
      ctx.textAlign = 'center';
      ctx.fillText(heb, x, labelY);

      if (i < 7) {
        ctx.font = '8px monospace'; ctx.direction = 'ltr';
        ctx.fillStyle = 'rgba(201,168,76,0.5)';
        ctx.fillText(en, x, labelY + (above ? -3 : 11));
      }
    }
  });

  // Axes
  ctx.strokeStyle = 'rgba(58,46,26,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ML, MT);      ctx.lineTo(ML, MT + PH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ML, MT + PH); ctx.lineTo(ML + PW, MT + PH); ctx.stroke();

  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.5)';
  ctx.textAlign = 'center'; ctx.direction = 'ltr';
  ctx.fillText('word rank  (log scale)', ML + PW / 2, H - 8);
  ctx.save();
  ctx.translate(13, MT + PH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('frequency  (log scale)', 0, 0);
  ctx.restore();

  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(201,168,76,0.38)';
  ctx.textAlign = 'left'; ctx.direction = 'ltr';
  ctx.fillText('Torah word frequencies (top 50, approx.) · dashed = Zipf', ML, MT - 10);
}

// ── Public ────────────────────────────────────────────────────────────────────

export function drawZipf(canvas, ctx, words) {
  if (_canvas && _clickFn) _canvas.removeEventListener('click', _clickFn);
  _canvas = canvas;

  function render() {
    if (_mode === 'letters') drawLetterZipf(canvas, ctx, words);
    else drawWordZipf(canvas, ctx);
  }

  _clickFn = (e) => {
    const r   = canvas.getBoundingClientRect();
    const k   = canvas.width / r.width;
    const cx  = (e.clientX - r.left) * k;
    const cy  = (e.clientY - r.top)  * k;

    // Check if click lands on a toggle button
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
