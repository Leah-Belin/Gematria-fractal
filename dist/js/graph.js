// Cartesian graph mode: plots each letter's gematria orbit as a line
// X = expansion step n,  Y = sum at that step (log₂ scale)
// Pre-cycle segments: muted. Attractor segment: bright + larger dots.

function heatColor(t, alpha = 1) {
  const hue = (270 + t * 300) % 360;
  return `hsla(${hue},${90 + t * 5}%,${30 + t * 50}%,${alpha})`;
}

export function drawGraph(canvas, ctx, words, gme) {
  const W = canvas.width, H = canvas.height;

  // Margins
  const ML = 58, MR = 18, MT = 28, MB = 42;
  const PW = W - ML - MR;
  const PH = H - MT - MB;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0806';
  ctx.fillRect(0, 0, W, H);

  const allLetters = words.flatMap(w => w.letters);
  if (!allLetters.length) return;

  // Build per-letter point arrays: step 0 = raw letter value, then each expansion sum
  const series = allLetters.map(lt => ({
    lt,
    pts: [{ step: 0, sum: lt.val }, ...lt.steps.map((s, i) => ({ step: i + 1, sum: s.sum }))]
  }));

  const maxStep = Math.max(...series.map(s => s.pts.at(-1).step));
  const allSums = series.flatMap(s => s.pts.map(p => p.sum));
  const minSum  = Math.max(1, Math.min(...allSums));
  const maxSum  = Math.max(...allSums);

  // Use log₂ scale; fall back to linear if range is narrow
  const useLog = maxSum / minSum > 6;
  const yScale = useLog
    ? v => Math.log2(Math.max(1, v))
    : v => v;
  const yMin = yScale(minSum);
  const yMax = yScale(maxSum);
  const yPad = (yMax - yMin) * 0.06;

  const toX = step => ML + (step / Math.max(maxStep, 1)) * PW;
  const toY = sum  => MT + PH - ((yScale(Math.max(1, sum)) - yMin + yPad) /
                                  (yMax - yMin + yPad * 2)) * PH;

  // ── Grid & axes ─────────────────────────────────────────────────────────────

  // Horizontal grid lines (Y ticks)
  const yTicks = useLog
    ? Array.from({ length: Math.ceil(Math.log2(maxSum)) + 1 }, (_, i) => Math.pow(2, i))
         .filter(v => v >= minSum * 0.5 && v <= maxSum * 2)
    : [minSum, (minSum + maxSum) / 2, maxSum];

  yTicks.forEach(v => {
    const y = toY(v);
    if (y < MT - 2 || y > MT + PH + 2) return;

    ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y);
    ctx.strokeStyle = 'rgba(58,46,26,0.35)'; ctx.lineWidth = 0.4; ctx.stroke();

    ctx.beginPath(); ctx.moveTo(ML - 4, y); ctx.lineTo(ML, y);
    ctx.strokeStyle = 'rgba(201,168,76,0.45)'; ctx.lineWidth = 0.7; ctx.stroke();

    ctx.save();
    ctx.font = '7px monospace';
    ctx.fillStyle = 'rgba(201,168,76,0.5)';
    ctx.textAlign = 'right';
    const label = v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v);
    ctx.fillText(label, ML - 6, y + 3);
    ctx.restore();
  });

  // Vertical grid lines (X ticks)
  const xStep = Math.max(1, Math.ceil(maxStep / 10));
  for (let s = 0; s <= maxStep; s += xStep) {
    const x = toX(s);
    ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH);
    ctx.strokeStyle = 'rgba(58,46,26,0.25)'; ctx.lineWidth = 0.3; ctx.stroke();

    ctx.beginPath(); ctx.moveTo(x, MT + PH); ctx.lineTo(x, MT + PH + 4);
    ctx.strokeStyle = 'rgba(201,168,76,0.45)'; ctx.lineWidth = 0.7; ctx.stroke();

    ctx.save();
    ctx.font = '7px monospace';
    ctx.fillStyle = 'rgba(201,168,76,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText(String(s), x, MT + PH + 13);
    ctx.restore();
  }

  // Axis lines
  ctx.strokeStyle = 'rgba(201,168,76,0.4)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(ML, MT); ctx.lineTo(ML, MT + PH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ML, MT + PH); ctx.lineTo(ML + PW, MT + PH); ctx.stroke();

  // Axis labels
  ctx.save();
  ctx.font = "9px 'EB Garamond', serif";
  ctx.fillStyle = 'rgba(201,168,76,0.5)';
  ctx.textAlign = 'center';
  ctx.fillText('expansion step  n', ML + PW / 2, H - 6);
  ctx.restore();

  ctx.save();
  ctx.font = "9px 'EB Garamond', serif";
  ctx.fillStyle = 'rgba(201,168,76,0.5)';
  ctx.textAlign = 'center';
  ctx.translate(11, MT + PH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(useLog ? 'Σ  (log₂ scale)' : 'Σ', 0, 0);
  ctx.restore();

  // ── Per-letter series ────────────────────────────────────────────────────────

  series.forEach(({ lt, pts }) => {
    const t = Math.min(lt.escapeIter / gme, 1);

    // Shade the cycle region lightly
    if (lt.cycleStart < pts.length - 1) {
      const x0 = toX(lt.cycleStart + 1);
      ctx.fillStyle = `hsla(${(270 + t * 300) % 360},60%,40%,0.04)`;
      ctx.fillRect(x0, MT, toX(pts.at(-1).step) - x0, PH);
    }

    // Line segments — pre-cycle muted, in-cycle bright
    for (let i = 1; i < pts.length; i++) {
      const inCycle = i > lt.cycleStart;
      const x0 = toX(pts[i - 1].step), y0 = toY(pts[i - 1].sum);
      const x1 = toX(pts[i].step),     y1 = toY(pts[i].sum);

      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.strokeStyle = heatColor(t, inCycle ? 0.85 : 0.35);
      ctx.lineWidth = inCycle ? 1.5 : 0.9;
      ctx.stroke();
    }

    // Dots
    pts.forEach((p, pi) => {
      const inCycle = pi > lt.cycleStart;
      const x = toX(p.step), y = toY(p.sum);
      const r = inCycle ? 4 : 2;

      if (inCycle) {
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        grd.addColorStop(0, heatColor(t, 0.4));
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.fill();
      }

      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = heatColor(t, inCycle ? 0.95 : 0.65);
      ctx.fill();
    });

    // Hebrew letter label at step 0
    const x0 = toX(0), y0 = toY(lt.val);
    ctx.save();
    ctx.font = "12px 'EB Garamond', serif";
    ctx.fillStyle = heatColor(t, 0.9);
    ctx.textAlign = 'center';
    ctx.fillText(lt.ch, x0, y0 - 7);
    ctx.restore();

    // Attractor sum annotation at the last point
    const last = pts.at(-1);
    const xl = toX(last.step), yl = toY(last.sum);
    ctx.save();
    ctx.font = '7px monospace';
    ctx.fillStyle = heatColor(t, 0.6);
    ctx.textAlign = 'left';
    ctx.fillText(last.sum, xl + 4, yl + 3);
    ctx.restore();
  });

  // ── Cycle-start tick on X axis ────────────────────────────────────────────
  // One tick per unique cycle-start step
  const cycleStarts = [...new Set(allLetters.map(lt => lt.cycleStart + 1))];
  cycleStarts.forEach(cs => {
    if (cs > maxStep) return;
    const x = toX(cs);
    ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH);
    ctx.strokeStyle = 'rgba(201,168,76,0.18)';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.font = '7px monospace';
    ctx.fillStyle = 'rgba(201,168,76,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText(`↺ n=${cs}`, x, MT + 9);
    ctx.restore();
  });

  // ── Word labels along top edge ────────────────────────────────────────────
  let letterIdx = 0;
  words.forEach(wd => {
    const wordLetters = wd.letters.length;
    const xStart = toX(0);  // rough position
    void xStart;
    // Place label above the midpoint of the word's letters' step-0 x positions
    // (all start at step 0, so just center the label in the top margin)
    const midX = ML + ((letterIdx + wordLetters / 2) / allLetters.length) * PW;
    ctx.save();
    ctx.font = "11px 'EB Garamond', serif";
    ctx.fillStyle = 'rgba(242,232,200,0.5)';
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.fillText(wd.word, midX, MT - 8);
    ctx.restore();
    letterIdx += wordLetters;
  });
}
