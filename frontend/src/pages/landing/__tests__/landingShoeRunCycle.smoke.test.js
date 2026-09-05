import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "../../..");
const landingSource = readFileSync(path.join(here, "../Landing.jsx"), 'utf8');
const styleSource = readFileSync(path.join(srcRoot, 'styles/_split/landing.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const shoeRunMaster = 'assets/generated/run-gait-v2/evo-sl-side-master.webp';
assert(existsSync(path.join(srcRoot, shoeRunMaster)), `Missing shoe gait master: ${shoeRunMaster}`);
assert(landingSource.includes(`../${shoeRunMaster}`), `Landing should import ${shoeRunMaster}`);

assert(
  landingSource.includes('const SHOE_GAIT_MOTION_STOPS = [')
    && landingSource.includes('function ShoeRunCycle({ scrollContainerRef })')
    && landingSource.includes('const heroScrollRef = useRef(null);')
    && landingSource.includes('ref={heroScrollRef}')
    && landingSource.includes('landing-cinematic-hero-inner landing-hero-shoe-grid')
    && landingSource.includes('<ShoeRunCycle scrollContainerRef={heroScrollRef} />')
    && landingSource.includes("progress: 0.38, phase: 'toe-off'")
    && landingSource.includes("progress: 0.68, phase: 'flight'")
    && landingSource.includes("progress: 0.94, phase: 'initial-contact'")
    && landingSource.includes("progress: 1, phase: 'landed'")
    && !landingSource.includes("assets/generated/run-cycle/"),
  'Landing hero should use one identity-locked shoe rig across a complete one-way running gait.',
);

assert(
  /\.landing-cinematic-hero--minimal \.landing-hero-shoe-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.88fr\) minmax\(440px,\s*1\.12fr\)/.test(styleSource)
    && landingSource.includes('className="landing-hero-shoe-cycle-runner"')
    && landingSource.includes('ref={canvasRef}')
    && landingSource.includes("canvas.dataset.hasFrame = 'true'")
    && landingSource.includes('const image = new window.Image()')
    && landingSource.includes('decodedShoeRef.current = image')
    && landingSource.includes('context.drawImage(image, drawX, drawY, drawWidth, drawHeight)')
    && landingSource.includes('window.requestAnimationFrame(updateFromScroll)')
    && landingSource.includes('function getShoeGaitMotion(progress)')
    && landingSource.includes('const easedProgress = localProgress * localProgress * (3 - (2 * localProgress))')
    && landingSource.includes('runner.style.transformOrigin = gaitMotion.transformOrigin')
    && landingSource.includes('runner.style.transform = gaitMotion.transform')
    && landingSource.includes('figure.dataset.gaitPhase = gaitMotion.phase')
    && landingSource.includes('const HERO_FOCUS_SCROLL_FRACTION = 0.14;')
    && landingSource.includes('const focusProgress = usesCompactLayout')
    && landingSource.includes('centeredFigureOffset - figure.offsetLeft')
    && landingSource.includes("scrollContainer.style.setProperty('--hero-copy-opacity', copyOpacity.toFixed(3))")
    && landingSource.includes("scrollContainer.dataset.heroFocusState = focusProgress <= 0")
    && landingSource.includes('copy.inert = focusProgress >= 0.85')
    && landingSource.includes('centerShiftX * focusProgress')
    && landingSource.includes("figure.dataset.scrollState = progress <= 0 ? 'idle' : progress >= 1 ? 'complete' : 'scrubbing'")
    && !landingSource.includes('advanceFrame')
    && !landingSource.includes('SHOE_RUN_FRAME_SECONDS')
    && !landingSource.includes('SHOE_SCROLL_SEQUENCE_FRAMES')
    && !landingSource.includes('Math.round(progress * lastFrameIndex)')
    && !landingSource.includes('Promise.all(preloaders)')
    && !styleSource.includes('landing-hero-shoe-run-cycle')
    && !styleSource.includes('@keyframes landing-hero-shoe-stride')
    && /\.landing-cinematic-hero--minimal\s*\{[\s\S]*min-height:\s*240svh;[\s\S]*overflow:\s*visible/.test(styleSource)
    && /\.landing-cinematic-hero--minimal \.landing-hero-shoe-grid\s*\{[\s\S]*position:\s*sticky;[\s\S]*top:\s*0;[\s\S]*height:\s*100svh/.test(styleSource)
    && /\.landing-cinematic-hero--minimal \.landing-hero-shoe-grid \.landing-command-copy\s*\{[\s\S]*opacity:\s*var\(--hero-copy-opacity,[\s\S]*filter:\s*blur\(var\(--hero-copy-blur,[\s\S]*transform:\s*translate3d\(var\(--hero-copy-shift-x/.test(styleSource)
    && /\.landing-cinematic-hero--minimal\[data-hero-focus-state="focused"\] \.landing-command-copy\s*\{[\s\S]*pointer-events:\s*none/.test(styleSource)
    && /html:has\(\.landing-page--cinematic\),[\s\S]*#root:has\(> \.landing-page--cinematic\)\s*\{[\s\S]*overflow-x:\s*clip/.test(styleSource),
  'Landing shoe should move to the center as the hero copy withdraws, then keep one immutable bitmap on one canvas while scroll position rigs a smooth gait.',
);

assert(
  /@media \(max-width:\s*980px\)\s*\{[\s\S]*\.landing-cinematic-hero--minimal \.landing-hero-shoe-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/.test(styleSource)
    && landingSource.includes("window.matchMedia('(prefers-reduced-motion: reduce)')")
    && /@media \(max-width:\s*980px\)\s*\{[\s\S]*\.landing-cinematic-hero--minimal\s*\{[\s\S]*min-height:\s*auto[\s\S]*\.landing-cinematic-hero--minimal \.landing-hero-shoe-grid\s*\{[\s\S]*position:\s*relative[\s\S]*height:\s*auto/.test(styleSource)
    && /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.landing-cinematic-hero--minimal\s*\{[\s\S]*min-height:\s*auto[\s\S]*\.landing-hero-shoe-cycle-runner\s*\{[\s\S]*transform:\s*none !important/.test(styleSource),
  'Landing shoe sequence should avoid an oversized pinned section on smaller screens and reduced-motion devices.',
);

console.log('[PASS] Landing shoe scroll-sequence guardrails passed.');
