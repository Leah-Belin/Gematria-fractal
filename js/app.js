import { analyzeText, stripNikud, letterValue } from './gematria.js';
import { cacheGet, cacheSet } from './cache.js';
import { drawSpiral, drawTree, drawMandala, drawScatter } from './visualizers.js';
import { drawJulia, drawPath } from './mandelbrot.js';

const canvas = document.getElementById('fractal');
const ctx = canvas.getContext('2d');
let mode = 'spiral';
let analysisData = null;
let globalMaxEscape = 1;

// Pre-generated preset data loaded from data/presets.json at startup
let presetCache = {};

async function loadPresets() {
  try {
    const res = await fetch('./data/presets.json');
    if (!res.ok) return;
    const json = await res.json();
    presetCache = Object.fromEntries(json.presets.map(p => [p.text, p.analysis]));
  } catch {
    // presets.json unavailable — will compute on demand
  }
}

function computeMaxEscape(words) {
  return Math.max(1, ...words.flatMap(w => w.letters.map(l => l.escapeIter)));
}

function dispatch(words) {
  globalMaxEscape = computeMaxEscape(words);
  if (mode === 'spiral') drawSpiral(canvas, ctx, words, globalMaxEscape);
  else if (mode === 'tree') drawTree(canvas, ctx, words, globalMaxEscape);
  else if (mode === 'mandala') drawMandala(canvas, ctx, words, globalMaxEscape);
  else if (mode === 'scatter') drawScatter(canvas, ctx, words, globalMaxEscape);
  else if (mode === 'julia') drawJulia(canvas, ctx, words);
  else if (mode === 'path') drawPath(canvas, ctx, words);
}

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

function draw() {
  const raw = document.getElementById('hebrew-input').value.trim();
  const depth = parseInt(document.getElementById('depth').value);
  if (!raw) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

  // 1. Check pre-generated presets
  if (presetCache[raw]) {
    analysisData = presetCache[raw];
    renderSidebar(analysisData);
    dispatch(analysisData);
    return;
  }

  // 2. Check localStorage cache
  const cached = cacheGet(raw, depth);
  if (cached) {
    analysisData = cached;
    renderSidebar(analysisData);
    dispatch(analysisData);
    return;
  }

  // 3. Compute fresh
  const words = analyzeText(raw, depth);
  cacheSet(raw, depth, words);
  analysisData = words;
  renderSidebar(words);
  dispatch(words);
}

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
    if (analysisData) dispatch(analysisData);
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
