import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { apiJson } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useUnit } from '../../contexts/UnitContext';
import AppIcon from '../../components/AppIcon';
import HermesLogo from '../../components/HermesLogo';
import MuscleHeatmap from '../../components/MuscleHeatmap';
import RunActivityContributionGraph from '../../components/RunActivityContributionGraph';
import FooterNavLinks from '../../components/FooterNavLinks';
import RunnerShellTopNav from '../../components/RunnerShellTopNav';
import TopbarNotifications from '../../components/TopbarNotifications';
import { getRunnerShellNavItems } from '../../utils/runnerShellNav';
import PageSkeleton from '../../components/PageSkeleton';
import { muscleSlugsForExercise } from '../../utils/muscleSlugMapper';
import targetArmsUrl from '../../assets/muscle-training/target-arms.webp';
import targetBackUrl from '../../assets/muscle-training/target-back.webp';
import targetChestUrl from '../../assets/muscle-training/target-chest.webp';
import targetCoreUrl from '../../assets/muscle-training/target-core.webp';
import targetLegsUrl from '../../assets/muscle-training/target-legs.webp';
import targetShouldersUrl from '../../assets/muscle-training/target-shoulders.webp';

const EXERCISE_DB_IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const exerciseDbImage = (imagePath) => `${EXERCISE_DB_IMAGE_BASE}${imagePath}`;
const youtubeThumbnail = (videoId) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

const EXERCISE_REFERENCE_IMAGES = {
  'barbell-bench-press': exerciseDbImage('Barbell_Bench_Press_-_Medium_Grip/0.jpg'),
  'incline-dumbbell-press': exerciseDbImage('Incline_Dumbbell_Press/0.jpg'),
  'weighted-dip': exerciseDbImage('Dips_-_Chest_Version/0.jpg'),
  'push-up': exerciseDbImage('Pushups/0.jpg'),
  'pull-up': exerciseDbImage('Pullups/0.jpg'),
  'barbell-row': exerciseDbImage('Bent_Over_Barbell_Row/0.jpg'),
  'romanian-deadlift': exerciseDbImage('Romanian_Deadlift/0.jpg'),
  'chest-supported-row': exerciseDbImage('Lying_Cambered_Barbell_Row/0.jpg'),
  'barbell-squat': exerciseDbImage('Barbell_Squat/0.jpg'),
  'front-squat': exerciseDbImage('Front_Barbell_Squat/0.jpg'),
  deadlift: exerciseDbImage('Barbell_Deadlift/0.jpg'),
  'bulgarian-split-squat': exerciseDbImage('Split_Squat_with_Dumbbells/0.jpg'),
  'barbell-hip-thrust': youtubeThumbnail('NOnbakeElAQ'),
  'single-leg-leg-press': youtubeThumbnail('3aYsOsBA7ZE'),
  'glute-ham-raise': youtubeThumbnail('Co7xAWe3hwo'),
  'squat-jump': youtubeThumbnail('tZSYZdtbONc'),
  'standing-overhead-press': exerciseDbImage('Standing_Military_Press/0.jpg'),
  'push-press': exerciseDbImage('Push_Press/0.jpg'),
  'landmine-press': exerciseDbImage('Landmine_Linear_Jammer/0.jpg'),
  'dumbbell-clean-press': exerciseDbImage('Clean_and_Press/0.jpg'),
  'chin-up': exerciseDbImage('Chin-Up/0.jpg'),
  'close-grip-bench': exerciseDbImage('Close-Grip_Barbell_Bench_Press/0.jpg'),
  'weighted-triceps-dip': exerciseDbImage('Dips_-_Triceps_Version/0.jpg'),
  'farmer-carry': exerciseDbImage('Farmers_Walk/0.jpg'),
  'turkish-get-up': exerciseDbImage('Kettlebell_Turkish_Get-Up_Lunge_style/0.jpg'),
  'front-rack-carry': youtubeThumbnail('Q5kuuxaNDDM'),
  'hanging-leg-raise': exerciseDbImage('Hanging_Leg_Raise/0.jpg'),
  'barbell-rollout': exerciseDbImage('Barbell_Ab_Rollout/0.jpg'),
  'hip-airplanes': exerciseDbImage('Balance_Board/0.jpg'),
  'calf-raises-slow-tempo': exerciseDbImage('Standing_Calf_Raises/0.jpg'),
  'dead-bug': exerciseDbImage('Dead_Bug/0.jpg'),
  'split-squat': exerciseDbImage('Split_Squat_with_Dumbbells/0.jpg'),
  'single-leg-romanian-deadlift': exerciseDbImage('Romanian_Deadlift/1.jpg'),
  'standing-calf-raise': exerciseDbImage('Standing_Calf_Raises/0.jpg'),
  'side-plank': exerciseDbImage('Push_Up_to_Side_Plank/0.jpg'),
  'glute-bridge-pause-at-top': exerciseDbImage('Barbell_Glute_Bridge/0.jpg'),
  'tibialis-wall-raise': exerciseDbImage('Anterior_Tibialis-SMR/0.jpg'),
  'worlds-greatest-stretch': exerciseDbImage('Worlds_Greatest_Stretch/0.jpg'),
  'ankle-dorsiflexion-rocks': exerciseDbImage('Ankle_Circles/0.jpg'),
  'step-down-knee-tracking': exerciseDbImage('Dumbbell_Step_Ups/1.jpg'),
  'hamstring-curl-slider-or-machine': exerciseDbImage('Seated_Band_Hamstring_Curl/0.jpg'),
  'pallof-press': exerciseDbImage('Pallof_Press/0.jpg'),
  'farmer-carry-suitcase': exerciseDbImage('Rickshaw_Carry/0.jpg'),
  'pogo-hops': exerciseDbImage('Front_Cone_Hops_or_hurdle_hops/0.jpg'),
  'skipping-a-drill': exerciseDbImage('Fast_Skipping/0.jpg'),
  'box-step-up-explosive': exerciseDbImage('Box_Skip/0.jpg'),
  'single-leg-hop-low-amplitude': exerciseDbImage('Single-Leg_Hop_Progression/0.jpg'),
};

function compoundLibraryExercise({
  key,
  zhName,
  enName,
  zhMuscles,
  enMuscles,
  equipment,
  sets,
  reps,
  rpe,
  zhIntent,
  enIntent,
  zhSteps,
  enSteps,
  zhRegression,
  enRegression,
  zhProgression,
  enProgression,
}) {
  return {
    key,
    exercise: {
      name: enName,
      sets,
      repsOrDuration: reps,
      targetRpe: rpe,
      tempoOrIntent: enIntent,
      noiseLevel: 'OPTIONAL',
      equipmentNeeded: equipment,
    },
    content: {
      name: { zh: zhName, en: enName },
      muscles: { zh: zhMuscles, en: enMuscles },
      steps: { zh: zhSteps, en: enSteps },
      intent: { zh: zhIntent, en: enIntent },
      regression: { zh: zhRegression, en: enRegression },
      progression: { zh: zhProgression, en: enProgression },
    },
  };
}

const TARGET_AREA_GROUPS = [
  {
    key: 'chest',
    copyKey: 'targetChest',
    image: targetChestUrl,
    match: /chest|pec|胸/i,
  },
  {
    key: 'back',
    copyKey: 'targetBack',
    image: targetBackUrl,
    match: /back|lats|latissimus|scapula|背|肩胛/i,
  },
  {
    key: 'legs',
    copyKey: 'targetLegs',
    image: targetLegsUrl,
    match: /quad|hamstring|glute|calf|shin|tibialis|ankle|hip|leg|臀|腿|股|腘|小腿|胫|踝|髋/i,
  },
  {
    key: 'shoulders',
    copyKey: 'targetShoulders',
    image: targetShouldersUrl,
    match: /shoulder|deltoid|rotator|肩/i,
  },
  {
    key: 'arms',
    copyKey: 'targetArms',
    image: targetArmsUrl,
    match: /arm|forearm|biceps|triceps|grip|carry|手臂|前臂|二头|三头|握力|农夫/i,
  },
  {
    key: 'core',
    copyKey: 'targetCore',
    image: targetCoreUrl,
    match: /core|abs|oblique|trunk|plank|腹|核心|躯干|侧桥/i,
  },
];

const TOP_MUSCLE_SELECTOR_GROUPS = {
  chest: ['chest'],
  back: ['upper-back', 'lower-back', 'trapezius'],
  legs: ['quadriceps', 'hamstring', 'calves', 'gluteal', 'adductors', 'tibialis'],
  shoulders: ['deltoids', 'trapezius'],
  arms: ['biceps', 'triceps', 'forearm', 'hands'],
  core: ['abs', 'obliques'],
};

// Bridge the purpose-oriented StrengthFocus enum (the backend recommendation
// vocabulary) to the 6 anatomy target-area keys that drive the heatmap chip +
// highlight. The backend emits POSTERIOR_CHAIN / CALVES_ANKLES / etc.; the UI
// highlights the matching anatomy region via this map.
const FOCUS_TO_TARGET_AREA = {
  LEG_DAY: 'legs',
  POSTERIOR_CHAIN: 'legs',   // glutes/hamstrings live under the 'legs' anatomy group
  CALVES_ANKLES: 'legs',     // calves/tibialis live under 'legs'
  CORE_STABILITY: 'core',
  MOBILITY_RESET: 'core',
  COACH_PICK: 'legs',
};

const TOP_MUSCLE_SELECTOR_SLUG_TARGETS = new Map([
  ['chest', 'chest'],
  ['upper-back', 'back'],
  ['lower-back', 'back'],
  ['trapezius', 'shoulders'],
  ['deltoids', 'shoulders'],
  ['biceps', 'arms'],
  ['triceps', 'arms'],
  ['forearm', 'arms'],
  ['hands', 'arms'],
  ['abs', 'core'],
  ['obliques', 'core'],
  ['quadriceps', 'legs'],
  ['hamstring', 'legs'],
  ['calves', 'legs'],
  ['gluteal', 'legs'],
  ['adductors', 'legs'],
  ['tibialis', 'legs'],
]);

function buildTopMuscleSelectorData(activeTarget) {
  const activeSlugs = TOP_MUSCLE_SELECTOR_GROUPS[activeTarget] || TOP_MUSCLE_SELECTOR_GROUPS.legs;
  return activeSlugs.map((slug) => ({
    slug,
    intensity: 3,
    styles: {
      fill: 'var(--mtpa-muscle-active-fill)',
      stroke: 'var(--mtpa-muscle-active-stroke)',
      strokeWidth: 1.65,
      opacity: 0.94,
    },
  }));
}

function resolveTopMuscleTargetFromSlug(slug) {
  return TOP_MUSCLE_SELECTOR_SLUG_TARGETS.get(slug) || '';
}

const EXERCISE_VIDEO_EMBEDS = {
  'barbell-bench-press': 'https://www.youtube-nocookie.com/embed/0cXAp6WhSj4',
  'incline-dumbbell-press': 'https://www.youtube-nocookie.com/embed/8fXfwG4ftaQ',
  'weighted-dip': 'https://www.youtube-nocookie.com/embed/ZDOrGNvRdM0',
  'push-up': 'https://www.youtube-nocookie.com/embed/c-lBErfxszs',
  'pull-up': 'https://www.youtube-nocookie.com/embed/p40iUjf02j0',
  'barbell-row': 'https://www.youtube-nocookie.com/embed/Nqh7q3zDCoQ',
  'romanian-deadlift': 'https://www.youtube-nocookie.com/embed/5zmlnbWb-g4',
  'chest-supported-row': 'https://www.youtube-nocookie.com/embed/oNsqMW1gPiU',
  'barbell-squat': 'https://www.youtube-nocookie.com/embed/gcNh17Ckjgg',
  'front-squat': 'https://www.youtube-nocookie.com/embed/_qv0m3tPd3s',
  'deadlift': 'https://www.youtube-nocookie.com/embed/vfKwjT5-86k',
  'bulgarian-split-squat': 'https://www.youtube-nocookie.com/embed/uODWo4YqbT8',
  'barbell-hip-thrust': 'https://www.youtube-nocookie.com/embed/NOnbakeElAQ',
  'single-leg-leg-press': 'https://www.youtube-nocookie.com/embed/3aYsOsBA7ZE',
  'glute-ham-raise': 'https://www.youtube-nocookie.com/embed/Co7xAWe3hwo',
  'squat-jump': 'https://www.youtube-nocookie.com/embed/tZSYZdtbONc',
  'standing-overhead-press': 'https://www.youtube-nocookie.com/embed/wO0l5jW2NtQ',
  'push-press': 'https://www.youtube-nocookie.com/embed/ep30avTSMB0',
  'landmine-press': 'https://www.youtube-nocookie.com/embed/t9GuiNQo1O4',
  'dumbbell-clean-press': 'https://www.youtube-nocookie.com/embed/sZ4XMWn8bAU',
  'chin-up': 'https://www.youtube-nocookie.com/embed/Oi3bW9nQmGI',
  'close-grip-bench': 'https://www.youtube-nocookie.com/embed/vEUyEOVn3yM',
  'weighted-triceps-dip': 'https://www.youtube-nocookie.com/embed/gF_F67aNvuE',
  'farmer-carry': 'https://www.youtube-nocookie.com/embed/z7E_YU9P1jU',
  'turkish-get-up': 'https://www.youtube-nocookie.com/embed/sgd8n917Zv0',
  'front-rack-carry': 'https://www.youtube-nocookie.com/embed/Q5kuuxaNDDM',
  'hanging-leg-raise': 'https://www.youtube-nocookie.com/embed/2n4UqRIJyk4',
  'barbell-rollout': 'https://www.youtube-nocookie.com/embed/ndc391RFNUM',
  'hip-airplanes': 'https://www.youtube-nocookie.com/embed/U5f8h7FDEa0',
  'calf-raises-slow-tempo': 'https://www.youtube-nocookie.com/embed/2GHbuiYS50I',
  'dead-bug': 'https://www.youtube-nocookie.com/embed/o4GKiEoYClI',
  'split-squat': 'https://www.youtube-nocookie.com/embed/YuLqw3kHPaw',
  'single-leg-romanian-deadlift': 'https://www.youtube-nocookie.com/embed/s32cCgmRV3I',
  'standing-calf-raise': 'https://www.youtube-nocookie.com/embed/eMTy3qylqnE',
  'side-plank': 'https://www.youtube-nocookie.com/embed/fzLeV8X0Gb8',
  'glute-bridge-pause-at-top': 'https://www.youtube-nocookie.com/embed/nBTdW5N8Cl4',
  'tibialis-wall-raise': 'https://www.youtube-nocookie.com/embed/VzIcGAgBiaM',
  'world-s-greatest-stretch': 'https://www.youtube-nocookie.com/embed/-CiWQ2IvY34',
  'ankle-dorsiflexion-rocks': 'https://www.youtube-nocookie.com/embed/dr1FYumuGC4',
  'step-down-knee-tracking': 'https://www.youtube-nocookie.com/embed/LRdfjaG3L8I',
  'hamstring-curl-slider-or-machine': 'https://www.youtube-nocookie.com/embed/0zCjuSI1IQI',
  'pallof-press': 'https://www.youtube-nocookie.com/embed/5aZ0IhJS8O8',
  'farmer-carry-suitcase': 'https://www.youtube-nocookie.com/embed/iTjwbts8Djw',
  'pogo-hops': 'https://www.youtube-nocookie.com/embed/L_khHgMz9uU',
  'skipping-a-drill': 'https://www.youtube-nocookie.com/embed/O9wh-huxbxU',
  'box-step-up-explosive': 'https://www.youtube-nocookie.com/embed/rEK4E5TaxWU',
  'single-leg-hop-low-amplitude': 'https://www.youtube-nocookie.com/embed/6A6Ynz_Y0Vo',
};

