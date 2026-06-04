import { analyzeText } from './gematria.js';
import { cacheGet, cacheSet } from './cache.js';
import { drawSpiral, drawTree, drawMandala, drawScatter } from './visualizers.js';
import { drawJulia, drawPath, drawEigenJulia } from './mandelbrot.js';
import { drawOrbit } from './cycle.js';

const canvas = document.getElementById('fractal');
const ctx = canvas.getContext('2d');
let mode = 'spiral';
let analysisData = null;
let globalMaxEscape = 1;

let presetCache = {};
let eigenC = null;      // { re, im } derived from M's dominant eigenvalue
let lambda1 = null;     // scalar Perron eigenvalue of the expansion matrix

async function loadPresets() {
  try {
    const res = await fetch('./data/presets.json');
    if (!res.ok) return;
    const json = await res.json();
    presetCache = Object.fromEntries(json.presets.map(p => [p.text, p.analysis]));
    if (json.matrix) {
      eigenC  = json.matrix.cEigen;
      lambda1 = json.matrix.lambda1;
    }
  } catch {
    // fall through — compute on demand
  }
}

function computeMaxEscape(words) {
  return Math.max(1, ...words.flatMap(w => w.letters.map(l => l.escapeIter)));
}

function dispatch(words) {
  globalMaxEscape = computeMaxEscape(words);
  if      (mode === 'spiral')  drawSpiral(canvas, ctx, words, globalMaxEscape);
  else if (mode === 'tree')    drawTree(canvas, ctx, words, globalMaxEscape);
  else if (mode === 'mandala') drawMandala(canvas, ctx, words, globalMaxEscape);
  else if (mode === 'scatter') drawScatter(canvas, ctx, words, globalMaxEscape);
  else if (mode === 'julia')   drawJulia(canvas, ctx, words);
  else if (mode === 'path')    drawPath(canvas, ctx, words, eigenC, lambda1);
  else if (mode === 'eigen')   drawEigenJulia(canvas, ctx, eigenC, lambda1);
  else if (mode === 'orbit')   drawOrbit(canvas, ctx, words);
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function renderSidebar(words) {
  const el = document.getElementById('breakdown');
  el.innerHTML = '';

  // Eigenvalue info block (shown when matrix data is available)
  if (lambda1 !== null) {
    const info = document.createElement('div');
    info.style.cssText = 'margin-bottom:1rem;padding:0.5rem 0.7rem;border-left:2px solid #2e2410;font-size:0.65rem;color:var(--gold);opacity:0.7;line-height:1.7;';
    info.innerHTML = `<div style="font-family:'Cinzel Decorative',serif;font-size:0.6rem;letter-spacing:0.12em;margin-bottom:0.3rem;opacity:0.9">Matrix λ₁</div>`
      + `T(ℓ) = N(ℓ)&nbsp; xₙ₊₁ = M·xₙ<br>`
      + `λ₁ ≈ <span style="color:var(--amber)">${lambda1}</span><br>`
      + `c<sub>eigen</sub> = <span style="color:var(--amber)">${eigenC?.re?.toFixed(4)}</span> (real axis)`;
    el.appendChild(info);
  }

  words.forEach(wd => {
    const block = document.createElement('div');
    block.className = 'word-block';

    const heb = document.createElement('div');
    heb.className = 'word-heb';
    heb.textContent = wd.word;

    const tot = document.createElement('div');
    tot.className = 'word-total';
    tot.textContent = `גמטריה: ${wd.total}`;

    block.appendChild(heb);
    block.appendChild(tot);

    wd.letters.forEach(lt => {
      const row = document.createElement('div');
      row.style.cssText = 'margin:0.4rem 0 0.2rem;';

      const chip = document.createElement('div');
      chip.className = 'letter-chip';
      chip.style.cssText = 'display:inline-flex;margin-bottom:0.25rem;';
      chip.innerHTML = `<span>${lt.ch}</span><em>${lt.val}</em>`;
      row.appendChild(chip);

      const meta = document.createElement('div');
      meta.style.cssText = 'font-size:0.68rem;color:var(--gold);opacity:0.75;margin-left:0.2rem;line-height:1.6;';
      meta.textContent = lt.cycleLength > 0
        ? `escape: ${lt.escapeIter} · cycle ${lt.cycleLength} · settles @ step ${lt.cycleStart}`
        : `escape: ${lt.escapeIter} · fixed point @ step ${lt.cycleStart}`;

      if (lt.attractor?.length) {
        const att = document.createElement('div');
        att.style.cssText = 'font-size:0.65rem;color:var(--amber);opacity:0.6;direction:rtl;margin-top:1px;';
        att.textContent = `attractor: [${lt.attractor.join(', ')}]`;
        meta.appendChild(att);
      }
      row.appendChild(meta);
      block.appendChild(row);
    });

    el.appendChild(block);
  });
}

// ── Main draw ─────────────────────────────────────────────────────────────────

function draw() {
  const raw   = document.getElementById('hebrew-input').value.trim();
  const depth = parseInt(document.getElementById('depth').value);
  if (!raw) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

  // Eigen mode doesn't depend on text — just render and return
  if (mode === 'eigen') { dispatch(null); return; }

  if (presetCache[raw]) {
    analysisData = presetCache[raw];
  } else {
    const cached = cacheGet(raw, depth);
    if (cached) {
      analysisData = cached;
    } else {
      analysisData = analyzeText(raw, depth);
      cacheSet(raw, depth, analysisData);
    }
  }

  renderSidebar(analysisData);
  dispatch(analysisData);
}

// ── Mode descriptions ─────────────────────────────────────────────────────────

const MODE_DESC = {
  spiral:  'Orbit sums plotted as a golden spiral. Color = escape velocity (iterations before the orbit enters its attractor cycle). Size = letter value. Attractor points get a ring.',
  tree:    'Orbit branches drawn from word roots. Branch length decays with each expansion step. Gold dots mark letters that have entered the attractor.',
  mandala: 'Letter orbits arranged in radial sectors — one sector per word, one arc per letter. Distance from center = expansion depth. Attractor points glow outward.',
  scatter: 'Phase portrait (return map): each pair of consecutive orbit sums (sₙ₋₁, sₙ) plotted as a point. Attractor cycles appear as fixed clusters or loops.',
  julia:   'Julia set J(c) per word. Parameter c = average of letterToC(v) = 0.7885·e^(i·2πv/400) across the word\'s letters. Rendered by iterating z → z² + c with smooth escape-time coloring.',
  path:    'Full Mandelbrot set with the text\'s letters overlaid as a path through parameter space. Each dot = one letter at c = 0.7885·e^(i·2πv/400). The dashed ring is the r=0.7885 parameter circle. ★ marks c_eigen.',
  eigen:   'Julia set for the eigenvalue-derived parameter c = −1/λ₁ ≈ −0.409. λ₁ is the Perron eigenvalue of the 27×27 letter-expansion matrix M (xₙ₊₁ = Mxₙ). This c is the mathematically "canonical" parameter for the Hebrew substitution system.',
  orbit:   'Expansion tree: each letter branches into the letters of its Hebrew name T(ℓ)=N(ℓ), recursively. Cool colors = pre-cycle expansion. Gold glow = letters inside the attractor cycle. Depth labels n=0…k on the left. Dashed lines = word boundaries.',
};

// ── Event wiring ──────────────────────────────────────────────────────────────

document.getElementById('preset').addEventListener('change', function () {
  if (this.value) document.getElementById('hebrew-input').value = this.value;
});

document.getElementById('depth').addEventListener('input', function () {
  document.getElementById('depth-label').textContent = this.value;
});

document.getElementById('draw-btn').addEventListener('click', draw);

document.getElementById('hebrew-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') draw();
});

document.querySelectorAll('.mode-tab').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    mode = this.dataset.mode;
    const infoEl = document.getElementById('mode-info');
    if (infoEl) infoEl.textContent = MODE_DESC[mode] || '';
    if (mode === 'eigen') { dispatch(null); return; }
    if (analysisData) dispatch(analysisData);
  });

  btn.addEventListener('mouseenter', function () {
    const infoEl = document.getElementById('mode-info');
    if (infoEl) infoEl.textContent = MODE_DESC[this.dataset.mode] || '';
  });

  btn.addEventListener('mouseleave', function () {
    const infoEl = document.getElementById('mode-info');
    // Restore active mode description (or clear)
    const activeBtn = document.querySelector('.mode-tab.active');
    if (infoEl && activeBtn) infoEl.textContent = '';
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────

window.addEventListener('load', async () => {
  document.getElementById('depth-label').textContent = '20';
  await loadPresets();
  const defaultText = 'בְּרֵאשִׁית בָּרָא אֱלֹהִים';
  document.getElementById('preset').value = defaultText;
  document.getElementById('hebrew-input').value = defaultText;
  draw();
});
