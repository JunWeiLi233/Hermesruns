import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const landingSource = readFileSync(path.join(here, 'Landing.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/_split/landing.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  landingSource.includes('landing-page--cinematic landing-page--liquid-glass'),
  'Landing should opt into the route-scoped liquid-glass treatment.',
);

assert(
  /\.landing-page--liquid-glass \.landing-cinematic-nav\s*\{[\s\S]*backdrop-filter:\s*blur\(24px\) saturate\(145%\)/.test(styleSource)
    && /\.landing-page--liquid-glass \.landing-cinematic-nav\.is-scrolled\s*\{[\s\S]*background:\s*rgba\(246,\s*241,\s*233,\s*0\.76\)/.test(styleSource),
  'Landing navigation should use a readable frosted-glass surface in both initial and scrolled states.',
);

assert(
  /\.landing-page--liquid-glass \.landing-command-deck--minimal-black \.landing-command-card\s*\{[\s\S]*backdrop-filter:\s*blur\(22px\) saturate\(132%\)/.test(styleSource)
    && /\.landing-page--liquid-glass \.landing-cinematic-answer-card,[\s\S]*\.landing-page--liquid-glass \.landing-cinematic-final-card--minimal\s*\{[\s\S]*backdrop-filter:\s*blur\(20px\) saturate\(135%\)/.test(styleSource)
    && styleSource.includes('inset 1px 0 0 rgba(145, 214, 218, 0.08)'),
  'Landing data surfaces should use translucent glass, edge highlights, and a restrained chromatic cue instead of opaque flat cards.',
);

assert(
  styleSource.includes('mask-composite: exclude;')
    && styleSource.includes('@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px)))')
    && /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.landing-page--liquid-glass \.landing-cinematic-btn/.test(styleSource),
  'Liquid glass should keep a non-filter fallback and respect reduced-motion preferences.',
);

console.log('[PASS] Landing liquid-glass guardrails passed.');
