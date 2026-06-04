#!/usr/bin/env node
// Pre-generates gematria analysis for all preset passages and writes data/presets.json.
// Run: node generator/generate.js
// Output is committed so GitHub Pages works without a build step.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { analyzeText } from '../js/gematria.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

const PASSAGES = [
  {
    id: 'bereshit',
    label: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים (Bereshit 1:1 fragment)',
    text: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים'
  },
  {
    id: 'shema',
    label: 'שְׁמַע יִשְׂרָאֵל — Shema',
    text: 'שְׁמַע יִשְׂרָאֵל יְהוָה אֱלֹהֵינוּ יְהוָה אֶחָד'
  },
  {
    id: 'emet',
    label: 'אֱמֶת וֶאֱמוּנָה (Truth and Faith)',
    text: 'אֱמֶת וֶאֱמוּנָה'
  },
  {
    id: 'ahavat',
    label: 'אַהֲבַת עוֹלָם (Eternal Love)',
    text: 'אַהֲבַת עוֹלָם'
  },
  {
    id: 'torah',
    label: 'תּוֹרָה אוֹר (Torah is Light)',
    text: 'תּוֹרָה אוֹר'
  }
];

const DEPTH = 20;

console.log(`Generating preset data (depth=${DEPTH}) for ${PASSAGES.length} passages…`);

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
  presets
};

const outPath = join(ROOT, 'data', 'presets.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`Written → data/presets.json (${(JSON.stringify(out).length / 1024).toFixed(1)} KB)`);
