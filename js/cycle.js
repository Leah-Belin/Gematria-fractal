// Orbit/Cycle visualization: draws the gematria expansion as a branching tree
// per letter. Each strip = one letter, tree grows top→bottom.
// Pre-cycle nodes are cool (purple/blue); attractor nodes glow warm gold.
// The transition point where the two colors meet IS the cycle settling.

import { LETTER_VALUES, LETTER_NAMES } from './gematria.js';

// ── Tree construction ─────────────────────────────────────────────────────────

function buildTree(ch, depth, maxDepth, cycleStart) {
  const val = LETTER_VALUES[ch] || 0;
  const node = { ch, val, depth, inCycle: depth > cycleStart, children: [] };
  if (depth < maxDepth) {
    const name = LETTER_NAMES[ch];
    if (name) {
      for (const c of name) {
        if (LETTER_VALUES[c] > 0)
          node.children.push(buildTree(c, depth + 1, maxDepth, cycleStart));
      }
    }
  }
  return node;
}

function countLeaves(node) {
  return node.children.length
    ? node.children.reduce((s, c) => s + countLeaves(c), 0)
    : 1;
}

// Assign x,y to every node — dendrogram layout.
// Leaves spaced evenly; parent x = midpoint of leftmost/rightmost child.
function layoutTree(root, ox, oy, W, H, maxDepth) {
  const leaves = countLeaves(root);
  const leafW = W / leaves;
  const levelH = H / (maxDepth + 1);
  let leafIdx = 0;

  function place(n) {
    if (!n.children.length) {
      n.x = ox + (leafIdx + 0.5) * leafW;
      leafIdx++;
    } else {
      const before = leafIdx;
      n.children.forEach(place);
      n.x = ox + (before + leafIdx) / 2 * leafW;
    }
    n.y = oy + n.depth * levelH + levelH / 2;
  }

  place(root);
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function drawEdges(ctx, node) {
  node.children.forEach(child => {
    ctx.beginPath();
    ctx.moveTo(node.x, node.y);
    ctx.lineTo(child.x, child.y);
    const t = child.val / 400;
    ctx.strokeStyle = child.inCycle
      ? `hsla(${(40 + t * 30) | 0},80%,55%,0.4)`
      : `hsla(${(240 + t * 60) | 0},60%,45%,0.3)`;
    ctx.lineWidth = child.inCycle ? 0.9 : 0.55;
    ctx.stroke();
    drawEdges(ctx, child);
  });
}

function drawNodes(ctx, node, nodeR) {
  const t = node.val / 400;
  const hue = (270 + t * 300) % 360;
  const { x, y, inCycle } = node;
  const r = nodeR;

  if (inCycle) {
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5);
    grd.addColorStop(0, `hsla(${hue},100%,70%,0.5)`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(x, y, r * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();
  }

  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${hue},${inCycle ? 95 : 75}%,${inCycle ? 68 : 36}%,${inCycle ? 0.95 : 0.7})`;
  ctx.fill();

  if (r >= 5) {
    ctx.save();
    ctx.font = `${Math.min(r * 1.6, 12)}px 'EB Garamond', serif`;
    ctx.fillStyle = `rgba(242,232,200,${inCycle ? 0.95 : 0.75})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.ch, x, y);
    ctx.restore();
  }

  if (r >= 6) {
    ctx.save();
    ctx.font = `${Math.min(r * 1.1, 9)}px monospace`;
    ctx.fillStyle = `rgba(201,168,76,${inCycle ? 0.65 : 0.4})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.val, x, y + r + 1);
    ctx.restore();
  }

  node.children.forEach(c => drawNodes(ctx, c, nodeR));
}

// ── Main export ───────────────────────────────────────────────────────────────

export function drawOrbit(canvas, ctx, words) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0806';
  ctx.fillRect(0, 0, W, H);

  const allLetters = words.flatMap(w => w.letters);
  const n = allLetters.length;
  if (!n) return;

  const stripW = W / n;

  // Auto depth: fill strip width with leaf nodes at minimum 9 px spacing
  // avg branching ≈ 2.8 → leaves at depth d ≈ 2.8^d
  const maxDepth = Math.max(2, Math.min(5,
    Math.floor(Math.log(Math.max(1, stripW / 9)) / Math.log(2.8))
  ));

  // Adaptive node radius: scales with strip width
  const nodeR = Math.max(2.5, Math.min(8, Math.sqrt(stripW) * 0.42));

  // Alternating strip tints
  allLetters.forEach((_, i) => {
    ctx.fillStyle = i % 2 === 0
      ? 'rgba(255,255,255,0.012)'
      : 'rgba(0,0,0,0.18)';
    ctx.fillRect(i * stripW, 0, stripW, H);
  });

  allLetters.forEach((lt, i) => {
    const ox = i * stripW;

    // Shade the cycle region of this strip
    if (lt.cycleStart < maxDepth) {
      const levelH = H / (maxDepth + 1);
      const cycleY = lt.cycleStart * levelH + levelH;
      ctx.fillStyle = 'rgba(201,168,76,0.04)';
      ctx.fillRect(ox, cycleY, stripW, H - cycleY);
    }

    const tree = buildTree(lt.ch, 0, maxDepth, lt.cycleStart);
    layoutTree(tree, ox, 0, stripW, H, maxDepth);
    drawEdges(ctx, tree);
    drawNodes(ctx, tree, nodeR);
  });

  // Depth-level guide lines (very faint)
  const levelH = H / (maxDepth + 1);
  for (let d = 1; d <= maxDepth; d++) {
    const ly = d * levelH;
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly);
    ctx.strokeStyle = 'rgba(58,46,26,0.25)'; ctx.lineWidth = 0.5; ctx.stroke();
  }

  // Word boundary markers
  let acc = 0;
  words.slice(0, -1).forEach(w => {
    acc += w.letters.length;
    const bx = acc * stripW;
    ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, H);
    ctx.strokeStyle = 'rgba(201,168,76,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
  });

  // Iteration-depth labels on left edge
  ctx.save();
  ctx.font = '8px monospace';
  ctx.fillStyle = 'rgba(201,168,76,0.35)';
  ctx.textAlign = 'left';
  for (let d = 0; d <= maxDepth; d++) {
    ctx.fillText(`n=${d}`, 2, d * levelH + levelH / 2 + 3);
  }
  ctx.restore();
}