const COMPOUND_TARGET_LIBRARY = {
  chest: [
    compoundLibraryExercise({
      key: 'barbell-bench-press',
      zhName: '杠铃卧推',
      enName: 'Barbell bench press',
      zhMuscles: ['胸部', '肩部', '手臂'],
      enMuscles: ['Chest', 'Shoulders', 'Arms'],
      equipment: 'GYM',
      sets: 4,
      reps: '5',
      rpe: 8,
      zhIntent: '水平推力主项，建立上肢绝对力量',
      enIntent: 'Primary horizontal press for upper-body strength',
      zhSteps: ['肩胛后收下沉，脚掌踩稳。', '杠铃受控下降到胸下缘。', '向上推直，保持肩胛和躯干稳定。'],
      enSteps: ['Retract and depress the shoulder blades with feet planted.', 'Lower the bar under control to the lower chest.', 'Press to lockout while the torso stays braced.'],
      zhRegression: '改用哑铃卧推或俯卧撑。',
      enRegression: 'Use dumbbell bench press or push-ups.',
      zhProgression: '增加重量，或加入暂停卧推。',
      enProgression: 'Add load or use paused bench reps.',
    }),
    compoundLibraryExercise({
      key: 'incline-dumbbell-press',
      zhName: '上斜哑铃卧推',
      enName: 'Incline dumbbell press',
      zhMuscles: ['胸部', '肩部', '手臂'],
      enMuscles: ['Chest', 'Shoulders', 'Arms'],
      equipment: 'DUMBBELL',
      sets: 3,
      reps: '6-8',
      rpe: 7,
      zhIntent: '上胸和肩前束复合推举',
      enIntent: 'Compound incline press for upper chest and anterior delts',
      zhSteps: ['凳角保持中等，不要过陡。', '哑铃下降到胸上侧，手肘略低于肩。', '向上推到哑铃接近但不碰撞。'],
      enSteps: ['Use a moderate bench angle.', 'Lower the dumbbells to the upper chest with elbows below shoulders.', 'Press up until the dumbbells nearly meet.'],
      zhRegression: '降低角度或减轻重量。',
      enRegression: 'Lower the incline or reduce load.',
      zhProgression: '增加重量或放慢离心阶段。',
      enProgression: 'Add load or slow the eccentric.',
    }),
    compoundLibraryExercise({
      key: 'weighted-dip',
      zhName: '负重双杠臂屈伸',
      enName: 'Weighted dip',
      zhMuscles: ['胸部', '手臂', '肩部'],
      enMuscles: ['Chest', 'Arms', 'Shoulders'],
      equipment: 'GYM',
      sets: 3,
      reps: '5-8',
      rpe: 8,
      zhIntent: '大幅度下压，强化胸肩肱三头',
      enIntent: 'Deep compound press for chest, shoulders, and triceps',
      zhSteps: ['身体微前倾，肩膀远离耳朵。', '下降到肩部可控深度。', '向下压杠回到顶部，不耸肩。'],
      enSteps: ['Lean slightly forward and keep shoulders away from ears.', 'Descend only as deep as control allows.', 'Press back to the top without shrugging.'],
      zhRegression: '改用辅助臂屈伸或窄距俯卧撑。',
      enRegression: 'Use assisted dips or close-grip push-ups.',
      zhProgression: '逐步加负重，保持底部稳定。',
      enProgression: 'Add load gradually while owning the bottom.',
    }),
    compoundLibraryExercise({
      key: 'push-up',
      zhName: '俯卧撑',
      enName: 'Push-up',
      zhMuscles: ['胸部', '核心', '手臂'],
      enMuscles: ['Chest', 'Core', 'Arms'],
      equipment: 'BODYWEIGHT',
      sets: 3,
      reps: '8-15',
      rpe: 7,
      zhIntent: '低门槛复合推力，保持躯干刚性',
      enIntent: 'Accessible compound press with trunk stiffness',
      zhSteps: ['身体从肩到脚保持直线。', '胸口向地面下降，手肘约 45 度。', '推起时肋骨不要外翻。'],
      enSteps: ['Keep a straight line from shoulders to feet.', 'Lower the chest with elbows around 45 degrees.', 'Press up without flaring the ribs.'],
      zhRegression: '改为上斜俯卧撑。',
      enRegression: 'Use incline push-ups.',
      zhProgression: '加负重或改为环上俯卧撑。',
      enProgression: 'Add load or use ring push-ups.',
    }),
  ],
  back: [
    compoundLibraryExercise({
      key: 'pull-up',
      zhName: '引体向上',
      enName: 'Pull-up',
      zhMuscles: ['背部', '手臂', '核心'],
      enMuscles: ['Back', 'Arms', 'Core'],
      equipment: 'GYM',
      sets: 4,
      reps: '4-8',
      rpe: 8,
      zhIntent: '垂直拉力主项，强化背阔肌和握力',
      enIntent: 'Primary vertical pull for lats and grip',
      zhSteps: ['先下压肩胛，再开始拉。', '胸口靠近横杠，身体不摆动。', '受控下降到手臂伸直。'],
      enSteps: ['Depress the scapula before pulling.', 'Pull the chest toward the bar without swinging.', 'Lower under control to full arm extension.'],
      zhRegression: '用弹力带辅助或做下放。',
      enRegression: 'Use band assistance or eccentric-only reps.',
      zhProgression: '加负重或加入顶部停顿。',
      enProgression: 'Add load or pause at the top.',
    }),
    compoundLibraryExercise({
      key: 'barbell-row',
      zhName: '杠铃划船',
      enName: 'Barbell row',
      zhMuscles: ['背部', '核心', '手臂'],
      enMuscles: ['Back', 'Core', 'Arms'],
      equipment: 'GYM',
      sets: 4,
      reps: '6',
      rpe: 8,
      zhIntent: '髋铰链位水平拉，训练背部和躯干抗弯',
      enIntent: 'Horizontal pull from a hinge position',
      zhSteps: ['髋部后移，背部保持长。', '杠铃拉向下肋，肘部向后。', '下降时保持躯干角度不变。'],
      enSteps: ['Hinge back and keep the spine long.', 'Row the bar toward the lower ribs.', 'Lower without changing torso angle.'],
      zhRegression: '改成胸托划船。',
      enRegression: 'Use chest-supported rows.',
      zhProgression: '增加重量或使用暂停划船。',
      enProgression: 'Add load or pause each row.',
    }),
    compoundLibraryExercise({
      key: 'romanian-deadlift',
      zhName: '罗马尼亚硬拉',
      enName: 'Romanian deadlift',
      zhMuscles: ['背部', '臀部', '腿部'],
      enMuscles: ['Back', 'Glutes', 'Legs'],
      equipment: 'GYM',
      sets: 4,
      reps: '6',
      rpe: 8,
      zhIntent: '后链复合力量，强化髋铰链和背部张力',
      enIntent: 'Posterior-chain compound hinge',
      zhSteps: ['膝盖微屈，髋部向后。', '杠铃贴腿下降到腘绳肌拉紧。', '收髋站起，背阔肌保持张力。'],
      enSteps: ['Keep soft knees and send hips back.', 'Slide the bar down until hamstrings load.', 'Extend the hips while lats stay tight.'],
      zhRegression: '改用哑铃或缩短下降幅度。',
      enRegression: 'Use dumbbells or shorten the range.',
      zhProgression: '增加重量或放慢下降。',
      enProgression: 'Add load or slow the descent.',
    }),
    compoundLibraryExercise({
      key: 'chest-supported-row',
      zhName: '胸托划船',
      enName: 'Chest-supported row',
      zhMuscles: ['背部', '手臂'],
      enMuscles: ['Back', 'Arms'],
      equipment: 'DUMBBELL',
      sets: 3,
      reps: '8-10',
      rpe: 7,
      zhIntent: '减少腰背负担，集中训练划船力量',
      enIntent: 'Row strength with less low-back demand',
      zhSteps: ['胸口贴稳斜凳。', '肩胛先后收，再拉肘。', '顶端停顿后慢慢放回。'],
      enSteps: ['Keep the chest supported on the bench.', 'Retract shoulder blades before driving elbows.', 'Pause at the top and lower slowly.'],
      zhRegression: '减轻重量或缩短顶端停顿。',
      enRegression: 'Reduce load or shorten the pause.',
      zhProgression: '增加重量或双侧改单侧。',
      enProgression: 'Add load or row one arm at a time.',
    }),
  ],
  legs: [
    compoundLibraryExercise({
      key: 'barbell-squat',
      zhName: '杠铃深蹲',
      enName: 'Barbell squat',
      zhMuscles: ['腿部', '臀部', '核心'],
      enMuscles: ['Legs', 'Glutes', 'Core'],
      equipment: 'GYM',
      sets: 4,
      reps: '5',
      rpe: 8,
      zhIntent: '下肢复合主项，建立全身张力',
      enIntent: 'Primary lower-body compound lift',
      zhSteps: ['吸气撑紧，脚掌三点踩地。', '膝髋同步下沉，杠铃在中足上方。', '蹬地站起，胸腔和骨盆保持堆叠。'],
      enSteps: ['Brace and root through the tripod foot.', 'Descend with knees and hips together over mid-foot.', 'Drive up while ribs and pelvis stay stacked.'],
      zhRegression: '改成高箱深蹲或杯式深蹲。',
      enRegression: 'Use box squats or goblet squats.',
      zhProgression: '增加重量或加入暂停深蹲。',
      enProgression: 'Add load or use paused squats.',
    }),
    compoundLibraryExercise({
      key: 'front-squat',
      zhName: '前蹲',
      enName: 'Front squat',
      zhMuscles: ['腿部', '核心', '背部'],
      enMuscles: ['Legs', 'Core', 'Back'],
      equipment: 'GYM',
      sets: 3,
      reps: '4-6',
      rpe: 8,
      zhIntent: '更直立的深蹲，强化股四头和躯干',
      enIntent: 'Upright squat for quads and trunk',
      zhSteps: ['手肘抬高，杠铃贴住肩前。', '保持躯干直立下蹲。', '站起时肘部不要掉。'],
      enSteps: ['Lift elbows and pin the bar to the shoulders.', 'Squat down with an upright torso.', 'Stand without dropping the elbows.'],
      zhRegression: '改成双哑铃前架深蹲。',
      enRegression: 'Use double-dumbbell front squats.',
      zhProgression: '增加重量或加入底部停顿。',
      enProgression: 'Add load or pause at the bottom.',
    }),
    compoundLibraryExercise({
      key: 'deadlift',
      zhName: '硬拉',
      enName: 'Deadlift',
      zhMuscles: ['腿部', '背部', '臀部'],
      enMuscles: ['Legs', 'Back', 'Glutes'],
      equipment: 'GYM',
      sets: 3,
      reps: '3-5',
      rpe: 8,
      zhIntent: '重型髋膝伸展，训练全身力量',
      enIntent: 'Heavy hip and knee extension',
      zhSteps: ['杠铃贴近胫骨，背阔肌收紧。', '先把杠铃拉紧，再离地。', '髋膝一起伸展，顶部不过度后仰。'],
      enSteps: ['Set the bar close and tighten the lats.', 'Pull slack out before the bar leaves the floor.', 'Extend hips and knees together without leaning back.'],
      zhRegression: '改成架上硬拉或壶铃硬拉。',
      enRegression: 'Use rack pulls or kettlebell deadlifts.',
      zhProgression: '增加重量或加入暂停硬拉。',
      enProgression: 'Add load or use paused deadlifts.',
    }),
    compoundLibraryExercise({
      key: 'bulgarian-split-squat',
      zhName: '保加利亚分腿蹲',
      enName: 'Bulgarian split squat',
      zhMuscles: ['腿部', '臀部', '核心'],
      enMuscles: ['Legs', 'Glutes', 'Core'],
      equipment: 'DUMBBELL',
      sets: 3,
      reps: '6/side',
      rpe: 8,
      zhIntent: '单腿复合力量，兼顾跑者稳定性',
      enIntent: 'Single-leg compound strength for runners',
      zhSteps: ['前脚踩稳，后脚放在凳上。', '向下坐到前腿承重。', '前脚蹬地站起，骨盆保持正。'],
      enSteps: ['Plant the front foot and elevate the rear foot.', 'Sit down into the front leg.', 'Drive through the front foot while hips stay square.'],
      zhRegression: '改成普通分腿蹲。',
      enRegression: 'Use regular split squats.',
      zhProgression: '加哑铃或底部停顿。',
      enProgression: 'Add dumbbells or a bottom pause.',
    }),
    compoundLibraryExercise({
      key: 'barbell-hip-thrust',
      zhName: '杠铃臀推',
      enName: 'Barbell hip thrust',
      zhMuscles: ['臀部', '腘绳肌', '核心'],
      enMuscles: ['Glutes', 'Hamstrings', 'Core'],
      equipment: 'GYM',
      sets: 3,
      reps: '5-8',
      rpe: 8,
      zhIntent: '重负荷髋伸展，强化跑步蹬伸力量',
      enIntent: 'Heavy hip extension for running propulsion',
      zhSteps: ['肩胛下缘靠稳长凳，杠铃加垫放在髋部。', '脚掌踩稳，收紧腹部并把髋部向上推。', '顶部夹紧臀部，保持肋骨下沉后受控下降。'],
      enSteps: ['Anchor the lower shoulder blades on a bench and pad the bar across the hips.', 'Plant the feet, brace, and drive the hips upward.', 'Squeeze the glutes with ribs down, then lower under control.'],
      zhRegression: '改成自重臀推或臀桥。',
      enRegression: 'Use a bodyweight hip thrust or glute bridge.',
      zhProgression: '逐步加重，或在顶部停顿 2 秒。',
      enProgression: 'Add load gradually or pause for two seconds at the top.',
    }),
    compoundLibraryExercise({
      key: 'single-leg-leg-press',
      zhName: '单腿腿举',
      enName: 'Single-leg leg press',
      zhMuscles: ['股四头肌', '臀部', '腘绳肌'],
      enMuscles: ['Quadriceps', 'Glutes', 'Hamstrings'],
      equipment: 'GYM',
      sets: 3,
      reps: '6/side',
      rpe: 8,
      zhIntent: '在稳定轨迹中建立单腿高负荷力量',
      enIntent: 'High-force unilateral strength on a stable path',
      zhSteps: ['背部和头部贴紧靠垫，单脚踩在踏板中央。', '膝盖沿脚尖方向受控下放到可保持骨盆稳定的深度。', '用整只脚推回，不要锁死膝盖。'],
      enSteps: ['Keep the back and head on the pad with one foot centered on the platform.', 'Lower under control while the knee tracks over the toes and the pelvis stays set.', 'Press through the whole foot without snapping the knee into lockout.'],
      zhRegression: '减轻重量，或改成双腿腿举。',
      enRegression: 'Reduce the load or use a bilateral leg press.',
      zhProgression: '在动作对称稳定后逐步加重。',
      enProgression: 'Add load only after both sides stay controlled and even.',
    }),
    compoundLibraryExercise({
      key: 'glute-ham-raise',
      zhName: '臀腿后侧挺身',
      enName: 'Glute-ham raise',
      zhMuscles: ['腘绳肌', '臀部', '小腿'],
      enMuscles: ['Hamstrings', 'Glutes', 'Calves'],
      equipment: 'GYM',
      sets: 3,
      reps: '6-8',
      rpe: 7,
      zhIntent: '同时训练屈膝与伸髋的后链力量',
      enIntent: 'Posterior-chain strength through knee flexion and hip extension',
      zhSteps: ['脚踝固定，膝盖放在支撑垫后方。', '臀部保持伸展，用腘绳肌控制身体前倾。', '收紧臀腿后侧，把身体拉回直线。'],
      enSteps: ['Secure the ankles with the knees just behind the pad.', 'Keep the hips extended while the hamstrings control the forward lean.', 'Contract the glutes and hamstrings to pull the body back to a straight line.'],
      zhRegression: '用弹力带辅助，或改做滑盘腘绳肌弯举。',
      enRegression: 'Use band assistance or a slider hamstring curl.',
      zhProgression: '减少辅助，或在胸前增加轻负重。',
      enProgression: 'Use less assistance or add a light load at the chest.',
    }),
    compoundLibraryExercise({
      key: 'squat-jump',
      zhName: '深蹲跳',
      enName: 'Squat jump',
      zhMuscles: ['股四头肌', '臀部', '小腿'],
      enMuscles: ['Quadriceps', 'Glutes', 'Calves'],
      equipment: 'BODYWEIGHT',
      sets: 3,
      reps: '5',
      rpe: 6,
      zhIntent: '用低次数高质量触地训练下肢爆发力',
      enIntent: 'Low-rep elastic power with high-quality landings',
      zhSteps: ['双脚与髋同宽，下沉到四分之一至半蹲。', '快速伸展髋、膝、踝向上起跳。', '轻柔落地并屈髋屈膝吸收冲击，每次重新站稳。'],
      enSteps: ['Stand hip-width and descend into a quarter-to-half squat.', 'Extend the hips, knees, and ankles quickly to jump.', 'Land softly, absorb through hips and knees, and reset before each rep.'],
      zhRegression: '改成快速徒手深蹲，不离地。',
      enRegression: 'Use fast bodyweight squats without leaving the floor.',
      zhProgression: '保持落地安静的前提下提高跳跃质量，不做到力竭。',
      enProgression: 'Increase jump quality while landings stay quiet; never take the set to failure.',
    }),
  ],
  shoulders: [
    compoundLibraryExercise({
      key: 'standing-overhead-press',
      zhName: '站姿推举',
      enName: 'Standing overhead press',
      zhMuscles: ['肩部', '手臂', '核心'],
      enMuscles: ['Shoulders', 'Arms', 'Core'],
      equipment: 'GYM',
      sets: 4,
      reps: '5',
      rpe: 8,
      zhIntent: '垂直推力主项，训练肩部和躯干刚性',
      enIntent: 'Primary vertical press with trunk stiffness',
      zhSteps: ['臀腹收紧，杠铃在锁骨上方。', '头略后移，杠铃直线上推。', '锁定后头回到杠铃下方。'],
      enSteps: ['Brace glutes and abs with the bar at the collarbone.', 'Move the head back and press vertically.', 'Lock out with the head under the bar.'],
      zhRegression: '改成坐姿哑铃推举。',
      enRegression: 'Use seated dumbbell press.',
      zhProgression: '增加重量或加入暂停推举。',
      enProgression: 'Add load or use paused presses.',
    }),
    compoundLibraryExercise({
      key: 'push-press',
      zhName: '借力推',
      enName: 'Push press',
      zhMuscles: ['肩部', '腿部', '核心'],
      enMuscles: ['Shoulders', 'Legs', 'Core'],
      equipment: 'GYM',
      sets: 4,
      reps: '3-5',
      rpe: 8,
      zhIntent: '下肢驱动到上肢的爆发推举',
      enIntent: 'Explosive leg drive into an overhead press',
      zhSteps: ['小幅屈膝，躯干保持直。', '快速蹬地把杠铃送起。', '手臂完成锁定，落回时吸收重量。'],
      enSteps: ['Dip slightly with the torso vertical.', 'Drive hard through the floor.', 'Lock out and absorb the bar on the way down.'],
      zhRegression: '改成轻重量站姿推举。',
      enRegression: 'Use a lighter strict press.',
      zhProgression: '增加重量但保持垂直驱动。',
      enProgression: 'Add load while keeping the drive vertical.',
    }),
    compoundLibraryExercise({
      key: 'landmine-press',
      zhName: '地雷管推举',
      enName: 'Landmine press',
      zhMuscles: ['肩部', '胸部', '核心'],
      enMuscles: ['Shoulders', 'Chest', 'Core'],
      equipment: 'GYM',
      sets: 3,
      reps: '6/side',
      rpe: 7,
      zhIntent: '斜向推举，肩部压力更友好',
      enIntent: 'Angled press with shoulder-friendly mechanics',
      zhSteps: ['半跪或站姿撑紧身体。', '沿斜向上推，不旋转躯干。', '受控回到胸前。'],
      enSteps: ['Brace from half-kneeling or standing.', 'Press up on the angle without rotating.', 'Return under control to the chest.'],
      zhRegression: '减轻重量或双手推。',
      enRegression: 'Reduce load or press with both hands.',
      zhProgression: '单手加重量或加入停顿。',
      enProgression: 'Add load one-arm or use pauses.',
    }),
    compoundLibraryExercise({
      key: 'dumbbell-clean-press',
      zhName: '哑铃挺举',
      enName: 'Dumbbell clean and press',
      zhMuscles: ['肩部', '腿部', '核心'],
      enMuscles: ['Shoulders', 'Legs', 'Core'],
      equipment: 'DUMBBELL',
      sets: 3,
      reps: '5',
      rpe: 7,
      zhIntent: '从髋部发力到头顶的全身复合动作',
      enIntent: 'Full-body compound from hip drive to overhead',
      zhSteps: ['髋部发力把哑铃带到肩上。', '稳定前架位置后再推举。', '放下时保持背部和腹压。'],
      enSteps: ['Use hip drive to clean the dumbbells to shoulders.', 'Stabilize the rack before pressing.', 'Lower while keeping the back and brace set.'],
      zhRegression: '拆成哑铃硬拉和推举。',
      enRegression: 'Split it into dumbbell deadlift plus press.',
      zhProgression: '增加重量或改成交替挺举。',
      enProgression: 'Add load or alternate reps.',
    }),
  ],
  arms: [
    compoundLibraryExercise({
      key: 'chin-up',
      zhName: '反握引体',
      enName: 'Chin-up',
      zhMuscles: ['手臂', '背部', '核心'],
      enMuscles: ['Arms', 'Back', 'Core'],
      equipment: 'GYM',
      sets: 4,
      reps: '4-8',
      rpe: 8,
      zhIntent: '以肱二头参与为主的复合拉力',
      enIntent: 'Compound pull with strong biceps contribution',
      zhSteps: ['反握横杠，先收紧肩胛。', '把胸口拉向横杠。', '慢慢下降到手臂伸直。'],
      enSteps: ['Use a supinated grip and set the shoulders.', 'Pull the chest toward the bar.', 'Lower slowly to straight arms.'],
      zhRegression: '弹力带辅助或离心下放。',
      enRegression: 'Use band assistance or eccentric reps.',
      zhProgression: '加负重或顶部停顿。',
      enProgression: 'Add load or pause at the top.',
    }),
    compoundLibraryExercise({
      key: 'close-grip-bench',
      zhName: '窄握卧推',
      enName: 'Close-grip bench press',
      zhMuscles: ['手臂', '胸部', '肩部'],
      enMuscles: ['Arms', 'Chest', 'Shoulders'],
      equipment: 'GYM',
      sets: 4,
      reps: '5',
      rpe: 8,
      zhIntent: '肱三头主导的复合水平推',
      enIntent: 'Triceps-biased compound press',
      zhSteps: ['握距略窄于肩，不要过窄。', '杠铃下降时肘部贴近身体。', '向上推直，手腕保持中立。'],
      enSteps: ['Use a grip slightly narrower than shoulder width.', 'Keep elbows close as the bar lowers.', 'Press up with neutral wrists.'],
      zhRegression: '改成窄距俯卧撑。',
      enRegression: 'Use close-grip push-ups.',
      zhProgression: '增加重量或加入暂停。',
      enProgression: 'Add load or use pauses.',
    }),
    compoundLibraryExercise({
      key: 'weighted-triceps-dip',
      zhName: '负重臂屈伸',
      enName: 'Weighted triceps dip',
      zhMuscles: ['手臂', '胸部', '肩部'],
      enMuscles: ['Arms', 'Chest', 'Shoulders'],
      equipment: 'GYM',
      sets: 3,
      reps: '5-8',
      rpe: 8,
      zhIntent: '肱三头和胸肩协同的复合下压',
      enIntent: 'Compound dip with triceps emphasis',
      zhSteps: ['身体更直立，肩膀下沉。', '下降到肩部可控范围。', '向下压杠回到顶部。'],
      enSteps: ['Stay more upright with shoulders depressed.', 'Descend only to controlled depth.', 'Press down into the bars to return.'],
      zhRegression: '使用辅助器械或自重。',
      enRegression: 'Use assistance or bodyweight only.',
      zhProgression: '加负重但保持肩部稳定。',
      enProgression: 'Add load while shoulders stay stable.',
    }),
    compoundLibraryExercise({
      key: 'farmer-carry',
      zhName: '农夫走',
      enName: 'Farmer carry',
      zhMuscles: ['手臂', '核心', '背部'],
      enMuscles: ['Arms', 'Core', 'Back'],
      equipment: 'DUMBBELL',
      sets: 3,
      reps: '30m',
      rpe: 7,
      zhIntent: '握力、躯干和肩胛稳定的全身负重行走',
      enIntent: 'Loaded carry for grip, trunk, and scapular stability',
      zhSteps: ['两侧重量拿稳，肩膀下沉。', '肋骨收住，步幅自然。', '走完全程不要让重量摆动。'],
      enSteps: ['Hold both loads firmly with shoulders down.', 'Keep ribs down and stride naturally.', 'Finish the distance without swinging the load.'],
      zhRegression: '减轻重量或缩短距离。',
      enRegression: 'Reduce load or shorten distance.',
      zhProgression: '增加重量或延长距离。',
      enProgression: 'Add load or increase distance.',
    }),
  ],
  core: [
    compoundLibraryExercise({
      key: 'turkish-get-up',
      zhName: '土耳其起立',
      enName: 'Turkish get-up',
      zhMuscles: ['核心', '肩部', '腿部'],
      enMuscles: ['Core', 'Shoulders', 'Legs'],
      equipment: 'DUMBBELL',
      sets: 3,
      reps: '2/side',
      rpe: 7,
      zhIntent: '从地面到站立的全身控制动作',
      enIntent: 'Full-body control from floor to standing',
      zhSteps: ['眼睛看重量，先卷到肘部。', '桥起髋部，把腿收回。', '站起和回放都保持手臂垂直。'],
      enSteps: ['Eyes on the weight as you roll to the elbow.', 'Bridge the hips and sweep the leg through.', 'Stand and return with the arm vertical.'],
      zhRegression: '空手练路径。',
      enRegression: 'Practice the path without load.',
      zhProgression: '增加重量但不加速。',
      enProgression: 'Add load without speeding up.',
    }),
    compoundLibraryExercise({
      key: 'front-rack-carry',
      zhName: '前架负重行走',
      enName: 'Front-rack carry',
      zhMuscles: ['核心', '背部', '腿部'],
      enMuscles: ['Core', 'Back', 'Legs'],
      equipment: 'DUMBBELL',
      sets: 3,
      reps: '20m',
      rpe: 7,
      zhIntent: '前架抗伸展，强化跑姿所需躯干刚性',
      enIntent: 'Anti-extension loaded carry for trunk stiffness',
      zhSteps: ['重量放在肩前，肘部略高。', '肋骨向下，骨盆中立。', '小步稳定前进，不后仰。'],
      enSteps: ['Hold loads at the front rack with elbows slightly high.', 'Keep ribs down and pelvis neutral.', 'Walk with small stable steps without leaning back.'],
      zhRegression: '减轻重量或原地站立保持。',
      enRegression: 'Reduce load or hold in place.',
      zhProgression: '增加重量或延长距离。',
      enProgression: 'Add load or extend distance.',
    }),
    compoundLibraryExercise({
      key: 'hanging-leg-raise',
      zhName: '悬垂举腿',
      enName: 'Hanging leg raise',
      zhMuscles: ['核心', '手臂', '背部'],
      enMuscles: ['Core', 'Arms', 'Back'],
      equipment: 'GYM',
      sets: 3,
      reps: '6-10',
      rpe: 7,
      zhIntent: '悬垂抗摆动，强化前侧核心',
      enIntent: 'Hanging anti-swing anterior core work',
      zhSteps: ['肩膀下沉，身体先停稳。', '骨盆后倾，把腿抬起。', '慢慢放下，不借摆动。'],
      enSteps: ['Depress shoulders and stop swinging first.', 'Posteriorly tilt the pelvis and lift the legs.', 'Lower slowly without using momentum.'],
      zhRegression: '改成屈膝举腿。',
      enRegression: 'Use bent-knee raises.',
      zhProgression: '伸直腿或加停顿。',
      enProgression: 'Straighten the legs or add pauses.',
    }),
    compoundLibraryExercise({
      key: 'barbell-rollout',
      zhName: '杠铃滚轮',
      enName: 'Barbell rollout',
      zhMuscles: ['核心', '肩部', '手臂'],
      enMuscles: ['Core', 'Shoulders', 'Arms'],
      equipment: 'GYM',
      sets: 3,
      reps: '6-8',
      rpe: 7,
      zhIntent: '抗伸展核心训练，连接肩带和骨盆',
      enIntent: 'Anti-extension core work linking shoulders and pelvis',
      zhSteps: ['跪姿撑紧臀腹。', '杠铃向前滚到可控距离。', '用核心拉回，不塌腰。'],
      enSteps: ['Brace glutes and abs from kneeling.', 'Roll the bar forward only as far as control allows.', 'Pull back with the core without sagging.'],
      zhRegression: '缩短滚出距离。',
      enRegression: 'Shorten the rollout range.',
      zhProgression: '增加距离或改站姿进阶。',
      enProgression: 'Increase range or progress toward standing.',
    }),
  ],
};
const DEFAULT_CHECK_IN_DRAFT = {
  runType: 'EASY',
  strengthFocus: 'COACH_PICK',
  strengthDose: 'STANDARD',
};
const KM_PER_MILE = 1.60934;

