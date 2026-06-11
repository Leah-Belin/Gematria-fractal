import { analyzeText } from './gematria.js?v=5b0fe49';
import { cacheGet, cacheSet } from './cache.js?v=5b0fe49';
import { drawSpiral, drawTree, drawMandala, drawScatter } from './visualizers.js?v=5b0fe49';
import { drawJulia } from './mandelbrot.js?v=5b0fe49';
import { drawGraph } from './graph.js?v=5b0fe49';
import { drawMatrix, resetMatrixLayout } from './matrix.js?v=5b0fe49';
import { drawLetterTree } from './lettertree.js?v=5b0fe49';
import { drawZipf } from './zipf.js?v=5b0fe49';
import { drawFreq } from './freq.js?v=5b0fe49';
import { drawShannon } from './shannon.js?v=5b0fe49';

const canvas = document.getElementById('fractal');
const ctx = canvas.getContext('2d');
let mode = 'spiral';
let analysisData = null;
let globalMaxEscape = 1;

let presetCache = {};
let presetDepth = 20;
let matrixMeta  = null;

async function loadPresets() {
  try {
    const res = await fetch('./data/presets.json');
    if (!res.ok) return;
    const json = await res.json();
    presetDepth = json.depth || 20;
    matrixMeta  = json.matrix || null;
    presetCache = Object.fromEntries(json.presets.map(p => [p.text, p.analysis]));
  } catch {
    // fall through — compute on demand
  }
}

function computeMaxEscape(words) {
  return Math.max(1, ...words.flatMap(w => w.letters.map(l => l.escapeIter)));
}

// ── Matrix animation handle ───────────────────────────────────────────────────

let stopMatrixFn = null;

function stopMatrix() {
  if (stopMatrixFn) { stopMatrixFn(); stopMatrixFn = null; }
}

// ── Letter tree handle ────────────────────────────────────────────────────────

let stopLettersFn = null;

function stopLetterTree() {
  if (stopLettersFn) { stopLettersFn(); stopLettersFn = null; }
}

// ── Zipf handle ───────────────────────────────────────────────────────────────

let stopZipfFn = null;

function stopZipf() {
  if (stopZipfFn) { stopZipfFn(); stopZipfFn = null; }
}

// ── Freq handle ───────────────────────────────────────────────────────────────

let stopFreqFn = null;

function stopFreq() {
  if (stopFreqFn) { stopFreqFn(); stopFreqFn = null; }
}

// ── Shannon handle ────────────────────────────────────────────────────────────

let stopShannonFn = null;

function stopShannon() {
  if (stopShannonFn) { stopShannonFn(); stopShannonFn = null; }
}

// ── Orbit animation (play/pause) ──────────────────────────────────────────────

let animTimerId = null;
let animStep    = 0;
let animPlaying = false;

function sliceWords(words, maxStep) {
  return words.map(w => ({
    ...w,
    letters: w.letters.map(lt => {
      const steps      = lt.steps.slice(0, maxStep);
      const cycleFound = lt.cycleStart < maxStep;
      return {
        ...lt,
        steps,
        escapeIter:  Math.min(lt.escapeIter, maxStep),
        cycleStart:  cycleFound ? lt.cycleStart  : steps.length,
        cycleLength: cycleFound ? lt.cycleLength : 0,
        attractor:   cycleFound ? lt.attractor   : []
      };
    })
  }));
}

function stopAnimation() {
  animPlaying = false;
  clearTimeout(animTimerId);
  animTimerId = null;
  const btn = document.getElementById('play-btn');
  if (btn) btn.textContent = '▶ Play';
}

