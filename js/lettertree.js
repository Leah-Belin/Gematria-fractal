// Letter-expansion trees — Hebrew glyph nodes, full pan/drag navigation.
// No scale-to-fit: content lives in a large virtual canvas the user drags around.

import { LETTER_NAMES, LETTER_VALUES } from './gematria.js';

// ── Layout constants ───────────────────────────────────────────────────────────
const NR       = 20;   // node radius — large enough to read
const LH       = 90;   // vertical distance between levels
const LPAD     = 16;   // half-width padding per leaf
const GAP      = 18;   // gap between sibling trees in same word
const WORD_GAP = 36;   // gap between word groups

// ── Pan state (module-level so redraw can access it) ──────────────────────────
let _panX = 24, _panY = 48;
let _drag = false, _dx = 0, _dy = 0;
let _canvas = null, _ctx = null, _groups = null, _highlight = null;

// ── Pan event handlers ────────────────────────────────────────────────────────

function onDown(x, y) {
  _drag = true;
  _dx = x - _panX;
  _dy = y - _panY;
}
function onMove(x, y) {
  if (!_drag) return;
  _panX = x - _dx;
  _panY = y - _dy;
  redraw();
}
function onUp() { _drag = false; }

function onMouseDown(e) { onDown(e.clientX, e.clientY); if (_canvas) _canvas.style.cursor = 'grabbing'; }
function onMouseMove(e) { onMove(e.clientX, e.clientY); }
function onMouseUp(e)   { onUp(); if (_canvas) _canvas.style.cursor = 'grab'; }

function onTouchStart(e) { if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY); }
function onTouchMove(e)  {
  if (e.touches.length === 1) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); }
}
function onTouchEnd() { onUp(); }

// ── Tree construction ─────────────────────────────────────────────────────────

function expand(ch) {
  const name = LETTER_NAMES[ch];
  if (!name) return [];
  return [...name].filter(x => LETTER_VALUES[x]);
}

// ancestors = array of node objects in path from root to parent.
// If ch already appears in ancestors, this is a cycle leaf; cycleRef points to that ancestor.
function buildNode(ch, ancestors, depthLeft) {
  const cycleRef = ancestors.find(a => a.ch === ch) || null;
  const node = { ch, x: 0, y: 0, children: [], cycleRef };
  if (cycleRef || depthLeft === 0) return node;
  node.children = expand(ch).map(k => buildNode(k, [...ancestors, node], depthLeft - 1));
  return node;
}

// ── Layout ────────────────────────────────────────────────────────────────────

function subtreeW(node) {
  if (!node.children.length) return (NR + LPAD) * 2;
  return node.children.reduce((s, c) => s + subtreeW(c), 0);
}

function place(node, cx, y) {
  node.x = cx; node.y = y;
  if (!node.children.length) return;
  const ws  = node.children.map(subtreeW);
  const tot = ws.reduce((a, b) => a + b, 0);
  let x = cx - tot / 2;
  node.children.forEach((c, i) => { place(c, x + ws[i] / 2, y + LH); x += ws[i]; });
}

// ── Render ────────────────────────────────────────────────────────────────────

function* walk(node) {
  yield node;
  for (const c of node.children) yield* walk(c);
}

