const SLUG_RULES = [
  { slugs: ['chest'], match: /\b(chest|pecs?|pectoral)\b|胸部|胸肌/iu },
  { slugs: ['deltoids'], match: /\b(shoulders?|delts?|deltoids?)\b|肩部|三角肌/iu },
  { slugs: ['biceps'], match: /\b(biceps?|chin[-\s]?up)\b|肱二头/iu },
  { slugs: ['triceps'], match: /\b(triceps?|dips?)\b|肱三头/iu },
  { slugs: ['forearm'], match: /\b(forearms?|grip|wrist|farmer|carry)\b|前臂|握力|手腕/iu },
  { slugs: ['biceps', 'triceps', 'forearm'], match: /\b(arms?|upper arms?)\b|手臂/iu },
  { slugs: ['trapezius'], match: /\b(traps?|trapezius)\b|斜方肌/iu },
  { slugs: ['upper-back'], match: /\b(upper[-\s]?back|lats?|latissimus|rows?|pull[-\s]?up)\b|上背|背阔肌/iu },
  { slugs: ['lower-back'], match: /\b(lower[-\s]?back|erectors?|deadlift)\b|下背|腰背|竖脊肌/iu },
  { slugs: ['upper-back', 'lower-back'], match: /\bback\b|背部/iu },
  { slugs: ['abs'], match: /\b(abs?|abdominals?|dead bug|rollout)\b|腹直肌|腹肌/iu },
  { slugs: ['obliques'], match: /\b(obliques?|side plank|pallof|anti[-\s]?rotation)\b|腹斜肌|侧桥|抗旋/iu },
  { slugs: ['abs', 'obliques'], match: /\b(core|trunk)\b|核心/iu },
  { slugs: ['gluteal'], match: /\b(glutes?|gluteal|hips?|bridge)\b|臀部|臀肌|髋/iu },
  { slugs: ['quadriceps'], match: /\b(quads?|quadriceps|squat|step[-\s]?up|step[-\s]?down)\b|股四头|大腿前侧|深蹲|台阶/iu },
  { slugs: ['adductors'], match: /\b(adductors?|inner[-\s]?thigh)\b|内收肌|大腿内侧/iu },
  { slugs: ['hamstring'], match: /\b(hamstrings?|rdl|romanian|hinge|curl)\b|腘绳肌|大腿后侧|罗马尼亚|髋铰链/iu },
  { slugs: ['calves'], match: /\b(calves|calf|pogo|hop|skipping)\b|小腿|腓肠肌|比目鱼肌|弹跳/iu },
  { slugs: ['tibialis'], match: /\b(tibialis|shin)\b|胫骨前肌|胫前肌/iu },
  { slugs: ['ankles'], match: /\b(ankles?|dorsiflexion)\b|踝关节|踝/iu },
  { slugs: ['quadriceps', 'hamstring', 'gluteal'], match: /\b(legs?|lower body)\b|腿部|下肢/iu },
  { slugs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'abs', 'obliques'], match: /\b(runner strength|run specific)\b|跑者力量/iu },
];

function collectLabels(muscles) {
  if (!muscles) return [];
  if (typeof muscles === 'string') return [muscles];
  if (Array.isArray(muscles)) return muscles;
  return []
    .concat(Array.isArray(muscles.zh) ? muscles.zh : [])
    .concat(Array.isArray(muscles.en) ? muscles.en : [])
    .concat(Array.isArray(muscles.labels) ? muscles.labels : []);
}

export function muscleSlugsForExercise(muscles) {
  const labels = collectLabels(muscles).filter((label) => typeof label === 'string' && label.trim());
  if (labels.length === 0) return [];

  const found = new Set();
  for (const label of labels) {
    for (const rule of SLUG_RULES) {
      rule.match.lastIndex = 0;
      if (rule.match.test(label)) {
        rule.slugs.forEach((slug) => found.add(slug));
      }
    }
  }
  return Array.from(found);
}

export function aggregateMuscleLoad(exercises) {
  if (!Array.isArray(exercises) || exercises.length === 0) return [];
  const counts = new Map();
  for (const exercise of exercises) {
    const slugs = muscleSlugsForExercise(exercise?.muscles);
    for (const slug of slugs) {
      counts.set(slug, (counts.get(slug) || 0) + 1);
    }
  }
  const max = Math.max(0, ...counts.values());
  if (max === 0) return [];
  return Array.from(counts.entries()).map(([slug, count]) => {
    const ratio = count / max;
    const intensity = ratio <= 1 / 3 ? 1 : ratio <= 2 / 3 ? 2 : 3;
    return { slug, intensity };
  });
}
