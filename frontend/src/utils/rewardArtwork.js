import { EXTRA_REWARD_DEFINITIONS } from './rewardCatalog';

// Presentation only: IDs and thresholds stay owned by the existing reward catalog.
const MILESTONE_MARKS = new Map(EXTRA_REWARD_DEFINITIONS
  .filter((reward) => !reward.id.startsWith('theme-'))
  .map((reward) => [reward.id, String(reward.threshold)]));

const REWARD_SCENES = {
  'first-run': ['shoe', ''],
  '5k': ['bib', '5'],
  '10k': ['bib', '10'],
  'half-marathon': ['bib', '21.1'],
  '25k': ['bib', '25'],
  'marathon': ['bib', '42.195'],
  'ultra-marathon': ['endurance', '50'],
  'lifetime-100': ['atlas', '100'],
  'lifetime-500': ['atlas', '500'],
  'lifetime-1000': ['atlas', '1000'],
  'long-run': ['route', '15'],
  'marathon-week': ['weekly-rhythm', '42.195'],
  'hundred-runs': ['logbook', '100'],
  'streak-7': ['footsteps', '7'],
  'streak-30': ['training-block', '30'],
  'weeks-4': ['weekly-rhythm', '4'],
  'early-bird': ['dawn', ''],
  'night-owl': ['headlamp', ''],
  'weekend-warrior': ['weekend-loop', ''],
  'city-one': ['city-map', '1'],
  'city-three': ['city-map', '3'],
  'city': ['city-map', ''],
  'world-major': ['atlas', ''],
  'park': ['trail-map', ''],
  'bridge': ['crossing', ''],
  'newyear': ['fresh-start', ''],
  'christmas': ['holiday-run', ''],
  'spring': ['spring-trail', ''],
  'summer': ['summer-kit', ''],
  'autumn': ['autumn-trail', ''],
  'winter': ['snow-route', ''],
  'theme-morning': ['dawn', ''],
  'theme-night': ['night-route', ''],
  'theme-rain': ['rain-shell', ''],
  'theme-heat': ['hydration', ''],
  'theme-snow': ['snow-route', ''],
  'theme-trail': ['trail-map', ''],
  'theme-track': ['track', ''],
  'theme-tempo': ['tempo', ''],
  'theme-intervals': ['intervals', ''],
  'theme-recovery': ['recovery-kit', ''],
  'theme-easy': ['shoe', ''],
  'theme-long': ['route', ''],
  'theme-race': ['finish', ''],
  'theme-marathon': ['bib', '42.2'],
  'theme-half': ['bib', '21.1'],
  'theme-five-k': ['track', '5'],
  'theme-ten-k': ['track', '10'],
  'theme-hill': ['climb', ''],
  'theme-commute': ['commute', ''],
  'theme-waterfront': ['waterfront-route', ''],
};

const ICON_SCENES = {
  boot: 'shoe', shoe: 'shoe', streak: 'footsteps', calendar: 'training-block', crown: 'weekly-rhythm',
  medal: 'bib', summit: 'climb', mountain: 'climb', park: 'trail-map', leaf: 'autumn-trail',
  globe: 'atlas', trophy: 'logbook', sunrise: 'dawn', sun: 'dawn', moon: 'night-route',
  weekend: 'weekend-loop', city: 'city-map', bridge: 'crossing', route: 'route', rain: 'rain-shell',
  track: 'track', bolt: 'tempo', recovery: 'recovery-kit', flag: 'finish', wave: 'waterfront-route',
};

const SERIES_SCENES = [
  ['single-run-', 'bib'], ['lifetime-distance-', 'atlas'], ['run-count-', 'logbook'],
  ['day-streak-', 'footsteps'], ['week-streak-', 'training-block'], ['elevation-', 'climb'],
];

const BACKGROUNDS = {
  bib: '#eee3d5', atlas: '#e0e8e3', climb: '#dde6e8', 'trail-map': '#e0e8e3',
  crossing: '#dde6e8', 'waterfront-route': '#dde6e8', 'city-map': '#eee3d5',
  'spring-trail': '#e0e8e3', 'summer-kit': '#f0dfd2', 'autumn-trail': '#ecdfcd',
  'snow-route': '#dde6e8', track: '#e3ddd7', footsteps: '#ecdfcd',
  headlamp: '#253447', 'night-route': '#253447', dawn: '#253447',
  commute: '#e0e8e3', intervals: '#dde6e8', 'rain-shell': '#dde6e8',
};

export function getRewardArtwork(reward = {}) {
  const preset = REWARD_SCENES[reward.id];
  const series = SERIES_SCENES.find(([prefix]) => reward.id?.startsWith(prefix));
  const scene = preset?.[0] || series?.[1] || ICON_SCENES[reward.icon] || 'fallback';
  return {
    scene,
    mark: preset?.[1] ?? MILESTONE_MARKS.get(reward.id) ?? '',
    background: BACKGROUNDS[scene] || '#eee3d5',
  };
}