function getProtocolItemKey(item) {
  if (!item) return '';
  if (item.source === 'library') {
    return `library-${item.targetKey || 'target'}-${item.libraryKey || item.exercise?.name || 'exercise'}-${item.exerciseIndex ?? 0}`;
  }
  return `${item.block?.title || 'block'}-${item.exercise?.name || 'exercise'}-${item.globalIndex ?? item.exerciseIndex ?? 0}`;
}

function createLibraryProtocolItem(targetKey, definition, exerciseIndex, globalIndex = 0) {
  return {
    source: 'library',
    targetKey,
    libraryKey: definition.key,
    block: { title: 'COMPOUND_LIBRARY' },
    blockIndex: 999,
    exercise: definition.exercise,
    exerciseIndex,
    globalIndex,
    libraryContent: definition.content,
  };
}

function exerciseMatchesTargetArea(exercise, isZh, targetKey) {
  if (targetKey === 'all') return true;
  const group = TARGET_AREA_GROUPS.find((item) => item.key === targetKey);
  if (!group) return false;
  const exerciseCopy = getExerciseCardContent(exercise, isZh);
  const haystack = [
    exercise?.name,
    exercise?.equipment,
    exercise?.equipmentNeeded,
    exercise?.intent,
    exercise?.tempoOrIntent,
    ...(exerciseCopy?.muscles || []),
  ]
    .filter(Boolean)
    .join(' ');
  return group.match.test(haystack);
}

const EXERCISE_LIBRARY = {
  'Hip airplanes': {
    name: { zh: '髋飞机', en: 'Hip airplanes' },
    muscles: { zh: ['臀部', '核心'], en: ['Glutes', 'Core'] },
    steps: {
      zh: ['单腿站稳，髋部先正对前方。', '像门轴一样慢慢打开再合上骨盆。', '膝盖微屈，躯干不要左右晃动。'],
      en: ['Stand tall on one leg with the hips square.', 'Open and close the pelvis slowly like a hinge.', 'Keep a soft knee and avoid trunk wobble.'],
    },
    intent: { zh: '慢速髋折叠，稳住平衡', en: 'Slow hinge, own the balance' },
    regression: { zh: '用指尖轻扶支撑，并缩小髋部旋转幅度。', en: 'Use fingertip support and shorten the hip rotation.' },
    progression: { zh: '去掉支撑，或每次打开时停 2 秒。', en: 'Remove support or add a 2-second pause in each open position.' },
  },
  'Calf raises (slow tempo)': {
    name: { zh: '慢节奏提踵', en: 'Calf raises (slow tempo)' },
    muscles: { zh: ['小腿'], en: ['Calves'] },
    steps: {
      zh: ['前脚掌稳定发力。', '慢慢提起脚跟，并在顶端停住。', '下放时继续控制，不要直接掉下去。'],
      en: ['Press through the ball of the foot.', 'Rise slowly and pause at the top.', 'Lower with control instead of dropping.'],
    },
    intent: { zh: '慢上慢下，顶端停顿', en: 'Slow up, slow down, pause at the top' },
    regression: { zh: '缩短动作幅度，同时保持前脚掌稳定发力。', en: 'Use a smaller range while keeping pressure through the forefoot.' },
    progression: { zh: '顶端多停 2 秒，或改成单腿版本。', en: 'Add a 2-second pause at the top or bias one leg at a time.' },
  },
  'Dead bug': {
    name: { zh: '死虫', en: 'Dead bug' },
    muscles: { zh: ['核心'], en: ['Core'] },
    steps: {
      zh: ['仰卧，收肋骨，让腰背保持稳定。', '对侧手脚一起向外伸。', '整个过程中不要让下背拱起。'],
      en: ['Lie on your back with the ribs down.', 'Reach the opposite arm and leg away together.', 'Keep the low back quiet and the core braced.'],
    },
    intent: { zh: '呼气、收肋、保持腰背安静', en: 'Exhale and keep ribs down' },
    regression: { zh: '只做脚跟点地，不完全伸直腿。', en: 'Tap the heel instead of extending the full leg.' },
    progression: { zh: '手脚伸展更慢，或每次伸展停 2 秒。', en: 'Extend slower or hold the reach for 2 seconds.' },
  },
  'Split squat': {
    name: { zh: '分腿蹲', en: 'Split squat' },
    muscles: { zh: ['臀部', '腘绳肌'], en: ['Glutes', 'Hamstrings'] },
    steps: {
      zh: ['前后站开，身体保持直立。', '垂直下沉，再通过前脚发力起身。', '前膝跟着脚尖方向走，不要内扣。'],
      en: ['Set up in a split stance.', 'Drop straight down and drive through the front foot.', 'Track the front knee over the toes.'],
    },
    intent: { zh: '3-1-1 节奏', en: '3-1-1 tempo' },
    regression: { zh: '先徒手并缩短下蹲深度，直到前膝轨迹稳定。', en: 'Use bodyweight and shorten depth until the front knee tracks cleanly.' },
    progression: { zh: '增加负重，或在底部停 2 秒。', en: 'Add load or add a 2-second pause at the bottom.' },
  },
  'Single-leg Romanian deadlift': {
    name: { zh: '单腿罗马尼亚硬拉', en: 'Single-leg Romanian deadlift' },
    muscles: { zh: ['臀部', '腘绳肌'], en: ['Glutes', 'Hamstrings'] },
    steps: {
      zh: ['单腿站稳，另一条腿向后伸。', '从髋部折叠，不要弯腰塌背。', '起身时主动夹臀回正。'],
      en: ['Balance on one leg and reach the other leg back.', 'Hinge from the hips instead of rounding forward.', 'Squeeze the glute to return tall.'],
    },
    intent: { zh: '向前伸展，从髋折叠', en: 'Reach long, hinge from the hips' },
    regression: { zh: '用后脚轻点地面，或扶墙保持平衡。', en: 'Use a kickstand or light wall support.' },
    progression: { zh: '增加负重，或在保持髋部控制时伸得更远。', en: 'Add load or increase the forward reach without losing hip control.' },
  },
  'Standing calf raise': {
    name: { zh: '站姿提踵', en: 'Standing calf raise' },
    muscles: { zh: ['小腿'], en: ['Calves'] },
    steps: {
      zh: ['双脚平均受力站稳。', '提起脚跟并保持身体拉长。', '缓慢下放，感受小腿发力。'],
      en: ['Stand evenly through both feet.', 'Lift the heels and stay tall through the body.', 'Lower slowly to load the calves.'],
    },
    intent: { zh: '2 秒上 / 2 秒下，顶端完全停住', en: '2 up / 2 down with full pause' },
    regression: { zh: '双腿同时发力，并缩短顶端停顿。', en: 'Use both legs and reduce the pause length.' },
    progression: { zh: '改成单腿偏重，或在顶端稳定时增加负重。', en: 'Bias one leg at a time or add load when the top position stays crisp.' },
  },
  'Side plank': {
    name: { zh: '侧桥', en: 'Side plank' },
    muscles: { zh: ['核心'], en: ['Core'] },
    steps: {
      zh: ['身体侧向排成一条线。', '主动提髋，不要塌腰。', '保持稳定呼吸，肩颈放松。'],
      en: ['Stack the body in one straight side line.', 'Lift the hips instead of sagging.', 'Breathe steadily and keep the neck relaxed.'],
    },
    intent: { zh: '肋骨叠骨盆，稳定呼吸', en: 'Stack ribs over pelvis' },
    regression: { zh: '下侧膝盖弯曲，增加支撑。', en: 'Bend the bottom knee for extra support.' },
    progression: { zh: '抬起上侧腿，或延长保持时间。', en: 'Lift the top leg or extend the hold if you stay stable.' },
  },
  'Glute bridge (pause at top)': {
    name: { zh: '臀桥（顶端停顿）', en: 'Glute bridge (pause at top)' },
    muscles: { zh: ['臀部', '核心'], en: ['Glutes', 'Core'] },
    steps: {
      zh: ['仰卧屈膝，双脚踩稳。', '把髋抬高到身体成斜线。', '顶端停 1-2 秒，再慢慢放下。'],
      en: ['Lie down with knees bent and feet planted.', 'Drive the hips up into a long line.', 'Pause at the top before lowering.'],
    },
    intent: { zh: '向上驱动，顶端停 2 秒', en: 'Drive up, 2-second pause' },
    regression: { zh: '缩小动作幅度，并让双脚更靠近臀部。', en: 'Use a shorter range and keep both feet close to the hips.' },
    progression: { zh: '桥式中交替抬脚，或在稳定后增加负重。', en: 'March from the bridge or load the hips once the pause is stable.' },
  },
  'Tibialis wall raise': {
    name: { zh: '靠墙胫骨前肌提脚', en: 'Tibialis wall raise' },
    muscles: { zh: ['胫骨前肌'], en: ['Shins'] },
    steps: {
      zh: ['背靠墙或扶稳支撑。', '把前脚掌和脚尖提起来。', '缓慢下放，感受小腿前侧发力。'],
      en: ['Lean back into a stable support.', 'Lift the forefoot and pull the toes up.', 'Lower with control and feel the front of the shin.'],
    },
    intent: { zh: '平顺抬起，控制下放', en: 'Smooth up, controlled down' },
    regression: { zh: '身体更直一些，减小小腿前倾角度。', en: 'Stand more upright with less shin angle.' },
    progression: { zh: '身体更后靠，或延长下放时间。', en: 'Lean further back or add a longer lower phase.' },
  },
  "World's greatest stretch": {
    name: { zh: '世界最强拉伸', en: "World's greatest stretch" },
    muscles: { zh: ['臀部', '核心'], en: ['Glutes', 'Core'] },
    steps: {
      zh: ['进入长弓步位。', '一手撑地，另一手打开胸椎向上转。', '每次动作都带着呼吸和控制。'],
      en: ['Step into a long lunge.', 'One hand stays down while the other opens the chest up.', 'Move slowly and breathe through each rep.'],
    },
    intent: { zh: '慢速移动并配合呼吸', en: 'Move slowly and breathe' },
    regression: { zh: '减少旋转幅度，后膝保持着地。', en: 'Reduce the rotation and keep the back knee down.' },
    progression: { zh: '每次终点多停 2 次呼吸。', en: 'Pause at end-range for 2 breaths.' },
  },
  'Ankle dorsiflexion rocks': {
    name: { zh: '踝背屈前移', en: 'Ankle dorsiflexion rocks' },
    muscles: { zh: ['踝关节'], en: ['Ankles'] },
    steps: {
      zh: ['前脚掌和脚跟都踩稳。', '膝盖向前推，但脚跟不要离地。', '来回轻推，打开踝关节活动度。'],
      en: ['Keep the front foot flat.', 'Drive the knee forward without lifting the heel.', 'Rock in and out to open ankle motion.'],
    },
    intent: { zh: '控制踝关节活动范围', en: 'Controlled ankle motion' },
    regression: { zh: '缩小前移范围，并扶稳支撑。', en: 'Limit range and keep the heel lightly loaded.' },
    progression: { zh: '在脚跟不离地的前提下让膝盖更向前。', en: 'Move the knee further forward while the heel stays planted.' },
  },
  'Step-down (knee tracking)': {
    name: { zh: '台阶下放（膝轨迹）', en: 'Step-down (knee tracking)' },
    muscles: { zh: ['臀部', '核心'], en: ['Glutes', 'Core'] },
    steps: {
      zh: ['站在小台阶上。', '慢慢把另一只脚向地面点下去。', '支撑腿的膝盖始终对准脚尖。'],
      en: ['Stand on a small step.', 'Lower the free foot toward the floor slowly.', 'Keep the stance knee tracking clean over the foot.'],
    },
    intent: { zh: '慢慢下放，保持膝盖轨迹干净', en: 'Slow lower, clean knee path' },
    regression: { zh: '降低台阶高度，或减少触地深度。', en: 'Use a lower step or limit the touch depth.' },
    progression: { zh: '提高台阶高度，或在稳定时增加负重。', en: 'Increase step height or add load when control stays clean.' },
  },
  'Hamstring curl (slider or machine)': {
    name: { zh: '腘绳肌弯曲（滑盘/器械）', en: 'Hamstring curl (slider or machine)' },
    muscles: { zh: ['腘绳肌'], en: ['Hamstrings'] },
    steps: {
      zh: ['先把髋抬稳。', '用脚跟把滑盘或器械拉向身体。', '回程慢放，不要让髋掉下去。'],
      en: ['Start from a stable bridged position.', 'Pull the heels toward the body.', 'Return slowly without dropping the hips.'],
    },
    intent: { zh: '平顺回勾，慢慢还原', en: 'Smooth curl, slow return' },
    regression: { zh: '缩小动作范围，并让髋部略低一些。', en: 'Use a reduced range or keep the hips lower.' },
    progression: { zh: '加入桥式停顿，或放慢离心回程。', en: 'Add a bridge hold or progress to slower eccentrics.' },
  },
  'Pallof press': {
    name: { zh: 'Pallof 抗旋推', en: 'Pallof press' },
    muscles: { zh: ['核心'], en: ['Core'] },
    steps: {
      zh: ['站稳，阻力从身体侧面来。', '双手向前推直。', '全程抗住身体被带偏。'],
      en: ['Stand tall with the resistance pulling from the side.', 'Press the hands straight out.', 'Fight rotation and keep the torso quiet.'],
    },
    intent: { zh: '收紧核心，前推并抗旋转', en: 'Brace, press, resist rotation' },
    regression: { zh: '缩短前推距离，或更靠近固定点。', en: 'Shorten the press range or step closer to the anchor.' },
    progression: { zh: '离固定点更远，或前推时停 2 秒。', en: 'Step further from the anchor or hold the press for 2 seconds.' },
  },
  'Farmer carry (suitcase)': {
    name: { zh: '单侧农夫行走', en: 'Farmer carry (suitcase)' },
    muscles: { zh: ['核心', '臀部'], en: ['Core', 'Glutes'] },
    steps: {
      zh: ['单手提起重量并站高。', '走路时身体不要向任何一侧倾斜。', '步幅短一点，保持躯干稳定。'],
      en: ['Carry the load in one hand and stand tall.', 'Do not lean toward or away from the weight.', 'Walk with short steady steps and a braced trunk.'],
    },
    intent: { zh: '站高，不向一侧倾斜', en: 'Tall posture, no side bend' },
    regression: { zh: '减轻重量，并缩短行走距离。', en: 'Use a lighter load and a shorter carry lane.' },
    progression: { zh: '加重，或在不侧倾的前提下走更远。', en: 'Carry heavier or add a longer distance without leaning.' },
  },
  'Pogo hops': {
    name: { zh: 'Pogo 弹跳', en: 'Pogo hops' },
    muscles: { zh: ['小腿'], en: ['Calves'] },
    steps: {
      zh: ['像弹簧一样通过脚踝快速反弹。', '动作要短、轻、快。', '身体保持高，不要变成深蹲跳。'],
      en: ['Bounce through the ankles like springs.', 'Keep the contacts short, light, and quick.', 'Stay tall instead of turning it into a squat jump.'],
    },
    intent: { zh: '短、轻、快的弹性触地', en: 'Short, light, springy contacts' },
    regression: { zh: '改成快速提踵，不离地。', en: 'Turn it into rapid calf raises without leaving the ground.' },
    progression: { zh: '提高反弹刚性，而不是跳得更高。', en: 'Increase rebound stiffness, not jump height.' },
  },
  'Skipping A-drill': {
    name: { zh: 'A Skip 抬腿跳步', en: 'Skipping A-drill' },
    muscles: { zh: ['臀部', '核心'], en: ['Glutes', 'Core'] },
    steps: {
      zh: ['抬膝到接近髋高。', '脚下快速回弹，落点在身体正下方。', '手臂自然配合节奏。'],
      en: ['Lift the knee to around hip height.', 'Strike quickly under the body and bounce out.', 'Let the arms match the rhythm.'],
    },
    intent: { zh: '先找节奏，再抬高度', en: 'Rhythm first, then height' },
    regression: { zh: '改成 A march 走步版。', en: 'March the pattern instead of skipping.' },
    progression: { zh: '在保持触地干净的前提下提速。', en: 'Increase speed while keeping the contacts crisp.' },
  },
  'Box step-up (explosive)': {
    name: { zh: '爆发式箱上踏步', en: 'Box step-up (explosive)' },
    muscles: { zh: ['臀部', '小腿'], en: ['Glutes', 'Calves'] },
    steps: {
      zh: ['整只脚踩上台面。', '快速向上驱动身体。', '下台时轻一点，不要砸地。'],
      en: ['Plant the whole foot on the box.', 'Drive up fast through the stance leg.', 'Step down softly with control.'],
    },
    intent: { zh: '快速上台，轻柔下台', en: 'Fast up, soft down' },
    regression: { zh: '降低台阶高度，并控制驱动力。', en: 'Use a lower step and control the drive.' },
    progression: { zh: '提高台阶，或增加轻负重但不砸地。', en: 'Use a higher step or add light load without stomping.' },
  },
  'Single-leg hop (low amplitude)': {
    name: { zh: '单腿低幅弹跳', en: 'Single-leg hop (low amplitude)' },
    muscles: { zh: ['小腿', '核心'], en: ['Calves', 'Core'] },
    steps: {
      zh: ['单腿轻弹，不追求跳得很高。', '落地时膝盖保持稳定。', '每一下都像干净的小反弹。'],
      en: ['Hop lightly on one leg without chasing height.', 'Land with a quiet stable knee.', 'Think of crisp elastic contacts each rep.'],
    },
    intent: { zh: '快速而有弹性的触地', en: 'Quick elastic contacts' },
    regression: { zh: '改成双腿 pogo 弹跳。', en: 'Use double-leg pogo contacts instead.' },
    progression: { zh: '增加高质量触地次数，不追求更高离地。', en: 'Increase the number of crisp contacts, not the height.' },
  },
};

