#!/usr/bin/env node
// Copies web-facing files to dist/ for GitHub Pages deployment.
// Run after generate.js: node generator/build.js

import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';

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

// Inject cache-busting ?v=<hash> into dist/index.html so browsers always
// fetch fresh JS/CSS after a new deployment.
let rev;
try {
  rev = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  rev = Date.now().toString(36);
}

// Bust index.html asset references
const htmlPath = join(DIST, 'index.html');
let html = readFileSync(htmlPath, 'utf8');
html = html
  .replace(/(href="css\/styles\.css)(")/g, `$1?v=${rev}$2`)
  .replace(/(src="js\/app\.js)(")/g,       `$1?v=${rev}$2`);
writeFileSync(htmlPath, html, 'utf8');

// Bust all relative ES module imports inside every JS file in dist/js/
// so that mandelbrot.js, visualizers.js, etc. are also re-fetched after deploy.
import { readdirSync } from 'node:fs';
const jsDir = join(DIST, 'js');
readdirSync(jsDir).filter(f => f.endsWith('.js')).forEach(f => {
  const p = join(jsDir, f);
  let src = readFileSync(p, 'utf8');
  src = src.replace(/(from\s+['"])(\.\/[^'"]+\.js)(['"])/g, `$1$2?v=${rev}$3`);
  writeFileSync(p, src, 'utf8');
});
console.log(`  cache-busted all JS modules with ?v=${rev}`);

console.log(`dist/ ready`);
