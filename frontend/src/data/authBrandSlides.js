// Shared brand-side carousel slides used by both /login and /signup so the
// two surfaces render identical brand copy + stat pairs out of the same
// source. Each slide resolves its strings through `t(key)` at render time;
// the keys live under the `index.stitch_slide_*` namespace.
const authBrandSlides = [
  {
    id: 'daily-coach',
    kickerKey: 'index.stitch_slide_1_kicker',
    lineOneKey: 'index.stitch_slide_1_line_one',
    lineTwoKey: 'index.stitch_slide_1_line_two',
    copyKey: 'index.stitch_slide_1_copy',
    details: [
      { value: '7 DAYS', labelKey: 'index.stitch_slide_1_detail_one' },
      { value: 'LIVE', labelKey: 'index.stitch_slide_1_detail_two' },
    ],
    stats: [
      { value: '12k+', labelKey: 'index.stitch_stat_athletes' },
      { value: '99.8%', labelKey: 'index.stitch_stat_accuracy' },
    ],
  },
  {
    id: 'training-trust',
    kickerKey: 'index.stitch_slide_2_kicker',
    lineOneKey: 'index.stitch_slide_2_line_one',
    lineTwoKey: 'index.stitch_slide_2_line_two',
    copyKey: 'index.stitch_slide_2_copy',
    details: [
      { value: 'PACE', labelKey: 'index.stitch_slide_2_detail_one' },
      { value: 'HR', labelKey: 'index.stitch_slide_2_detail_two' },
    ],
    stats: [
      { value: 'VO2', labelKey: 'index.stitch_slide_2_stat_one' },
      { value: 'ACWR', labelKey: 'index.stitch_slide_2_stat_two' },
    ],
  },
  {
    id: 'race-ready',
    kickerKey: 'index.stitch_slide_3_kicker',
    lineOneKey: 'index.stitch_slide_3_line_one',
    lineTwoKey: 'index.stitch_slide_3_line_two',
    copyKey: 'index.stitch_slide_3_copy',
    details: [
      { value: 'VDOT', labelKey: 'index.stitch_slide_3_detail_one' },
      { value: 'GOAL', labelKey: 'index.stitch_slide_3_detail_two' },
    ],
    stats: [
      { value: '5K-M', labelKey: 'index.stitch_slide_3_stat_one' },
      { value: 'GPS', labelKey: 'index.stitch_slide_3_stat_two' },
    ],
  },
  {
    id: 'heart-rate-detail',
    kickerKey: 'index.stitch_slide_4_kicker',
    lineOneKey: 'index.stitch_slide_4_line_one',
    lineTwoKey: 'index.stitch_slide_4_line_two',
    copyKey: 'index.stitch_slide_4_copy',
    details: [
      { value: 'KM', labelKey: 'index.stitch_slide_4_detail_one' },
      { value: 'DRAG', labelKey: 'index.stitch_slide_4_detail_two' },
    ],
    stats: [
      { value: 'BPM', labelKey: 'index.stitch_slide_4_stat_one' },
      { value: 'Drag', labelKey: 'index.stitch_slide_4_stat_two' },
    ],
  },
  {
    id: 'shoe-rotation',
    kickerKey: 'index.stitch_slide_6_kicker',
    lineOneKey: 'index.stitch_slide_6_line_one',
    lineTwoKey: 'index.stitch_slide_6_line_two',
    copyKey: 'index.stitch_slide_6_copy',
    details: [
      { value: 'AI', labelKey: 'index.stitch_slide_6_detail_one' },
      { value: '600 KM', labelKey: 'index.stitch_slide_6_detail_two' },
    ],
    stats: [
      { value: 'AI scan', labelKey: 'index.stitch_slide_6_stat_one' },
      { value: '600km', labelKey: 'index.stitch_slide_6_stat_two' },
    ],
  },
  {
    id: 'course-map-ai',
    kickerKey: 'index.stitch_slide_7_kicker',
    lineOneKey: 'index.stitch_slide_7_line_one',
    lineTwoKey: 'index.stitch_slide_7_line_two',
    copyKey: 'index.stitch_slide_7_copy',
    details: [
      { value: 'PDF → ROUTE', labelKey: 'index.stitch_slide_7_detail_one' },
      { value: 'ELEVATION', labelKey: 'index.stitch_slide_7_detail_two' },
      { value: 'PACE + WEATHER', labelKey: 'index.stitch_slide_7_detail_three' },
    ],
    stats: [
      { value: 'AI vision', labelKey: 'index.stitch_slide_7_stat_one' },
      { value: 'Georef', labelKey: 'index.stitch_slide_7_stat_two' },
    ],
  },
  {
    id: 'run-data-hub',
    kickerKey: 'index.stitch_slide_8_kicker',
    lineOneKey: 'index.stitch_slide_8_line_one',
    lineTwoKey: 'index.stitch_slide_8_line_two',
    copyKey: 'index.stitch_slide_8_copy',
    details: [
      { value: 'STRAVA', labelKey: 'index.stitch_slide_8_detail_one' },
      { value: 'GPX + FIT', labelKey: 'index.stitch_slide_8_detail_two' },
    ],
    stats: [
      { value: 'AUTO', labelKey: 'index.stitch_slide_8_stat_one' },
      { value: 'IMPORT', labelKey: 'index.stitch_slide_8_stat_two' },
    ],
  },
  {
    id: 'recovery-context',
    kickerKey: 'index.stitch_slide_9_kicker',
    lineOneKey: 'index.stitch_slide_9_line_one',
    lineTwoKey: 'index.stitch_slide_9_line_two',
    copyKey: 'index.stitch_slide_9_copy',
    details: [
      { value: 'WELLNESS', labelKey: 'index.stitch_slide_9_detail_one' },
      { value: 'HRV + SLEEP', labelKey: 'index.stitch_slide_9_detail_two' },
    ],
    stats: [
      { value: 'RECOVERY', labelKey: 'index.stitch_slide_9_stat_one' },
      { value: 'SIGNALS', labelKey: 'index.stitch_slide_9_stat_two' },
    ],
  },
  {
    id: 'progress-at-a-glance',
    kickerKey: 'index.stitch_slide_10_kicker',
    lineOneKey: 'index.stitch_slide_10_line_one',
    lineTwoKey: 'index.stitch_slide_10_line_two',
    copyKey: 'index.stitch_slide_10_copy',
    details: [
      { value: 'VDOT', labelKey: 'index.stitch_slide_10_detail_one' },
      { value: 'LOAD', labelKey: 'index.stitch_slide_10_detail_two' },
    ],
    stats: [
      { value: '7 DAYS', labelKey: 'index.stitch_slide_10_stat_one' },
      { value: 'PROFILE', labelKey: 'index.stitch_slide_10_stat_two' },
    ],
  },
  {
    id: 'today-run-decision',
    kickerKey: 'index.stitch_slide_11_kicker',
    lineOneKey: 'index.stitch_slide_11_line_one',
    lineTwoKey: 'index.stitch_slide_11_line_two',
    copyKey: 'index.stitch_slide_11_copy',
    details: [
      { value: 'TODAY RUN', labelKey: 'index.stitch_slide_11_detail_one' },
      { value: 'READINESS', labelKey: 'index.stitch_slide_11_detail_two' },
    ],
    stats: [
      { value: 'ONE DECISION', labelKey: 'index.stitch_slide_11_stat_one' },
      { value: 'NO GUESSWORK', labelKey: 'index.stitch_slide_11_stat_two' },
    ],
  },
  {
    id: 'race-intelligence',
    kickerKey: 'index.stitch_slide_12_kicker',
    lineOneKey: 'index.stitch_slide_12_line_one',
    lineTwoKey: 'index.stitch_slide_12_line_two',
    copyKey: 'index.stitch_slide_12_copy',
    details: [
      { value: 'COURSE', labelKey: 'index.stitch_slide_12_detail_one' },
      { value: 'WEATHER', labelKey: 'index.stitch_slide_12_detail_two' },
    ],
    stats: [
      { value: 'ROUTE AWARE', labelKey: 'index.stitch_slide_12_stat_one' },
      { value: 'PACE READY', labelKey: 'index.stitch_slide_12_stat_two' },
    ],
  },
  {
    id: 'training-week',
    kickerKey: 'index.stitch_slide_13_kicker',
    lineOneKey: 'index.stitch_slide_13_line_one',
    lineTwoKey: 'index.stitch_slide_13_line_two',
    copyKey: 'index.stitch_slide_13_copy',
    details: [
      { value: 'SCHEDULE', labelKey: 'index.stitch_slide_13_detail_one' },
      { value: 'RACE PLAN', labelKey: 'index.stitch_slide_13_detail_two' },
    ],
    stats: [
      { value: 'WEEK VIEW', labelKey: 'index.stitch_slide_13_stat_one' },
      { value: 'ADAPTIVE', labelKey: 'index.stitch_slide_13_stat_two' },
    ],
  },
  {
    id: 'coach-reasoning',
    kickerKey: 'index.stitch_slide_14_kicker',
    lineOneKey: 'index.stitch_slide_14_line_one',
    lineTwoKey: 'index.stitch_slide_14_line_two',
    copyKey: 'index.stitch_slide_14_copy',
    details: [
      { value: 'LOAD', labelKey: 'index.stitch_slide_14_detail_one' },
      { value: 'HEART RATE', labelKey: 'index.stitch_slide_14_detail_two' },
    ],
    stats: [
      { value: 'CLEAR LOGIC', labelKey: 'index.stitch_slide_14_stat_one' },
      { value: 'COACH CONTEXT', labelKey: 'index.stitch_slide_14_stat_two' },
    ],
  },
];

export default authBrandSlides;