const FALLBACK_EXERCISE_COPY = {
  name: { zh: '跑者力量动作', en: 'Runner strength exercise' },
  muscles: { zh: ['跑者力量'], en: ['Runner strength'] },
  steps: {
    zh: ['先把身体站稳。', '全程控制动作。', '保持均匀呼吸。'],
    en: ['Set your body first.', 'Move with control.', 'Keep your breathing steady.'],
  },
  intent: { zh: '平稳发力，控制节奏', en: 'Move with steady control' },
  regression: { zh: '先缩小动作范围，保证动作质量。', en: 'Reduce the range until the movement feels clean.' },
  progression: { zh: '动作稳定后再增加负荷或难度。', en: 'Add load or difficulty once the movement stays crisp.' },
};

const LOCALIZED_EXERCISE_LIBRARY = {
  'Hip airplanes': {
    name: { zh: '髋飞机', en: 'Hip airplanes' },
    muscles: { zh: ['臀部', '核心'], en: ['Glutes', 'Core'] },
    steps: {
      zh: ['单腿站稳，髋部先正对前方。', '像门轴一样缓慢打开再合上骨盆。', '膝盖微屈，躯干不要左右晃。'],
      en: ['Stand tall on one leg with the hips square.', 'Open and close the pelvis slowly like a hinge.', 'Keep a soft knee and avoid trunk wobble.'],
    },
    intent: { zh: '慢速髋折叠，稳住平衡', en: 'Slow hinge, own the balance' },
    regression: { zh: '用指尖轻扶支撑，并缩小髋部旋转幅度。', en: 'Use fingertip support and shorten the hip rotation.' },
    progression: { zh: '去掉支撑，或每次打开时停 2 秒。', en: 'Remove support or add a 2-second pause in each open position.' },
  },
  'Calf raises (slow tempo)': {
    name: { zh: '慢速提踵', en: 'Calf raises (slow tempo)' },
    muscles: { zh: ['小腿'], en: ['Calves'] },
    steps: {
      zh: ['前脚掌稳稳踩地。', '慢慢提起脚跟，并在顶部稍停。', '下放时继续控制，不要直接掉下去。'],
      en: ['Press through the ball of the foot.', 'Rise slowly and pause at the top.', 'Lower with control instead of dropping.'],
    },
    intent: { zh: '慢上慢下，顶部停顿', en: 'Slow up, slow down, pause at the top' },
    regression: { zh: '缩小动作幅度，但保持前脚掌稳定发力。', en: 'Use a smaller range while keeping pressure through the forefoot.' },
    progression: { zh: '顶部多停 2 秒，或改成单腿偏重。', en: 'Add a 2-second pause at the top or bias one leg at a time.' },
  },
  'Dead bug': {
    name: { zh: '死虫', en: 'Dead bug' },
    muscles: { zh: ['核心'], en: ['Core'] },
    steps: {
      zh: ['仰卧，收肋骨，让腰背贴稳。', '对侧手脚一起向外伸远。', '全程不要让下背拱起来。'],
      en: ['Lie on your back with the ribs down.', 'Reach the opposite arm and leg away together.', 'Keep the low back quiet and the core braced.'],
    },
    intent: { zh: '呼气、收肋、保持腰背安静', en: 'Exhale and keep ribs down' },
    regression: { zh: '只做脚跟点地，不完全伸直腿。', en: 'Tap the heel instead of extending the full leg.' },
    progression: { zh: '伸展更慢，或每次伸远时停 2 秒。', en: 'Extend slower or hold the reach for 2 seconds.' },
  },
  'Split squat': {
    name: { zh: '分腿蹲', en: 'Split squat' },
    muscles: { zh: ['臀部', '腘绳肌'], en: ['Glutes', 'Hamstrings'] },
    steps: {
      zh: ['前后站开，身体保持直立。', '垂直下沉，再通过前脚发力起身。', '前膝跟着脚尖方向走，不要内扣。'],
      en: ['Set up in a split stance.', 'Drop straight down and drive through the front foot.', 'Track the front knee over the toes.'],
    },
    intent: { zh: '3-1-1 节奏', en: '3-1-1 tempo' },
    regression: { zh: '先徒手并缩短下蹲深度，直到前膝轨迹稳定。', en: 'Use bodyweight and shorten depth until the front knee tracks cleanly.' },
    progression: { zh: '增加负重，或在底部停 2 秒。', en: 'Add load or add a 2-second pause at the bottom.' },
  },
  'Single-leg Romanian deadlift': {
    name: { zh: '单腿罗马尼亚硬拉', en: 'Single-leg Romanian deadlift' },
    muscles: { zh: ['臀部', '腘绳肌'], en: ['Glutes', 'Hamstrings'] },
    steps: {
      zh: ['单腿站稳，另一条腿向后伸。', '从髋部折叠，不要弯腰塌背。', '起身时主动夹臀回正。'],
      en: ['Balance on one leg and reach the other leg back.', 'Hinge from the hips instead of rounding forward.', 'Squeeze the glute to return tall.'],
    },
    intent: { zh: '向前伸远，从髋折叠', en: 'Reach long, hinge from the hips' },
    regression: { zh: '用后脚轻点地面，或扶墙保持平衡。', en: 'Use a kickstand or light wall support.' },
    progression: { zh: '增加负重，或在保持髋部控制时伸得更远。', en: 'Add load or increase the forward reach without losing hip control.' },
  },
  'Standing calf raise': {
    name: { zh: '站姿提踵', en: 'Standing calf raise' },
    muscles: { zh: ['小腿'], en: ['Calves'] },
    steps: {
      zh: ['双脚均匀受力站稳。', '提起脚跟并保持身体拉长。', '缓慢下放，感受小腿发力。'],
      en: ['Stand evenly through both feet.', 'Lift the heels and stay tall through the body.', 'Lower slowly to load the calves.'],
    },
    intent: { zh: '2 秒上 / 2 秒下，顶部完整停顿', en: '2 up / 2 down with full pause' },
    regression: { zh: '双脚同时发力，并缩短顶部停顿。', en: 'Use both legs and reduce the pause length.' },
    progression: { zh: '改单腿偏重，或在顶部稳定后增加负重。', en: 'Bias one leg at a time or add load when the top position stays crisp.' },
  },
  'Side plank': {
    name: { zh: '侧桥', en: 'Side plank' },
    muscles: { zh: ['核心'], en: ['Core'] },
    steps: {
      zh: ['身体侧向排成一条线。', '主动提髋，不要塌腰。', '保持均匀呼吸，肩颈放松。'],
      en: ['Stack the body in one straight side line.', 'Lift the hips instead of sagging.', 'Breathe steadily and keep the neck relaxed.'],
    },
    intent: { zh: '肋骨叠骨盆，稳定呼吸', en: 'Stack ribs over pelvis' },
    regression: { zh: '下侧膝盖弯曲，增加支撑。', en: 'Bend the bottom knee for extra support.' },
    progression: { zh: '抬起上侧腿，或延长保持时间。', en: 'Lift the top leg or extend the hold if you stay stable.' },
  },
  'Glute bridge (pause at top)': {
    name: { zh: '臀桥（顶部停顿）', en: 'Glute bridge (pause at top)' },
    muscles: { zh: ['臀部', '核心'], en: ['Glutes', 'Core'] },
    steps: {
      zh: ['仰卧屈膝，双脚踩稳。', '把髋抬高到身体成斜线。', '顶部停 1-2 秒，再慢慢放下。'],
      en: ['Lie down with knees bent and feet planted.', 'Drive the hips up into a long line.', 'Pause at the top before lowering.'],
    },
    intent: { zh: '向上驱动，顶部停 2 秒', en: 'Drive up, 2-second pause' },
    regression: { zh: '缩小动作幅度，并让双脚更靠近臀部。', en: 'Use a shorter range and keep both feet close to the hips.' },
    progression: { zh: '桥式中交替抬脚，或在稳定后增加负重。', en: 'March from the bridge or load the hips once the pause is stable.' },
  },
  'Tibialis wall raise': {
    name: { zh: '靠墙胫前肌抬脚', en: 'Tibialis wall raise' },
    muscles: { zh: ['胫骨前肌'], en: ['Shins'] },
    steps: {
      zh: ['背靠墙或扶稳支撑。', '把前脚掌和脚尖抬起来。', '缓慢下放，感受胫前肌发力。'],
      en: ['Lean back into a stable support.', 'Lift the forefoot and pull the toes up.', 'Lower with control and feel the front of the shin.'],
    },
    intent: { zh: '平顺抬起，控制下放', en: 'Smooth up, controlled down' },
    regression: { zh: '身体更直一些，减小胫前角度。', en: 'Stand more upright with less shin angle.' },
    progression: { zh: '身体更后靠，或延长下放时间。', en: 'Lean further back or add a longer lower phase.' },
  },
  "World's greatest stretch": {
    name: { zh: '世界最强拉伸', en: "World's greatest stretch" },
    muscles: { zh: ['臀部', '核心'], en: ['Glutes', 'Core'] },
    steps: {
      zh: ['进入长弓步位。', '一手撑地，另一手打开胸腔向上转。', '每次动作都配合呼吸与控制。'],
      en: ['Step into a long lunge.', 'One hand stays down while the other opens the chest up.', 'Move slowly and breathe through each rep.'],
    },
    intent: { zh: '慢速移动并配合呼吸', en: 'Move slowly and breathe' },
    regression: { zh: '减少旋转幅度，并让后膝着地。', en: 'Reduce the rotation and keep the back knee down.' },
    progression: { zh: '每次终点多停 2 次呼吸。', en: 'Pause at end-range for 2 breaths.' },
  },
  'Ankle dorsiflexion rocks': {
    name: { zh: '踝背屈前移', en: 'Ankle dorsiflexion rocks' },
    muscles: { zh: ['踝关节'], en: ['Ankles'] },
    steps: {
      zh: ['前脚掌和脚跟都踩稳。', '膝盖向前推，但脚跟不要离地。', '来回轻推，找到踝关节活动度。'],
      en: ['Keep the front foot flat.', 'Drive the knee forward without lifting the heel.', 'Rock in and out to open ankle motion.'],
    },
    intent: { zh: '控制踝关节活动范围', en: 'Controlled ankle motion' },
    regression: { zh: '缩小前移范围，并保持脚跟轻压地面。', en: 'Limit range and keep the heel lightly loaded.' },
    progression: { zh: '在脚跟不离地的前提下让膝盖更向前。', en: 'Move the knee further forward while the heel stays planted.' },
  },
  'Step-down (knee tracking)': {
    name: { zh: '台阶下放（膝轨迹）', en: 'Step-down (knee tracking)' },
    muscles: { zh: ['臀部', '核心'], en: ['Glutes', 'Core'] },
    steps: {
      zh: ['站在小台阶上。', '慢慢把另一只脚向地面点下去。', '支撑腿的膝盖始终对准脚尖。'],
      en: ['Stand on a small step.', 'Lower the free foot toward the floor slowly.', 'Keep the stance knee tracking clean over the foot.'],
    },
    intent: { zh: '慢慢下放，保持膝盖轨迹干净', en: 'Slow lower, clean knee path' },
    regression: { zh: '降低台阶高度，或减少触地深度。', en: 'Use a lower step or limit the touch depth.' },
    progression: { zh: '提高台阶高度，或在稳定时增加负重。', en: 'Increase step height or add load when control stays clean.' },
  },
  'Hamstring curl (slider or machine)': {
    name: { zh: '腘绳肌弯举（滑盘/器械）', en: 'Hamstring curl (slider or machine)' },
    muscles: { zh: ['腘绳肌'], en: ['Hamstrings'] },
    steps: {
      zh: ['先把髋顶稳。', '用脚跟把滑盘或器械拉向身体。', '回程慢放，不要让髋掉下去。'],
      en: ['Start from a stable bridged position.', 'Pull the heels toward the body.', 'Return slowly without dropping the hips.'],
    },
    intent: { zh: '平顺回勾，慢慢还原', en: 'Smooth curl, slow return' },
    regression: { zh: '缩小动作范围，并让髋略低一些。', en: 'Use a reduced range or keep the hips lower.' },
    progression: { zh: '加入桥式停顿，或放慢离心回程。', en: 'Add a bridge hold or progress to slower eccentrics.' },
  },
  'Pallof press': {
    name: { zh: 'Pallof 抗旋推', en: 'Pallof press' },
    muscles: { zh: ['核心'], en: ['Core'] },
    steps: {
      zh: ['站稳，阻力从身体侧面来。', '双手向前推出。', '全程抵抗身体被带偏。'],
      en: ['Stand tall with the resistance pulling from the side.', 'Press the hands straight out.', 'Fight rotation and keep the torso quiet.'],
    },
    intent: { zh: '收紧核心，前推并抗旋转', en: 'Brace, press, resist rotation' },
    regression: { zh: '缩短前推距离，或更靠近固定点。', en: 'Shorten the press range or step closer to the anchor.' },
    progression: { zh: '离固定点更远，或前推时停 2 秒。', en: 'Step further from the anchor or hold the press for 2 seconds.' },
  },
  'Farmer carry (suitcase)': {
    name: { zh: '单侧农夫行走', en: 'Farmer carry (suitcase)' },
    muscles: { zh: ['核心', '臀部'], en: ['Core', 'Glutes'] },
    steps: {
      zh: ['单手提起重量并站高。', '走路时身体不要向任一侧倾斜。', '步幅短一点，保持躯干稳定。'],
      en: ['Carry the load in one hand and stand tall.', 'Do not lean toward or away from the weight.', 'Walk with short steady steps and a braced trunk.'],
    },
    intent: { zh: '站高，不向一侧倾斜', en: 'Tall posture, no side bend' },
    regression: { zh: '减轻重量，并缩短行走距离。', en: 'Use a lighter load and a shorter carry lane.' },
    progression: { zh: '加重，或在不侧倾的前提下走更远。', en: 'Carry heavier or add a longer distance without leaning.' },
  },
  'Pogo hops': {
    name: { zh: 'Pogo 弹跳', en: 'Pogo hops' },
    muscles: { zh: ['小腿'], en: ['Calves'] },
    steps: {
      zh: ['像弹簧一样通过脚踝快速反弹。', '动作要短、轻、快。', '身体保持高，不要变成深蹲跳。'],
      en: ['Bounce through the ankles like springs.', 'Keep the contacts short, light, and quick.', 'Stay tall instead of turning it into a squat jump.'],
    },
    intent: { zh: '短、轻、快的弹性触地', en: 'Short, light, springy contacts' },
    regression: { zh: '改成快速提踵，不离地。', en: 'Turn it into rapid calf raises without leaving the ground.' },
    progression: { zh: '提高反弹刚性，而不是跳得更高。', en: 'Increase rebound stiffness, not jump height.' },
  },
  'Skipping A-drill': {
    name: { zh: 'A Skip 跳步', en: 'Skipping A-drill' },
    muscles: { zh: ['臀部', '核心'], en: ['Glutes', 'Core'] },
    steps: {
      zh: ['抬膝到接近髋高。', '脚下快速回弹，落点在身体正下方。', '手臂自然配合节奏。'],
      en: ['Lift the knee to around hip height.', 'Strike quickly under the body and bounce out.', 'Let the arms match the rhythm.'],
    },
    intent: { zh: '先找节奏，再抬高度', en: 'Rhythm first, then height' },
    regression: { zh: '改成 A march 行进版。', en: 'March the pattern instead of skipping.' },
    progression: { zh: '在保持节奏的前提下增加前进速度。', en: 'Add more forward speed without losing rhythm.' },
  },
  'Box step-up (explosive)': {
    name: { zh: '爆发式箱上踏步', en: 'Box step-up (explosive)' },
    muscles: { zh: ['臀部', '小腿'], en: ['Glutes', 'Calves'] },
    steps: {
      zh: ['一脚稳踩台面。', '通过支撑腿快速把身体带上去。', '下放时轻柔回到地面。'],
      en: ['Plant one foot firmly on the box.', 'Drive fast through the stance leg to rise.', 'Step down softly under control.'],
    },
    intent: { zh: '快上、轻下、保持干净发力', en: 'Fast up, soft down' },
    regression: { zh: '降低台面高度，改成稳定踏步。', en: 'Use a lower box and turn it into a controlled step-up.' },
    progression: { zh: '提高爆发速度，或在动作干净后增加负重。', en: 'Increase speed or add load once the movement stays sharp.' },
  },
  'Single-leg hop (low amplitude)': {
    name: { zh: '单腿小幅弹跳', en: 'Single-leg hop (low amplitude)' },
    muscles: { zh: ['小腿', '臀部'], en: ['Calves', 'Glutes'] },
    steps: {
      zh: ['单腿轻轻弹离地面。', '落地短而快，保持脚踝弹性。', '髋膝脚保持对齐。'],
      en: ['Hop lightly off one leg.', 'Keep the landings short and springy.', 'Stack hip, knee, and foot on each contact.'],
    },
    intent: { zh: '快速、轻盈、稳定触地', en: 'Quick elastic contacts' },
    regression: { zh: '改成双腿 pogo 弹跳。', en: 'Use double-leg pogo contacts instead.' },
    progression: { zh: '增加高质量触地次数，而不是追求更高离地。', en: 'Increase the number of crisp contacts, not the height.' },
  },
};

