import { LETTER_VALUES, LETTER_NAMES } from './gematria.js?v=3fed687';

const LETTERS = Object.keys(LETTER_VALUES);
const N = LETTERS.length;
const lidx = Object.fromEntries(LETTERS.map((ch, i) => [ch, i]));

const M = Array.from({ length: N }, () => new Array(N).fill(0));
for (const [ch, name] of Object.entries(LETTER_NAMES)) {
  const j = lidx[ch];
  if (j === undefined) continue;
  for (const c of name) {
    const i = lidx[c];
    if (i !== undefined) M[i][j]++;
  }
}

const maxW  = Math.max(...M.flat(), 1);
const inDeg = LETTERS.map((_, i) => M[i].reduce((s, v) => s + v, 0));
const maxID = Math.max(...inDeg, 1);
const nodeR = i => 11 + (inDeg[i] / maxID) * 11;

const KR = 3500, KS = 0.006, L0 = 95, DAMP = 0.82, KC = 0.003;

let nodes = null, simW = 0, simH = 0;
let animId = null, frameN = 0, settled = false;
let highlight = new Set(), eigenVec = null;

function buildNodes(W, H) {
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.34;
  return LETTERS.map((ch, i) => ({
    ch,
    x: cx + r * Math.cos((i / N) * Math.PI * 2 - Math.PI / 2),
    y: cy + r * Math.sin((i / N) * Math.PI * 2 - Math.PI / 2),
    vx: 0, vy: 0
  }));
}

function stepSim(W, H) {
  const cx = W / 2, cy = H / 2;
  const fx = new Float64Array(N), fy = new Float64Array(N);

  for (let k = 0; k < N; k++) {
    fx[k] += KC * (cx - nodes[k].x);
    fy[k] += KC * (cy - nodes[k].y);
  }

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
      const d2 = Math.max(400, dx * dx + dy * dy), d = Math.sqrt(d2);
      const f = KR / d2;
      fx[i] -= f * dx / d; fy[i] -= f * dy / d;
      fx[j] += f * dx / d; fy[j] += f * dy / d;
    }
  }

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const w = M[i][j] + M[j][i];
      if (!w) continue;
      const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = KS * w * (d - L0) / d;
      fx[i] += f * dx; fy[i] += f * dy;
      fx[j] -= f * dx; fy[j] -= f * dy;
    }
  }

  let ke = 0;
  for (let k = 0; k < N; k++) {
    nodes[k].vx = (nodes[k].vx + fx[k]) * DAMP;
    nodes[k].vy = (nodes[k].vy + fy[k]) * DAMP;
    nodes[k].x  = Math.max(22, Math.min(W - 22, nodes[k].x + nodes[k].vx));
    nodes[k].y  = Math.max(22, Math.min(H - 22, nodes[k].y + nodes[k].vy));
    ke += nodes[k].vx ** 2 + nodes[k].vy ** 2;
  }
  return ke;
}