function drawEdge(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(58,46,26,0.75)';
  ctx.lineWidth = 1;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// Dashed bezier arc looping back from a cycle node (from) up to its ancestor (to).
// Bows to the right; arrowhead enters the ancestor from the right.
function drawArc(ctx, from, to) {
  const sx = from.x + NR, sy = from.y;
  const ex = to.x   + NR, ey = to.y;
  const span = Math.abs(sy - ey);
  const bx   = Math.max(sx, ex) + 34 + span * 0.16;

  ctx.save();
  ctx.setLineDash([5, 3]);
  ctx.strokeStyle = 'rgba(122,59,30,0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.bezierCurveTo(bx, sy, bx, ey, ex, ey);
  ctx.stroke();
  ctx.restore();

  // Arrowhead at destination, pointing left (→ into the target circle from right)
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(Math.PI);
  ctx.fillStyle = 'rgba(122,59,30,0.85)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, -3.5);
  ctx.lineTo(-8,  3.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawNode(ctx, node, highlight) {
  const { x, y, ch, cycleRef } = node;
  const isCycle = !!cycleRef;
  const isLit   = highlight.has(ch);

  // Circle fill
  ctx.beginPath();
  ctx.arc(x, y, NR, 0, Math.PI * 2);
  ctx.fillStyle = isCycle ? '#110905' : (isLit ? '#221508' : '#121009');
  ctx.fill();

  // Circle border
  if (isCycle) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(122,59,30,0.65)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
  } else {
    if (isLit) { ctx.shadowColor = 'rgba(201,168,76,0.4)'; ctx.shadowBlur = 9; }
    ctx.strokeStyle = isLit ? 'rgba(232,197,106,0.9)' : 'rgba(58,46,26,0.9)';
    ctx.lineWidth   = isLit ? 1.8 : 1;
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }

  // Hebrew glyph
  ctx.font         = `${Math.round(NR * 1.4)}px 'EB Garamond', serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction    = 'ltr';
  ctx.fillStyle    = isCycle ? 'rgba(122,59,30,0.65)' : (isLit ? '#e8c56a' : '#c9a84c');
  ctx.fillText(ch, x, y);
}

function renderTree(ctx, root, highlight) {
  // Edges first so nodes paint over them
  for (const node of walk(root)) {
    for (const child of node.children) {
      if (child.cycleRef) {
        drawArc(ctx, child, child.cycleRef);
      } else {
        drawEdge(ctx, node.x, node.y + NR, child.x, child.y - NR);
      }
    }
  }
  for (const node of walk(root)) drawNode(ctx, node, highlight);
}

// ── Redraw (called on every pan event) ────────────────────────────────────────

function redraw() {
  if (!_canvas || !_ctx || !_groups) return;
  const W = _canvas.width, H = _canvas.height;

  _ctx.clearRect(0, 0, W, H);
  _ctx.fillStyle = '#0a0806';
  _ctx.fillRect(0, 0, W, H);

  _ctx.save();
  _ctx.translate(_panX, _panY);

  _groups.forEach(g => {
    // Word label
    _ctx.save();
    _ctx.font      = '14px \'EB Garamond\', serif';
    _ctx.fillStyle = 'rgba(201,168,76,0.38)';
    _ctx.textAlign = 'center';
    _ctx.direction = 'rtl';
    _ctx.fillText(g.word, g.labelX, g.labelY);
    _ctx.restore();

    g.roots.forEach(root => renderTree(_ctx, root, _highlight));

    // Dashed vertical divider between word groups
    if (g.divX !== null) {
      _ctx.save();
      _ctx.strokeStyle = 'rgba(58,46,26,0.35)';
      _ctx.lineWidth = 1;
      _ctx.setLineDash([4, 6]);
      _ctx.beginPath();
      _ctx.moveTo(g.divX, g.divY1);
      _ctx.lineTo(g.divX, g.divY2);
      _ctx.stroke();
      _ctx.restore();
    }
  });

  _ctx.restore();

  // Fixed hint — stays in canvas corner regardless of pan
  _ctx.font      = '9px monospace';
  _ctx.fillStyle = 'rgba(201,168,76,0.22)';
  _ctx.textAlign = 'left';
  _ctx.direction = 'ltr';
  _ctx.fillText('drag to explore', 8, H - 8);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function drawLetterTree(canvas, ctx, words, maxDepth) {
  _panX = 24; _panY = 48;
  _canvas = canvas; _ctx = ctx;
  canvas.style.cursor = 'grab';

  _highlight = new Set(words.flatMap(w => w.letters.map(l => l.ch)));
  _groups = [];

  const y0 = NR + 24;
  let gx = 0;

  words.forEach((w, wi) => {
    // No dedup — show every letter occurrence
    const roots  = w.letters.map(l => buildNode(l.ch, [], maxDepth));
    const ws     = roots.map(subtreeW);
    const totalW = ws.reduce((s, v) => s + v, 0) + GAP * Math.max(0, roots.length - 1);

    let x = gx;
    roots.forEach((root, i) => {
      place(root, x + ws[i] / 2, y0);
      x += ws[i] + GAP;
    });

    _groups.push({
      word:   w.word,
      roots,
      labelX: gx + totalW / 2,
      labelY: y0 - NR - 8,
      divX:   wi < words.length - 1 ? gx + totalW + WORD_GAP / 2 : null,
      divY1:  y0 - NR,
      divY2:  y0 + maxDepth * LH + NR,
    });

    gx += totalW + WORD_GAP;
  });

  redraw();

  canvas.addEventListener('mousedown',  onMouseDown);
  canvas.addEventListener('mousemove',  onMouseMove);
  canvas.addEventListener('mouseup',    onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
  canvas.addEventListener('touchend',   onTouchEnd);

  return function stop() {
    _canvas = null; _ctx = null; _groups = null; _highlight = null;
    canvas.style.cursor = '';
    canvas.removeEventListener('mousedown',  onMouseDown);
    canvas.removeEventListener('mousemove',  onMouseMove);
    canvas.removeEventListener('mouseup',    onMouseUp);
    canvas.removeEventListener('mouseleave', onMouseUp);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove',  onTouchMove);
    canvas.removeEventListener('touchend',   onTouchEnd);
  };
}
