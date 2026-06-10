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

// Static:    c = letterToC(word.total) — word's gematria identity on the parameter circle
// Animated:  lerp from that same starting point toward the expanded-letter-average c.
//            At step 0 the animation frame exactly matches the static drawing.
//            By step 7 c has drifted to avg(letterToC) of the expanded multiset.
function wordCompositeC(word, useExpanded = false) {
  const lts = word.letters;
  if (!lts.length) return { re: 0, im: 0 };

  const cBase = letterToC(word.total);
  if (!useExpanded) return cBase;

  let re = 0, im = 0, count = 0;
  lts.forEach(lt => {
    const vals = lt.steps.length > 0 ? lt.steps.at(-1).vals : [lt.val];
    vals.forEach(v => { const c = letterToC(v); re += c.re; im += c.im; count++; });
  });
  if (!count) return cBase;

  const n = Math.max(...lts.map(lt => lt.steps.length), 0);
  const t = n / 7;
  return {
    re: cBase.re * (1 - t) + (re / count) * t,
    im: cBase.im * (1 - t) + (im / count) * t,
  };
}

function stepLabel(word, useExpanded) {
  if (!useExpanded) return `Σ=${word.total}`;
  const n = Math.max(...word.letters.map(lt => lt.steps.length), 0);
  return n === 0 ? `Σ=${word.total}` : `step ${n}`;
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

export function drawJulia(canvas, ctx, words, useExpanded = false) {
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

    const c = wordCompositeC(word, useExpanded);
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
    ctx.fillText(`c = ${c.re.toFixed(3)}+${c.im.toFixed(3)}i  [${stepLabel(word, useExpanded)}]`, ox + 5, oy + tH - 14);
    ctx.fillText(`Σ${word.total}`, ox + 5, oy + tH - 4);
    ctx.restore();
  });
}