function drawEdge(ctx, toIdx, fromIdx, w, dir) {
  const t = w / maxW;
  const hue = (240 + t * 110) % 360;
  const alpha = 0.10 + t * 0.52;

  const x1 = nodes[fromIdx].x, y1 = nodes[fromIdx].y;
  const x2 = nodes[toIdx].x,   y2 = nodes[toIdx].y;
  const dx = x2 - x1, dy = y2 - y1;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;

  const sx = x1 + dx / d * (nodeR(fromIdx) + 2);
  const sy = y1 + dy / d * (nodeR(fromIdx) + 2);
  const ex = x2 - dx / d * (nodeR(toIdx) + 5);
  const ey = y2 - dy / d * (nodeR(toIdx) + 5);

  const px = (-dy / d) * 20 * dir, py = (dx / d) * 20 * dir;
  const mx = (sx + ex) / 2 + px, my = (sy + ey) / 2 + py;

  ctx.save();
  ctx.strokeStyle = `hsla(${hue},75%,58%,${alpha})`;
  ctx.lineWidth = 0.5 + w * 0.55;
  ctx.beginPath(); ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();

  const ang = Math.atan2(ey - my, ex - mx);
  const aL = 4.5 + w * 1.5;
  ctx.fillStyle = `hsla(${hue},75%,60%,${alpha + 0.08})`;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - aL * Math.cos(ang - 0.42), ey - aL * Math.sin(ang - 0.42));
  ctx.lineTo(ex - aL * Math.cos(ang + 0.42), ey - aL * Math.sin(ang + 0.42));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function render(canvas, ctx) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0806'; ctx.fillRect(0, 0, W, H);

  // Self-loops (ה, ו, מ, נ, ן, ם all appear in their own names)
  for (let i = 0; i < N; i++) {
    if (!M[i][i]) continue;
    const r = nodeR(i);
    ctx.beginPath();
    ctx.arc(nodes[i].x, nodes[i].y - r - 9, 7, 0, Math.PI * 2);
    ctx.strokeStyle = 'hsla(40,70%,55%,0.32)';
    ctx.lineWidth = 1 + M[i][i] * 0.4;
    ctx.stroke();
  }

  // Directed edges
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (M[i][j] > 0) drawEdge(ctx, i, j, M[i][j], +1);
      if (M[j][i] > 0) drawEdge(ctx, j, i, M[j][i], -1);
    }
  }

  // Nodes
  const evMax = eigenVec ? Math.max(...eigenVec.map(Math.abs), 0.001) : 1;
  nodes.forEach((n, i) => {
    const r = nodeR(i);
    const ev = eigenVec ? Math.abs(eigenVec[i]) / evMax : inDeg[i] / maxID;
    const isHi = highlight.has(n.ch);
    const hue = 36 + ev * 24;
    const lit  = 14 + ev * 32;

    if (isHi) {
      const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 2.8);
      grd.addColorStop(0, 'rgba(232,197,106,0.35)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(n.x, n.y, r * 2.8, 0, Math.PI * 2);
      ctx.fillStyle = grd; ctx.fill();
    }

    const grd = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 1, n.x, n.y, r);
    grd.addColorStop(0, `hsla(${hue},52%,${lit + 18}%,1)`);
    grd.addColorStop(1, `hsla(${hue},52%,${lit}%,1)`);
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();

    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = isHi ? 'rgba(232,197,106,0.88)' : `hsla(${hue},60%,52%,0.38)`;
    ctx.lineWidth = isHi ? 1.5 : 0.8;
    ctx.stroke();

    ctx.save();
    ctx.font = `${Math.max(10, r * 0.9)}px 'EB Garamond', serif`;
    ctx.fillStyle = isHi ? '#f2e8c8' : `hsla(${hue},72%,82%,0.9)`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n.ch, n.x, n.y + 0.5);
    ctx.restore();
  });

  ctx.save();
  ctx.font = "8px 'EB Garamond', serif";
  ctx.fillStyle = 'rgba(201,168,76,0.28)';
  ctx.textAlign = 'center';
  ctx.fillText('M[i][j]: letter i in the Hebrew name of j · arrows show expansion flow · node size = in-degree · gold glow = present in input', W / 2, H - 5);
  ctx.restore();

  if (!settled) {
    ctx.save();
    ctx.font = '7px monospace';
    ctx.fillStyle = 'rgba(201,168,76,0.22)';
    ctx.textAlign = 'left';
    ctx.fillText(`settling… ${frameN}`, 6, 11);
    ctx.restore();
  }
}

export function resetMatrixLayout() {
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  nodes   = null;
  settled = false;
  frameN  = 0;
}

export function drawMatrix(canvas, ctx, words, meta) {
  const W = canvas.width, H = canvas.height;
  highlight = new Set(words.flatMap(w => w.letters.map(lt => lt.ch)));
  eigenVec  = meta?.eigenvector ?? null;

  if (!nodes || simW !== W || simH !== H) {
    nodes = buildNodes(W, H);
    simW = W; simH = H; settled = false; frameN = 0;
  }

  if (animId) cancelAnimationFrame(animId);

  if (settled) { render(canvas, ctx); return () => {}; }

  function frame() {
    frameN++;
    const ke = stepSim(W, H);
    if (ke < 0.008 && frameN > 100) settled = true;
    render(canvas, ctx);
    animId = settled ? null : requestAnimationFrame(frame);
  }
  animId = requestAnimationFrame(frame);

  return () => { if (animId) { cancelAnimationFrame(animId); animId = null; } };
}