const EXERCISE_HEATMAP_SLUGS = {
  'barbell-bench-press': ['chest', 'triceps', 'deltoids'],
  'incline-dumbbell-press': ['chest', 'deltoids', 'triceps'],
  'weighted-dip': ['chest', 'triceps', 'deltoids'],
  'push-up': ['chest', 'triceps', 'deltoids', 'abs'],
  'pull-up': ['upper-back', 'biceps', 'forearm', 'abs'],
  'barbell-row': ['upper-back', 'lower-back', 'biceps', 'forearm', 'abs'],
  'romanian-deadlift': ['hamstring', 'gluteal', 'lower-back'],
  'chest-supported-row': ['upper-back', 'biceps', 'forearm'],
  'barbell-squat': ['quadriceps', 'gluteal', 'hamstring', 'adductors', 'abs', 'lower-back'],
  'front-squat': ['quadriceps', 'gluteal', 'adductors', 'abs', 'upper-back', 'lower-back'],
  deadlift: ['hamstring', 'gluteal', 'quadriceps', 'lower-back', 'upper-back', 'forearm'],
  'bulgarian-split-squat': ['quadriceps', 'gluteal', 'hamstring', 'adductors', 'abs'],
  'barbell-hip-thrust': ['gluteal', 'hamstring', 'quadriceps', 'abs'],
  'single-leg-leg-press': ['quadriceps', 'gluteal', 'hamstring', 'adductors', 'abs'],
  'glute-ham-raise': ['hamstring', 'gluteal', 'calves', 'lower-back'],
  'squat-jump': ['quadriceps', 'gluteal', 'hamstring', 'calves', 'abs'],
  'standing-overhead-press': ['deltoids', 'triceps', 'trapezius', 'abs'],
  'push-press': ['deltoids', 'triceps', 'quadriceps', 'gluteal', 'calves', 'abs'],
  'landmine-press': ['deltoids', 'chest', 'triceps', 'abs', 'obliques'],
  'dumbbell-clean-press': ['deltoids', 'triceps', 'quadriceps', 'gluteal', 'hamstring', 'calves', 'abs', 'trapezius'],
  'chin-up': ['biceps', 'upper-back', 'forearm', 'abs'],
  'close-grip-bench': ['triceps', 'chest', 'deltoids'],
  'weighted-triceps-dip': ['triceps', 'chest', 'deltoids'],
  'farmer-carry': ['forearm', 'hands', 'trapezius', 'upper-back', 'abs', 'obliques'],
  'turkish-get-up': ['abs', 'obliques', 'deltoids', 'triceps', 'quadriceps', 'gluteal'],
  'front-rack-carry': ['abs', 'obliques', 'upper-back', 'trapezius', 'quadriceps', 'gluteal'],
  'hanging-leg-raise': ['abs', 'obliques', 'forearm', 'upper-back'],
  'barbell-rollout': ['abs', 'obliques', 'deltoids', 'triceps'],

  'Hip airplanes': ['gluteal', 'hamstring', 'abs', 'obliques'],
  'Calf raises (slow tempo)': ['calves'],
  'Dead bug': ['abs', 'obliques'],
  'Split squat': ['quadriceps', 'gluteal', 'hamstring', 'adductors'],
  'Single-leg Romanian deadlift': ['hamstring', 'gluteal', 'lower-back', 'calves'],
  'Standing calf raise': ['calves'],
  'Side plank': ['obliques', 'abs', 'deltoids'],
  'Glute bridge (pause at top)': ['gluteal', 'hamstring', 'abs'],
  'Tibialis wall raise': ['tibialis'],
  "World's greatest stretch": ['gluteal', 'hamstring', 'abs', 'obliques', 'chest'],
  'Ankle dorsiflexion rocks': ['ankles', 'tibialis', 'calves'],
  'Step-down (knee tracking)': ['quadriceps', 'gluteal', 'hamstring', 'adductors'],
  'Hamstring curl (slider or machine)': ['hamstring', 'gluteal'],
  'Pallof press': ['abs', 'obliques'],
  'Farmer carry (suitcase)': ['forearm', 'hands', 'abs', 'obliques', 'trapezius', 'gluteal'],
  'Pogo hops': ['calves'],
  'Skipping A-drill': ['quadriceps', 'gluteal', 'calves', 'tibialis', 'abs'],
  'Box step-up (explosive)': ['quadriceps', 'gluteal', 'hamstring', 'calves'],
  'Single-leg hop (low amplitude)': ['calves', 'quadriceps', 'gluteal', 'tibialis', 'abs'],
};

const EXERCISE_COPY_FIELDS = ['name', 'muscles', 'steps', 'intent', 'regression', 'progression'];

function normalizeExerciseName(name) {
  return name || '';
}

function getExerciseDefinition(name) {
  return LOCALIZED_EXERCISE_LIBRARY[normalizeExerciseName(name)] || null;
}

