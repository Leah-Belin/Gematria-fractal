#!/usr/bin/env node
// Copies web-facing files to dist/ for GitHub Pages deployment.
// Run after generate.js: node generator/build.js

import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const DIST = join(ROOT, 'dist');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const items = ['index.html', 'css', 'js', 'data', '.nojekyll'];
items.forEach(item => {
  cpSync(join(ROOT, item), join(DIST, item), { recursive: true });
  console.log(`  copied ${item}`);
});

console.log(`dist/ ready`);
