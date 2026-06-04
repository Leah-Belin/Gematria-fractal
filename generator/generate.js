#!/usr/bin/env node
// Pre-generates gematria analysis for preset passages and writes data/presets.json.
// Also computes the 27×27 letter-expansion matrix M and its dominant eigenvalue λ₁
// via power iteration (Perron-Frobenius: M has non-negative entries so λ₁ is real, positive).
// Run: node generator/generate.js

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { analyzeText, LETTER_VALUES, LETTER_NAMES } from '../js/gematria.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

const PASSAGES = [
  { id: 'bereshit',    label: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים — Genesis 1:1',          text: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים' },
  { id: 'anochi',      label: 'אָנֹכִי יְהוָה אֱלֹהֶיךָ — Exodus 20:2',             text: 'אָנֹכִי יְהוָה אֱלֹהֶיךָ' },
  { id: 'mi_chamocha', label: 'מִי כָמֹכָה בָּאֵלִם יְהוָה — Exodus 15:11',         text: 'מִי כָמֹכָה בָּאֵלִם יְהוָה' },
  { id: 'veahavta',    label: 'וְאָהַבְתָּ לְרֵעֲךָ כָּמוֹךָ — Leviticus 19:18',    text: 'וְאָהַבְתָּ לְרֵעֲךָ כָּמוֹךָ' },
  { id: 'birkat',      label: 'יְבָרֶכְךָ יְהוָה וְיִשְׁמְרֶךָ — Numbers 6:24',     text: 'יְבָרֶכְךָ יְהוָה וְיִשְׁמְרֶךָ' },
  { id: 'shema',       label: 'שְׁמַע יִשְׂרָאֵל — Deuteronomy 6:4',                text: 'שְׁמַע יִשְׂרָאֵל יְהוָה אֱלֹהֵינוּ יְהוָה אֶחָד' },
  { id: 'kadosh',      label: 'קָדוֹשׁ קָדוֹשׁ קָדוֹשׁ יְהוָה צְבָאוֹת — Isaiah 6:3', text: 'קָדוֹשׁ קָדוֹשׁ קָדוֹשׁ יְהוָה צְבָאוֹת' },
  { id: 'lo_bechayil', label: 'לֹא בְחַיִל וְלֹא בְכֹחַ — Zechariah 4:6',           text: 'לֹא בְחַיִל וְלֹא בְכֹחַ כִּי אִם בְּרוּחִי' },
  { id: 'psalm23',     label: 'יְהוָה רֹעִי לֹא אֶחְסָר — Psalm 23:1',              text: 'יְהוָה רֹעִי לֹא אֶחְסָר' },
  { id: 'emet',        label: 'אֱמֶת וֶאֱמוּנָה — Truth and Faith',                  text: 'אֱמֶת וֶאֱמוּנָה' },
  { id: 'ahavat',      label: 'אַהֲבַת עוֹלָם — Eternal Love',                       text: 'אַהֲבַת עוֹלָם' },
  { id: 'torah',       label: 'תּוֹרָה אוֹר — Torah is Light (Proverbs 6:23)',       text: 'תּוֹרָה אוֹר' }
];

const DEPTH = 20;

// ── Build the letter-expansion matrix M ───────────────────────────────────────
// Letters indexed in the order they appear in LETTER_VALUES
const LETTERS = Object.keys(LETTER_VALUES);  // 27 characters (includes final forms)
const N = LETTERS.length;
const letterIdx = Object.fromEntries(LETTERS.map((ch, i) => [ch, i]));

// M[i][j] = how many times letter i appears in the name of letter j
const M = Array.from({ length: N }, () => new Array(N).fill(0));

for (const [ch, name] of Object.entries(LETTER_NAMES)) {
  const j = letterIdx[ch];
  if (j === undefined) continue;
  for (const c of name) {
    const i = letterIdx[c];
    if (i !== undefined) M[i][j]++;
  }
}

// ── Power iteration for dominant eigenvalue λ₁ ────────────────────────────────
// By Perron-Frobenius, M has a unique positive real dominant eigenvalue.
function powerIterate(M, n, iters = 400) {
  let v = new Array(n).fill(1.0);
  let lambda = 1.0;

  for (let iter = 0; iter < iters; iter++) {
    const Mv = new Array(n).fill(0.0);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        Mv[i] += M[i][j] * v[j];

    // Rayleigh quotient
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += Mv[i] * v[i]; den += v[i] * v[i]; }
    lambda = den > 0 ? num / den : 1;

    // Normalize
    const norm = Math.sqrt(Mv.reduce((s, x) => s + x * x, 0));
    v = norm > 0 ? Mv.map(x => x / norm) : Mv;
  }

  return { lambda: +lambda.toFixed(6), eigenvector: v.map(x => +x.toFixed(6)) };
}

// ── Run ───────────────────────────────────────────────────────────────────────
console.log(`Building ${N}×${N} expansion matrix M…`);
const { lambda: lambda1, eigenvector } = powerIterate(M, N);
console.log(`  Dominant eigenvalue λ₁ ≈ ${lambda1}`);

// Map λ₁ back to a c value on the parameter circle:
// Real positive eigenvalue → c_eigen = 0.7885 (θ=0), not very interesting by itself.
// Instead use  c = -1/λ₁  (normalized inverse → inside main cardioid, near period-2 bulb)
const cEigenRe = +(-1 / lambda1).toFixed(6);
const cEigenIm = 0;
console.log(`  Eigenvalue-derived Julia parameter: c = ${cEigenRe} + ${cEigenIm}i`);

console.log(`\nGenerating preset data (depth=${DEPTH}) for ${PASSAGES.length} passages…`);
const presets = PASSAGES.map(p => {
  const analysis = analyzeText(p.text, DEPTH);
  const wordCount = analysis.length;
  const letterCount = analysis.reduce((s, w) => s + w.letters.length, 0);
  console.log(`  ${p.id}: ${wordCount} words, ${letterCount} letters`);
  return { ...p, depth: DEPTH, analysis };
});

const out = {
  generated: new Date().toISOString(),
  depth: DEPTH,
  matrix: {
    size: N,
    letters: LETTERS,
    lambda1,
    eigenvector,
    cEigen: { re: cEigenRe, im: cEigenIm },
    note: 'M[i][j] = count of letter i in the Hebrew name of letter j. λ₁ is the Perron eigenvalue (dominant growth rate of the substitution morphism). c_eigen = -1/λ₁ maps this rate into the Mandelbrot parameter space.'
  },
  presets
};

const outPath = join(ROOT, 'data', 'presets.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`\nWritten → data/presets.json (${(JSON.stringify(out).length / 1024).toFixed(1)} KB)`);
