// Canvas visualization modes — all functions receive (canvas, ctx, words, globalMaxEscape)

function collectOrbit(lt) {
  return lt.steps.map(s => s.sum);
}

function heatColor(t, alpha = 1) {
  const hue = (270 + t * 300) % 360;
  const sat = 95 + t * 5;
  const lit = 28 + t * 52;
  return `hsla(${hue},${sat}%,${lit}%,${alpha})`;
}

function glowColor(t, alpha = 1) {
  const hue = (280 + t * 320) % 360;
  return `hsla(${hue},100%,${40 + t * 40}%,${alpha})`;
}

export function drawSpiral(canvas, ctx, words, gme) {
  const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.6);
  bg.addColorStop(0, '#100d06'); bg.addColorStop(1, '#06050302');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const pts = [];
  words.forEach(wd => {
    wd.letters.forEach(lt => {
      collectOrbit(lt).forEach((sum, step) => {
        pts.push({ sum, step, escapeIter: lt.escapeIter, inCycle: step >= lt.cycleStart });
      });
    });
  });

  const maxSum = Math.max(...pts.map(p => p.sum), 1);
  let angle = 0, radius = 18;
  const step = 0.2;

  pts.forEach((p, i) => {
    const t = Math.min(p.escapeIter / gme, 1);
    const sT = p.sum / maxSum;
    const r = 2 + sT * 11;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    if (p.inCycle) {
      ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = heatColor(t, 0.25); ctx.lineWidth = 1; ctx.stroke();
    }

    const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    grd.addColorStop(0, glowColor(t, 0.55)); grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();

    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = heatColor(t, 0.92); ctx.fill();

    if (i < pts.length - 1) {
      const na = angle + step * (1 + sT * 0.4);
      const nr = radius + step * (1 + sT * 0.4) * 8;
      const nx = cx + nr * Math.cos(na), ny = cy + nr * Math.sin(na);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny);
      ctx.strokeStyle = heatColor(t, 0.12); ctx.lineWidth = 0.7; ctx.stroke();
    }

    angle += step * (1 + sT * 0.4);
    radius += step * 8 * (0.3 + sT * 0.12);
    if (radius > W * 0.47) { radius = 18; angle += Math.PI * 0.618; }
  });
}

function drawOrbitBranch(ctx, lt, x, y, angle, length, gme) {
  const orbit = collectOrbit(lt);
  if (!orbit.length || length < 2) return;
  const maxSum = Math.max(...orbit, 1);
  const t = Math.min(lt.escapeIter / gme, 1);
  let cx2 = x, cy2 = y, len = length;

  orbit.forEach((sum, si) => {
    if (len < 1.5) return;
    const jitter = ((sum % 11) - 5) * 0.03;
    const a = angle + jitter;
    const ex = cx2 + Math.cos(a) * len;
    const ey = cy2 + Math.sin(a) * len;

    ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(ex, ey);
    ctx.strokeStyle = heatColor(t, Math.max(0.05, 0.75 - si * 0.06));
    ctx.lineWidth = Math.max(0.3, 2.5 - si * 0.18); ctx.stroke();

    if (si >= lt.cycleStart) {
      ctx.beginPath(); ctx.arc(ex, ey, 2, 0, Math.PI * 2);
      ctx.fillStyle = heatColor(t, 0.7); ctx.fill();
    }

    cx2 = ex; cy2 = ey;
    len *= si < lt.cycleStart ? 0.68 : 0.88;
  });
}

export function drawTree(canvas, ctx, words, gme) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#06050302'; ctx.fillRect(0, 0, W, H);

  words.forEach((wd, wi) => {
    const rootX = W * (wi + 0.5) / words.length;
    wd.letters.forEach((lt, li) => {
      const spread = wd.letters.length > 1 ? Math.PI * 0.6 : 0;
      const baseAngle = -Math.PI / 2 - spread / 2 + spread * (li / Math.max(wd.letters.length - 1, 1));
      drawOrbitBranch(ctx, lt, rootX, H * 0.9, baseAngle, H * 0.3, gme);
    });
  });
}

