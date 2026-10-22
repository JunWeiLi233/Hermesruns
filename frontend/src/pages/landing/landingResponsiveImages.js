import g5s from '../../assets/landing-v3-responsive/goal-5k-card-320.webp';
import g5m from '../../assets/landing-v3-responsive/goal-5k-card-480.webp';
import g5l from '../../assets/landing-v3-responsive/goal-5k-card-576.webp';
import g10s from '../../assets/landing-v3-responsive/goal-10k-card-320.webp';
import g10m from '../../assets/landing-v3-responsive/goal-10k-card-480.webp';
import g10l from '../../assets/landing-v3-responsive/goal-10k-card-576.webp';
import ghs from '../../assets/landing-v3-responsive/goal-half-card-320.webp';
import ghm from '../../assets/landing-v3-responsive/goal-half-card-480.webp';
import ghl from '../../assets/landing-v3-responsive/goal-half-card-576.webp';
import gms from '../../assets/landing-v3-responsive/goal-marathon-card-320.webp';
import gmm from '../../assets/landing-v3-responsive/goal-marathon-card-480.webp';
import gml from '../../assets/landing-v3-responsive/goal-marathon-card-576.webp';
import gus from '../../assets/landing-v3-responsive/goal-ultra-card-320.webp';
import gum from '../../assets/landing-v3-responsive/goal-ultra-card-480.webp';
import gul from '../../assets/landing-v3-responsive/goal-ultra-card-576.webp';
import fas from '../../assets/landing-v3-responsive/feature-adapt-cover-480.webp';
import fam from '../../assets/landing-v3-responsive/feature-adapt-cover-768.webp';
import fal from '../../assets/landing-v3-responsive/feature-adapt-cover-960.webp';
import fcs from '../../assets/landing-v3-responsive/feature-coach-cover-480.webp';
import fcm from '../../assets/landing-v3-responsive/feature-coach-cover-768.webp';
import fcl from '../../assets/landing-v3-responsive/feature-coach-cover-960.webp';
import frs from '../../assets/landing-v3-responsive/feature-race-cover-480.webp';
import frm from '../../assets/landing-v3-responsive/feature-race-cover-768.webp';
import frl from '../../assets/landing-v3-responsive/feature-race-cover-960.webp';
import ctas from '../../assets/landing-v3-responsive/cta-crowd-mobile-480.webp';
import ctam from '../../assets/landing-v3-responsive/cta-crowd-mobile-768.webp';
import ctaw from '../../assets/landing-v3-responsive/cta-crowd-wide-1280.webp';
import ctal from '../../assets/landing-v3-responsive/cta-crowd-wide-1920.webp';

const card = (small, medium, large) => ({
  srcSet: `${small} 320w, ${medium} 480w, ${large} 576w`,
  // The desktop cover is taller than its grid cell is wide. Account for the
  // cover's rendered bitmap width so srcset does not undersample that crop.
  sizes: '(max-width: 999px) 230px, 272px',
  width: 576,
  height: 720,
});
const feature = (small, medium, large) => ({
  srcSet: `${small} 480w, ${medium} 768w, ${large} 960w`,
  sizes: '(max-width: 760px) calc(100vw - 40px), 484px',
  width: 960,
  height: 1200,
});

export const GOAL_IMAGE_PROPS = {
  '5k': card(g5s, g5m, g5l), '10k': card(g10s, g10m, g10l),
  half: card(ghs, ghm, ghl), marathon: card(gms, gmm, gml), ultra: card(gus, gum, gul),
};
export const FEATURE_IMAGE_PROPS = {
  adapt: feature(fas, fam, fal), coach: feature(fcs, fcm, fcl), race: feature(frs, frm, frl),
};
export const CTA_IMAGE_PROPS = { srcSet: `${ctaw} 1280w, ${ctal} 1920w`, sizes: '100vw', width: 1920, height: 1280 };
export const CTA_MOBILE_SRCSET = `${ctas} 480w, ${ctam} 768w`;
