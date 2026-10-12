// Structure and photos of the landing page. All copy lives in the locale files under `landing.home_*`;
// this module holds only the keys, so a translation can change without touching the page.
import heroPhoto from '../../assets/landing-v3/hero-golden-hour.webp';
import ctaPhoto from '../../assets/landing-v3/cta-crowd.webp';
import goal5k from '../../assets/landing-v3/goal-5k.webp';
import goal10k from '../../assets/landing-v3/goal-10k.webp';
import goalHalf from '../../assets/landing-v3/goal-half.webp';
import goalMarathon from '../../assets/landing-v3/goal-marathon.webp';
import goalUltra from '../../assets/landing-v3/goal-ultra.webp';
import featAdapt from '../../assets/landing-v3/feature-adapt.webp';
import featCoach from '../../assets/landing-v3/feature-coach.webp';
import featRace from '../../assets/landing-v3/feature-race.webp';
import promiseFree from '../../assets/landing-v3/story-1.webp';
import promiseFormula from '../../assets/landing-v3/story-2.webp';
import promiseData from '../../assets/landing-v3/story-3.webp';
import phoneScreen from '../../assets/landing-v3/phone-home.webp';

export const PHOTOS = { hero: heroPhoto, cta: ctaPhoto, phone: phoneScreen };

// Brand names and file types are not translated. Strava and Garmin sync, COROS comes in as files.
export const SYNC_SOURCES = ['Strava', 'Garmin', 'COROS', 'FIT · GPX · TCX'];

export const NAV_LINKS = [
  { href: '#plans', labelKey: 'landing.home_nav_plans' },
  { href: '#coaching', labelKey: 'landing.home_nav_coaching' },
  { href: '#promises', labelKey: 'landing.home_nav_promises' },
  { href: '#pricing', labelKey: 'landing.home_nav_pricing' },
];

export const DEFAULT_GOAL_ID = 'marathon';

export const GOALS = [
  { id: '5k', photo: goal5k, labelKey: 'landing.home_goal_5k', subKey: 'landing.home_goal_5k_sub', titleKey: 'landing.home_goal_5k_title' },
  { id: '10k', photo: goal10k, labelKey: 'landing.home_goal_10k', subKey: 'landing.home_goal_10k_sub', titleKey: 'landing.home_goal_10k_title' },
  { id: 'half', photo: goalHalf, labelKey: 'landing.home_goal_half', subKey: 'landing.home_goal_half_sub', titleKey: 'landing.home_goal_half_title' },
  { id: 'marathon', photo: goalMarathon, labelKey: 'landing.home_goal_marathon', subKey: 'landing.home_goal_marathon_sub', titleKey: 'landing.home_goal_marathon_title' },
  { id: 'ultra', photo: goalUltra, labelKey: 'landing.home_goal_ultra', subKey: 'landing.home_goal_ultra_sub', titleKey: 'landing.home_goal_ultra_title' },
];

// The cards show an invented example (a skipped Tuesday, a Berlin prediction), so each one is tagged "Example".
export const FEATURES = [
  {
    id: 'adapt', reverse: false, photo: featAdapt, tone: 'neutral',
    eyebrowKey: 'landing.home_feat_adapt_eyebrow', titleKey: 'landing.home_feat_adapt_title', copyKey: 'landing.home_feat_adapt_copy',
    card: { labelKey: 'landing.home_feat_adapt_card_label', valueKey: 'landing.home_feat_adapt_card_value', noteKey: 'landing.home_feat_adapt_card_note' },
  },
  {
    id: 'coach', reverse: true, photo: featCoach, tone: 'good',
    eyebrowKey: 'landing.home_feat_coach_eyebrow', titleKey: 'landing.home_feat_coach_title', copyKey: 'landing.home_feat_coach_copy',
    card: { labelKey: 'landing.home_feat_coach_card_label', valueKey: 'landing.home_feat_coach_card_value', noteKey: 'landing.home_feat_coach_card_note' },
  },
  {
    id: 'race', reverse: false, photo: featRace, tone: 'good',
    eyebrowKey: 'landing.home_feat_race_eyebrow', titleKey: 'landing.home_feat_race_title', copyKey: 'landing.home_feat_race_copy',
    card: { labelKey: 'landing.home_feat_race_card_label', valueKey: 'landing.home_feat_race_card_value', noteKey: 'landing.home_feat_race_card_note' },
  },
];

// What the product promises, in the place a testimonial strip would sit. There are no testimonials, user counts
// or ratings on this page until there are real ones to show.
export const PROMISES = [
  { id: 'free', photo: promiseFree, titleKey: 'landing.home_promise_free_title', copyKey: 'landing.home_promise_free_copy' },
  { id: 'formula', photo: promiseFormula, titleKey: 'landing.home_promise_formula_title', copyKey: 'landing.home_promise_formula_copy' },
  { id: 'data', photo: promiseData, titleKey: 'landing.home_promise_data_title', copyKey: 'landing.home_promise_data_copy' },
];

// `home_plan_free_scans` states the free monthly shoe-photo scans; tools/free-plan-copy.smoke.test.mjs keeps its
// number equal to app.quota.free.shoe-scan in application.properties.
export const PLANS = {
  free: {
    nameKey: 'landing.home_plan_free_name',
    priceKey: 'landing.home_plan_free_price',
    unitKey: 'landing.home_plan_free_unit',
    ctaKey: 'landing.home_plan_free_cta',
    itemKeys: [
      'landing.home_plan_free_item_1',
      'landing.home_plan_free_item_2',
      'landing.home_plan_free_item_3',
      'landing.home_plan_free_item_4',
      'landing.home_plan_free_scans',
    ],
  },
  supporter: {
    nameKey: 'landing.home_plan_supporter_name',
    badgeKey: 'landing.home_plan_supporter_badge',
    priceKey: 'landing.home_plan_supporter_price',
    unitKey: 'landing.home_plan_supporter_unit',
    ctaKey: 'landing.home_plan_supporter_cta',
    // Cleared (set to an empty string) when payments go live; the page then shows no status line.
    statusKey: 'landing.studio_pricing_supporter_status',
    itemKeys: [
      'landing.home_plan_supporter_item_1',
      'landing.home_plan_supporter_item_2',
      'landing.home_plan_supporter_item_3',
      'landing.home_plan_supporter_item_4',
      'landing.home_plan_supporter_item_5',
    ],
  },
};

export const FAQS = [
  { id: 'gps', questionKey: 'landing.home_faq_gps_q', answerKey: 'landing.home_faq_gps_a' },
  { id: 'miss', questionKey: 'landing.home_faq_miss_q', answerKey: 'landing.home_faq_miss_a' },
  { id: 'race', questionKey: 'landing.home_faq_race_q', answerKey: 'landing.home_faq_race_a' },
  { id: 'history', questionKey: 'landing.home_faq_history_q', answerKey: 'landing.home_faq_history_a' },
  { id: 'charge', questionKey: 'landing.home_faq_charge_q', answerKey: 'landing.home_faq_charge_a' },
];