export function drawMandala(canvas, ctx, words, gme) {
  const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
  bg.addColorStop(0, '#10090502'); bg.addColorStop(1, '#06050302');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const sectors = words.length || 1;
  const sectorAngle = (Math.PI * 2) / sectors;

  words.forEach((wd, wi) => {
    const baseAngle = sectorAngle * wi - Math.PI / 2;
    wd.letters.forEach((lt, li) => {
      const orbit = collectOrbit(lt);
      if (!orbit.length) return;
      const t = Math.min(lt.escapeIter / gme, 1);
      const maxSum = Math.max(...orbit, 1);
      const letterOffset = (li / Math.max(wd.letters.length, 1)) * sectorAngle * 0.9;

      orbit.forEach((sum, si) => {
        const frac = si / Math.max(orbit.length - 1, 1);
        const r = 22 + frac * (cx * 0.84);
        const sweep = sectorAngle * (0.85 / Math.max(wd.letters.length, 1));
        const a = baseAngle + letterOffset + sweep * frac;
        const jitter = (sum % 7 - 3) * 0.025 + (si >= lt.cycleStart ? Math.sin(si * 1.2) * 0.04 : 0);
        const px = cx + r * Math.cos(a + jitter);
        const py = cy + r * Math.sin(a + jitter);
        const dotR = si >= lt.cycleStart ? 2 + t * 8 : 1.5 + (sum / maxSum) * 5;

        if (si >= lt.cycleStart) {
          const grd = ctx.createRadialGradient(px, py, 0, px, py, dotR * 3);
          grd.addColorStop(0, glowColor(t, 0.4)); grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath(); ctx.arc(px, py, dotR * 3, 0, Math.PI * 2);
          ctx.fillStyle = grd; ctx.fill();
        }

        ctx.beginPath(); ctx.arc(px, py, dotR, 0, Math.PI * 2);
        ctx.fillStyle = heatColor(t, si >= lt.cycleStart ? 0.95 : 0.55); ctx.fill();

        if (si > 0) {
          const pFrac = (si - 1) / Math.max(orbit.length - 1, 1);
          const pr = 22 + pFrac * (cx * 0.84);
          const pa = baseAngle + letterOffset + sweep * pFrac;
          const pj = ((orbit[si - 1] || 0) % 7 - 3) * 0.025;
          ctx.beginPath();
          ctx.moveTo(cx + pr * Math.cos(pa + pj), cy + pr * Math.sin(pa + pj));
          ctx.lineTo(px, py);
          ctx.strokeStyle = heatColor(t, si >= lt.cycleStart ? 0.45 : 0.2);
          ctx.lineWidth = si >= lt.cycleStart ? 1.2 : 0.6; ctx.stroke();
        }
      });
    });
  });

  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 9);
  cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.5, '#e8c56a'); cg.addColorStop(1, 'rgba(201,168,76,0)');
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fillStyle = cg; ctx.fill();
}

export function drawScatter(canvas, ctx, words, gme) {
  const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#06050302'; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(201,168,76,0.08)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(30, cy); ctx.lineTo(W - 30, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 30); ctx.lineTo(cx, H - 30); ctx.stroke();

  words.forEach(wd => {
    wd.letters.forEach(lt => {
      const orbit = collectOrbit(lt);
      if (orbit.length < 2) return;
      const t = Math.min(lt.escapeIter / gme, 1);
      const maxS = Math.max(...orbit, 1);

      for (let i = 1; i < orbit.length; i++) {
        const px = cx + (orbit[i - 1] / maxS) * cx * 0.82;
        const py = cy - (orbit[i] / maxS) * cy * 0.82;
        const r = 1.5 + (orbit[i] / maxS) * 9;
        const inCycle = i >= lt.cycleStart;

        if (inCycle) {
          const grd = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
          grd.addColorStop(0, glowColor(t, 0.55)); grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath(); ctx.arc(px, py, r * 4, 0, Math.PI * 2);
          ctx.fillStyle = grd; ctx.fill();
        }

        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = heatColor(t, inCycle ? 0.95 : 0.45); ctx.fill();

        if (i > 1) {
          const ppx = cx + (orbit[i - 2] / maxS) * cx * 0.82;
          const ppy = cy - (orbit[i - 1] / maxS) * cy * 0.82;
          ctx.beginPath(); ctx.moveTo(ppx, ppy); ctx.lineTo(px, py);
          ctx.strokeStyle = heatColor(t, inCycle ? 0.35 : 0.1);
          ctx.lineWidth = inCycle ? 1 : 0.5; ctx.stroke();
        }
      }
    });
  });
}
