// Mandelbrot-style complex iteration: Julia set tiling
// Formula: z_{n+1} = z_n² + c  in ℂ, colored by smooth escape time

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function escapeRgb(iter, maxIter, zMag) {
  if (iter >= maxIter) return [6, 5, 3];
  const nu = iter + 1 - Math.log2(Math.max(1, Math.log2(zMag)));
  const t = Math.max(0, Math.min(1, nu / maxIter));
  const hue = (270 + t * 300) % 360;
  return hslToRgb(hue, 95 + t * 5, 28 + t * 52);
}

// Maps gematria value (1–400) → complex parameter on the Julia boundary circle.
// r = 0.7885 traces through all Julia set morphologies.
export function letterToC(v) {
  const theta = (2 * Math.PI * v) / 400;
  return { re: 0.7885 * Math.cos(theta), im: 0.7885 * Math.sin(theta) };
}

function wordCompositeC(word) {
  const lts = word.letters;
  if (!lts.length) return { re: 0, im: 0 };
  let re = 0, im = 0, count = 0;
  lts.forEach(lt => {
    // Use the full letter composition at the last available expansion step.
    // At step 0 (no expansions yet) falls back to the raw letter value.
    const vals = lt.steps.length > 0 ? lt.steps.at(-1).vals : [lt.val];
    vals.forEach(v => { const c = letterToC(v); re += c.re; im += c.im; count++; });
  });
  return count > 0 ? { re: re / count, im: im / count } : { re: 0, im: 0 };
}

function stepLabel(word) {
  const n = Math.max(...word.letters.map(lt => lt.steps.length), 0);
  return n === 0 ? 'initial' : `step ${n}`;
}

function renderJulia(buf, w, h, c, maxIter) {
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let zRe = (px / w) * 3.0 - 1.5;
      let zIm = (py / h) * 3.0 - 1.5;
      let i = 0;
      while (i < maxIter && zRe * zRe + zIm * zIm < 4) {
        const tmp = zRe * zRe - zIm * zIm + c.re;
        zIm = 2 * zRe * zIm + c.im;
        zRe = tmp;
        i++;
      }
      const zMag = Math.sqrt(zRe * zRe + zIm * zIm);
      const [r, g, b] = escapeRgb(i, maxIter, zMag);
      const idx = (py * w + px) * 4;
      buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = 255;
    }
  }
}

// ── Julia tile mode ───────────────────────────────────────────────────────────
// Each word → its own Julia set J(c), tiled across the canvas.
// Single word: full canvas. Multiple words: grid.

export function drawJulia(canvas, ctx, words) {
  const W = canvas.width, H = canvas.height;
  const n = words.length;
  if (!n) return;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0806';
  ctx.fillRect(0, 0, W, H);

  const cols = n === 1 ? 1 : Math.min(n, Math.ceil(Math.sqrt(n * (W / H))));
  const rows = Math.ceil(n / cols);
  const tW = Math.floor(W / cols);
  const tH = Math.floor(H / rows);

  words.forEach((word, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = col * tW;
    const oy = row * tH;

    const c = wordCompositeC(word);
    const img = ctx.createImageData(tW, tH);
    renderJulia(img.data, tW, tH, c, 100);
    ctx.putImageData(img, ox, oy);

    if (n > 1) {
      ctx.strokeStyle = 'rgba(58,46,26,0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + 0.5, oy + 0.5, tW - 1, tH - 1);
    }

    ctx.save();
    ctx.font = `${Math.max(12, Math.floor(tH * 0.065))}px 'EB Garamond', serif`;
    ctx.fillStyle = 'rgba(242,232,200,0.88)';
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    ctx.fillText(word.word, ox + tW - 6, oy + Math.max(18, Math.floor(tH * 0.08)));
    ctx.restore();

    ctx.save();
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(201,168,76,0.5)';
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.fillText(`c = ${c.re.toFixed(3)}+${c.im.toFixed(3)}i  [${stepLabel(word)}]`, ox + 5, oy + tH - 14);
    ctx.fillText(`Σ${word.total}`, ox + 5, oy + tH - 4);
    ctx.restore();
  });
}
