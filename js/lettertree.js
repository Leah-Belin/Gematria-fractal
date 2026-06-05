// Letter-expansion tree visualizer.
// Each node shows a Hebrew glyph. Children = letters of that letter's Hebrew name.
// Dashed curved back-arrows = letters that recur in their own ancestry (self-referential loops).

import { LETTER_NAMES, LETTER_VALUES } from './gematria.js';

const NR   = 11;   // node radius
const LH   = 62;   // vertical distance between levels
const LPAD = 10;   // half-width padding per leaf node

function expand(ch) {
  const name = LETTER_NAMES[ch];
  if (!name) return [];
  return [...name].filter(x => LETTER_VALUES[x]);
}

// ── Build tree ────────────────────────────────────────────────────────────────
// ancestors = array of node objects from root down to parent.
// cycleRef: if ch already appears in ancestors, this node is a cycle leaf
//           and cycleRef points to the ancestor node (for drawing the back-arc).

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
  const ws = node.children.map(subtreeW);
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
  // Arc from cycle node (from) back up to ancestor (to), bowing to the right.
  const sx = from.x + NR, sy = from.y;
  const ex = to.x   + NR, ey = to.y;
  const bx = Math.max(sx, ex) + 30;

  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = 'rgba(122,59,30,0.8)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.bezierCurveTo(bx, sy, bx, ey, ex, ey);
  ctx.stroke();
  ctx.restore();

  // Arrowhead at destination pointing left (→ into the target node from the right)
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(Math.PI);
  ctx.fillStyle = 'rgba(122,59,30,0.8)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-6, -2.5);
  ctx.lineTo(-6,  2.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawNode(ctx, node, highlight) {
  const { x, y, ch, cycleRef } = node;
  const isCycle = !!cycleRef;
  const isLit   = highlight.has(ch);

  ctx.beginPath();
  ctx.arc(x, y, NR, 0, Math.PI * 2);
  ctx.fillStyle = isCycle ? '#110905' : (isLit ? '#1e1304' : '#0f0d09');
  ctx.fill();

  if (isCycle) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(122,59,30,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  } else {
    if (isLit) { ctx.shadowColor = 'rgba(201,168,76,0.3)'; ctx.shadowBlur = 6; }
    ctx.strokeStyle = isLit ? 'rgba(232,197,106,0.85)' : 'rgba(58,46,26,0.9)';
    ctx.lineWidth   = isLit ? 1.5 : 1;
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }

  ctx.font         = `${Math.round(NR * 1.35)}px 'EB Garamond', serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction    = 'ltr';
  ctx.fillStyle    = isCycle ? 'rgba(122,59,30,0.6)' : (isLit ? '#e8c56a' : '#c9a84c');
  ctx.fillText(ch, x, y);
}

function renderTree(ctx, root, highlight) {
  // Edges first (so nodes render on top)
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

// ── Public ────────────────────────────────────────────────────────────────────

export function drawLetterTree(canvas, ctx, words, maxDepth) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0806';
  ctx.fillRect(0, 0, W, H);

  if (!words.length) return;

  const highlight = new Set(words.flatMap(w => w.letters.map(l => l.ch)));
  const depth     = Math.min(maxDepth, 4);
  const GAP       = 12;   // gap between trees within a word
  const WORD_GAP  = 26;   // gap between word groups

  // Build trees, deduplicating letters within each word
  const groups = words.map(w => {
    const seen = new Set();
    const letters = w.letters.filter(l => { if (seen.has(l.ch)) return false; seen.add(l.ch); return true; });
    const roots = letters.map(l => buildNode(l.ch, [], depth));
    const ws    = roots.map(subtreeW);
    const totalW = ws.reduce((s, v) => s + v, 0) + GAP * Math.max(0, roots.length - 1);
    return { word: w.word, roots, ws, totalW };
  });

  const totalW = groups.reduce((s, g) => s + g.totalW, 0) + WORD_GAP * Math.max(0, groups.length - 1);
  const totalH = (depth + 1) * LH + NR * 2 + 28;

  const scale = Math.min(1, (W * 0.96) / totalW, (H * 0.96) / totalH);

  ctx.save();
  ctx.translate((W - totalW * scale) / 2, (H - totalH * scale) / 2);
  ctx.scale(scale, scale);

  let gx = 0;
  const y0 = NR + 20;

  groups.forEach((g, gi) => {
    // Word label above the group
    ctx.save();
    ctx.font      = '13px \'EB Garamond\', serif';
    ctx.fillStyle = 'rgba(201,168,76,0.35)';
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.fillText(g.word, gx + g.totalW / 2, y0 - NR - 6);
    ctx.restore();

    // Place all trees in this group
    let x = gx;
    g.roots.forEach((root, i) => {
      place(root, x + g.ws[i] / 2, y0);
      x += g.ws[i] + GAP;
    });

    g.roots.forEach(root => renderTree(ctx, root, highlight));

    // Dashed vertical divider between words
    if (gi < groups.length - 1) {
      const dx = gx + g.totalW + WORD_GAP / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(58,46,26,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(dx, y0 - NR);
      ctx.lineTo(dx, y0 + depth * LH + NR);
      ctx.stroke();
      ctx.restore();
    }

    gx += g.totalW + WORD_GAP;
  });

  ctx.restore();
}