function playAnimation() {
  if (!analysisData || mode === 'matrix' || mode === 'letters' || mode === 'zipf' || mode === 'freq' || mode === 'shannon') return;
  const depth = parseInt(document.getElementById('depth').value);
  animPlaying = true;
  document.getElementById('play-btn').textContent = '⏸ Pause';

  function step() {
    if (!animPlaying) return;
    animStep = Math.min(animStep + 1, depth);
    dispatch(sliceWords(analysisData, animStep));
    if (animStep < depth) {
      animTimerId = setTimeout(step, 160);
    } else {
      stopAnimation();
    }
  }
  step();
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

function dispatch(words) {
  stopMatrix();
  stopLetterTree();
  stopZipf();
  stopFreq();
  stopShannon();
  globalMaxEscape = computeMaxEscape(words);
  if      (mode === 'spiral')  drawSpiral(canvas, ctx, words, globalMaxEscape);
  else if (mode === 'tree')    drawTree(canvas, ctx, words, globalMaxEscape);
  else if (mode === 'mandala') drawMandala(canvas, ctx, words, globalMaxEscape);
  else if (mode === 'scatter') drawScatter(canvas, ctx, words, globalMaxEscape);
  else if (mode === 'julia')   drawJulia(canvas, ctx, words, animPlaying);
  else if (mode === 'graph')   drawGraph(canvas, ctx, words, globalMaxEscape);
  else if (mode === 'matrix')  stopMatrixFn  = drawMatrix(canvas, ctx, words, matrixMeta);
  else if (mode === 'letters') stopLettersFn = drawLetterTree(canvas, ctx, words, parseInt(document.getElementById('depth').value));
  else if (mode === 'zipf')    stopZipfFn    = drawZipf(canvas, ctx, words);
  else if (mode === 'freq')    stopFreqFn    = drawFreq(canvas, ctx, words, parseInt(document.getElementById('depth').value));
  else if (mode === 'shannon') stopShannonFn = drawShannon(canvas, ctx, words, parseInt(document.getElementById('depth').value));
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function renderSidebar(words) {
  const el = document.getElementById('breakdown');
  el.innerHTML = '';
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
        ? `converged @ step ${lt.cycleStart} · growing at λ₁`
        : `not converged · depth ${lt.escapeIter}`;

      if (lt.attractor?.length) {
        const att = document.createElement('div');
        att.style.cssText = 'font-size:0.65rem;color:var(--amber);opacity:0.6;direction:rtl;margin-top:1px;';
        att.textContent = `mix: [${lt.attractor.join(', ')}]`;
        meta.appendChild(att);
      }
      row.appendChild(meta);
      block.appendChild(row);
    });

    el.appendChild(block);
  });
}

// ── Mode descriptions ─────────────────────────────────────────────────────────

const MODE_DESC = {
  spiral:  'Orbit sums plotted as a golden spiral. Color = escape velocity (iterations before the orbit enters its attractor cycle). Size = letter value. Attractor points get a ring.',
  tree:    'Orbit branches drawn from word roots. Branch length decays with each expansion step. Gold dots mark letters that have entered the attractor.',
  mandala: 'Letter orbits arranged in radial sectors — one sector per word, one arc per letter. Distance from center = expansion depth. Attractor points glow outward.',
  scatter: 'Phase portrait (return map): each pair of consecutive orbit sums (sₙ₋₁, sₙ) plotted as a point. Attractor cycles appear as fixed clusters or loops.',
  julia:   'Julia set J(c) per word. c = 0.7885·e^(i·2π·Σ/400) where Σ is the gematria total of the current expansion multiset — |c| stays on the parameter circle throughout. Static: Σ = word total (unique per word). Press Play to animate: Σ grows with each expansion step, tracing a path around the parameter circle as the letter composition evolves.',
  graph:   'Cartesian plot: x = expansion step n, y = gematria sum Σ (log₂ scale). One colored line per letter. Muted segments = pre-cycle. Bright dots + glow = attractor. ↺ markers on x-axis show where each orbit enters its cycle.',
  letters: 'Letter-expansion trees. Each Hebrew glyph shows the letters that make up its name, expanding downward. Dashed curved arrows with arrowheads mark letters that appear in their own ancestry — the self-referential loops of the Hebrew alphabet. Gold glow = letters in the current input.',
  matrix:  'Force-directed graph of the 27×27 letter-expansion matrix M. An arrow j→i means letter i appears in the Hebrew name of letter j. Node size = in-degree. Brightness = eigenvector centrality (λ₁ ≈ 2.443). Gold glow = letters present in the current input text. Layout self-animates to equilibrium.',
  zipf:    'Log-log rank vs. frequency plot. <b>Letter mode:</b> Torah letter frequencies (gold) overlaid with expansion-step distributions (blue) — shows convergence toward the Perron eigenvector. <b>Word mode:</b> top 50 Torah word token frequencies vs. ideal Zipf (slope −1); drag/scroll to zoom. Letter counts: all 22 confirmed against <a href="http://xwalk.ca/lt.html" target="_blank">xwalk.ca</a> (304,805 letters; academic anchor: <a href="https://www.jstor.org/stable/3260008" target="_blank">Marx, JBL 1919</a>). Word counts: יְהוָה ≈ 1,820 and מֹשֶׁה ≈ 647 confirmed via <a href="https://www.blueletterbible.org/lexicon/h3068/kjv/wlc/0-1/" target="_blank">WLC/Blue Letter Bible</a>; remaining values are Torah-proportional estimates — authoritative Torah-only counts available via <a href="https://github.com/ETCBC/bhsa" target="_blank">ETCBC BHSA</a> (cite: <a href="https://doi.org/10.17026/dans-z6y-skyh" target="_blank">doi:10.17026/dans-z6y-skyh</a>).',
  freq:    'Gematria Zipf — log-log rank vs. frequency of gematria values in the expanding letter multiset. Step 0 = just the input letters. Each subsequent step expands every letter to the letters of its Hebrew name, growing the multiset by λ₁ ≈ 2.443× per step. Gold dots (deepest step) show each gematria value with its Hebrew letter inside. Dashed line = ideal Zipf (slope −1).',
  shannon: 'Shannon entropy H = −Σ p log₂ p of the letter distribution at each expansion depth. Two curves converge from opposite sides: bright gold (input letters) starts low and rises; dim amber (all 22 letters, equal weight) starts near H_uniform ≈ 4.459 bits and falls. Both converge to the Perron eigenvector entropy H∞ (dotted line) — the information-theoretic fixed point of the expansion morphism. Reference lines: H_uniform = log₂(22) ≈ 4.459 b (maximum entropy for 22 letters) and H_Torah ≈ 4.160 b (Torah letter distribution, source: <a href="http://xwalk.ca/lt.html" target="_blank">xwalk.ca</a>). D_KL to the eigenvector shown at final depth. See Visser (2013) <a href="https://arxiv.org/abs/1212.5567" target="_blank">arXiv:1212.5567</a> for the max-entropy derivation of Zipf.',
};

