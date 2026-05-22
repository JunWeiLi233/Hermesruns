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
    stats: [
      { value: 'BPM', labelKey: 'index.stitch_slide_4_stat_one' },
      { value: 'Drag', labelKey: 'index.stitch_slide_4_stat_two' },
    ],
  },
  {
    id: 'territory-polygons',
    kickerKey: 'index.stitch_slide_5_kicker',
    lineOneKey: 'index.stitch_slide_5_line_one',
    lineTwoKey: 'index.stitch_slide_5_line_two',
    copyKey: 'index.stitch_slide_5_copy',
    stats: [
      { value: 'km²', labelKey: 'index.stitch_slide_5_stat_one' },
      { value: 'Loops', labelKey: 'index.stitch_slide_5_stat_two' },
    ],
  },
  {
    id: 'shoe-rotation',
    kickerKey: 'index.stitch_slide_6_kicker',
    lineOneKey: 'index.stitch_slide_6_line_one',
    lineTwoKey: 'index.stitch_slide_6_line_two',
    copyKey: 'index.stitch_slide_6_copy',
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
    stats: [
      { value: 'AI vision', labelKey: 'index.stitch_slide_7_stat_one' },
      { value: 'Georef', labelKey: 'index.stitch_slide_7_stat_two' },
    ],
  },
];

export default authBrandSlides;
