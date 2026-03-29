#!/usr/bin/env node
/**
 * Build script: packages the extension into a zip file,
 * excluding dev-only files (docs, tests, node_modules, .git).
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST_DIR = join(ROOT, 'dist');

const EXCLUDE = [
  'node_modules',
  '.git',
  'dist',
  'dist-test',
  'docs',
  'scripts',
  '*.test.js',
  '*.spec.js',
  'vitest.config.js',
  'eslint.config.js',
  'package.json',
  'package-lock.json',
  '.husky',
  'CLAUDE.md',
  '.gitignore',
].map(p => `--exclude="${p}"`).join(' ');

if (!existsSync(DIST_DIR)) mkdirSync(DIST_DIR, { recursive: true });

const outFile = join(DIST_DIR, 'auto-flow-extension.zip');

try {
  execSync(`zip -r "${outFile}" . ${EXCLUDE}`, { cwd: ROOT, stdio: 'inherit' });
  console.log(`\n✅ Build complete: ${outFile}`);
} catch (err) {
  console.error('❌ Build failed:', err.message);
  process.exit(1);
}