function hasLocalizedExerciseContent(definition, locale) {
  if (!definition) return false;
  return EXERCISE_COPY_FIELDS.every((field) => {
    const value = definition[field]?.[locale];
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function mapWorkoutTypeToCheckInType(workoutType) {
  switch (workoutType) {
    case 'THRESHOLD':
    case 'TEMPO':
    case 'INTERVALS':
    case 'QUALITY':
      return 'QUALITY';
    case 'LONG_RUN':
      return 'LONG_RUN';
    case 'RECOVERY':
      return 'RECOVERY';
    case 'CROSS_TRAIN':
      return 'CROSS_TRAIN';
    case 'REST':
      return 'REST';
    case 'EASY':
    default:
      return 'EASY';
  }
}

function parseCustomStrengthSessionType(sessionType) {
  const match = /^CUSTOM_(.+)_(MICRO|STANDARD|STRONG)$/.exec(sessionType || '');
  if (!match) return null;
  return {
    focus: match[1],
    dose: match[2],
  };
}

function inferStrengthFocus(sessionType) {
  return parseCustomStrengthSessionType(sessionType)?.focus || DEFAULT_CHECK_IN_DRAFT.strengthFocus;
}

function inferStrengthDose(sessionType) {
  return parseCustomStrengthSessionType(sessionType)?.dose || DEFAULT_CHECK_IN_DRAFT.strengthDose;
}

function resolveStrengthCoachGridDecision(plan) {
  const firstStrengthDay = (plan?.days || []).find((day) => day?.strength);
  const sessionType = firstStrengthDay?.strength?.sessionType;
  const engineDecision = plan?.strengthCoachDecision;
  const appliedFocus = engineDecision ? engineDecision.appliedFocus : plan?.recommendedMuscleArea;
  const appliedDose = engineDecision ? engineDecision.appliedDose : inferStrengthDose(sessionType);
  return {
    ...(engineDecision || {}),
    appliedFocus,
    appliedDose,
    displayFocus: appliedFocus || plan?.recommendedMuscleArea || null,
    targetKey: FOCUS_TO_TARGET_AREA[appliedFocus || plan?.recommendedMuscleArea] || 'legs',
  };
}

function buildCheckInDraft(plan, isMile) {
  const today = Array.isArray(plan?.days) ? plan.days[0] : null;
  const checkIn = plan?.todayCheckIn;
  const sessionType = checkIn?.strengthSessionType || today?.strength?.sessionType;
  const coachDecision = resolveStrengthCoachGridDecision(plan);
  if (checkIn) {
    return {
      runType: checkIn.runType || DEFAULT_CHECK_IN_DRAFT.runType,
      entryState: checkIn.entryState || DEFAULT_CHECK_IN_DRAFT.entryState,
      distanceKm: checkIn.distanceKm != null ? (isMile ? checkIn.distanceKm / KM_PER_MILE : checkIn.distanceKm) : '',
      durationMinutes: checkIn.durationMinutes ?? '',
      strengthFocus: checkIn.strengthFocus || inferStrengthFocus(sessionType),
      strengthDose: checkIn.strengthDose || inferStrengthDose(sessionType),
    };
  }
  return {
    runType: mapWorkoutTypeToCheckInType(today?.run?.workoutType),
    entryState: 'PLANNED',
    distanceKm: today?.run?.plannedDistanceKm != null ? (isMile ? today.run.plannedDistanceKm / KM_PER_MILE : today.run.plannedDistanceKm) : '',
    durationMinutes: today?.run?.plannedDurationMinutes ?? '',
    // Pre-fill the coach's recommended focus (Today's Strength Focus) when no
    // check-in exists yet; the user can still override in the composer.
    strengthFocus: coachDecision.displayFocus || inferStrengthFocus(sessionType),
    strengthDose: coachDecision.appliedDose || inferStrengthDose(sessionType),
  };
}

function pickLabel(map, key, fallback = '-') {
  if (!key) return fallback;
  return map[key] || fallback || key;
}

function pickStrengthSessionLabel(copy, sessionType, fallback = '') {
  const custom = parseCustomStrengthSessionType(sessionType);
  if (!custom) return pickLabel(copy.sessionEmphasis, sessionType, fallback);
  const focusLabel = pickLabel(copy.strengthFocusOptions, custom.focus, custom.focus);
  const doseLabel = pickLabel(copy.strengthDoseOptions, custom.dose, custom.dose);
  return [focusLabel, doseLabel].filter(Boolean).join(' · ');
}

function trimNumber(value, digits = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits)).toString();
}

function formatShortDate(date, displayLang) {
  if (!date) return '-';
  try {
    const locale = displayLang === 'zh-CN' ? 'zh-CN' : 'en-US';
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
  } catch {
    return date;
  }
}

function formatDistance(km, isZh, isMile) {
  const value = formatDistanceValue(km, isMile);
  if (value == null) return '-';
  return `${value} ${isMile ? (isZh ? '\u82f1\u91cc' : 'mi') : (isZh ? '\u516c\u91cc' : 'km')}`;
}

function formatDistanceValue(km, isMile, digits = 1) {
  const unitValue = typeof km === 'number' ? (isMile ? km / KM_PER_MILE : km) : km;
  return trimNumber(unitValue, digits);
}

function formatMinutes(minutes, isZh) {
  if (typeof minutes !== 'number' || Number.isNaN(minutes)) return '-';
  return `${minutes} ${isZh ? '分钟' : 'min'}`;
}

function formatLocalizedExercisePrescriptionValue(repsOrDuration, isZh) {
  if (!isZh || !repsOrDuration) return repsOrDuration;
  return repsOrDuration
    .replace(/\/side\b/gi, '/侧')
    .replace(/(\d+(?:-\d+)?)s(?=\/|$|\b)/g, '$1 秒')
    .replace(/(\d+(?:-\d+)?)m(?=\/|$|\b)/g, '$1 米');
}

function formatLocalizedExercisePrescription(exercise, isZh) {
  const multiplier = isZh ? '×' : 'x';
  return `${exercise.sets} ${multiplier} ${formatLocalizedExercisePrescriptionValue(exercise.repsOrDuration, isZh)} · RPE ${exercise.targetRpe}`;
}

function getExerciseCardContent(exercise, isZh) {
  const definition = getExerciseDefinition(exercise?.name);
  const locale = isZh && hasLocalizedExerciseContent(definition, 'zh') ? 'zh' : 'en';
  const fallbackName = normalizeExerciseName(exercise?.name) || FALLBACK_EXERCISE_COPY.name[locale];
  const useEnglishFallback = locale === 'en';
  return {
    locale,
    name: definition?.name?.[locale] || fallbackName,
    muscles: definition?.muscles?.[locale] || FALLBACK_EXERCISE_COPY.muscles[locale],
    steps: definition?.steps?.[locale] || FALLBACK_EXERCISE_COPY.steps[locale],
    intent: definition?.intent?.[locale] || (useEnglishFallback ? exercise?.tempoOrIntent : null) || FALLBACK_EXERCISE_COPY.intent[locale],
    regression: definition?.regression?.[locale] || (useEnglishFallback ? exercise?.regression : null) || FALLBACK_EXERCISE_COPY.regression[locale],
    progression: definition?.progression?.[locale] || (useEnglishFallback ? exercise?.progression : null) || FALLBACK_EXERCISE_COPY.progression[locale],
  };
}

function getExerciseContentForItem(item, isZh) {
  if (item?.source === 'library' && item.libraryContent) {
    const locale = isZh ? 'zh' : 'en';
    return {
      locale,
      name: item.libraryContent.name?.[locale] || item.libraryContent.name?.en || normalizeExerciseName(item.exercise?.name),
      muscles: item.libraryContent.muscles?.[locale] || item.libraryContent.muscles?.en || [],
      steps: item.libraryContent.steps?.[locale] || item.libraryContent.steps?.en || [],
      intent: item.libraryContent.intent?.[locale] || item.libraryContent.intent?.en || item.exercise?.tempoOrIntent || '',
      regression: item.libraryContent.regression?.[locale] || item.libraryContent.regression?.en || '',
      progression: item.libraryContent.progression?.[locale] || item.libraryContent.progression?.en || '',
    };
  }
  return getExerciseCardContent(item?.exercise, isZh);
}

function getExerciseHeatmapSlugs(item, exerciseCopy) {
  const possibleKeys = [
    item?.libraryKey,
    normalizeExerciseName(item?.exercise?.name),
    slugExerciseName(item?.exercise?.name),
  ].filter(Boolean);
  const explicitSlugs = possibleKeys.map((key) => EXERCISE_HEATMAP_SLUGS[key]).find(Boolean);
  return explicitSlugs || muscleSlugsForExercise(exerciseCopy.muscles || []);
}

function getExerciseVideoUrl(name) {
  const queries = {
    'Hip airplanes': 'hip airplanes exercise demo',
    'Calf raises (slow tempo)': 'slow tempo calf raise exercise demo',
    'Dead bug': 'dead bug exercise demo',
    'Split squat': 'split squat exercise demo',
    'Single-leg Romanian deadlift': 'single leg romanian deadlift exercise demo',
    'Standing calf raise': 'standing calf raise exercise demo',
    'Side plank': 'side plank exercise demo',
    'Glute bridge (pause at top)': 'glute bridge pause at top exercise demo',
    'Tibialis wall raise': 'tibialis wall raise exercise demo',
    "World's greatest stretch": 'world greatest stretch exercise demo',
    'Ankle dorsiflexion rocks': 'ankle dorsiflexion rocks exercise demo',
    'Step-down (knee tracking)': 'step down knee tracking exercise demo',
    'Hamstring curl (slider or machine)': 'hamstring slider curl exercise demo',
    'Pallof press': 'pallof press exercise demo',
    'Farmer carry (suitcase)': 'suitcase carry exercise demo',
    'Pogo hops': 'pogo hops running drill demo',
    'Skipping A-drill': 'A skip drill running demo',
    'Box step-up (explosive)': 'explosive box step up exercise demo',
    'Single-leg hop (low amplitude)': 'single leg hop low amplitude exercise demo',
  };
  const canonicalName = normalizeExerciseName(name);
  const query = queries[canonicalName] || `${canonicalName} exercise demo`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function slugExerciseName(name) {
  return normalizeExerciseName(name)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getExerciseReferenceImageKey(item) {
  if (!item) return '';
  if (item.libraryKey && EXERCISE_REFERENCE_IMAGES[item.libraryKey]) {
    return item.libraryKey;
  }
  const exerciseSlug = slugExerciseName(item.exercise?.name);
  return EXERCISE_REFERENCE_IMAGES[exerciseSlug] ? exerciseSlug : '';
}

function resolveExerciseReferenceImage(item, fallbackImage = targetLegsUrl) {
  const imageKey = getExerciseReferenceImageKey(item);
  return imageKey ? EXERCISE_REFERENCE_IMAGES[imageKey] : fallbackImage;
}

function getExerciseVideoEmbedUrl(item) {
  if (!item) return '';
  if (item.source === 'library' && item.libraryKey) {
    return EXERCISE_VIDEO_EMBEDS[item.libraryKey] || '';
  }
  return EXERCISE_VIDEO_EMBEDS[slugExerciseName(item.exercise?.name)] || '';
}

function resolveTargetAreaKeyForItem(item, isZh) {
  if (item?.targetKey) return item.targetKey;
  const exercise = item?.exercise;
  const targetGroup = TARGET_AREA_GROUPS.find((group) => exerciseMatchesTargetArea(exercise, isZh, group.key));
  return targetGroup?.key || 'legs';
}

export default function MuscleTraining() {
  const { isAuthenticated } = useAuth();
  const { lang, t } = useI18n();
  const { theme } = useTheme();
  const { isMile } = useUnit();
  const navigate = useNavigate();
  const resolvedMuscleTheme = theme === 'midnight' ? 'dark' : 'white';
  const [plan, setPlan] = useState(null);
  const [checkInDraft, setCheckInDraft] = useState(DEFAULT_CHECK_IN_DRAFT);
  const [loading, setLoading] = useState(true);
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [error, setError] = useState('');
  const [checkInNotice, setCheckInNotice] = useState('');
  const [muscleCheckIns, setMuscleCheckIns] = useState([]);
  const [muscleActivityState, setMuscleActivityState] = useState('loading');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [shellProfile, setShellProfile] = useState(null);
  const [activeTarget, setActiveTarget] = useState('all');
  const [selectedExerciseKey, setSelectedExerciseKey] = useState('');
  const [expandedExerciseIdx, setExpandedExerciseIdx] = useState(null);
  const [selectedMuscleTarget, setSelectedMuscleTarget] = useState('legs');
  const [recommendedArea, setRecommendedArea] = useState(null);
  const [recommendedReasonCode, setRecommendedReasonCode] = useState(null);
  const userOverrideRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    apiJson('/api/profile/me').then((data) => {
      if (data && typeof data === 'object') setShellProfile(data);
    }).catch(() => {});
  }, [isAuthenticated, navigate]);

  const displayName = shellProfile?.displayName?.trim()
    || shellProfile?.email?.split('@')[0]
    || 'Runner';
  const initials = displayName.slice(0, 1).toUpperCase();

  const displayLang = lang;
  const isZh = displayLang === 'zh-CN';

  const copy = useMemo(() => ({
    checkInTitle: t('muscle_training.check_in_title'),
    checkInHint: t('muscle_training.check_in_hint'),
    checkInTypeLabel: t('muscle_training.check_in_type_label'),
    checkInStateLabel: t('muscle_training.check_in_state_label'),
    checkInDistanceLabel: t('muscle_training.check_in_distance_label'),
    checkInDurationLabel: t('muscle_training.check_in_duration_label'),
    checkInSave: t('muscle_training.check_in_save'),
    checkInSaving: t('muscle_training.check_in_saving'),
    checkInDone: t('muscle_training.check_in_done'),
    checkInReset: t('muscle_training.check_in_reset'),
    checkInSaved: t('muscle_training.check_in_saved'),
    checkInResetSuccess: t('muscle_training.check_in_reset_success'),
    checkInUpdatedAt: t('muscle_training.check_in_updated_at'),
    checkInEffectHint: t('muscle_training.check_in_effect_hint'),
    strengthComposerTitle: t('muscle_training.strength_composer_title'),
    strengthComposerHint: t('muscle_training.strength_composer_hint'),
    strengthComposerSafety: t('muscle_training.strength_composer_safety'),
    strengthFocusLabel: t('muscle_training.strength_focus_label'),
    strengthDoseLabel: t('muscle_training.strength_dose_label'),
    strengthFocusOptions: {
      COACH_PICK: t('muscle_training.strength_focus_coach_pick'),
      LEG_DAY: t('muscle_training.strength_focus_leg_day'),
      POSTERIOR_CHAIN: t('muscle_training.strength_focus_posterior_chain'),
      CALVES_ANKLES: t('muscle_training.strength_focus_calves_ankles'),
      CORE_STABILITY: t('muscle_training.strength_focus_core_stability'),
      MOBILITY_RESET: t('muscle_training.strength_focus_mobility_reset'),
    },
    strengthDoseOptions: {
      MICRO: t('muscle_training.strength_dose_micro'),
      STANDARD: t('muscle_training.strength_dose_standard'),
      STRONG: t('muscle_training.strength_dose_strong'),
    },
    planSourceLabel: t('muscle_training.plan_source_label'),
    sourcePills: {
      COACH_SCHEDULE: t('muscle_training.source_pill_coach_schedule'),
      COACH_SYNC: t('muscle_training.source_pill_coach_schedule'),
      USER_PLANNED: t('muscle_training.source_pill_user_planned'),
      USER_ACTUAL: t('muscle_training.source_pill_user_actual'),
    },
    sourceSummary: {
      COACH_SCHEDULE: t('muscle_training.source_summary_coach_schedule'),
      COACH_SYNC: t('muscle_training.source_summary_coach_schedule'),
      USER_PLANNED: t('muscle_training.source_summary_user_planned'),
      USER_ACTUAL: t('muscle_training.source_summary_user_actual'),
    },
    checkInStateOptions: {
      PLANNED: t('muscle_training.check_in_state_planned'),
      ACTUAL: t('muscle_training.check_in_state_actual'),
    },
    heading: t('muscle_training.heading'),
    subheading: t('muscle_training.subheading'),
    languageToggleLabel: t('muscle_training.language_toggle_label'),
    loading: t('muscle_training.loading'),
    profileTitle: t('muscle_training.profile_title'),
    profileHint: t('muscle_training.profile_hint'),
    experienceLabel: t('muscle_training.experience_label'),
    equipmentLabel: t('muscle_training.equipment_label'),
    sessionMinutesLabel: t('muscle_training.session_minutes_label'),
    noiseLabel: t('muscle_training.noise_label'),
    preferredDaysLabel: t('muscle_training.preferred_days_label'),
    save: t('muscle_training.save_settings'),
    saving: t('muscle_training.saving_settings'),
    saveSuccess: t('muscle_training.save_success'),
    profileSummaryTitle: t('muscle_training.profile_summary_title'),
    profileSummarySessions: t('muscle_training.profile_summary_sessions'),
    profileSummaryNext: t('muscle_training.profile_summary_next'),
    profileSummaryFocus: t('muscle_training.profile_summary_focus'),
    profileSummaryDuration: t('muscle_training.profile_summary_duration'),
    profilePreviewEquipment: t('muscle_training.profile_preview_equipment'),
    profilePreviewDifficulty: t('muscle_training.profile_preview_difficulty'),
    profilePreviewDuration: t('muscle_training.profile_preview_duration'),
    profilePreviewDays: t('muscle_training.profile_preview_days'),
    profileDirty: t('muscle_training.profile_dirty'),
    profileSynced: t('muscle_training.profile_synced'),
    profileExperienceHint: t('muscle_training.profile_experience_hint'),
    profileEquipmentHint: t('muscle_training.profile_equipment_hint'),
    profileSessionMinutesHint: t('muscle_training.profile_session_minutes_hint'),
    profileNoiseHint: t('muscle_training.profile_noise_hint'),
    profilePreferredDaysHint: t('muscle_training.profile_preferred_days_hint'),
    profilePlanImpactTitle: t('muscle_training.profile_plan_impact_title'),
    profileImpactEquipment: t('muscle_training.profile_impact_equipment'),
    profileImpactNoise: t('muscle_training.profile_impact_noise'),
    profileImpactDays: t('muscle_training.profile_impact_days'),
    statusTitle: t('muscle_training.status_title'),
    rationaleTitle: t('muscle_training.rationale_title'),
    weekTitle: t('muscle_training.week_title'),
    weekHint: t('muscle_training.week_hint'),
    conservativeBanner: t('muscle_training.conservative_banner'),
    summaryFrequency: t('muscle_training.summary_frequency'),
    summaryRecovery: t('muscle_training.summary_recovery'),
    summaryUpcoming: t('muscle_training.summary_upcoming'),
    summaryFocus: t('muscle_training.summary_focus'),
    noKeyRun: t('muscle_training.no_key_run'),
    noLongRun: t('muscle_training.no_long_run'),
    runContext: t('muscle_training.run_context'),
    strengthTitle: t('muscle_training.strength_title'),
    noStrengthTitle: t('muscle_training.no_strength_title'),
    placementTitle: t('muscle_training.placement_title'),
    durationTitle: t('muscle_training.duration_title'),
    rpeTitle: t('muscle_training.rpe_title'),
    optionalTitle: t('muscle_training.optional_title'),
    optionalYes: t('muscle_training.optional_yes'),
    optionalNo: t('muscle_training.optional_no'),
    noteTitle: t('muscle_training.note_title'),
    watchDemo: t('muscle_training.watch_demo'),
    intentLabel: t('muscle_training.intent_label'),
    regression: t('muscle_training.regression_label'),
    progression: t('muscle_training.progression_label'),
    readinessAdjusted: t('muscle_training.readiness_adjusted'),
    experienceOptions: {
      BEGINNER: t('muscle_training.experience_beginner'),
      INTERMEDIATE: t('muscle_training.experience_intermediate'),
      CONSISTENT: t('muscle_training.experience_consistent'),
    },
    equipmentOptions: {
      BODYWEIGHT: t('muscle_training.equipment_bodyweight'),
      BAND: t('muscle_training.equipment_band'),
      DUMBBELL: t('muscle_training.equipment_dumbbell'),
      GYM: t('muscle_training.equipment_gym'),
    },
    noiseOptions: {
      NORMAL: t('muscle_training.noise_normal'),
      QUIET_ONLY: t('muscle_training.noise_quiet_only'),
    },
    sessionTypes: {
      FOUNDATION_STRENGTH: t('muscle_training.session_type_foundation_strength'),
      RESILIENCE_CAPACITY: t('muscle_training.session_type_resilience_capacity'),
      OPTIONAL_ELASTICITY: t('muscle_training.session_type_optional_elasticity'),
    },
    sessionEmphasis: {
      FOUNDATION_STRENGTH: t('muscle_training.session_emphasis_foundation_strength'),
      RESILIENCE_CAPACITY: t('muscle_training.session_emphasis_resilience_capacity'),
      OPTIONAL_ELASTICITY: t('muscle_training.session_emphasis_optional_elasticity'),
    },
    workoutTypes: {
      QUALITY: t('muscle_training.workout_quality'),
      REST: t('muscle_training.workout_rest'),
      EASY: t('muscle_training.workout_easy'),
      RECOVERY: t('muscle_training.workout_recovery'),
      TEMPO: t('muscle_training.workout_tempo'),
      THRESHOLD: t('muscle_training.workout_threshold'),
      INTERVALS: t('muscle_training.workout_intervals'),
      LONG_RUN: t('muscle_training.workout_long_run'),
      CROSS_TRAIN: t('muscle_training.workout_cross_train'),
    },
    loadStatus: {
      CONSERVATIVE: t('muscle_training.load_status_conservative'),
      STEADY: t('muscle_training.load_status_steady'),
      SPIKING: t('muscle_training.load_status_spiking'),
      HIGH_VOLUME: t('muscle_training.load_status_high_volume'),
      RACE_WEEK: t('muscle_training.load_status_race_week'),
    },
    recoveryGate: {
      OPEN: t('muscle_training.recovery_gate_open'),
      CAUTION: t('muscle_training.recovery_gate_caution'),
      PROTECT: t('muscle_training.recovery_gate_protect'),
    },
    currentFocus: {
      RECOVERY_CAPACITY: t('muscle_training.current_focus_recovery_capacity'),
      QUIET_POSTERIOR_CHAIN: t('muscle_training.current_focus_quiet_posterior_chain'),
      ELASTIC_STIFFNESS: t('muscle_training.current_focus_elastic_stiffness'),
      POSTERIOR_CHAIN_STABILITY: t('muscle_training.current_focus_posterior_chain_stability'),
    },
    rationale: {
      R_VOLUME_28D: t('muscle_training.rationale_r_volume_28d'),
      R_COACH_SCHEDULE: t('muscle_training.rationale_r_coach_schedule'),
      R_EQUIPMENT_FILTER: t('muscle_training.rationale_r_equipment_filter'),
      R_CONSERVATIVE_DATA: t('muscle_training.rationale_r_conservative_data'),
      R_RECOVERY_GATE: t('muscle_training.rationale_r_recovery_gate'),
      R_LOAD_SPIKE: t('muscle_training.rationale_r_load_spike'),
      R_HIGH_VOLUME: t('muscle_training.rationale_r_high_volume'),
      R_RACE_WEEK: t('muscle_training.rationale_r_race_week'),
      R_QUIET_FILTER: t('muscle_training.rationale_r_quiet_filter'),
      R_SKIP_WEEK: t('muscle_training.rationale_r_skip_week'),
      R_CUSTOM_TODAY_FOCUS: t('muscle_training.rationale_r_custom_today_focus'),
    },
    placementReasons: {
      ASSIGN_AFTER_EASY_RUN: t('muscle_training.placement_assign_after_easy_run'),
      ASSIGN_ON_RECOVERY_DAY: t('muscle_training.placement_assign_on_recovery_day'),
      ASSIGN_OPTIONAL_LOW_IMPACT_SLOT: t('muscle_training.placement_assign_optional_low_impact_slot'),
      REST_DAY_OPTIMAL: t('muscle_training.placement_rest_day_optimal'),
      EASY_DAY_PAIRING: t('muscle_training.placement_easy_day_pairing'),
    },
    noStrengthReasons: {
      KEY_RUN_PRIORITY: t('muscle_training.no_strength_key_run_priority'),
      WEEKLY_CAP_REACHED: t('muscle_training.no_strength_skip_session_cap_reached'),
      SKIP_KEY_RUN_DAY: t('muscle_training.no_strength_skip_key_run_day'),
      SKIP_LONG_RUN_DAY: t('muscle_training.no_strength_skip_long_run_day'),
      SKIP_KEY_RUN_TOMORROW: t('muscle_training.no_strength_skip_key_run_tomorrow'),
      SKIP_LONG_RUN_TOMORROW: t('muscle_training.no_strength_skip_long_run_tomorrow'),
      SKIP_RECOVERY_GATE: t('muscle_training.no_strength_skip_recovery_gate'),
      SKIP_SESSION_CAP_REACHED: t('muscle_training.no_strength_skip_session_cap_reached'),
      SKIP_BUFFER_DAY: t('muscle_training.no_strength_skip_buffer_day'),
    },
    cautionCodes: {
      CAUTION_KEEP_SUBMAXIMAL: t('muscle_training.caution_keep_submaximal'),
      CAUTION_RACE_WEEK: t('muscle_training.caution_race_week'),
    },
    blockTitles: {
      Prep: t('muscle_training.block_prep'),
      Main: t('muscle_training.block_main'),
      Accessory: t('muscle_training.block_accessory'),
    },
    exerciseNoise: {
      QUIET: t('muscle_training.exercise_noise_quiet'),
      SOUND: t('muscle_training.exercise_noise_sound'),
    },
    exerciseEquipment: {
      BODYWEIGHT: t('muscle_training.exercise_equipment_bodyweight'),
      BAND: t('muscle_training.exercise_equipment_band'),
      DUMBBELL: t('muscle_training.exercise_equipment_dumbbell'),
      GYM: t('muscle_training.exercise_equipment_gym'),
    },
  }), [t]);
  const sessionByType = useMemo(
    () => new Map((plan?.sessions || []).map((session) => [session.sessionType, session])),
    [plan],
  );
  const strengthCoachDecision = useMemo(
    () => resolveStrengthCoachGridDecision(plan),
    [plan],
  );
  const todayPlan = useMemo(() => (plan?.days || [])[0] || null, [plan]);
  const gridStrengthDay = strengthCoachDecision?.appliedDate
    ? (plan?.days || []).find((day) => (
      day.date === strengthCoachDecision.appliedDate && day.strength
    )) || todayPlan
    : todayPlan;
  const featuredDay = todayPlan;
  const featuredSession = useMemo(
    () => (gridStrengthDay?.strength ? sessionByType.get(gridStrengthDay.strength.sessionType) : null),
    [gridStrengthDay, sessionByType],
  );
  const protocolItems = useMemo(() => {
    const items = [];
    (featuredSession?.blocks || []).forEach((block, blockIndex) => {
      (block.exercises || []).forEach((exercise, exerciseIndex) => {
        items.push({
          block,
          blockIndex,
          exercise,
          exerciseIndex,
          globalIndex: items.length,
        });
      });
    });
    return items;
  }, [featuredSession]);
  const stitchCopy = useMemo(() => ({
    dashboard: t('muscle_training.stitch_dashboard'),
    analysis: t('muscle_training.stitch_analysis'),
    schedule: t('muscle_training.stitch_schedule'),
    strength: t('muscle_training.stitch_strength'),
    seriesLabel: t('muscle_training.stitch_series_label'),
    durationLabel: t('muscle_training.stitch_duration_label'),
    burnLabel: t('muscle_training.stitch_burn_label'),
    loadLabel: t('muscle_training.stitch_load_label'),
    protocolTitle: t('muscle_training.stitch_protocol_title'),
    readyTitle: t('muscle_training.stitch_ready_title'),
    readyHint: t('muscle_training.stitch_ready_hint'),
    startWorkout: t('muscle_training.stitch_start_workout'),
    enterWorkout: t('muscle_training.stitch_enter_workout'),
    noStrengthTitle: t('muscle_training.stitch_no_strength_title'),
    noStrengthHint: t('muscle_training.stitch_no_strength_hint'),
    muscleFocusTitle: t('muscle_training.stitch_muscle_focus_title'),
    coachingCuesTitle: t('muscle_training.stitch_coaching_cues_title'),
    recoveryImpactTitle: t('muscle_training.stitch_recovery_impact_title'),
    support: t('muscle_training.stitch_support'),
    settings: t('muscle_training.stitch_settings'),
    todayLabel: t('muscle_training.stitch_today_label'),
    guideTitle: t('muscle_training.stitch_guide_title'),
    guideSubtitle: t('muscle_training.stitch_guide_subtitle'),
    guideDecisionTitle: t('muscle_training.stitch_guide_decision_title'),
    guideDecisionBodyActive: t('muscle_training.stitch_guide_decision_body_active'),
    guideDecisionBodyRest: t('muscle_training.stitch_guide_decision_body_rest'),
    guideRunwayTitle: t('muscle_training.stitch_guide_runway_title'),
    guideMapTitle: t('muscle_training.stitch_guide_map_title'),
    guideAdjustCheckin: t('muscle_training.stitch_guide_adjust_checkin'),
    anatomyExploreTitle: t('muscle_training.stitch_anatomy_explore_title'),
    anatomyExploreHint: t('muscle_training.stitch_anatomy_explore_hint'),
    weekDoseLabel: t('muscle_training.stitch_week_dose_label'),
    weekAlignLabel: t('muscle_training.stitch_week_align_label'),
    decisionLabel: t('muscle_training.stitch_decision_label'),
    nextRunLabel: t('muscle_training.stitch_next_run_label'),
    recoveryGateLabel: t('muscle_training.stitch_recovery_gate_label'),
    runwayEmpty: t('muscle_training.stitch_runway_empty'),
    bodyMeasureTitle: t('muscle_training.stitch_body_measure_title'),
    bodyMeasureDesc: t('muscle_training.stitch_body_measure_desc'),
    bodyMeasureLoadLabel: t('muscle_training.stitch_body_measure_load_label'),
    bodyMeasureBalanceLabel: t('muscle_training.stitch_body_measure_balance_label'),
    bodyMeasureAnterior: t('muscle_training.stitch_body_measure_anterior'),
    bodyMeasurePosterior: t('muscle_training.stitch_body_measure_posterior'),
    bodyMeasureInteractionHint: t('muscle_training.stitch_body_measure_interaction_hint'),
    bodyMeasureSelectedLabel: t('muscle_training.stitch_body_measure_selected_label'),
    bodyMeasureTrainedByLabel: t('muscle_training.stitch_body_measure_trained_by_label'),
    bodyMeasurePlanFocusLabel: t('muscle_training.stitch_body_measure_plan_focus_label'),
    bodyMeasureInspectHint: t('muscle_training.stitch_body_measure_inspect_hint'),
    topMuscleTitle: t('muscle_training.stitch_top_muscle_title'),
    topMuscleHint: t('muscle_training.stitch_top_muscle_hint'),
    topActionsTitle: t('muscle_training.stitch_top_actions_title'),
    topActionsSelected: t('muscle_training.stitch_top_actions_selected'),
    topActionsHint: t('muscle_training.stitch_top_actions_hint'),
    topReferenceKicker: t('muscle_training.stitch_top_reference_kicker'),
    topReferenceTitle: t('muscle_training.stitch_top_reference_title'),
    topPlanBadge: t('muscle_training.stitch_top_plan_badge'),
    topLibraryBadge: t('muscle_training.stitch_top_library_badge'),
    emptyStateTitle: t('muscle_training.stitch_empty_state_title'),
    emptyStateAction: t('muscle_training.stitch_empty_state_action'),
    weekStripLabel: t('muscle_training.stitch_week_strip_label'),
    sessionsDoneLabel: t('muscle_training.stitch_sessions_done'),
    sessionsOfLabel: t('muscle_training.stitch_sessions_of'),
    strengthDayBadge: t('muscle_training.stitch_strength_day_badge'),
    runDayBadge: t('muscle_training.stitch_run_day_badge'),
    restDayBadge: t('muscle_training.stitch_rest_day_badge'),
    todayBadge: t('muscle_training.stitch_today_badge'),
    keyRunBadge: t('muscle_training.stitch_key_run_badge'),
    longRunBadge: t('muscle_training.stitch_long_run_badge'),
    detailsToggle: t('muscle_training.stitch_details_toggle'),
    noRunContext: t('muscle_training.stitch_no_run_context'),
    labBadge: t('muscle_training.stitch_lab_badge'),
    volumeGoalTitle: t('muscle_training.stitch_volume_goal_title'),
    weeklyCompletion: t('muscle_training.stitch_weekly_completion'),
    progressStackTitle: t('muscle_training.stitch_progress_stack_title'),
    nextKeyRun: t('muscle_training.stitch_next_key_run'),
    currentFocusTitle: t('muscle_training.stitch_current_focus_title'),
    historyPlaceholderTitle: t('muscle_training.stitch_history_placeholder_title'),
    historyPlaceholderHint: t('muscle_training.stitch_history_placeholder_hint'),
    historyPlaceholderBadge: t('muscle_training.stitch_history_placeholder_badge'),
    targetAreasTitle: t('muscle_training.stitch_target_areas_title'),
    targetChest: t('muscle_training.stitch_target_chest'),
    targetBack: t('muscle_training.stitch_target_back'),
    targetLegs: t('muscle_training.stitch_target_legs'),
    targetShoulders: t('muscle_training.stitch_target_shoulders'),
    targetArms: t('muscle_training.stitch_target_arms'),
    targetCore: t('muscle_training.stitch_target_core'),
    allTargets: t('muscle_training.stitch_all_targets'),
    targetCardsHint: t('muscle_training.stitch_target_cards_hint'),
    areaExerciseCount: t('muscle_training.stitch_area_exercise_count'),
    areaPlanCount: t('muscle_training.stitch_area_plan_count'),
    areaLibraryCount: t('muscle_training.stitch_area_library_count'),
    currentSplitTitle: t('muscle_training.stitch_current_split_title'),
    currentSplitBadge: t('muscle_training.stitch_current_split_badge'),
    nextStrengthSession: t('muscle_training.stitch_next_strength_session'),
    activeTime: t('muscle_training.stitch_active_time'),
    recentPrsTitle: t('muscle_training.stitch_recent_prs_title'),
    placeholderMetric: t('muscle_training.stitch_placeholder_metric'),
    noAreaExercises: t('muscle_training.stitch_no_area_exercises'),
    noAreaPlanExercises: t('muscle_training.stitch_no_area_plan_exercises'),
    todayPlanTitle: t('muscle_training.stitch_today_plan_title'),
    compoundLibraryTitle: t('muscle_training.stitch_compound_library_title'),
    compoundBadge: t('muscle_training.stitch_compound_badge'),
    optionalLibraryBadge: t('muscle_training.stitch_optional_library_badge'),
    optionalLibraryNote: t('muscle_training.stitch_optional_library_note'),
    weekRunwayTitle: t('muscle_training.stitch_week_runway_title'),
    progressBandTitle: t('muscle_training.stitch_progress_band_title'),
    volume7d: t('muscle_training.stitch_volume_7d'),
    volume28d: t('muscle_training.stitch_volume_28d'),
    highIntensity: t('muscle_training.stitch_high_intensity'),
    recentHardRuns: t('muscle_training.stitch_recent_hard_runs'),
    protocolWorkspaceTitle: t('muscle_training.stitch_protocol_workspace_title'),
    protocolWorkspaceHint: t('muscle_training.stitch_protocol_workspace_hint'),
    filterAll: t('muscle_training.stitch_filter_all'),
    exerciseDetailTitle: t('muscle_training.stitch_exercise_detail_title'),
    noExerciseSelected: t('muscle_training.stitch_no_exercise_selected'),
    stepsLabel: t('muscle_training.stitch_steps_label'),
    videoDemoTitle: t('muscle_training.stitch_video_demo_title'),
    videoUnavailable: t('muscle_training.stitch_video_unavailable'),
    professionalTips: t('muscle_training.stitch_professional_tips'),
    targetMusclesLabel: t('muscle_training.stitch_target_muscles_label'),
    plannedLabel: t('muscle_training.stitch_planned_label'),
    recommendedLabel: t('muscle_training.stitch_recommended_label'),
  }), [t]);

  const navItems = useMemo(
    () => getRunnerShellNavItems({ t, lang, activeKey: 'muscle' }),
    [t, lang],
  );
  // Count how many strength sessions are planned in the 7-day rolling window
  const _weekDoseStats = useMemo(() => {
    if (!plan) return { planned: 0, recommended: 0, completedToday: false };
    const days = plan.days || [];
    const planned = days.filter((d) => !!d.strength).length;
    const recommended = plan.weekContext?.recommendedSessionsPerWeek ?? 0;
    const completedToday = !!plan.todayCheckIn && plan.planSource === 'USER_ACTUAL';
    return { planned, recommended, completedToday };
  }, [plan]);

  // Build a specific, warm coach narrative for today
  const todayCoachNarrative = useMemo(() => {
    if (!plan || !featuredDay) return null;
    const hasStrength = !!featuredDay.strength;
    const runType = featuredDay.run?.workoutType;
    const runDist = featuredDay.run?.plannedDistanceKm;
    const strengthDur = featuredDay.strength?.durationMinutes;
    const sessionType = featuredDay.strength?.sessionType;
    const acwr = plan.weekContext?.acwr;
    const volKm = plan.weekContext?.volumeKm7d;
    const nextKeyDate = plan.weekContext?.nextKeyRunDate;
    const noReasonCode = featuredDay.noStrengthReasonCode;

    const runLabel = pickLabel(copy.workoutTypes, runType, '');
    const distStr = runDist != null ? ` ${formatDistance(runDist, isZh, isMile)}` : '';
    const durStr = strengthDur != null ? formatMinutes(strengthDur, isZh) : '';
    const acwrStr = acwr != null ? `ACWR ${trimNumber(acwr, 2)}` : '';
    const volStr = volKm != null ? `${formatDistanceValue(volKm, isMile, 0)} ${isMile ? (t('muscle_training.miles_unit')) : (t('muscle_training.km_unit'))}` : '';
    const focusLabel = pickStrengthSessionLabel(copy, sessionType, '');
    const nextKeyStr = nextKeyDate ? formatShortDate(nextKeyDate, displayLang) : '';

    if (hasStrength) {
      if (isZh) {
        const basisParts = [volStr && `本周跑量 ${volStr}`, acwrStr].filter(Boolean).join('，');
        const nextKeyNote = nextKeyStr ? `，距下次关键跑（${nextKeyStr}）保留了缓冲` : '';
        const runNote = runLabel ? `${runType === 'REST' ? '休息日' : `${runLabel}${distStr}之后`}` : '';
        const durationNote = durStr ? `做 ${durStr}` : '';
        return `今天${runNote ? runNote + '，建议' : '建议'}${durationNote} ${focusLabel || '力量训练'}${nextKeyNote}。${basisParts ? `基于${basisParts}。` : ''}`;
      }
      const basisParts = [volStr && `${volStr} this week`, acwrStr].filter(Boolean).join(', ');
      const runNote = runLabel
        ? (runType === 'REST' ? 'rest day' : `after your ${runLabel}${distStr}`)
        : '';
      const durationNote = durStr ? `${durStr} of` : '';
      const nextKeyNote = nextKeyStr ? ` This keeps a buffer before your key run on ${nextKeyStr}.` : '';
      return `Today${runNote ? ` ${runNote}` : ''}: ${durationNote} ${focusLabel || 'strength work'} — fits this week's load.${nextKeyNote}${basisParts ? ` Based on ${basisParts}.` : ''}`;
    }

    // No strength today
    const noReason = pickLabel(copy.noStrengthReasons, noReasonCode, '');
    if (noReason) {
      return t('muscle_training.coach_narrative_no_strength_reason', { reason: noReason });
    }
    return t('muscle_training.coach_narrative_no_strength_default');
  }, [copy, displayLang, featuredDay, isZh, t, isMile, plan]);

  const targetAreaCards = useMemo(() => {
    return TARGET_AREA_GROUPS.map((group) => ({
      ...group,
      label: stitchCopy[group.copyKey],
      planCount: protocolItems.filter(({ exercise }) => exerciseMatchesTargetArea(exercise, isZh, group.key)).length,
      libraryCount: COMPOUND_TARGET_LIBRARY[group.key]?.length || 0,
      count: protocolItems.filter(({ exercise }) => exerciseMatchesTargetArea(exercise, isZh, group.key)).length
        + (COMPOUND_TARGET_LIBRARY[group.key]?.length || 0),
    }));
  }, [isZh, protocolItems, stitchCopy]);

  const filteredProtocolItems = useMemo(() => {
    if (activeTarget === 'all') return protocolItems;
    return protocolItems.filter(({ exercise }) => exerciseMatchesTargetArea(exercise, isZh, activeTarget));
  }, [activeTarget, isZh, protocolItems]);

  const libraryProtocolItems = useMemo(() => {
    const targetKeys = activeTarget === 'all'
      ? TARGET_AREA_GROUPS.map((group) => group.key)
      : [activeTarget];
    let globalIndex = protocolItems.length;
    return targetKeys.flatMap((targetKey) => (COMPOUND_TARGET_LIBRARY[targetKey] || [])
      .map((definition, exerciseIndex) => createLibraryProtocolItem(
        targetKey,
        definition,
        exerciseIndex,
        globalIndex++,
      )));
  }, [activeTarget, protocolItems.length]);

  const visibleExerciseItems = useMemo(() => [
    ...filteredProtocolItems.map((item) => ({ ...item, source: 'plan' })),
    ...libraryProtocolItems,
  ], [filteredProtocolItems, libraryProtocolItems]);

  const buildTopRecommendationItems = useCallback((targetKey) => {
    const planItems = protocolItems
      .filter(({ exercise }) => exerciseMatchesTargetArea(exercise, isZh, targetKey))
      .map((item) => ({ ...item, source: 'plan', targetKey }));
    const libraryItems = (COMPOUND_TARGET_LIBRARY[targetKey] || [])
      .map((definition, exerciseIndex) => createLibraryProtocolItem(
        targetKey,
        definition,
        exerciseIndex,
        protocolItems.length + exerciseIndex,
      ));
    return [...planItems, ...libraryItems].slice(0, 5);
  }, [isZh, protocolItems]);

  const topRecommendationItems = useMemo(
    () => buildTopRecommendationItems(selectedMuscleTarget),
    [buildTopRecommendationItems, selectedMuscleTarget],
  );

  const topMuscleSelectorData = useMemo(
    () => buildTopMuscleSelectorData(selectedMuscleTarget),
    [selectedMuscleTarget],
  );

  const selectedProtocolItem = useMemo(() => (
    visibleExerciseItems.find((item) => getProtocolItemKey(item) === selectedExerciseKey)
    || visibleExerciseItems[0]
    || null
  ), [selectedExerciseKey, visibleExerciseItems]);

  const selectedExerciseCopy = useMemo(
    () => (selectedProtocolItem ? getExerciseContentForItem(selectedProtocolItem, isZh) : null),
    [isZh, selectedProtocolItem],
  );

  const selectedExerciseVideoUrl = useMemo(
    () => getExerciseVideoEmbedUrl(selectedProtocolItem),
    [selectedProtocolItem],
  );

  const selectedRailTargetKey = useMemo(
    () => resolveTargetAreaKeyForItem(selectedProtocolItem, isZh),
    [isZh, selectedProtocolItem],
  );

  const selectedMuscleTargetCard = useMemo(
    () => targetAreaCards.find((target) => target.key === selectedMuscleTarget) || targetAreaCards.find((target) => target.key === 'legs'),
    [selectedMuscleTarget, targetAreaCards],
  );

  const selectedRailTargetCard = useMemo(
    () => targetAreaCards.find((target) => target.key === selectedRailTargetKey)
      || targetAreaCards.find((target) => target.key === selectedMuscleTarget)
      || targetAreaCards.find((target) => target.key === 'legs'),
    [selectedMuscleTarget, selectedRailTargetKey, targetAreaCards],
  );

  const topReferenceImage = resolveExerciseReferenceImage(
    selectedProtocolItem,
    selectedMuscleTargetCard?.image || targetLegsUrl,
  );

  const selectedExerciseReferenceImage = useMemo(
    () => resolveExerciseReferenceImage(
      selectedProtocolItem,
      selectedRailTargetCard?.image || targetLegsUrl,
    ),
    [selectedProtocolItem, selectedRailTargetCard],
  );

  function handleTargetAreaSelect(targetKey) {
    const nextTargetKey = targetKey === 'all' ? 'legs' : targetKey;
    setActiveTarget(targetKey);
    setSelectedMuscleTarget(nextTargetKey);
    setExpandedExerciseIdx(null);
    const nextPlanItem = targetKey === 'all'
      ? protocolItems[0]
      : protocolItems.find(({ exercise }) => exerciseMatchesTargetArea(exercise, isZh, targetKey));
    const nextLibraryDefinition = targetKey === 'all'
      ? COMPOUND_TARGET_LIBRARY[TARGET_AREA_GROUPS[0].key]?.[0]
      : COMPOUND_TARGET_LIBRARY[targetKey]?.[0];
    const nextItem = nextPlanItem || (
      nextLibraryDefinition
        ? createLibraryProtocolItem(targetKey === 'all' ? TARGET_AREA_GROUPS[0].key : targetKey, nextLibraryDefinition, 0, protocolItems.length)
        : null
    );
    const nextKey = getProtocolItemKey(nextItem);
    setSelectedExerciseKey(nextKey);
    window.setTimeout(() => {
      if (nextKey) document.getElementById(`mt-exercise-${nextKey}`)?.focus();
    }, 0);
  }

  function handleExerciseSelect(item) {
    const nextTargetKey = resolveTargetAreaKeyForItem(item, isZh);
    if (nextTargetKey !== 'all') {
      setSelectedMuscleTarget(nextTargetKey);
    }
    setSelectedExerciseKey(getProtocolItemKey(item));
  }

  function handleTopMuscleSelect(targetKey) {
    userOverrideRef.current = true;
    const nextItems = buildTopRecommendationItems(targetKey);
    setSelectedMuscleTarget(targetKey);
    setActiveTarget(targetKey);
    setExpandedExerciseIdx(null);
    if (nextItems[0]) {
      setSelectedExerciseKey(getProtocolItemKey(nextItems[0]));
    }
  }

  function handleTopExerciseSelect(item) {
    const nextTargetKey = item.targetKey || selectedMuscleTarget;
    setSelectedMuscleTarget(nextTargetKey);
    setActiveTarget(nextTargetKey);
    setSelectedExerciseKey(getProtocolItemKey(item));
  }

  useEffect(() => {
    if (activeTarget === 'all') return;
    if (targetAreaCards.some((target) => target.key === activeTarget)) return;
    setActiveTarget('all');
  }, [activeTarget, targetAreaCards]);

  useEffect(() => {
    if (selectedExerciseKey && visibleExerciseItems.some((item) => getProtocolItemKey(item) === selectedExerciseKey)) return;
    setSelectedExerciseKey(getProtocolItemKey(visibleExerciseItems[0]));
  }, [selectedExerciseKey, visibleExerciseItems]);

  const applyLoadedData = useCallback((nextPlan) => {
    setPlan(nextPlan);
    setCheckInDraft(buildCheckInDraft(nextPlan));

    // Today's recommended muscle area comes from the backend plan. Apply it as
    // the default anatomy selection on first load (so the heatmap + chip auto-
    // highlight the coach's pick) unless the user has already chosen manually.
    const coachDecision = resolveStrengthCoachGridDecision(nextPlan);
    const area = coachDecision.displayFocus;
    const reason = area === nextPlan?.recommendedMuscleArea
      ? nextPlan?.recommendedMuscleReasonCode
      : null;
    setRecommendedArea(area || null);
    setRecommendedReasonCode(reason || null);
    if (area && !userOverrideRef.current) {
      const targetKey = coachDecision.targetKey;
      const nextItems = buildTopRecommendationItems(targetKey);
      setSelectedMuscleTarget(targetKey);
      setActiveTarget(targetKey);
      setExpandedExerciseIdx(null);
      if (nextItems[0]) {
        setSelectedExerciseKey(getProtocolItemKey(nextItems[0]));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildTopRecommendationItems omitted to prevent infinite re-render loop
  }, []);

  function applyPlanOnly(nextPlan) {
    const coachDecision = resolveStrengthCoachGridDecision(nextPlan);
    const area = coachDecision.displayFocus;
    const reason = area === nextPlan?.recommendedMuscleArea
      ? nextPlan?.recommendedMuscleReasonCode
      : null;
    setPlan(nextPlan);
    setCheckInDraft(buildCheckInDraft(nextPlan, isMile));
    setRecommendedArea(area || null);
    setRecommendedReasonCode(reason || null);
    userOverrideRef.current = false;
    if (area) {
      const nextItems = buildTopRecommendationItems(coachDecision.targetKey);
      setSelectedMuscleTarget(coachDecision.targetKey);
      setActiveTarget(coachDecision.targetKey);
      setExpandedExerciseIdx(null);
      if (nextItems[0]) {
        setSelectedExerciseKey(getProtocolItemKey(nextItems[0]));
      }
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setCheckInNotice('');
      setMuscleActivityState('loading');
      const checkInsPromise = apiJson('/api/training/muscle/check-ins')
        .then((checkIns) => (Array.isArray(checkIns) ? checkIns : null))
        .catch(() => null);
      checkInsPromise.then((checkIns) => {
        if (cancelled) return;
        setMuscleCheckIns(checkIns || []);
        setMuscleActivityState(checkIns ? 'ready' : 'unavailable');
      });
      try {
        const nextPlan = await apiJson('/api/training/muscle/plan');
        if (cancelled) return;
        applyLoadedData(nextPlan);
      } catch (cause) {
        if (!cancelled) {
          setError(cause?.message || t('muscle_training.connection_failed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyLoadedData, isAuthenticated, t, navigate]);

  async function handleDailyCheckIn() {
    if (checkInSaving || plan?.todayCheckIn?.entryState === 'ACTUAL') return;
    setCheckInSaving(true);
    setError('');
    setCheckInNotice('');
    try {
      const payload = {
        runType: checkInDraft.runType,
        entryState: 'ACTUAL',
        distanceKm: null,
        durationMinutes: null,
        strengthFocus: checkInDraft.strengthFocus,
        strengthDose: checkInDraft.strengthDose,
      };
      await apiJson('/api/training/muscle/today', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const [nextPlan, nextCheckIns] = await Promise.all([
        apiJson('/api/training/muscle/plan'),
        apiJson('/api/training/muscle/check-ins').catch(() => null),
      ]);
      applyPlanOnly(nextPlan);
      if (Array.isArray(nextCheckIns)) setMuscleCheckIns(nextCheckIns);
      setCheckInNotice(copy.checkInSaved);
    } catch (cause) {
      setError(cause?.message || 'Could not save today\'s training.');
    } finally {
      setCheckInSaving(false);
    }
  }

  function scrollToControls() {
    document.getElementById('muscle-controls')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) return <PageSkeleton variant="muscle-training" />;

  return (
    <div
      className={`runner-shell-page runner-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}
      data-muscle-theme={resolvedMuscleTheme}
    >
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('analysis.stitch_brand_subtitle_muscle')}</span>
          </div>
          <button
            type="button"
            className="runner-dashboard-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={t(isSidebarCollapsed ? 'profile.sidebar_expand' : 'profile.sidebar_collapse')}
            aria-pressed={isSidebarCollapsed}
          >
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{isSidebarCollapsed ? '>' : '<'}</span>
          </button>
        </div>

        <nav className="runner-shell-side-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`runner-shell-side-link${item.active ? ' is-active' : ''}`}
              onClick={() => navigate(item.route)}
            >
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="runner-shell-sidebar-footer">
          <button type="button" className="runner-shell-workout-btn runner-dashboard-workout-btn" onClick={scrollToControls}>
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{stitchCopy.startWorkout}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <RunnerShellTopNav
              navItems={navItems}
              activeLabel={stitchCopy.strength}
              navigate={navigate}
            />
          </div>

          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" aria-label={displayName} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas muscle-training-canvas">
          <div className="mt-content">

        {loading && <div className="muscle-training-loading-skeleton" role="status" aria-live="polite" aria-busy="true">{copy.loading}</div>}
        {!loading && error && <div className="error-alert" style={{ display: 'block', marginTop: 18 }}>{error}</div>}

        {!loading && !error && !plan && (
          <div className="mt-coach-empty">
            <AppIcon name="fitness_center" className="mt-coach-empty-icon" />
            <h2>{stitchCopy.emptyStateTitle}</h2>
            <p>{stitchCopy.emptyStateAction}</p>
          </div>
        )}

        {!loading && !error && plan && (
          <>
            <section
              className="mt-top-workbench"
              aria-labelledby="mt-top-muscle-title"
              data-strength-algorithm={strengthCoachDecision?.algorithmVersion || undefined}
              data-strength-focus={strengthCoachDecision?.appliedFocus || undefined}
              data-strength-dose={strengthCoachDecision?.appliedDose || undefined}
              data-strength-safety-action={strengthCoachDecision?.safetyAction || undefined}
            >
              <article className="mt-top-panel mt-top-muscle-card">
                <div className="mt-top-panel-head">
                  <h2 id="mt-top-muscle-title">{stitchCopy.topMuscleTitle}</h2>
                </div>
                <div className="mt-muscle-visual-shell">
                  <div className="mt-muscle-visual mt-muscle-visual--svg">
                    <MuscleHeatmap
                      data={topMuscleSelectorData}
                      side="both"
                      scale={0.64}
                      ariaLabel={stitchCopy.topMuscleTitle}
                      frontLabel={t('common.heatmap_front')}
                      backLabel={t('common.heatmap_back')}
                      onMuscleClick={(part) => {
                        const targetKey = resolveTopMuscleTargetFromSlug(part?.slug);
                        if (targetKey) handleTopMuscleSelect(targetKey);
                      }}
                    />
                  </div>
                </div>
                {recommendedArea && (
                  <p className="mt-recommended-area-banner" role="note">
                    <span>{t('muscle_training.recommended_area_label')}</span>
                    <strong>{pickLabel(copy.strengthFocusOptions, recommendedArea, recommendedArea)}</strong>
                    {recommendedReasonCode && (
                      <span>{t(`muscle_training.recommended_area_reason_${recommendedReasonCode.toLowerCase()}`)}</span>
                    )}
                  </p>
                )}
                <div className="mt-muscle-target-buttons" role="group" aria-label={stitchCopy.topMuscleHint}>
                  {targetAreaCards.map((target) => {
                    const isActive = selectedMuscleTarget === target.key;
                    return (
                      <button
                        key={`top-target-${target.key}`}
                        type="button"
                        className={`mt-muscle-target-button mt-muscle-target-button--${target.key}${isActive ? ' is-active' : ''}`}
                        onClick={() => handleTopMuscleSelect(target.key)}
                        aria-pressed={isActive}
                      >
                        <span>{target.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-top-muscle-hint">{stitchCopy.topMuscleHint}</p>
              </article>

              <article className="mt-top-panel mt-top-actions-card">
                <div className="mt-top-actions-head">
                  <h2>{stitchCopy.topActionsTitle}</h2>
                  <span>{pickLabel(copy.strengthDoseOptions, strengthCoachDecision?.appliedDose, stitchCopy.topActionsSelected)}</span>
                </div>
                <div className="mt-top-action-list" role="list">
                  {topRecommendationItems.map((item) => {
                    const itemKey = getProtocolItemKey(item);
                    const isLibrary = item.source === 'library';
                    const exerciseCopy = getExerciseContentForItem(item, isZh);
                    const targetImage = targetAreaCards.find((target) => target.key === (item.targetKey || selectedMuscleTarget))?.image || targetLegsUrl;
                    const exerciseImage = resolveExerciseReferenceImage(item, targetImage);
                    const isSelected = selectedExerciseKey === itemKey;
                    return (
                      <button
                        key={`top-action-${itemKey}`}
                        type="button"
                        className={`mt-top-action-card${isSelected ? ' is-selected' : ''}`}
                        onClick={() => handleTopExerciseSelect(item)}
                        aria-pressed={isSelected}
                      >
                        <span className="mt-top-action-thumb">
                          <img src={exerciseImage} alt="" aria-hidden="true" width="900" height="600" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                          {isLibrary && <i>{stitchCopy.topLibraryBadge}</i>}
                        </span>
                        <span className="mt-top-action-copy">
                          <strong>{exerciseCopy.name}</strong>
                          <em>{exerciseCopy.muscles.slice(0, 2).join(' · ') || formatLocalizedExercisePrescription(item.exercise, isZh)}</em>
                        </span>
                        {!isLibrary && <small>{stitchCopy.topPlanBadge}</small>}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-top-actions-note">{stitchCopy.topActionsHint}</p>
              </article>

              <aside className="mt-top-reference" aria-labelledby="mt-top-reference-title">
                <div className="mt-top-reference-head">
                  <span className="mt-kicker">{stitchCopy.topReferenceKicker}</span>
                  <h2 id="mt-top-reference-title">{stitchCopy.topReferenceTitle}</h2>
                </div>
                <div className="mt-top-reference-card">
                  <figure className="mt-top-reference-media">
                    <img src={topReferenceImage} alt="" aria-hidden="true" width="900" height="600" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                    <figcaption>
                      <strong>{selectedExerciseCopy?.name || selectedMuscleTargetCard?.label}</strong>
                      <span>{selectedProtocolItem?.exercise ? formatLocalizedExercisePrescription(selectedProtocolItem.exercise, isZh) : ''}</span>
                    </figcaption>
                  </figure>
                  <div className="mt-top-reference-body">
                    <h3>{selectedExerciseCopy?.name || selectedMuscleTargetCard?.label}</h3>
                    <p>{selectedExerciseCopy?.intent || todayCoachNarrative || stitchCopy.guideSubtitle}</p>
                    {selectedExerciseCopy?.steps?.length > 0 && (
                      <ul>
                        {selectedExerciseCopy.steps.slice(0, 2).map((step) => (
                          <li key={step}>
                            <span>i</span>
                            {step}
                          </li>
                        ))}
                      </ul>
                    )}
                    {selectedExerciseCopy?.muscles?.length > 0 && (
                      <div className="mt-top-reference-muscles">
                        <span>{stitchCopy.targetMusclesLabel}</span>
                        <div>
                          {selectedExerciseCopy.muscles.slice(0, 4).map((muscle) => (
                            <em key={muscle}>{muscle}</em>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </section>

            {/* ── Exercise List ── */}
            <section className="mt-exercises" aria-labelledby="mt-exercises-title">
              <div className="mt-exercises-head">
                <div>
                  <span className="mt-kicker">{t('muscle_training.stitch_mt_exercises_kicker')}</span>
                  <h2 id="mt-exercises-title" className="mt-card-title">{stitchCopy.protocolWorkspaceTitle}</h2>
                </div>
              </div>
              <div className="mt-exercises-filter" role="group" aria-label={stitchCopy.targetAreasTitle}>
                <button
                  type="button"
                  className={`mt-chip mt-chip--filter${activeTarget === 'all' ? ' is-active' : ''}`}
                  onClick={() => handleTargetAreaSelect('all')}
                  aria-pressed={activeTarget === 'all'}
                >
                  {stitchCopy.allTargets}
                  <small>({visibleExerciseItems.length})</small>
                </button>
                {targetAreaCards.map((ta) => (
                  <button
                    key={ta.key}
                    type="button"
                    className={`mt-chip mt-chip--filter${activeTarget === ta.key ? ' is-active' : ''}`}
                    onClick={() => handleTargetAreaSelect(ta.key)}
                    aria-pressed={activeTarget === ta.key}
                  >
                    <span>{ta.label}</span>
                    <span className="mt-filter-visual" aria-hidden="true">
                      <img src={ta.image} alt="" width="900" height="600" loading="lazy" decoding="async" />
                    </span>
                    <small>({ta.planCount})</small>
                  </button>
                ))}
              </div>
              <div className="mt-exercise-list" role="list">
                {visibleExerciseItems.map((item, idx) => {
                  const isLibrary = item.source === 'library';
                  const exerciseCopy = getExerciseContentForItem(item, isZh);
                  const exercisePrescription = formatLocalizedExercisePrescription(item.exercise, isZh);
                  const itemKey = getProtocolItemKey(item);
                  const isSelected = selectedExerciseKey === itemKey;
                  const isExpanded = expandedExerciseIdx === idx;
                  return (
                    <div key={itemKey} className={`mt-exercise-row${isSelected ? ' is-selected' : ''}`} role="listitem">
                      <div
                        className="mt-exercise-main"
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        aria-controls={`mt-ex-detail-${idx}`}
                        onClick={() => {
                          handleExerciseSelect(item);
                          setExpandedExerciseIdx(isExpanded ? null : idx);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleExerciseSelect(item);
                            setExpandedExerciseIdx(isExpanded ? null : idx);
                          }
                          if (e.key === 'Escape') {
                            setExpandedExerciseIdx(null);
                          }
                        }}
                      >
                        <span className="mt-exercise-num">{String(idx + 1).padStart(2, '0')}</span>
                        <div className="mt-exercise-info">
                          <strong>{exerciseCopy.name}</strong>
                          <span className="mt-exercise-meta">
                            {exercisePrescription}
                            {exerciseCopy.muscles.length > 0 && (
                              <>&nbsp;·&nbsp;{exerciseCopy.muscles.slice(0, 2).join(' / ')}</>
                            )}
                          </span>
                        </div>
                        <span className={`mt-exercise-badge${isLibrary ? ' is-library' : ' is-plan'}`}>
                          {isLibrary ? 'OPT' : 'PLAN'}
                        </span>
                        <span className="mt-exercise-chevron" aria-hidden="true">
                          <AppIcon name={isExpanded ? 'expand_less' : 'expand_more'} />
                        </span>
                      </div>
                      {isExpanded && (
                        <div id={`mt-ex-detail-${idx}`} className="mt-exercise-detail">
                          <div className="mt-exercise-detail-layout">
                            <div className="mt-exercise-record">
                              <p className="mt-exercise-record-prescription">{exercisePrescription}</p>
                              {exerciseCopy.steps.length > 0 && (
                                <ol className="mt-exercise-steps">
                                  {exerciseCopy.steps.map((step, si) => (
                                    <li key={si} className="mt-exercise-step">{step}</li>
                                  ))}
                                </ol>
                              )}
                              {exerciseCopy.intent && (
                                <p className="mt-exercise-intent">{exerciseCopy.intent}</p>
                              )}
                            </div>
                            {(() => {
                              const heatmapSlugs = getExerciseHeatmapSlugs(item, exerciseCopy);
                              if (heatmapSlugs.length === 0) return null;
                              const heatmapData = heatmapSlugs.map((slug) => ({ slug, intensity: 2 }));
                              const muscleLabel = exerciseCopy.muscles.join(' / ');
                              return (
                                <div className="mt-exercise-anatomy-panel">
                                  <figure
                                    className="mt-exercise-heatmap"
                                    aria-label={`${exerciseCopy.name}${muscleLabel ? ': ' + muscleLabel : ''}`}
                                  >
                                    <MuscleHeatmap
                                      data={heatmapData}
                                      frontLabel={isZh ? '正面' : 'Front'}
                                      backLabel={isZh ? '背面' : 'Back'}
                                    />
                                  </figure>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {visibleExerciseItems.length === 0 && (
                  <div className="mt-exercise-empty">
                    <strong>{stitchCopy.noAreaPlanExercises}</strong>
                    <p>{stitchCopy.targetCardsHint}</p>
                  </div>
                )}
              </div>
            </section>

            {/* Side rail: video + exercise reference */}
            <div className="mt-side-grid mt-media-rail">
              <div className="mt-media-rail-sticky">
                <article className="mt-card mt-video-card" aria-labelledby="mt-video-title">
                  <div className="mt-card-head">
                    <span className="mt-kicker">{stitchCopy.topReferenceKicker}</span>
                    <h2 id="mt-video-title" className="mt-card-title">{stitchCopy.videoDemoTitle}</h2>
                  </div>
                  {selectedExerciseVideoUrl ? (
                    <div className="mt-video-frame">
                      <iframe
                        src={selectedExerciseVideoUrl}
                        title={`${selectedExerciseCopy?.name || stitchCopy.noExerciseSelected} ${stitchCopy.videoDemoTitle}`}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="mt-video-missing">
                      <p>{stitchCopy.videoUnavailable}</p>
                      <a href={getExerciseVideoUrl(selectedProtocolItem?.exercise?.name)} target="_blank" rel="noreferrer">
                        {selectedExerciseCopy?.name || stitchCopy.noExerciseSelected}
                      </a>
                    </div>
                  )}
                </article>

                <article className="mt-card mt-reference-card" aria-labelledby="mt-reference-title">
                  <figure className="mt-reference-media">
                    <img
                      src={selectedExerciseReferenceImage}
                      alt={selectedExerciseCopy?.name || selectedRailTargetCard?.label || stitchCopy.noExerciseSelected}
                      width="900"
                      height="600"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                    <figcaption>
                      <span>{selectedRailTargetCard?.label || stitchCopy.targetLegs}</span>
                      <strong>{selectedExerciseCopy?.name || stitchCopy.noExerciseSelected}</strong>
                    </figcaption>
                  </figure>
                  <div className="mt-reference-body">
                    <span className="mt-kicker">{stitchCopy.professionalTips}</span>
                    <h2 id="mt-reference-title" className="mt-card-title">
                      {selectedExerciseCopy?.name || stitchCopy.noExerciseSelected}
                    </h2>
                    {selectedProtocolItem?.exercise && (
                      <p className="mt-reference-prescription">
                        {formatLocalizedExercisePrescription(selectedProtocolItem.exercise, isZh)}
                      </p>
                    )}
                    <p className="mt-reference-intent">
                      {selectedExerciseCopy?.intent || todayCoachNarrative || stitchCopy.guideSubtitle}
                    </p>
                    {selectedExerciseCopy?.steps?.length > 0 && (
                      <ul className="mt-reference-steps">
                        {selectedExerciseCopy.steps.slice(0, 3).map((step) => (
                          <li key={step}>
                            <span>i</span>
                            {step}
                          </li>
                        ))}
                      </ul>
                    )}
                    {selectedExerciseCopy?.muscles?.length > 0 && (
                      <div className="mt-reference-muscles">
                        <span>{stitchCopy.targetMusclesLabel}</span>
                        <div>
                          {selectedExerciseCopy.muscles.slice(0, 4).map((muscle) => (
                            <em key={muscle}>{muscle}</em>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              </div>
            </div>
          </>
        )}

        {!loading && !error && plan && (
          <>
            <section id="muscle-controls" className="strength-plan-control-deck muscle-activity-deck">
              <RunActivityContributionGraph
                runs={muscleCheckIns}
                status={muscleActivityState}
                lang={displayLang}
                t={t}
                activityType="muscle"
                action={(
                  <div className="muscle-activity-checkin-action">
                    <button
                      type="button"
                      className="muscle-activity-checkin-btn"
                      disabled={checkInSaving || plan.todayCheckIn?.entryState === 'ACTUAL'}
                      onClick={handleDailyCheckIn}
                    >
                      {checkInSaving
                        ? copy.checkInSaving
                        : plan.todayCheckIn?.entryState === 'ACTUAL'
                          ? copy.checkInDone
                          : copy.checkInSave}
                    </button>
                    {checkInNotice && <span className="muscle-activity-checkin-notice" role="status">{checkInNotice}</span>}
                  </div>
                )}
              />
            </section>
          </>
        )}
          </div>

        <footer className="runner-shell-footer runner-dashboard-footer">
          <FooterNavLinks />
        </footer>
        </div>
      </main>
    </div>
  );
}
