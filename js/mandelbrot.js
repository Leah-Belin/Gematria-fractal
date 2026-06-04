// Complex iteration modes: Julia tiling and Mandelbrot parameter-path
// Formula: z_{n+1} = z_n² + c   in ℂ, colored by smooth escape time

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
  if (iter >= maxIter) return [6, 5, 3]; // in-set: near-black
  // Smooth (continuous) escape: removes banding by using fractional iteration count
  const nu = iter + 1 - Math.log2(Math.max(1, Math.log2(zMag)));
  const t = Math.max(0, Math.min(1, nu / maxIter));
  const hue = (270 + t * 300) % 360;
  return hslToRgb(hue, 95 + t * 5, 28 + t * 52);
}

// Maps gematria value (1–400) → complex parameter on the Julia boundary circle.
// r = 0.7885 passes through every Julia set morphology: dendrites, spirals, Siegel discs, rabbits.
export function letterToC(v) {
  const theta = (2 * Math.PI * v) / 400;
  return { re: 0.7885 * Math.cos(theta), im: 0.7885 * Math.sin(theta) };
}

function wordCompositeC(word) {
  const lts = word.letters;
  if (!lts.length) return { re: 0, im: 0 };
  let re = 0, im = 0;
  lts.forEach(lt => { const c = letterToC(lt.val); re += c.re; im += c.im; });
  return { re: re / lts.length, im: im / lts.length };
}

// Pixel-level Julia set render into a pre-allocated ImageData buffer
function renderJulia(buf, w, h, c, maxIter) {
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      // z₀ = (x,y) in [-1.5, 1.5]²
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

// Pixel-level Mandelbrot render; view: re ∈ [-2.5, 1.0], im ∈ [-1.25, 1.25]
function renderMandelbrot(buf, w, h, maxIter) {
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const cRe = (px / w) * 3.5 - 2.5;
      const cIm = (py / h) * 2.5 - 1.25;
      let zRe = 0, zIm = 0, i = 0;
      while (i < maxIter && zRe * zRe + zIm * zIm < 4) {
        const tmp = zRe * zRe - zIm * zIm + cRe;
        zIm = 2 * zRe * zIm + cIm;
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
// Each word → its own Julia set J(c) where c is the composite of the word's letter values.
// Single word: full canvas. Multiple words: tiled grid.

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

    // Word label
    ctx.save();
    ctx.font = `${Math.max(12, Math.floor(tH * 0.065))}px 'EB Garamond', serif`;
    ctx.fillStyle = 'rgba(242,232,200,0.88)';
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    ctx.fillText(word.word, ox + tW - 6, oy + Math.max(18, Math.floor(tH * 0.08)));
    ctx.restore();

    // c parameter
    ctx.save();
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(201,168,76,0.5)';
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.fillText(`c = ${c.re.toFixed(3)}+${c.im.toFixed(3)}i`, ox + 5, oy + tH - 14);
    ctx.fillText(`Σ${word.total}`, ox + 5, oy + tH - 4);
    ctx.restore();
  });
}

// ── Mandelbrot path mode ──────────────────────────────────────────────────────
// Renders the full Mandelbrot set and overlays the text's letter sequence as a
// connected path through parameter space. Each dot = one letter at its c value.

export function drawPath(canvas, ctx, words) {
  const W = canvas.width, H = canvas.height;

  const img = ctx.createImageData(W, H);
  renderMandelbrot(img.data, W, H, 80);
  ctx.putImageData(img, 0, 0);

  // Complex → pixel for the Mandelbrot view bounds used above
  const toPixel = (re, im) => ({
    x: ((re + 2.5) / 3.5) * W,
    y: ((im + 1.25) / 2.5) * H
  });

  const pts = words.flatMap(w =>
    w.letters.map(lt => ({ c: letterToC(lt.val), ch: lt.ch, val: lt.val }))
  );
  if (!pts.length) return;

  // Draw the parameter circle (r = 0.7885) as a faint reference ring
  const origin = toPixel(0, 0);
  const circleR = (0.7885 / 3.5) * W;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, circleR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(201,168,76,0.18)';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Connecting line through all letter positions
  ctx.beginPath();
  pts.forEach((p, i) => {
    const { x, y } = toPixel(p.c.re, p.c.im);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = 'rgba(242,232,200,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Letter dots + labels
  pts.forEach((p, i) => {
    const { x, y } = toPixel(p.c.re, p.c.im);
    const t = pts.length > 1 ? i / (pts.length - 1) : 0.5;
    const hue = (270 + t * 300) % 360;

    // Glow halo
    const grd = ctx.createRadialGradient(x, y, 0, x, y, 10);
    grd.addColorStop(0, `hsla(${hue},100%,65%,0.55)`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Dot
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue},95%,72%,0.95)`;
    ctx.fill();

    // Hebrew letter above the dot
    ctx.save();
    ctx.font = "13px 'EB Garamond', serif";
    ctx.fillStyle = `hsla(${hue},75%,88%,0.92)`;
    ctx.textAlign = 'center';
    ctx.fillText(p.ch, x, y - 9);
    ctx.restore();
  });
}
