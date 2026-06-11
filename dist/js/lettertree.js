// Letter-expansion trees — Hebrew glyph nodes, pan + pinch-zoom navigation.

import { LETTER_NAMES, LETTER_VALUES } from './gematria.js?v=5b0fe49';

// ── Layout constants ───────────────────────────────────────────────────────────
const NR       = 20;
const LH       = 90;
const LPAD     = 16;
const GAP      = 18;
const WORD_GAP = 36;

// ── View state ────────────────────────────────────────────────────────────────
let _panX = 24, _panY = 48, _scale = 1;
let _drag = false, _dx = 0, _dy = 0;
let _pinching = false, _pinchDist = 0;
let _canvas = null, _ctx = null, _groups = null, _highlight = null;

// Convert a clientX/Y position to canvas pixel coordinates
function toCanvas(clientX, clientY) {
  const r = _canvas.getBoundingClientRect();
  const k = _canvas.width / r.width;   // CSS → canvas pixel ratio
  return [(clientX - r.left) * k, (clientY - r.top) * k];
}

function pinchDist(t) {
  const dx = t[1].clientX - t[0].clientX;
  const dy = t[1].clientY - t[0].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// Zoom around canvas point (cx, cy) by multiplier factor
function applyZoom(factor, cx, cy) {
  const s = Math.max(0.1, Math.min(6, _scale * factor));
  const f = s / _scale;
  _panX = cx - (cx - _panX) * f;
  _panY = cy - (cy - _panY) * f;
  _scale = s;
  redraw();
}

// ── Event handlers ────────────────────────────────────────────────────────────

function onMouseDown(e) {
  if (!_canvas) return;
  _drag = true;
  _dx = e.clientX - _panX;
  _dy = e.clientY - _panY;
  _canvas.style.cursor = 'grabbing';
}
function onMouseMove(e) {
  if (!_drag) return;
  _panX = e.clientX - _dx;
  _panY = e.clientY - _dy;
  redraw();
}
function onMouseUp() {
  _drag = false;
  if (_canvas) _canvas.style.cursor = 'grab';
}

function onWheel(e) {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1 / 0.9;
  const [cx, cy] = toCanvas(e.clientX, e.clientY);
  applyZoom(factor, cx, cy);
}

function onTouchStart(e) {
  if (e.touches.length === 1) {
    _drag = true;
    _pinching = false;
    _dx = e.touches[0].clientX - _panX;
    _dy = e.touches[0].clientY - _panY;
  } else if (e.touches.length === 2) {
    _drag = false;
    _pinching = true;
    _pinchDist = pinchDist(e.touches);
  }
}

function onTouchMove(e) {
  e.preventDefault();
  if (e.touches.length === 2 && _pinching) {
    const newDist = pinchDist(e.touches);
    const midClientX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midClientY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const [cx, cy] = toCanvas(midClientX, midClientY);
    applyZoom(newDist / _pinchDist, cx, cy);
    _pinchDist = newDist;
    // Also pan with the midpoint movement
    _dx = midClientX - _panX;
    _dy = midClientY - _panY;
  } else if (e.touches.length === 1 && _drag) {
    _panX = e.touches[0].clientX - _dx;
    _panY = e.touches[0].clientY - _dy;
    redraw();
  }
}

function onTouchEnd(e) {
  _pinching = false;
  if (e.touches.length === 0) {
    _drag = false;
  } else if (e.touches.length === 1) {
    // Lift one finger: restart single-finger pan from current position
    _drag = true;
    _dx = e.touches[0].clientX - _panX;
    _dy = e.touches[0].clientY - _panY;
  }
}

// ── Tree construction ─────────────────────────────────────────────────────────

function expand(ch) {
  const name = LETTER_NAMES[ch];
  if (!name) return [];
  return [...name].filter(x => LETTER_VALUES[x]);
}

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

  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(Math.PI);
  ctx.fillStyle = 'rgba(122,59,30,0.85)';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-8, -3.5); ctx.lineTo(-8, 3.5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawNode(ctx, node, highlight) {
  const { x, y, ch, cycleRef } = node;
  const isCycle = !!cycleRef;
  const isLit   = highlight.has(ch);

  ctx.beginPath();
  ctx.arc(x, y, NR, 0, Math.PI * 2);
  ctx.fillStyle = isCycle ? '#110905' : (isLit ? '#221508' : '#121009');
  ctx.fill();

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

  ctx.font         = `${Math.round(NR * 1.4)}px 'EB Garamond', serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction    = 'ltr';
  ctx.fillStyle    = isCycle ? 'rgba(122,59,30,0.65)' : (isLit ? '#e8c56a' : '#c9a84c');
  ctx.fillText(ch, x, y);
}

function renderTree(ctx, root, highlight) {
  for (const node of walk(root)) {
    for (const child of node.children) {
      if (child.cycleRef) {
        drawArc(ctx, child, child.cycleRef);
      } else {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(58,46,26,0.75)';
        ctx.lineWidth = 1;
        ctx.moveTo(node.x, node.y + NR);
        ctx.lineTo(child.x, child.y - NR);
        ctx.stroke();
      }
    }
  }
  for (const node of walk(root)) drawNode(ctx, node, highlight);
}

// ── Redraw ────────────────────────────────────────────────────────────────────

function redraw() {
  if (!_canvas || !_ctx || !_groups) return;
  const W = _canvas.width, H = _canvas.height;

  _ctx.clearRect(0, 0, W, H);
  _ctx.fillStyle = '#0a0806';
  _ctx.fillRect(0, 0, W, H);

  _ctx.save();
  _ctx.translate(_panX, _panY);
  _ctx.scale(_scale, _scale);

  _groups.forEach(g => {
    _ctx.save();
    _ctx.font      = '14px \'EB Garamond\', serif';
    _ctx.fillStyle = 'rgba(201,168,76,0.38)';
    _ctx.textAlign = 'center';
    _ctx.direction = 'rtl';
    _ctx.fillText(g.word, g.labelX, g.labelY);
    _ctx.restore();

    g.roots.forEach(root => renderTree(_ctx, root, _highlight));

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

  // Fixed hint — not scaled with content
  _ctx.font      = '9px monospace';
  _ctx.fillStyle = 'rgba(201,168,76,0.22)';
  _ctx.textAlign = 'left';
  _ctx.direction = 'ltr';
  _ctx.fillText('drag · pinch to zoom', 8, H - 8);
}

// ── Public ────────────────────────────────────────────────────────────────────

export function drawLetterTree(canvas, ctx, words, maxDepth) {
  _panX = 24; _panY = 48; _scale = 1;
  _canvas = canvas; _ctx = ctx;
  canvas.style.cursor = 'grab';

  _highlight = new Set(words.flatMap(w => w.letters.map(l => l.ch)));
  _groups = [];

  const y0 = NR + 24;
  let gx = 0;

  words.forEach((w, wi) => {
    const roots  = w.letters.map(l => buildNode(l.ch, [], maxDepth));
    const ws     = roots.map(subtreeW);
    const totalW = ws.reduce((s, v) => s + v, 0) + GAP * Math.max(0, roots.length - 1);

    let x = gx;
    roots.forEach((root, i) => { place(root, x + ws[i] / 2, y0); x += ws[i] + GAP; });

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

  // Scale to show the first letter's complete tree (all levels, all leaves),
  // then center it. This is also what ↺ Reset restores to.
  if (_groups.length && _groups[0].roots.length) {
    const r0     = _groups[0].roots[0];
    const treeW  = subtreeW(r0);
    const labelY = _groups[0].labelY;                  // topmost drawn y (word label)
    const botY   = y0 + maxDepth * LH + NR + 4;

    const sx = (canvas.width  * 0.88) / treeW;
    const sy = (canvas.height * 0.88) / (botY - labelY);
    _scale = Math.min(sx, sy, 1.0);                    // never zoom in beyond 100 %

    _panX = canvas.width  / 2 - r0.x     * _scale;
    _panY = 12                - labelY   * _scale;
  }

  redraw();

  canvas.addEventListener('mousedown',  onMouseDown);
  canvas.addEventListener('mousemove',  onMouseMove);
  canvas.addEventListener('mouseup',    onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);
  canvas.addEventListener('wheel',      onWheel, { passive: false });
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
    canvas.removeEventListener('wheel',      onWheel);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove',  onTouchMove);
    canvas.removeEventListener('touchend',   onTouchEnd);
  };
}
