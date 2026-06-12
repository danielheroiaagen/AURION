#!/usr/bin/env node
/**
 * Repository hygiene lint (zero dependencies).
 *
 * AURION already uses workspace-native typechecks and tests. This root lint
 * protects the product polish contracts that are easy to regress without a
 * full ESLint stack: no stub scripts, current README framing, responsive
 * dashboard CSS, and a real demo-intake path on the public landing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)), '..');

function read(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function check(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const rootPackage = JSON.parse(read('package.json'));
const scripts = rootPackage.scripts ?? {};
check(!/not configured yet|echo/i.test(scripts.lint ?? ''), 'root lint must not be a stub');
check(!/not configured yet|echo/i.test(scripts.typecheck ?? ''), 'root typecheck must not be a stub');

const ci = read('.github/workflows/ci.yml');
check(ci.includes('npm run lint'), 'CI must run the root lint gate');
check(ci.includes('npm run typecheck'), 'CI must run the root typecheck gate');

const readme = read('README.md');
check(
  readme.includes('Production-aware Voice Agent SaaS Core'),
  'README must describe the implemented product, not only the documentation package',
);
check(
  !readme.includes('Stack base asumido'),
  'README must not present the stack as merely assumed',
);

const dashboardStyles = read('apps/dashboard/src/styles.css');
check(dashboardStyles.includes('@media (max-width: 860px)'), 'dashboard needs mobile CSS');
check(dashboardStyles.includes('min-width: 720px'), 'dashboard tables need mobile overflow protection');

const landing = read('apps/landing/index.html');
check(landing.includes('id="demo-form"'), 'landing needs a structured demo request form');
check(landing.includes('data-lead-form'), 'landing demo form must be script-addressable');

console.log('repository hygiene lint passed');