// ── Main draw ─────────────────────────────────────────────────────────────────

function draw() {
  stopAnimation();
  const raw   = document.getElementById('hebrew-input').value.trim();
  const depth = parseInt(document.getElementById('depth').value);
  if (!raw) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

  if (presetCache[raw] && depth === presetDepth) {
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

// ── Event wiring ──────────────────────────────────────────────────────────────

document.getElementById('preset').addEventListener('change', function () {
  if (this.value) document.getElementById('hebrew-input').value = this.value;
});

document.getElementById('depth').addEventListener('input', function () {
  document.getElementById('depth-label').textContent = this.value;
});

document.getElementById('draw-btn').addEventListener('click', draw);

function syncPlayBtn() {
  const btn = document.getElementById('play-btn');
  if (!btn) return;
  if (mode === 'matrix' || mode === 'letters' || mode === 'zipf' || mode === 'freq' || mode === 'shannon') {
    btn.textContent = '↺ Reset';
  } else if (!animPlaying) {
    btn.textContent = '▶ Play';
  }
}

document.getElementById('play-btn').addEventListener('click', () => {
  if (mode === 'matrix') {
    resetMatrixLayout();
    if (analysisData) dispatch(analysisData);
    return;
  }
  if (mode === 'letters' || mode === 'zipf' || mode === 'freq' || mode === 'shannon') {
    if (analysisData) dispatch(analysisData);
    return;
  }
  if (animPlaying) {
    stopAnimation();
  } else {
    if (!analysisData) draw();
    animStep = 0;
    playAnimation();
  }
});

document.getElementById('hebrew-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') draw();
});

document.querySelectorAll('.mode-tab').forEach(btn => {
  btn.addEventListener('click', function () {
    stopAnimation();
    document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    mode = this.dataset.mode;
    syncPlayBtn();
    const infoEl = document.getElementById('mode-info');
    if (infoEl) infoEl.innerHTML = MODE_DESC[mode] || '';
    if (analysisData) dispatch(analysisData);
  });

  btn.addEventListener('mouseenter', function () {
    const infoEl = document.getElementById('mode-info');
    if (infoEl) infoEl.innerHTML = MODE_DESC[this.dataset.mode] || '';
  });

  btn.addEventListener('mouseleave', function () {
    const infoEl = document.getElementById('mode-info');
    if (infoEl) infoEl.innerHTML = MODE_DESC[mode] || '';
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────

window.addEventListener('load', async () => {
  document.getElementById('depth-label').textContent = '7';
  await loadPresets();
  const defaultText = 'בְּרֵאשִׁית בָּרָא אֱלֹהִים';
  document.getElementById('preset').value = defaultText;
  document.getElementById('hebrew-input').value = defaultText;
  draw();
});
