import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const landingSource = readFileSync(path.join(here, "../Landing.jsx"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/_split/landing.css"), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  landingSource.includes('landing-page--cinematic landing-page--liquid-glass'),
  'Landing should opt into the route-scoped liquid-glass treatment.',
);

assert(
  /\.landing-page--liquid-glass \.landing-cinematic-nav\s*\{[^}]*backdrop-filter:\s*blur\(16px\) saturate\(115%\)/.test(styleSource)
    && /\.landing-page--liquid-glass \.landing-cinematic-nav\.is-scrolled\s*\{[^}]*background:\s*rgba\(248,\s*246,\s*241,\s*0\.96\)/.test(styleSource),
  'Landing navigation should use a readable frosted-glass surface in both initial and scrolled states.',
);

assert(
  /\.landing-page--liquid-glass \.landing-command-deck--minimal-black \.landing-command-card\s*\{[\s\S]*backdrop-filter:\s*blur\(22px\) saturate\(132%\)/.test(styleSource)
    && /\.landing-page--liquid-glass \.landing-cinematic-answer-card,[\s\S]*\.landing-page--liquid-glass \.landing-cinematic-final-card--minimal\s*\{[^}]*background:\s*#fcfbf8;[^}]*backdrop-filter:\s*none;/.test(styleSource)
    && styleSource.includes('inset 1px 0 0 rgba(145, 214, 218, 0.08)'),
  'The active light content surfaces should stay opaque and avoid per-card blur; preserve the separate dark treatment.',
);

assert(
  /\.landing-cinematic-hero--minimal \.landing-cinematic-hero-title\s*\{[^}]*font-size:\s*clamp\(3\.1rem,\s*6\.4vw,\s*6rem\)/.test(styleSource)
    && /\.landing-cinematic-hero--minimal \.landing-command-copy \.landing-cinematic-hero-title > span\s*\{[^}]*text-shadow:\s*none;/.test(styleSource),
  'The light hero should use restrained typography without its old dark-photo text shadow.',
);

assert(
  /@media \(max-width:\s*760px\)[\s\S]*?\.landing-cinematic-nav-actions \.landing-cinematic-btn--ghost\s*\{[^}]*display:\s*inline-flex;/.test(styleSource)
    && styleSource.includes('.landing-page--liquid-glass :is(a, button):focus-visible')
    && styleSource.includes('@media (prefers-reduced-transparency: reduce)'),
  'Mobile sign-in must stay discoverable, keyboard focus visible, and reduced-transparency preferences supported.',
);

assert(
  styleSource.includes('mask-composite: exclude;')
    && styleSource.includes('@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px)))')
    && /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.landing-page--liquid-glass \.landing-cinematic-btn/.test(styleSource),
  'Liquid glass should keep a non-filter fallback and respect reduced-motion preferences.',
);

assert(
  /\.landing-page--liquid-glass \.landing-cinematic-section-head h2 span\s*\{[^}]*background:\s*none;[^}]*color:\s*#b34d3a;/.test(styleSource)
    && /\.landing-page--liquid-glass \.landing-cinematic-mini-paces span\s*\{[^}]*color:\s*#68615b;[^}]*font-size:\s*0\.75rem;/.test(styleSource),
  'Section accents must not inherit pale gradient text, and pace labels must remain readable at 12px.',
);

console.log('[PASS] Landing liquid-glass guardrails passed.');
