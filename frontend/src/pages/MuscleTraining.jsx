import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import MuscleHeatmap from '../components/MuscleHeatmap';
import FooterNavLinks from '../components/FooterNavLinks';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import TopbarNotifications from '../components/TopbarNotifications';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';
import { muscleSlugsForExercise } from '../utils/muscleSlugMapper';
import MUSCLE_MASKS from '../utils/muscleMasks.data.json';
import targetArmsUrl from '../assets/muscle-training/target-arms.webp';
import targetBackUrl from '../assets/muscle-training/target-back.webp';
import targetChestUrl from '../assets/muscle-training/target-chest.webp';
import targetCoreUrl from '../assets/muscle-training/target-core.webp';
import targetLegsUrl from '../assets/muscle-training/target-legs.webp';
import targetShouldersUrl from '../assets/muscle-training/target-shoulders.webp';

const DAY_OPTIONS = [
  { value: 'MONDAY', en: 'Mon', zh: '周一' },
  { value: 'TUESDAY', en: 'Tue', zh: '周二' },
  { value: 'WEDNESDAY', en: 'Wed', zh: '周三' },
  { value: 'THURSDAY', en: 'Thu', zh: '周四' },
  { value: 'FRIDAY', en: 'Fri', zh: '周五' },
  { value: 'SATURDAY', en: 'Sat', zh: '周六' },
  { value: 'SUNDAY', en: 'Sun', zh: '周日' },
];

const DEFAULT_PROFILE = {
  experienceLevel: 'BEGINNER',
  equipmentLevel: 'BODYWEIGHT',
  sessionMinutes: 30,
  noisePreference: 'NORMAL',
  preferredStrengthDays: ['MONDAY', 'THURSDAY'],
};

const CHECK_IN_RUN_TYPES = ['REST', 'EASY', 'RECOVERY', 'QUALITY', 'LONG_RUN', 'CROSS_TRAIN'];
const CHECK_IN_ENTRY_STATES = ['PLANNED', 'ACTUAL'];
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
  entryState: 'PLANNED',
  distanceKm: '',
  durationMinutes: '',
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

const EXERCISE_LABELS = {
  'Hip airplanes': { zh: '髋飞机', en: 'Hip airplanes' },
  'Calf raises (slow tempo)': { zh: '慢节奏提踵', en: 'Calf raises (slow tempo)' },
  'Dead bug': { zh: '死虫', en: 'Dead bug' },
  'Split squat': { zh: '分腿蹲', en: 'Split squat' },
  'Single-leg Romanian deadlift': { zh: '单腿罗马尼亚硬拉', en: 'Single-leg Romanian deadlift' },
  'Standing calf raise': { zh: '站姿提踵', en: 'Standing calf raise' },
  'Side plank': { zh: '侧桥', en: 'Side plank' },
  'Glute bridge (pause at top)': { zh: '臀桥（顶端停顿）', en: 'Glute bridge (pause at top)' },
  'Tibialis wall raise': { zh: '靠墙胫骨前肌提脚', en: 'Tibialis wall raise' },
  "World's greatest stretch": { zh: '世界最强拉伸', en: "World's greatest stretch" },
  'Ankle dorsiflexion rocks': { zh: '踝背屈前移', en: 'Ankle dorsiflexion rocks' },
  'Step-down (knee tracking)': { zh: '台阶下放（膝轨迹）', en: 'Step-down (knee tracking)' },
  'Hamstring curl (slider or machine)': { zh: '腘绳肌弯曲（滑盘/器械）', en: 'Hamstring curl (slider or machine)' },
  'Pallof press': { zh: 'Pallof 抗旋推', en: 'Pallof press' },
  'Farmer carry (suitcase)': { zh: '单侧农夫走', en: 'Farmer carry (suitcase)' },
  'Pogo hops': { zh: 'Pogo 弹跳', en: 'Pogo hops' },
  'Skipping A-drill': { zh: 'A Skip 抬腿跳步', en: 'Skipping A-drill' },
  'Box step-up (explosive)': { zh: '爆发式箱上踏步', en: 'Box step-up (explosive)' },
  'Single-leg hop (low amplitude)': { zh: '单腿小幅弹跳', en: 'Single-leg hop (low amplitude)' },
};

const DEFAULT_EXERCISE_COPY = {
  name: { zh: '跑者力量动作', en: 'Runner strength exercise' },
  muscles: { zh: ['跑者力量'], en: ['Runner strength'] },
  steps: {
    zh: ['先稳住身体。', '全程控制动作。', '保持均匀呼吸。'],
    en: ['Set your body first.', 'Move with control.', 'Keep your breathing steady.'],
  },
};

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

function normalizeProfile(profile) {
  return {
    ...DEFAULT_PROFILE,
    ...profile,
    preferredStrengthDays: Array.isArray(profile?.preferredStrengthDays) && profile.preferredStrengthDays.length > 0
      ? profile.preferredStrengthDays
      : DEFAULT_PROFILE.preferredStrengthDays,
  };
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

function buildCheckInDraft(plan, isMile) {
  const today = Array.isArray(plan?.days) ? plan.days[0] : null;
  const checkIn = plan?.todayCheckIn;
  if (checkIn) {
    return {
      runType: checkIn.runType || DEFAULT_CHECK_IN_DRAFT.runType,
      entryState: checkIn.entryState || DEFAULT_CHECK_IN_DRAFT.entryState,
      distanceKm: checkIn.distanceKm != null ? (isMile ? checkIn.distanceKm / KM_PER_MILE : checkIn.distanceKm) : '',
      durationMinutes: checkIn.durationMinutes ?? '',
    };
  }
  return {
    runType: mapWorkoutTypeToCheckInType(today?.run?.workoutType),
    entryState: 'PLANNED',
    distanceKm: today?.run?.plannedDistanceKm != null ? (isMile ? today.run.plannedDistanceKm / KM_PER_MILE : today.run.plannedDistanceKm) : '',
    durationMinutes: today?.run?.plannedDurationMinutes ?? '',
  };
}

function pickLabel(map, key, fallback = '-') {
  if (!key) return fallback;
  return map[key] || fallback || key;
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

function formatDayLabel(date, fallbackDay, displayLang) {
  if (date) {
    try {
      const locale = displayLang === 'zh-CN' ? 'zh-CN' : 'en-US';
      return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(`${date}T12:00:00`));
    } catch {
      /* ignore */
    }
  }
  const match = DAY_OPTIONS.find((option) => option.value === fallbackDay);
  return match ? (displayLang === 'zh-CN' ? match.zh : match.en) : (fallbackDay || '-');
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

function convertDistanceInput(value, fromMile, toMile) {
  if (value === '' || value == null) return '';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  if (fromMile === toMile) return trimNumber(parsed, 1) ?? '';
  const distanceKm = fromMile ? parsed * KM_PER_MILE : parsed;
  const convertedValue = toMile ? distanceKm / KM_PER_MILE : distanceKm;
  return trimNumber(convertedValue, 1) ?? '';
}

function formatMinutes(minutes, isZh) {
  if (typeof minutes !== 'number' || Number.isNaN(minutes)) return '-';
  return `${minutes} ${isZh ? '分钟' : 'min'}`;
}

function formatTimestamp(value, displayLang) {
  if (!value) return '-';
  try {
    const locale = displayLang === 'zh-CN' ? 'zh-CN' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatCopyTemplate(template, replacements = {}) {
  return Object.entries(replacements).reduce(
    (text, [token, value]) => text.replaceAll(`{${token}}`, value ?? ''),
    template || '',
  );
}

function parseOptionalNumber(value) {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInteger(value) {
  if (value === '' || value == null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatExercisePrescriptionValue(repsOrDuration, isZh) {
  if (!isZh || !repsOrDuration) return repsOrDuration;
  return repsOrDuration
    .replace(/\/side/g, '/侧')
    .replace(/(\d+(?:-\d+)?)s(?=\/|$)/g, '$1 秒')
    .replace(/(\d+(?:-\d+)?)m(?=\/|$)/g, '$1 米');
}

function formatExercisePrescription(exercise, isZh) {
  return `${exercise.sets} x ${formatExercisePrescriptionValue(exercise.repsOrDuration, isZh)} · RPE ${exercise.targetRpe}`;
}

function getLocalizedExerciseContent(exercise, isZh) {
  const definition = getExerciseDefinition(exercise?.name);
  const locale = isZh ? 'zh' : 'en';
  return {
    name: definition?.name?.[locale] || definition?.name?.en || normalizeExerciseName(exercise?.name) || DEFAULT_EXERCISE_COPY.name[locale],
    muscles: definition?.muscles?.[locale] || DEFAULT_EXERCISE_COPY.muscles[locale],
    steps: definition?.steps?.[locale] || DEFAULT_EXERCISE_COPY.steps[locale],
    intent: definition?.intent?.[locale] || exercise?.tempoOrIntent || '',
    regression: definition?.regression?.[locale] || exercise?.regression || '',
    progression: definition?.progression?.[locale] || exercise?.progression || '',
  };
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

function getExerciseEquipmentKey(exercise) {
  return exercise?.equipment || exercise?.equipmentNeeded || '';
}

function resolveExerciseVisualKey(name, muscles = []) {
  switch (normalizeExerciseName(name)) {
    case 'Dead bug':
      return 'deadbug';
    case 'Side plank':
      return 'sideplank';
    case 'Pallof press':
      return 'pallof';
    case 'Farmer carry (suitcase)':
      return 'carry';
    case 'Glute bridge (pause at top)':
      return 'bridge';
    case 'Hamstring curl (slider or machine)':
      return 'hamstring';
    case 'Split squat':
      return 'split';
    case 'Step-down (knee tracking)':
      return 'stepdown';
    case "World's greatest stretch":
      return 'stretch';
    case 'Single-leg Romanian deadlift':
      return 'hinge';
    case 'Hip airplanes':
      return 'balance';
    case 'Standing calf raise':
    case 'Calf raises (slow tempo)':
      return 'calf';
    case 'Tibialis wall raise':
      return 'shin';
    case 'Ankle dorsiflexion rocks':
      return 'ankle';
    case 'Pogo hops':
      return 'pogo';
    case 'Skipping A-drill':
      return 'skip';
    case 'Box step-up (explosive)':
      return 'stepup';
    case 'Single-leg hop (low amplitude)':
      return 'hop';
    default:
      {
        const muscleText = (muscles || []).join(' ').toLowerCase();
        if (/shin|胫/.test(muscleText)) return 'shin';
        if (/ankle|踝/.test(muscleText)) return 'ankle';
        if (/calf|小腿/.test(muscleText)) return 'calf';
        if (/hamstring|腘/.test(muscleText)) return 'hamstring';
        if (/glute|臀/.test(muscleText)) return 'bridge';
        if (/core|核心/.test(muscleText)) return 'deadbug';
      }
      return 'standing';
  }
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

function LegacyMuscleMap({ isZh }) {
  const setsLabel = isZh ? '4组' : '4 sets';

  const frontHighlights = [
    { d: 'M44 50 C48 44 56 44 60 50 L58 70 C55 75 49 75 46 70 Z', o: 0.92 },
    { d: 'M41 82 C45 86 47 100 44 118 C39 114 38 95 39 86 Z', o: 0.78 },
    { d: 'M63 82 C59 86 57 100 60 118 C65 114 66 95 65 86 Z', o: 0.78 },
  ];

  const backHighlights = [
    { d: 'M40 76 C47 71 54 74 56 86 C53 92 45 92 40 87 Z', o: 0.92 },
    { d: 'M64 76 C57 71 50 74 48 86 C51 92 59 92 64 87 Z', o: 0.92 },
    { d: 'M43 90 C47 98 48 112 45 126 C40 122 39 104 40 94 Z', o: 0.8 },
    { d: 'M61 90 C57 98 56 112 59 126 C64 122 65 104 64 94 Z', o: 0.8 },
    { d: 'M45 127 C48 135 48 150 45 164 C42 158 42 140 43 130 Z', o: 0.7 },
    { d: 'M59 127 C56 135 56 150 59 164 C62 158 62 140 61 130 Z', o: 0.7 },
  ];

  function renderBody(highlights) {
    return (
      <>
        <circle cx="52" cy="18" r="10" className="mm-head" />
        <path d="M40 32 C42 24 47 20 52 20 C57 20 62 24 64 32 L66 46 C67 54 61 62 52 64 C43 62 37 54 38 46 Z" className="mm-torso" />
        <path d="M37 38 C32 46 28 58 26 68" className="mm-limb" />
        <path d="M67 38 C72 46 76 58 78 68" className="mm-limb" />
        <path d="M45 65 C40 76 38 90 38 102" className="mm-limb" />
        <path d="M59 65 C64 76 66 90 66 102" className="mm-limb" />
        <path d="M38 102 C37 115 38 130 40 146" className="mm-limb mm-limb-lower" />
        <path d="M66 102 C67 115 66 130 64 146" className="mm-limb mm-limb-lower" />
        <path d="M45 64 C47 76 47 90 45 104" className="mm-def" />
        <path d="M59 64 C57 76 57 90 59 104" className="mm-def" />
        <path d="M44 42 C47 50 48 58 49 64" className="mm-def" />
        <path d="M60 42 C57 50 56 58 55 64" className="mm-def" />
        {highlights.map((h, i) => (
          <path key={i} d={h.d} className="mm-highlight" opacity={h.o} />
        ))}
      </>
    );
  }

  return (
    <div className="muscle-map-card">
      <svg viewBox="0 0 400 290" className="muscle-map-figure" aria-hidden="true">
        <defs>
          <filter id="mglow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Front body */}
        <g transform="translate(48, 10) scale(1.7)">
          {renderBody(frontHighlights)}
        </g>

        {/* Back body */}
        <g transform="translate(210, 10) scale(1.7)">
          {renderBody(backHighlights)}
        </g>

        {/* Front labels */}
        <text x="28" y="108" className="mm-label">{setsLabel}</text>
        <line x1="58" y1="106" x2="120" y2="106" className="mm-leader" />

        <text x="28" y="188" className="mm-label">{setsLabel}</text>
        <line x1="58" y1="186" x2="110" y2="186" className="mm-leader" />

        {/* Back labels */}
        <text x="374" y="150" className="mm-label" textAnchor="end">{setsLabel}</text>
        <line x1="344" y1="148" x2="310" y2="148" className="mm-leader" />

        <text x="374" y="228" className="mm-label" textAnchor="end">{setsLabel}</text>
        <line x1="344" y1="226" x2="316" y2="226" className="mm-leader" />
      </svg>
    </div>
  );
}

const BODY_MEASURE_REGIONS = [
  {
    key: 'core',
    view: 'front',
    label: { en: 'Core', zh: '核心' },
    tokens: ['core', 'abs', 'trunk', '核心'],
    paths: [
      'M98 83 C104 76 116 76 122 83 L120 126 C115 134 105 134 100 126 Z',
      'M92 90 C98 96 100 111 98 127 C91 121 89 104 90 94 Z',
      'M128 90 C122 96 120 111 122 127 C129 121 131 104 130 94 Z',
    ],
  },
  {
    key: 'hip-flexors',
    view: 'front',
    label: { en: 'Hip flexors', zh: '髋屈肌' },
    tokens: ['hip', 'flexor', 'groin', '髋'],
    paths: [
      'M96 132 C102 127 108 128 110 138 L106 153 C99 151 95 144 96 132 Z',
      'M124 132 C118 127 112 128 110 138 L114 153 C121 151 125 144 124 132 Z',
    ],
  },
  {
    key: 'quads',
    view: 'front',
    label: { en: 'Quads', zh: '股四头肌' },
    tokens: ['quad', 'quadriceps', 'knee', '膝', '大腿'],
    paths: [
      'M91 153 C101 158 103 184 99 211 C89 204 85 174 87 160 Z',
      'M129 153 C119 158 117 184 121 211 C131 204 135 174 133 160 Z',
    ],
  },
  {
    key: 'adductors',
    view: 'front',
    label: { en: 'Adductors', zh: '内收肌' },
    tokens: ['adductor', 'groin', 'inner', '内收'],
    paths: [
      'M105 151 C109 161 109 186 105 202 C101 190 101 165 103 153 Z',
      'M115 151 C111 161 111 186 115 202 C119 190 119 165 117 153 Z',
    ],
  },
  {
    key: 'shins',
    view: 'front',
    label: { en: 'Shins', zh: '胫骨前肌' },
    tokens: ['shin', 'tibialis', 'ankle', '胫骨', '踝'],
    paths: [
      'M91 215 C98 223 98 251 94 274 C87 262 86 233 88 219 Z',
      'M129 215 C122 223 122 251 126 274 C133 262 134 233 132 219 Z',
    ],
  },
  {
    key: 'glutes',
    view: 'back',
    label: { en: 'Glutes', zh: '臀部' },
    tokens: ['glute', '臀'],
    paths: [
      'M338 134 C350 126 362 130 365 145 C360 156 345 156 338 148 Z',
      'M392 134 C380 126 368 130 365 145 C370 156 385 156 392 148 Z',
    ],
  },
  {
    key: 'hamstrings',
    view: 'back',
    label: { en: 'Hamstrings', zh: '腘绳肌' },
    tokens: ['hamstring', 'posterior thigh', '腘'],
    paths: [
      'M342 156 C354 166 354 196 348 218 C337 207 335 174 339 160 Z',
      'M388 156 C376 166 376 196 382 218 C393 207 395 174 391 160 Z',
    ],
  },
  {
    key: 'calves',
    view: 'back',
    label: { en: 'Calves', zh: '小腿' },
    tokens: ['calf', 'calves', 'gastrocnemius', 'soleus', '小腿'],
    paths: [
      'M344 220 C354 230 354 258 348 281 C338 266 337 238 340 224 Z',
      'M386 220 C376 230 376 258 382 281 C392 266 393 238 390 224 Z',
    ],
  },
];

function resolveBodyMeasureRegions(focusMuscles) {
  const normalizedFocus = (focusMuscles || [])
    .map((muscle) => String(muscle || '').toLowerCase())
    .join(' ');
  const matched = BODY_MEASURE_REGIONS
    .filter((region) => region.tokens.some((token) => normalizedFocus.includes(token.toLowerCase())))
    .map((region) => region.key);
  return new Set(matched.length ? matched : ['glutes', 'hamstrings', 'calves', 'core']);
}

function MuscleMap({ isZh, focusMuscles = [], weekContext, weekDoseStats, copy }) {
  const activeRegions = resolveBodyMeasureRegions(focusMuscles);
  const activeRegionLabels = BODY_MEASURE_REGIONS
    .filter((region) => activeRegions.has(region.key))
    .map((region) => region.label[isZh ? 'zh' : 'en']);
  const loadScore = Math.min(100, Math.round(((weekDoseStats?.planned || 0) / Math.max(weekDoseStats?.recommended || 1, 1)) * 100));
  const acwrScore = weekContext?.acwr == null ? 50 : Math.min(100, Math.max(12, Math.round(weekContext.acwr * 70)));
  const bodyMeasureCopy = copy || {};

  function renderBaseBody(prefix) {
    return (
      <>
        <circle cx={prefix === 'front' ? 110 : 365} cy="38" r="18" className="mt-body-measure-base mt-body-measure-head" />
        <path
          d={prefix === 'front'
            ? 'M88 68 C92 50 102 45 110 45 C118 45 128 50 132 68 L139 118 C135 132 124 141 110 142 C96 141 85 132 81 118 Z'
            : 'M343 68 C347 50 357 45 365 45 C373 45 383 50 387 68 L394 118 C390 132 379 141 365 142 C351 141 340 132 336 118 Z'}
          className="mt-body-measure-base"
        />
        <path d={prefix === 'front' ? 'M80 75 C63 98 57 123 54 151' : 'M335 75 C318 98 312 123 309 151'} className="mt-body-measure-limb" />
        <path d={prefix === 'front' ? 'M140 75 C157 98 163 123 166 151' : 'M395 75 C412 98 418 123 421 151'} className="mt-body-measure-limb" />
        <path d={prefix === 'front' ? 'M93 141 C82 166 79 201 87 224' : 'M348 141 C337 166 334 201 342 224'} className="mt-body-measure-limb" />
        <path d={prefix === 'front' ? 'M127 141 C138 166 141 201 133 224' : 'M382 141 C393 166 396 201 388 224'} className="mt-body-measure-limb" />
        <path d={prefix === 'front' ? 'M87 224 C84 248 86 273 94 300' : 'M342 224 C339 248 341 273 349 300'} className="mt-body-measure-limb mt-body-measure-lower" />
        <path d={prefix === 'front' ? 'M133 224 C136 248 134 273 126 300' : 'M388 224 C391 248 389 273 381 300'} className="mt-body-measure-limb mt-body-measure-lower" />
      </>
    );
  }

  return (
    <div className="muscle-map-card mt-body-measure-atlas">
      <div className="mt-body-measure-header">
        <span className="strength-plan-section-label">{bodyMeasureCopy.title}</span>
        <strong>{activeRegionLabels.slice(0, 3).join(' / ')}</strong>
      </div>

      <svg
        viewBox="0 0 520 340"
        className="muscle-map-figure mt-body-measure-svg"
        role="img"
        aria-labelledby="mt-body-measure-title mt-body-measure-desc"
      >
        <title id="mt-body-measure-title">{bodyMeasureCopy.title}</title>
        <desc id="mt-body-measure-desc">{bodyMeasureCopy.desc}</desc>
        <defs>
          <linearGradient id="mtBodyMeasureHot" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.92" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.54" />
          </linearGradient>
        </defs>

        <g className="mt-body-measure-view" aria-label={bodyMeasureCopy.anterior}>
          <text x="110" y="24" textAnchor="middle" className="mt-body-measure-view-label">{bodyMeasureCopy.anterior}</text>
          {renderBaseBody('front')}
        </g>
        <g className="mt-body-measure-view" aria-label={bodyMeasureCopy.posterior}>
          <text x="365" y="24" textAnchor="middle" className="mt-body-measure-view-label">{bodyMeasureCopy.posterior}</text>
          {renderBaseBody('back')}
        </g>

        {BODY_MEASURE_REGIONS.map((region) => (
          <g key={region.key} className={`mt-body-measure-region${activeRegions.has(region.key) ? ' is-active' : ''}`} data-region={region.key}>
            {region.paths.map((d, index) => (
              <path key={`${region.key}-${index}`} d={d} />
            ))}
          </g>
        ))}

        <line x1="226" y1="70" x2="226" y2="292" className="mt-body-measure-divider" />
      </svg>

      <div className="mt-body-measure-readout">
        <div className="mt-body-measure-gauge">
          <span>{bodyMeasureCopy.loadLabel}</span>
          <strong>{loadScore}%</strong>
          <i style={{ '--measure': `${loadScore}%` }} />
        </div>
        <div className="mt-body-measure-gauge">
          <span>{bodyMeasureCopy.balanceLabel}</span>
          <strong>{weekContext?.acwr == null ? '-' : trimNumber(weekContext.acwr, 2)}</strong>
          <i style={{ '--measure': `${acwrScore}%` }} />
        </div>
      </div>
    </div>
  );
}

const REFERENCE_BODY_MEASURE_VIEWBOX = { width: 790, height: 580 };
/*
 * The posterior PNG uses the same source-to-SVG scale as the anterior PNG,
 * then gets a head-reveal y nudge. That keeps the rear view reading as the
 * same person instead of a larger, broader body while leaving enough top room
 * for the back head. Its visible body axis is centered in the wider rear grid,
 * and the posterior SVG/muscle regions share that fitted person-scale matrix
 * with legacy x-axis corrections on top.
 */
const POSTERIOR_SVG_ALIGNMENT_TRANSFORM = 'matrix(0.9665354331 0 0 0.9665354331 32.3948031496 18.805511811)';
const POSTERIOR_REGION_ALIGNMENT_TRANSFORM = 'matrix(0.9665354331 0 0 0.9665354331 83.7 9.0)';
const POSTERIOR_GLUTE_REGION_ALIGNMENT_TRANSFORM = 'matrix(0.9665354331 0 0 0.9665354331 89.0 12.0)';
const POSTERIOR_LEG_REGION_ALIGNMENT_TRANSFORM = 'matrix(0.9665354331 0 0 0.9665354331 70.5 7.0)';

// Mapping from muscleMasks.data.json key → REFERENCE_BODY_MEASURE_REGIONS key
// Each mask key maps to the region it belongs to; multiple mask keys can share a region key.
const MASK_KEY_TO_REGION_KEY = {
  'neck': 'neck',
  'traps-front-left': 'traps-front',
  'traps-front-right': 'traps-front',
  'deltoids-left': 'deltoids',
  'deltoids-right': 'deltoids',
  'pectorals-left': 'pectorals',
  'pectorals-right': 'pectorals',
  'biceps-left': 'biceps',
  'biceps-right': 'biceps',
  'forearms-front-left': 'forearms-front',
  'forearms-front-right': 'forearms-front',
  'abdominals': 'abdominals',
  'quadriceps-left': 'quadriceps',
  'quadriceps-right': 'quadriceps',
  'calves-front-left': 'calves-front',
  'calves-front-right': 'calves-front',
  'trapezius-left': 'trapezius',
  'trapezius-right': 'trapezius',
  'shoulders-back-left': 'shoulders-back',
  'shoulders-back-right': 'shoulders-back',
  'lats-left': 'lats',
  'lats-right': 'lats',
  'triceps-left': 'triceps',
  'triceps-right': 'triceps',
  'forearms-back-left': 'forearms-back',
  'forearms-back-right': 'forearms-back',
  'lower-back-left': 'lower-back',
  'lower-back-right': 'lower-back',
  'glutes-left': 'glutes',
  'glutes-right': 'glutes',
  'hamstrings-left': 'hamstrings',
  'hamstrings-right': 'hamstrings',
  'gastrocnemius-left': 'gastrocnemius',
  'gastrocnemius-right': 'gastrocnemius',
};

function getPosteriorRegionAlignmentTransform(region) {
  return region.posteriorAlignmentTransform || POSTERIOR_REGION_ALIGNMENT_TRANSFORM;
}
const REFERENCE_BODY_MEASURE_FRONT_OUTLINE = [
  'M190 46 C200 46 206 56 205 70 C204 85 198 99 194 106',
  'L194 120 C211 123 229 129 244 141 C257 151 265 168 270 188',
  'C279 209 285 236 286 263 C287 286 286 307 282 321',
  'C278 333 270 336 263 324 C259 315 258 292 258 270',
  'C257 230 251 195 241 169 C233 188 230 218 228 246',
  'C226 274 220 303 210 322 C214 353 218 391 217 433',
  'C216 477 212 518 206 546 C204 556 196 557 194 547',
  'C190 519 188 487 187 455 C186 487 184 519 180 547',
  'C178 557 170 556 168 546 C162 518 158 477 157 433',
  'C156 391 160 353 164 322 C154 303 148 274 146 246',
  'C144 218 141 188 133 169 C123 195 117 230 116 270',
  'C116 292 115 315 111 324 C104 336 96 333 92 321',
  'C88 307 87 286 89 263 C90 236 96 209 106 188',
  'C111 168 119 151 132 141 C147 129 165 123 186 120',
  'L186 106 C182 99 176 85 175 70 C174 56 180 46 190 46 Z',
].join(' ');
const REFERENCE_BODY_MEASURE_BACK_OUTLINE = [
  'M570 46 C580 46 586 56 585 70 C584 85 578 99 574 106',
  'L574 120 C591 123 609 129 624 141 C637 151 645 168 650 188',
  'C659 209 665 236 666 263 C668 286 666 307 662 321',
  'C658 333 650 336 643 324 C639 315 638 292 638 270',
  'C637 230 631 195 621 169 C613 188 610 218 608 246',
  'C606 274 600 303 590 322 C594 353 598 391 597 433',
  'C596 477 592 518 586 546 C584 556 576 557 574 547',
  'C570 519 568 487 567 455 C566 487 564 519 560 547',
  'C558 557 550 556 548 546 C542 518 538 477 537 433',
  'C536 391 540 353 544 322 C534 303 528 274 526 246',
  'C524 218 521 188 513 169 C503 195 497 230 496 270',
  'C496 292 495 315 491 324 C484 336 476 333 472 321',
  'C468 307 466 286 468 263 C469 236 475 209 485 188',
  'C490 168 498 151 511 141 C526 129 544 123 566 120',
  'L566 106 C562 99 556 85 555 70 C554 56 560 46 570 46 Z',
].join(' ');

/* ── Clean anatomical chart regions ─────────────────────────────────────
   Front figure centred ~x190, back figure centred ~x570.
   callout.side 'left'  → label sits to the left  of the figure
   callout.side 'right' → label sits to the right of the figure
──────────────────────────────────────────────────────────────────────── */
const REFERENCE_BODY_MEASURE_REGIONS = [
  /* ── FRONT VIEW ──────────────────────────────────────────────── */
  {
    key: 'neck',
    label: { en: 'Neck', zh: '颈部' },
    tokens: ['neck', '颈'],
    callout: { from: [190, 108], elbow: [128, 92], label: [108, 82], side: 'left' },
    anchors: [{ cx: 190, cy: 120, kind: 'circle', r: 6 }],
  },
  {
    key: 'traps-front',
    label: { en: 'Traps', zh: '斜方肌' },
    tokens: ['trapezius', 'trap', '斜方肌'],
    callout: { from: [148, 130], elbow: [100, 114], label: [80, 104], side: 'left' },
    anchors: [
      { cx: 168, cy: 140, kind: 'ellipse', rx: 10, ry: 8 },
      { cx: 212, cy: 140, kind: 'ellipse', rx: 10, ry: 8 },
    ],
  },
  {
    key: 'deltoids',
    label: { en: 'Shoulders', zh: '肩' },
    tokens: ['shoulder', 'deltoid', '肩', '三角肌'],
    callout: { from: [122, 148], elbow: [78, 140], label: [58, 130], side: 'left' },
    anchors: [
      { cx: 130, cy: 160, kind: 'circle', r: 10 },
      { cx: 250, cy: 160, kind: 'circle', r: 10 },
    ],
  },
  {
    key: 'pectorals',
    label: { en: 'Chest', zh: '胸' },
    tokens: ['pectoral', 'chest', '胸', '胸大肌'],
    callout: { from: [230, 155], elbow: [278, 144], label: [298, 134], side: 'right' },
    anchors: [
      { cx: 170, cy: 170, kind: 'ellipse', rx: 14, ry: 10 },
      { cx: 210, cy: 170, kind: 'ellipse', rx: 14, ry: 10 },
    ],
  },
  {
    key: 'biceps',
    label: { en: 'Biceps', zh: '肱二头肌' },
    tokens: ['biceps', 'arm', 'elbow', '肱二头肌', '手臂'],
    callout: { from: [278, 190], elbow: [310, 188], label: [332, 178], side: 'right' },
    anchors: [
      { cx: 98, cy: 200, kind: 'ellipse', rx: 10, ry: 22 },
      { cx: 282, cy: 200, kind: 'ellipse', rx: 10, ry: 22 },
    ],
  },
  {
    key: 'forearms-front',
    label: { en: 'Forearms', zh: '前臂' },
    tokens: ['forearm', 'brachioradialis', 'wrist', '手腕', '前臂'],
    callout: { from: [296, 248], elbow: [326, 256], label: [348, 254], side: 'right' },
    anchors: [
      { cx: 88, cy: 270, kind: 'ellipse', rx: 10, ry: 26 },
      { cx: 292, cy: 270, kind: 'ellipse', rx: 10, ry: 26 },
    ],
  },
  {
    key: 'abdominals',
    label: { en: 'Abs', zh: '腹部' },
    tokens: ['core', 'abs', 'abdominals', 'trunk', '腹', '核心'],
    callout: { from: [190, 220], elbow: [264, 218], label: [286, 218], side: 'right' },
    anchors: [{ cx: 190, cy: 212, kind: 'ellipse', rx: 14, ry: 38 }],
  },
  {
    key: 'quadriceps',
    label: { en: 'Quadriceps', zh: '股四头肌' },
    tokens: ['quad', 'quadriceps', 'knee', 'thigh', '股四头肌', '大腿'],
    callout: { from: [226, 346], elbow: [278, 368], label: [300, 372], side: 'right' },
    anchors: [
      { cx: 170, cy: 360, kind: 'ellipse', rx: 14, ry: 50 },
      { cx: 210, cy: 360, kind: 'ellipse', rx: 14, ry: 50 },
    ],
  },
  {
    key: 'calves-front',
    label: { en: 'Shins', zh: '胫骨前肌' },
    tokens: ['shin', 'shins', 'tibialis', 'ankle', '胫骨', '胫骨前肌', '踝'],
    callout: { from: [230, 462], elbow: [278, 480], label: [300, 480], side: 'right' },
    anchors: [
      { cx: 170, cy: 480, kind: 'ellipse', rx: 10, ry: 30 },
      { cx: 210, cy: 480, kind: 'ellipse', rx: 10, ry: 30 },
    ],
  },

  /* ── BACK VIEW ───────────────────────────────────────────────── */
  {
    key: 'trapezius',
    label: { en: 'Traps', zh: '斜方肌' },
    tokens: ['trapezius', 'trap', '斜方肌'],
    callout: { from: [526, 112], elbow: [600, 96], label: [614, 86], side: 'left' },
    posteriorAlignmentTransform: POSTERIOR_REGION_ALIGNMENT_TRANSFORM,
    anchors: [
      { cx: 486, cy: 128, kind: 'circle', r: 10 },
      { cx: 538, cy: 128, kind: 'circle', r: 10 },
    ],
  },
  {
    key: 'shoulders-back',
    label: { en: 'Shoulders', zh: '肩' },
    tokens: ['shoulder', 'deltoid', 'infraspinatus', '肩', '三角肌', '冈下肌'],
    callout: { from: [578, 154], elbow: [604, 144], label: [614, 134], side: 'left' },
    posteriorAlignmentTransform: POSTERIOR_REGION_ALIGNMENT_TRANSFORM,
    anchors: [
      { cx: 448, cy: 160, kind: 'circle', r: 10 },
      { cx: 576, cy: 160, kind: 'circle', r: 10 },
    ],
  },
  {
    key: 'lats',
    label: { en: 'Lats', zh: '背阔肌' },
    tokens: ['lat', 'lats', 'back', 'latissimus', '背阔肌', '背', 'upper back'],
    callout: { from: [576, 224], elbow: [604, 240], label: [614, 240], side: 'left' },
    posteriorAlignmentTransform: POSTERIOR_REGION_ALIGNMENT_TRANSFORM,
    anchors: [
      { cx: 470, cy: 215, kind: 'ellipse', rx: 14, ry: 28 },
      { cx: 554, cy: 215, kind: 'ellipse', rx: 14, ry: 28 },
    ],
  },
  {
    key: 'triceps',
    label: { en: 'Triceps', zh: '肱三头肌' },
    tokens: ['triceps', 'arm', '肱三头肌', '手臂'],
    callout: { from: [622, 208], elbow: [642, 210], label: [650, 210], side: 'left' },
    posteriorAlignmentTransform: POSTERIOR_REGION_ALIGNMENT_TRANSFORM,
    anchors: [
      { cx: 420, cy: 200, kind: 'ellipse', rx: 10, ry: 24 },
      { cx: 604, cy: 200, kind: 'ellipse', rx: 10, ry: 24 },
    ],
  },
  {
    key: 'forearms-back',
    label: { en: 'Forearms', zh: '前臂' },
    tokens: ['forearm', 'wrist', '前臂', '手腕'],
    callout: { from: [624, 262], elbow: [642, 270], label: [650, 270], side: 'left' },
    posteriorAlignmentTransform: POSTERIOR_REGION_ALIGNMENT_TRANSFORM,
    anchors: [
      { cx: 410, cy: 270, kind: 'ellipse', rx: 10, ry: 28 },
      { cx: 614, cy: 270, kind: 'ellipse', rx: 10, ry: 28 },
    ],
  },
  {
    key: 'lower-back',
    label: { en: 'Lower Back', zh: '下背' },
    tokens: ['spine', 'erector', 'lower back', '竖脊肌', '腰'],
    callout: { from: [530, 246], elbow: [612, 271], label: [630, 275], side: 'left' },
    posteriorAlignmentTransform: POSTERIOR_REGION_ALIGNMENT_TRANSFORM,
    anchors: [
      { cx: 502, cy: 270, kind: 'ellipse', rx: 8, ry: 20 },
      { cx: 522, cy: 270, kind: 'ellipse', rx: 8, ry: 20 },
    ],
  },
  {
    key: 'glutes',
    label: { en: 'Glutes', zh: '臀部' },
    tokens: ['glute', 'hip', 'posterior chain', '臀'],
    callout: { from: [556, 360], elbow: [612, 374], label: [630, 378], side: 'left' },
    posteriorAlignmentTransform: POSTERIOR_GLUTE_REGION_ALIGNMENT_TRANSFORM,
    anchors: [
      { cx: 503, cy: 330, kind: 'ellipse', rx: 18, ry: 18 },
      { cx: 541, cy: 330, kind: 'ellipse', rx: 18, ry: 18 },
    ],
  },
  {
    key: 'hamstrings',
    label: { en: 'Hamstrings', zh: '腘绳肌' },
    tokens: ['hamstring', 'posterior thigh', 'posterior chain', '腘绳肌', '大腿'],
    callout: { from: [576, 396], elbow: [612, 416], label: [630, 420], side: 'left' },
    posteriorAlignmentTransform: POSTERIOR_LEG_REGION_ALIGNMENT_TRANSFORM,
    anchors: [
      { cx: 510, cy: 395, kind: 'ellipse', rx: 12, ry: 32 },
      { cx: 552, cy: 395, kind: 'ellipse', rx: 12, ry: 32 },
    ],
  },
  {
    key: 'gastrocnemius',
    label: { en: 'Calves', zh: '小腿' },
    tokens: ['calf', 'calves', 'gastrocnemius', 'soleus', 'ankle', '小腿', '腓肠肌', '踝'],
    callout: { from: [576, 456], elbow: [612, 472], label: [630, 476], side: 'left' },
    posteriorAlignmentTransform: POSTERIOR_LEG_REGION_ALIGNMENT_TRANSFORM,
    anchors: [
      { cx: 515, cy: 490, kind: 'ellipse', rx: 10, ry: 24 },
      { cx: 547, cy: 490, kind: 'ellipse', rx: 10, ry: 24 },
    ],
  },
];

function resolveReferenceBodyMeasureRegionKeys(focusMuscles) {
  const normalizedFocus = (focusMuscles || [])
    .map((muscle) => String(muscle || '').toLowerCase())
    .join(' ');
  return REFERENCE_BODY_MEASURE_REGIONS
    .filter((region) => region.tokens.some((token) => normalizedFocus.includes(token.toLowerCase())))
    .map((region) => region.key);
}

function resolveReferenceBodyMeasureRegions(focusMuscles) {
  const matched = resolveReferenceBodyMeasureRegionKeys(focusMuscles);
  return new Set(matched.length ? matched : ['glutes', 'hamstrings', 'gastrocnemius', 'abdominals']);
}

function ReferenceMuscleMap({ isZh, focusMuscles = [], weekContext, weekDoseStats, copy, inspection = new Map(), compact = false }) {
  const planRegions = resolveReferenceBodyMeasureRegions(focusMuscles);
  const [hoveredRegionKey, setHoveredRegionKey] = useState(null);
  const [selectedRegionKey, setSelectedRegionKey] = useState(null);
  const focusRegionKey = hoveredRegionKey || selectedRegionKey;
  const toggleSelectedRegion = useCallback((regionKey) => {
    setSelectedRegionKey((current) => (current === regionKey ? null : regionKey));
  }, []);
  const handleRegionKeyDown = useCallback((event, regionKey) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleSelectedRegion(regionKey);
      return;
    }
    if (event.key === 'Escape') {
      setHoveredRegionKey(null);
      setSelectedRegionKey(null);
    }
  }, [toggleSelectedRegion]);
  const highlightedRegions = selectedRegionKey ? new Set([selectedRegionKey]) : new Set();
  const bodyMeasureCopy = copy || {};
  const activeRegionLabels = REFERENCE_BODY_MEASURE_REGIONS
    .filter((region) => (focusRegionKey ? region.key === focusRegionKey : planRegions.has(region.key)))
    .map((region) => region.label[isZh ? 'zh' : 'en']);
  const planRegionOptions = REFERENCE_BODY_MEASURE_REGIONS.filter((region) => planRegions.has(region.key));
  const focusedRegion = REFERENCE_BODY_MEASURE_REGIONS.find((region) => region.key === focusRegionKey);
  const focusedRegionLabel = focusedRegion?.label?.[isZh ? 'zh' : 'en'] || activeRegionLabels[0] || bodyMeasureCopy.interactionHint;
  const focusedInspection = focusRegionKey ? inspection.get(focusRegionKey) : null;
  const focusedInspectionExercises = focusedInspection?.exercises || [];
  const focusedInspectionSummary = focusedInspectionExercises.length
    ? focusedInspectionExercises.map((item) => item.name).slice(0, 3).join(' / ')
    : bodyMeasureCopy.inspectHint;
  const loadScore = Math.min(100, Math.round(((weekDoseStats?.planned || 0) / Math.max(weekDoseStats?.recommended || 1, 1)) * 100));
  const acwrScore = weekContext?.acwr == null ? 50 : Math.min(100, Math.max(12, Math.round(weekContext.acwr * 70)));
  const atlasClassName = [
    'muscle-map-card',
    'mt-body-measure-atlas',
    'mt-body-clinical-atlas',
    'mt-body-svg-human-atlas',
    'mt-body-medical-atlas',
    'mt-body-lean-runner-atlas',
    compact ? 'mt-body-measure-atlas--compact' : '',
  ].filter(Boolean).join(' ');

  const renderRegion = (region) => {
    const isPlanActive = planRegions.has(region.key);
    const isFocused = hoveredRegionKey === region.key;
    const isPosteriorRegion = region.callout.from[0] > REFERENCE_BODY_MEASURE_VIEWBOX.width / 2;
    const posteriorRegionTransform = isPosteriorRegion ? getPosteriorRegionAlignmentTransform(region) : undefined;
    const regionLabel = region.label[isZh ? 'zh' : 'en'];
    const regionInspection = inspection.get(region.key);
    const regionExerciseNames = (regionInspection?.exercises || []).map((item) => item.name).slice(0, 2).join(' / ');
    const regionAriaLabel = regionExerciseNames
      ? `${regionLabel}, ${bodyMeasureCopy.trainedByLabel || ''} ${regionExerciseNames}`.trim()
      : regionLabel;
    const anchors = region.anchors || [];
    // Compute a bounding hit-target rect that covers all anchors for pointer events
    const allCx = anchors.map((a) => a.cx);
    const allCy = anchors.map((a) => a.cy);
    const hitR = 42; // half hit-area size in viewBox units
    const hitX = allCx.length ? Math.min(...allCx) - hitR : 0;
    const hitY = allCy.length ? Math.min(...allCy) - hitR : 0;
    const hitW = allCx.length ? Math.max(...allCx) - Math.min(...allCx) + hitR * 2 : 0;
    const hitH = allCy.length ? Math.max(...allCy) - Math.min(...allCy) + hitR * 2 : 0;
    return (
      <g
        key={region.key}
        className={`mt-body-measure-region${highlightedRegions.has(region.key) ? ' is-active' : ''}${isPlanActive ? ' is-plan-active' : ''}${regionInspection?.exercises?.length ? ' is-trainable' : ''}${isFocused ? ' is-focused' : ''}`}
        data-region={region.key}
        data-training-count={regionInspection?.exercises?.length || 0}
        data-view={isPosteriorRegion ? 'posterior' : 'anterior'}
        transform={posteriorRegionTransform}
        role="button"
        tabIndex={0}
        aria-label={regionAriaLabel}
        aria-pressed={selectedRegionKey === region.key}
        onMouseEnter={() => setHoveredRegionKey(region.key)}
        onMouseLeave={() => setHoveredRegionKey(null)}
        onFocus={() => setHoveredRegionKey(region.key)}
        onBlur={() => setHoveredRegionKey(null)}
        onClick={() => toggleSelectedRegion(region.key)}
        onKeyDown={(event) => handleRegionKeyDown(event, region.key)}
      >
        {/* Invisible hit-target rect spanning all anchor positions */}
        {allCx.length > 0 && (
          <rect
            className="mt-body-measure-hit-target"
            x={hitX} y={hitY} width={hitW} height={hitH}
            rx={hitR}
            aria-hidden="true"
          />
        )}
      </g>
    );
  };

  const renderRegionBed = (region) => {
    const isPosteriorRegion = region.callout.from[0] > REFERENCE_BODY_MEASURE_VIEWBOX.width / 2;
    const posteriorRegionTransform = isPosteriorRegion ? getPosteriorRegionAlignmentTransform(region) : undefined;
    const anchors = region.anchors || [];
    return (
      <g
        key={`${region.key}-bed`}
        className="mt-body-measure-region-bed"
        data-region={region.key}
        data-view={isPosteriorRegion ? 'posterior' : 'anterior'}
        transform={posteriorRegionTransform}
        aria-hidden="true"
      >
        {anchors.map((anchor, index) => (
          anchor.kind === 'circle'
            ? <circle key={`${region.key}-bed-${index}`} cx={anchor.cx} cy={anchor.cy} r={(anchor.r || 8) * 2.4} />
            : <ellipse key={`${region.key}-bed-${index}`} cx={anchor.cx} cy={anchor.cy} rx={(anchor.rx || 8) * 2.2} ry={(anchor.ry || 14) * 2.2} />
        ))}
      </g>
    );
  };

  return (
    <div className={atlasClassName}>
      <div className="mt-body-measure-header">
        <span className="strength-plan-section-label">{bodyMeasureCopy.title}</span>
        <strong>{activeRegionLabels.slice(0, 3).join(' / ')}</strong>
      </div>

      <div className="mt-body-measure-anatomy-plate">
        <svg
          viewBox={`0 0 ${REFERENCE_BODY_MEASURE_VIEWBOX.width} ${REFERENCE_BODY_MEASURE_VIEWBOX.height}`}
          className="muscle-map-figure mt-body-measure-svg mt-body-reference-standard"
          role="img"
          aria-labelledby="mt-body-measure-title mt-body-measure-desc"
        >
          <title id="mt-body-measure-title">{bodyMeasureCopy.title}</title>
          <desc id="mt-body-measure-desc">{bodyMeasureCopy.desc}</desc>
          <defs>
            {/* Spotlight radial glow — coral at centre, transparent at edge */}
            <radialGradient id="mtMuscleGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent-coral-strong, #f07561)" stopOpacity="0.85" />
              <stop offset="55%" stopColor="var(--accent-coral, #ffb4a7)" stopOpacity="0.42" />
              <stop offset="100%" stopColor="var(--accent-coral, #ffb4a7)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="mtBodyMeasureHot" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.98" />
              <stop offset="58%" stopColor="currentColor" stopOpacity="0.76" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.54" />
            </linearGradient>
            <linearGradient id="mtBodyMeasureRest" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#df7452" stopOpacity="0.84" />
              <stop offset="58%" stopColor="#c94f35" stopOpacity="0.72" />
              <stop offset="100%" stopColor="#9d3028" stopOpacity="0.58" />
            </linearGradient>
            <linearGradient id="mtBodyAnatomyBase" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f07856" stopOpacity="0.98" />
              <stop offset="42%" stopColor="#c94631" stopOpacity="0.96" />
              <stop offset="100%" stopColor="#7f241d" stopOpacity="0.94" />
            </linearGradient>
            <linearGradient id="mtBodyHumanFascia" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#eaa184" stopOpacity="0.94" />
              <stop offset="40%" stopColor="#bf553f" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#7d241c" stopOpacity="0.88" />
            </linearGradient>
            <radialGradient id="mtBodyHumanMusclePlate" cx="48%" cy="26%" r="78%">
              <stop offset="0%" stopColor="#f7b197" stopOpacity="0.86" />
              <stop offset="48%" stopColor="#b9412f" stopOpacity="0.82" />
              <stop offset="100%" stopColor="#641812" stopOpacity="0.78" />
            </radialGradient>
            <radialGradient id="mtBodyMuscleBelly" cx="42%" cy="24%" r="76%">
              <stop offset="0%" stopColor="#ffc0a5" stopOpacity="0.96" />
              <stop offset="44%" stopColor="#db5f41" stopOpacity="0.94" />
              <stop offset="100%" stopColor="#7f211a" stopOpacity="0.9" />
            </radialGradient>
            <radialGradient id="mtBodyMuscleBellyDeep" cx="38%" cy="18%" r="80%">
              <stop offset="0%" stopColor="#e8a882" stopOpacity="0.92" />
              <stop offset="44%" stopColor="#c04428" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#6e1a14" stopOpacity="0.9" />
            </radialGradient>
            <linearGradient id="mtBodyAnatomyTendon" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#fad5c0" stopOpacity="0.82" />
              <stop offset="100%" stopColor="#c45a3a" stopOpacity="0.74" />
            </linearGradient>
            <pattern id="mtBodyTissueTexture" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
              <path d="M-4 10 C4 4 12 18 26 8" fill="none" stroke="#ffe4d8" strokeOpacity="0.2" strokeWidth="1.1" />
              <path d="M-2 18 C7 12 14 26 28 16" fill="none" stroke="#7b2017" strokeOpacity="0.12" strokeWidth="0.7" />
            </pattern>
            <clipPath id="mtBodyClinicalClip" clipPathUnits="userSpaceOnUse">
              <path d={REFERENCE_BODY_MEASURE_FRONT_OUTLINE} />
              <g transform={POSTERIOR_SVG_ALIGNMENT_TRANSFORM}>
                <path d={REFERENCE_BODY_MEASURE_BACK_OUTLINE} />
              </g>
            </clipPath>
            <clipPath id="mtBodyAnteriorPlate" clipPathUnits="userSpaceOnUse">
              <rect x="58" y="42" width="264" height="508" rx="32" />
            </clipPath>
            <clipPath id="mtBodyPosteriorPlate" clipPathUnits="userSpaceOnUse">
              <rect x="391.8" y="42" width="383.1" height="508" rx="32" />
            </clipPath>
            {/* Per-muscle pixel-trace clip paths from muscleMasks.data.json */}
            {Object.entries(MUSCLE_MASKS.masks).map(([key, m]) =>
              m.d ? (
                <clipPath key={`mmask-cp-${key}`} id={`muscle-mask-${key}`} clipPathUnits="userSpaceOnUse">
                  <path d={m.d} />
                </clipPath>
              ) : null
            )}
          </defs>

          <g className="mt-body-clinical-frame" aria-hidden="true">
            <rect x="58" y="42" width="264" height="508" rx="32" />
            <rect x="391.8" y="42" width="383.1" height="508" rx="32" />
            <path d="M78 84 H128 M252 84 H302 M78 508 H128 M252 508 H302" />
            <path d="M412 84 H462 M705 84 H755 M412 508 H462 M705 508 H755" />
            <path className="mt-body-clinical-axis" d="M190 70 V534 M570 70 V534" />
          </g>

          {/* ── FRONT FIGURE ─────────────────────────────────────────────── */}
          <g className="mt-body-measure-view" aria-label={bodyMeasureCopy.anterior}>
            <text x="190" y="28" textAnchor="middle" className="mt-body-measure-view-label">{bodyMeasureCopy.anterior}</text>
            <g className="mt-body-figure-clean" aria-hidden="true">
              {/* single coherent body silhouette — anterior */}
              <path
                className="mt-ref-body-outline"
                d={REFERENCE_BODY_MEASURE_FRONT_OUTLINE}
              />
              <g className="mt-body-human-landmarks mt-body-human-landmarks--front">
                <path className="mt-body-cranial-landmark" d="M177 66 C181 88 199 88 203 66" />
                <path className="mt-body-cranial-landmark" d="M181 58 C185 55 195 55 199 58" />
                <path className="mt-body-cranial-landmark" d="M190 61 L189 78" />
                <path className="mt-body-cranial-landmark" d="M183 87 C187 90 193 90 197 87" />
                <path className="mt-body-anatomy-landmark" d="M156 132 C168 126 181 126 190 135 C199 126 212 126 224 132" />
                <path className="mt-body-anatomy-landmark" d="M142 150 C158 158 176 161 190 161 C204 161 222 158 238 150" />
                <path className="mt-body-anatomy-landmark" d="M190 166 L190 282" />
                <path className="mt-body-anatomy-landmark" d="M174 186 C182 191 198 191 206 186" />
                <path className="mt-body-anatomy-landmark" d="M172 205 L208 205 M173 228 L207 228 M175 250 L205 250" />
                <path className="mt-body-anatomy-landmark" d="M157 176 C164 205 164 238 155 263" />
                <path className="mt-body-anatomy-landmark" d="M223 176 C216 205 216 238 225 263" />
                <path className="mt-body-anatomy-landmark" d="M160 296 C171 307 181 313 190 314 C199 313 209 307 220 296" />
                <path className="mt-body-anatomy-landmark" d="M166 322 C174 356 174 394 169 426 M214 322 C206 356 206 394 211 426" />
                <path className="mt-body-anatomy-landmark" d="M150 405 C158 414 167 418 176 417 M204 417 C213 418 222 414 230 405" />
                <path className="mt-body-anatomy-landmark" d="M146 511 C152 518 160 520 168 517 M212 517 C220 520 228 518 234 511" />
              </g>
              {/* hands */}
              <path className="mt-ref-hand" d="M88 292 C81 299 78 307 80 315 C82 322 86 321 88 313 C89 322 94 324 96 316 C98 322 103 320 103 311 C104 302 98 294 92 290 Z" />
              <path className="mt-ref-hand" d="M292 292 C299 299 302 307 300 315 C298 322 294 321 292 313 C291 322 286 324 284 316 C282 322 277 320 277 311 C276 302 282 294 288 290 Z" />
              {/* feet */}
              <path className="mt-ref-foot" d="M154 541 C143 544 133 549 127 555 C139 557 153 555 164 548 C164 543 160 540 154 541 Z" />
              <path className="mt-ref-foot" d="M226 541 C237 544 247 549 253 555 C241 557 227 555 216 548 C216 543 220 540 226 541 Z" />
              {/* internal muscle contour lines — anterior */}
              <path className="mt-body-figure-contour" d="M175 97 C179 108 184 116 190 119 C196 116 201 108 205 97" />
              <path className="mt-body-figure-contour" d="M143 130 C157 123 177 121 190 133 C203 121 223 123 237 130" />
              <path className="mt-body-figure-contour" d="M137 146 C154 151 171 153 190 153 C209 153 226 151 243 146" />
              <path className="mt-body-figure-contour" d="M170 180 C177 187 183 190 190 190 C197 190 203 187 210 180" />
              <path className="mt-body-figure-contour" d="M173 202 L207 202 M172 224 L208 224 M173 247 L207 247" />
              <path className="mt-body-figure-contour" d="M190 167 L190 255" />
              <path className="mt-body-figure-contour" d="M152 275 C162 285 174 291 190 295 C206 291 218 285 228 275" />
              <path className="mt-body-figure-contour" d="M141 295 C154 330 155 380 149 421 M239 295 C226 330 225 380 231 421" />
              <path className="mt-body-figure-contour" d="M164 295 C172 336 172 386 167 432 M216 295 C208 336 208 386 213 432" />
              <path className="mt-body-figure-contour" d="M143 435 C151 458 152 497 148 528 M237 435 C229 458 228 497 232 528" />
            </g>
          </g>

          {/* ── BACK FIGURE ──────────────────────────────────────────────── */}
          <g className="mt-body-measure-view" aria-label={bodyMeasureCopy.posterior}>
            <text x="570" y="28" textAnchor="middle" className="mt-body-measure-view-label">{bodyMeasureCopy.posterior}</text>
            <g className="mt-body-figure-clean" transform={POSTERIOR_SVG_ALIGNMENT_TRANSFORM} aria-hidden="true">
              {/* single coherent body silhouette — posterior */}
              <path
                className="mt-ref-body-outline"
                d={REFERENCE_BODY_MEASURE_BACK_OUTLINE}
              />
              <g className="mt-body-human-landmarks mt-body-human-landmarks--back">
                <path className="mt-body-cranial-landmark" d="M557 66 C561 88 579 88 583 66" />
                <path className="mt-body-cranial-landmark" d="M561 92 C566 97 574 97 579 92" />
                <path className="mt-body-anatomy-landmark" d="M536 130 C548 124 562 127 570 142 C578 127 592 124 604 130" />
                <path className="mt-body-anatomy-landmark" d="M570 114 L570 316" />
                <path className="mt-body-anatomy-landmark" d="M515 158 C536 176 548 205 550 244 M625 158 C604 176 592 205 590 244" />
                <path className="mt-body-anatomy-landmark" d="M538 172 C546 200 547 240 542 286 M602 172 C594 200 593 240 598 286" />
                <path className="mt-body-anatomy-landmark" d="M510 194 C524 214 530 242 528 270 M630 194 C616 214 610 242 612 270" />
                <path className="mt-body-anatomy-landmark" d="M520 302 C538 313 553 326 570 342 C587 326 602 313 620 302" />
                <path className="mt-body-anatomy-landmark" d="M540 350 C550 382 550 424 544 462 M600 350 C590 382 590 424 596 462" />
                <path className="mt-body-anatomy-landmark" d="M530 407 C540 416 550 420 560 418 M580 418 C590 420 600 416 610 407" />
                <path className="mt-body-anatomy-landmark" d="M528 512 C535 519 544 521 552 518 M588 518 C596 521 605 519 612 512" />
              </g>
              {/* hands */}
              <path className="mt-ref-hand" d="M468 292 C461 299 458 307 460 315 C462 322 466 321 468 313 C469 322 474 324 476 316 C478 322 483 320 483 311 C484 302 478 294 472 290 Z" />
              <path className="mt-ref-hand" d="M672 292 C679 299 682 307 680 315 C678 322 674 321 672 313 C671 322 666 324 664 316 C662 322 657 320 657 311 C656 302 662 294 668 290 Z" />
              {/* feet */}
              <path className="mt-ref-foot" d="M534 541 C523 544 513 549 507 555 C519 557 533 555 544 548 C544 543 540 540 534 541 Z" />
              <path className="mt-ref-foot" d="M606 541 C617 544 627 549 633 555 C621 557 607 555 596 548 C596 543 600 540 606 541 Z" />
              {/* internal muscle contour lines — posterior */}
              <path className="mt-body-figure-contour" d="M526 104 C540 126 552 158 558 192 M614 104 C600 126 588 158 582 192" />
              <path className="mt-body-figure-contour" d="M498 130 C521 121 542 131 570 158 C598 131 619 121 642 130" />
              <path className="mt-body-figure-contour" d="M493 166 C518 190 530 224 531 267 M647 166 C622 190 610 224 609 267" />
              <path className="mt-body-figure-contour" d="M547 164 C552 202 552 252 548 296 M593 164 C588 202 588 252 592 296" />
              <path className="mt-body-figure-contour" d="M570 111 L570 303" />
              <path className="mt-body-figure-contour" d="M518 298 C534 308 547 320 570 337 C593 320 606 308 622 298" />
              <path className="mt-body-figure-contour" d="M500 340 C516 374 520 430 512 474 M640 340 C624 374 620 430 628 474" />
              <path className="mt-body-figure-contour" d="M532 346 C542 385 542 437 536 481 M608 346 C598 385 598 437 604 481" />
              <path className="mt-body-figure-contour" d="M509 480 C517 500 517 526 513 548 M631 480 C623 500 623 526 627 548" />
            </g>
          </g>

          {/* ── PIXEL-TRACE MUSCLE HIGHLIGHT FILLS ──────────────────── */}
          {/* Each mask rect covers the full panel, clipped to the traced muscle boundary */}
          <g className="mt-muscle-pixel-fill-layer" aria-hidden="true">
            {Object.entries(MUSCLE_MASKS.masks).map(([maskKey, m]) => {
              if (!m.d) return null;
              const regionKey = MASK_KEY_TO_REGION_KEY[maskKey];
              if (!regionKey) return null;
              const isActive = highlightedRegions.has(regionKey);
              const isPlanActive = planRegions.has(regionKey);
              const isFocused = hoveredRegionKey === regionKey || focusRegionKey === regionKey;
              const isAnterior = m.view === 'anterior';
              const stateClass = isActive ? 'is-active' : isFocused ? 'is-focused' : isPlanActive ? 'is-plan-active' : '';
              // Panel bounds: anterior x=58–322, posterior x=391.8–774.9
              const rx = isAnterior ? 58 : 391.8;
              const rw = isAnterior ? 264 : 383.1;
              return (
                <rect
                  key={`mfill-${maskKey}`}
                  className={`mt-muscle-pixel-fill${stateClass ? ` ${stateClass}` : ''}`}
                  x={rx}
                  y={42}
                  width={rw}
                  height={508}
                  clipPath={`url(#muscle-mask-${maskKey})`}
                  data-mask-key={maskKey}
                  data-region={regionKey}
                />
              );
            })}
          </g>

          <g className="mt-body-measure-region-bed-layer" aria-hidden="true" clipPath="url(#mtBodyClinicalClip)">
            {REFERENCE_BODY_MEASURE_REGIONS.map(renderRegionBed)}
          </g>
          {REFERENCE_BODY_MEASURE_REGIONS.map(renderRegion)}
          <g className="mt-body-human-negative-space" aria-hidden="true">
            <path d="M182 320 C186 362 187 460 184 540 C187 545 193 545 196 540 C193 460 194 362 198 320 C193 323 187 323 182 320 Z" />
            <path d="M132 174 C121 208 116 254 119 292 C128 265 132 218 140 184 Z" />
            <path d="M248 174 C259 208 264 254 261 292 C252 265 248 218 240 184 Z" />
            <g transform={POSTERIOR_SVG_ALIGNMENT_TRANSFORM}>
              <path d="M562 320 C566 362 567 460 564 540 C567 545 573 545 576 540 C573 460 574 362 578 320 C573 323 567 323 562 320 Z" />
              <path d="M512 174 C501 208 496 254 499 292 C508 265 512 218 520 184 Z" />
              <path d="M628 174 C639 208 644 254 641 292 C632 265 628 218 620 184 Z" />
            </g>
          </g>
          <line x1="380" y1="52" x2="380" y2="552" className="mt-body-measure-divider" />
        </svg>
      </div>

      <div className="mt-body-measure-readout">
        <div className="mt-body-measure-interaction" aria-live="polite">
          <span>{focusRegionKey ? bodyMeasureCopy.selectedLabel : bodyMeasureCopy.interactionHint}</span>
          <strong>{focusedRegionLabel}</strong>
          <div className="mt-body-measure-region-plan">
            <span>{focusedInspectionExercises.length ? bodyMeasureCopy.trainedByLabel : bodyMeasureCopy.planFocusLabel}</span>
            <p>{focusedInspectionSummary}</p>
            {focusedInspectionExercises.length > 0 && (
              <ul>
                {focusedInspectionExercises.slice(0, 3).map((item) => (
                  <li key={`${item.name}-${item.prescription}`}>
                    <strong>{item.name}</strong>
                    <em>{item.prescription}</em>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="mt-body-measure-region-pills" aria-label={bodyMeasureCopy.planFocusLabel}>
          {planRegionOptions.map((region) => {
            const regionLabel = region.label[isZh ? 'zh' : 'en'];
            const isSelected = focusRegionKey === region.key;
            return (
              <button
                key={`${region.key}-quick-pick`}
                type="button"
                className={isSelected ? 'is-selected' : ''}
                data-region={region.key}
                aria-pressed={selectedRegionKey === region.key}
                onMouseEnter={() => setHoveredRegionKey(region.key)}
                onMouseLeave={() => setHoveredRegionKey(null)}
                onFocus={() => setHoveredRegionKey(region.key)}
                onBlur={() => setHoveredRegionKey(null)}
                onClick={() => toggleSelectedRegion(region.key)}
              >
                {regionLabel}
              </button>
            );
          })}
        </div>
        <div className="mt-body-measure-gauge">
          <span>{bodyMeasureCopy.loadLabel}</span>
          <strong>{loadScore}%</strong>
          <i style={{ '--measure': `${loadScore}%` }} />
        </div>
        <div className="mt-body-measure-gauge">
          <span>{bodyMeasureCopy.balanceLabel}</span>
          <strong>{weekContext?.acwr == null ? '-' : trimNumber(weekContext.acwr, 2)}</strong>
          <i style={{ '--measure': `${acwrScore}%` }} />
        </div>
      </div>
    </div>
  );
}

function ExerciseIllustration({ exerciseName, muscles = [], isZh = false }) {
  const mode = resolveExerciseVisualKey(exerciseName, muscles);
  const visibleMuscles = (muscles || []).filter(Boolean);
  const muscleSummary = visibleMuscles.join(' / ') || 'Target muscles';
  const trimSvgLabel = (value, maxLength = 18) => {
    const label = String(value || '').trim();
    return label.length > maxLength ? `${label.slice(0, maxLength - 3)}...` : label;
  };
  const regions = {
    front: {
      abs: 'M52 56 C58 48 70 48 76 56 L73 88 C68 94 60 94 55 88 Z',
      obliqueLeft: 'M46 58 C52 62 55 72 54 86 C49 84 46 78 43 68 Z',
      obliqueRight: 'M82 58 C76 62 73 72 74 86 C79 84 82 78 85 68 Z',
      quadsLeft: 'M52 104 C58 110 60 130 56 154 C49 149 46 125 48 110 Z',
      quadsRight: 'M76 104 C70 110 68 130 72 154 C79 149 82 125 80 110 Z',
      adductorLeft: 'M60 106 C63 118 63 138 61 154 C57 143 56 123 57 110 Z',
      adductorRight: 'M68 106 C65 118 65 138 67 154 C71 143 72 123 71 110 Z',
      calfLeft: 'M52 156 C57 166 57 186 53 202 C48 194 48 171 50 159 Z',
      calfRight: 'M76 156 C71 166 71 186 75 202 C80 194 80 171 78 159 Z',
      shinLeft: 'M59 158 C61 170 60 188 56 204 C53 192 53 173 55 160 Z',
      shinRight: 'M69 158 C67 170 68 188 72 204 C75 192 75 173 73 160 Z',
      hipFlexorLeft: 'M54 96 C60 98 62 106 60 114 C55 111 53 103 54 96 Z',
      hipFlexorRight: 'M74 96 C68 98 66 106 68 114 C73 111 75 103 74 96 Z',
    },
    back: {
      upperBackLeft: 'M49 52 C55 48 59 50 60 62 C55 67 49 64 46 56 Z',
      upperBackRight: 'M79 52 C73 48 69 50 68 62 C73 67 79 64 82 56 Z',
      lowerBack: 'M60 72 C64 68 70 68 74 72 L72 96 C68 100 64 100 60 96 Z',
      gluteLeft: 'M51 98 C60 92 67 96 69 110 C65 118 56 118 50 111 Z',
      gluteRight: 'M77 98 C68 92 61 96 59 110 C63 118 72 118 78 111 Z',
      hamLeft: 'M54 114 C60 124 61 142 57 160 C50 154 49 132 50 118 Z',
      hamRight: 'M74 114 C68 124 67 142 71 160 C78 154 79 132 78 118 Z',
      calfLeft: 'M56 160 C60 170 60 188 56 204 C51 197 51 176 53 163 Z',
      calfRight: 'M72 160 C68 170 68 188 72 204 C77 197 77 176 75 163 Z',
    },
  };

  const regionSets = {
    deadbug: {
      focus: 'front',
      frontPrimary: ['abs'],
      frontSecondary: ['obliqueLeft', 'obliqueRight', 'hipFlexorLeft', 'hipFlexorRight'],
      backSecondary: ['lowerBack'],
      cue: 'Brace',
    },
    sideplank: {
      focus: 'front',
      frontPrimary: ['obliqueLeft', 'obliqueRight', 'abs'],
      backSecondary: ['upperBackLeft', 'upperBackRight', 'lowerBack'],
      cue: 'Lateral',
    },
    pallof: {
      focus: 'front',
      frontPrimary: ['abs', 'obliqueLeft', 'obliqueRight'],
      backSecondary: ['lowerBack', 'upperBackLeft', 'upperBackRight'],
      cue: 'Anti-rotation',
    },
    carry: {
      focus: 'front',
      frontPrimary: ['obliqueLeft', 'obliqueRight', 'abs'],
      backPrimary: ['gluteLeft', 'gluteRight'],
      backSecondary: ['lowerBack'],
      cue: 'Carry',
    },
    bridge: {
      focus: 'back',
      backPrimary: ['gluteLeft', 'gluteRight'],
      backSecondary: ['hamLeft', 'hamRight'],
      frontSecondary: ['abs'],
      cue: 'Hip drive',
    },
    hamstring: {
      focus: 'back',
      backPrimary: ['hamLeft', 'hamRight'],
      backSecondary: ['gluteLeft', 'gluteRight', 'calfLeft', 'calfRight'],
      cue: 'Curl',
    },
    split: {
      focus: 'front',
      frontPrimary: ['quadsLeft', 'quadsRight', 'adductorLeft', 'adductorRight'],
      backSecondary: ['gluteLeft', 'gluteRight', 'hamLeft', 'hamRight'],
      cue: 'Split stance',
    },
    stepdown: {
      focus: 'front',
      frontPrimary: ['quadsLeft', 'quadsRight'],
      frontSecondary: ['adductorLeft', 'adductorRight'],
      backPrimary: ['gluteLeft', 'gluteRight'],
      cue: 'Knee line',
    },
    stretch: {
      focus: 'front',
      frontSecondary: ['hipFlexorLeft', 'hipFlexorRight', 'obliqueLeft', 'obliqueRight'],
      backPrimary: ['gluteLeft', 'gluteRight'],
      backSecondary: ['hamLeft', 'hamRight'],
      cue: 'Open chain',
    },
    hinge: {
      focus: 'back',
      backPrimary: ['gluteLeft', 'gluteRight', 'hamLeft', 'hamRight', 'lowerBack'],
      frontSecondary: ['abs'],
      cue: 'Hinge',
    },
    balance: {
      focus: 'back',
      backPrimary: ['gluteLeft', 'gluteRight', 'lowerBack'],
      frontSecondary: ['abs', 'obliqueLeft', 'obliqueRight'],
      cue: 'Balance',
    },
    calf: {
      focus: 'back',
      backPrimary: ['calfLeft', 'calfRight'],
      frontSecondary: ['shinLeft', 'shinRight'],
      cue: 'Plantar flex',
    },
    shin: {
      focus: 'front',
      frontPrimary: ['shinLeft', 'shinRight'],
      backSecondary: ['calfLeft', 'calfRight'],
      cue: 'Toe lift',
    },
    ankle: {
      focus: 'front',
      frontPrimary: ['shinLeft', 'shinRight'],
      frontSecondary: ['calfLeft', 'calfRight'],
      backSecondary: ['calfLeft', 'calfRight'],
      cue: 'Ankle range',
    },
    pogo: {
      focus: 'back',
      backPrimary: ['calfLeft', 'calfRight'],
      frontSecondary: ['quadsLeft', 'quadsRight'],
      cue: 'Elastic',
    },
    skip: {
      focus: 'front',
      frontPrimary: ['hipFlexorLeft', 'hipFlexorRight', 'quadsLeft', 'quadsRight'],
      backSecondary: ['gluteLeft', 'gluteRight', 'calfLeft', 'calfRight'],
      cue: 'Rhythm',
    },
    stepup: {
      focus: 'front',
      frontPrimary: ['quadsLeft', 'quadsRight', 'calfLeft', 'calfRight'],
      backPrimary: ['gluteLeft', 'gluteRight'],
      cue: 'Drive',
    },
    hop: {
      focus: 'back',
      backPrimary: ['calfLeft', 'calfRight', 'gluteLeft', 'gluteRight'],
      frontSecondary: ['quadsLeft', 'quadsRight', 'abs'],
      cue: 'Landing',
    },
    standing: {
      focus: 'front',
      frontPrimary: ['quadsLeft', 'quadsRight'],
      backSecondary: ['gluteLeft', 'gluteRight'],
      cue: 'Standing',
    },
  };

  const active = regionSets[mode] || regionSets.standing;
  const movementVectors = {
    deadbug: ['M142 58 C158 44 179 44 194 58', 'M61 82 C72 69 83 69 94 82'],
    sideplank: ['M52 66 C38 83 38 109 52 126', 'M174 66 C190 83 190 109 174 126'],
    pallof: ['M52 78 C78 60 98 60 123 78', 'M128 78 C154 96 174 96 199 78'],
    carry: ['M46 70 C38 92 39 122 48 145', 'M182 70 C190 92 189 122 180 145'],
    bridge: ['M37 146 C55 126 78 124 99 142', 'M146 145 C166 126 190 126 210 144'],
    hamstring: ['M61 144 C72 154 77 171 72 190', 'M166 144 C177 154 182 171 177 190'],
    split: ['M62 128 C75 118 89 116 102 124', 'M151 128 C166 118 183 119 198 130'],
    stepdown: ['M74 114 L91 132 L74 150', 'M158 113 L176 132 L158 151'],
    stretch: ['M60 70 C91 54 125 58 153 80', 'M71 142 C101 126 135 127 164 144'],
    hinge: ['M42 94 C70 72 90 79 101 116', 'M150 94 C178 72 198 79 209 116'],
    balance: ['M43 112 C74 82 94 93 99 139', 'M151 112 C182 82 202 93 207 139'],
    calf: ['M65 169 C72 155 80 155 87 169', 'M169 169 C176 155 184 155 191 169'],
    shin: ['M67 158 C76 145 84 145 92 158', 'M157 158 C166 145 174 145 182 158'],
    ankle: ['M58 183 C76 173 95 173 111 184', 'M145 183 C164 173 184 173 201 184'],
    pogo: ['M62 174 C74 151 88 151 99 174', 'M153 174 C166 151 181 151 192 174'],
    skip: ['M62 116 C77 97 93 97 105 117', 'M152 116 C168 97 184 97 197 117'],
    stepup: ['M64 137 L88 113 L112 137', 'M145 137 L170 113 L198 137'],
    hop: ['M67 171 C82 144 96 144 110 171', 'M147 171 C162 144 178 144 193 171'],
    standing: ['M70 128 C84 117 96 117 110 128', 'M145 128 C160 117 174 117 190 128'],
  };
  const vectorPaths = movementVectors[mode] || movementVectors.standing;
  const hasPrimaryOnFront = Boolean(active.frontPrimary?.length);
  const hasPrimaryOnBack = Boolean(active.backPrimary?.length);
  const primaryLabel = trimSvgLabel(visibleMuscles[0] || active.cue || 'Primary');
  const secondaryLabel = trimSvgLabel(visibleMuscles[1] || 'Support');
  const diagramTitle = `${normalizeExerciseName(exerciseName) || exerciseName} muscle diagram`;

  function renderRegions(side, names, tone) {
    return (names || []).map((name) => (
      <path key={`${side}-${tone}-${name}`} d={regions[side][name]} className={tone === 'primary' ? 'muscle-region-primary' : 'muscle-region-secondary'} />
    ));
  }

  function renderBody(side, label, x) {
    const isFocusedSide = active.focus === side;
    return (
      <g transform={`translate(${x} 22)`} className={`muscle-map-body muscle-map-body--${side}${isFocusedSide ? ' is-focus-body' : ''}`}>
        <rect x="0" y="0" width="96" height="184" rx="28" className="muscle-map-panel" />
        <text x="48" y="17" textAnchor="middle" className="muscle-map-panel-label">{label}</text>
        <path d="M48 37 L48 176" className="muscle-body-axis" />
        <ellipse cx="48" cy="174" rx="25" ry="7" className="muscle-map-shadow" />
        <circle cx="46" cy="23" r="11" className="muscle-body-head" />
        <path d="M33 38 C35 27 40 22 46 22 C52 22 57 27 59 38 L62 55 C63 65 56 75 46 77 C36 75 29 65 30 55 Z" className="muscle-body-core" />
        <path d="M30 46 C24 56 20 69 18 81" className="muscle-body-limb" />
        <path d="M62 46 C68 56 72 69 74 81" className="muscle-body-limb" />
        <path d="M39 79 C33 92 30 109 31 126" className="muscle-body-limb" />
        <path d="M53 79 C59 92 62 109 61 126" className="muscle-body-limb" />
        <path d="M31 126 C30 141 31 158 34 176" className="muscle-body-limb muscle-body-limb-lower" />
        <path d="M61 126 C62 141 61 158 58 176" className="muscle-body-limb muscle-body-limb-lower" />
        <path d="M39 78 C41 92 41 110 38 128" className="muscle-body-inner-line" />
        <path d="M53 78 C51 92 51 110 54 128" className="muscle-body-inner-line" />
        <path d="M37 51 C40 62 42 71 43 79" className="muscle-body-inner-line" />
        <path d="M55 51 C52 62 50 71 49 79" className="muscle-body-inner-line" />
        {side === 'front' ? renderRegions('front', active.frontSecondary, 'secondary') : renderRegions('back', active.backSecondary, 'secondary')}
        {side === 'front' ? renderRegions('front', active.frontPrimary, 'primary') : renderRegions('back', active.backPrimary, 'primary')}
      </g>
    );
  }

  return (
    <svg
      viewBox="0 0 252 232"
      className={`muscle-exercise-figure muscle-exercise-figure--${mode}`}
      role="img"
      aria-label={`${diagramTitle}: ${muscleSummary}`}
      data-muscle-mode={mode}
      data-muscle-summary={muscleSummary}
    >
      <title>{diagramTitle}</title>
      <desc>{muscleSummary}</desc>
      <rect x="8" y="8" width="236" height="216" rx="32" className="muscle-exercise-bg" />
      <path d="M24 205 H228" className="muscle-exercise-floor" />
      <g className="muscle-action-vectors" aria-hidden="true">
        {vectorPaths.map((pathData) => (
          <path key={pathData} d={pathData} className="muscle-action-vector" />
        ))}
        <circle cx={hasPrimaryOnBack ? 70 : 177} cy="43" r="3.8" className="muscle-action-node" />
        <circle cx={hasPrimaryOnFront ? 177 : 70} cy="197" r="3.8" className="muscle-action-node muscle-action-node--quiet" />
      </g>
      {renderBody('back', 'BACK', 22)}
      {renderBody('front', 'FRONT', 134)}
      <g className="muscle-exercise-legend">
        <circle cx="24" cy="216" r="4" className="muscle-region-primary" />
        <text x="34" y="219" className="muscle-exercise-primary-label">{primaryLabel}</text>
        <circle cx="139" cy="216" r="4" className="muscle-region-secondary" />
        <text x="149" y="219" className="muscle-exercise-secondary-label">{secondaryLabel}</text>
      </g>
      <text x="126" y="29" textAnchor="middle" className="muscle-map-legend-copy">{active.cue}</text>
    </svg>
  );
}

function getExerciseGuide(name, isZh) {
  const guides = {
    'Hip airplanes': {
      muscles: isZh ? ['臀部', '核心'] : ['Glutes', 'Core'],
      steps: isZh
        ? ['单腿站稳，髋部先保持正对前方。', '像门轴一样慢慢打开和合上骨盆。', '膝盖微屈，躯干不要左右乱晃。']
        : ['Stand tall on one leg with the hips square.', 'Open and close the pelvis slowly like a hinge.', 'Keep a soft knee and avoid trunk wobble.'],
    },
    'Calf raises (slow tempo)': {
      muscles: isZh ? ['小腿'] : ['Calves'],
      steps: isZh
        ? ['前脚掌稳稳压地。', '慢慢提起脚跟，在顶部停住一下。', '下放时保持控制，不要直接掉下去。']
        : ['Press through the ball of the foot.', 'Rise slowly and pause at the top.', 'Lower with control instead of dropping.'],
    },
    'Dead bug': {
      muscles: isZh ? ['核心'] : ['Core'],
      steps: isZh
        ? ['仰卧，肋骨收下，腰背贴稳。', '对侧手脚一起伸远。', '全程别让下背拱起来。']
        : ['Lie on your back with the ribs down.', 'Reach the opposite arm and leg away together.', 'Keep the low back quiet and the core braced.'],
    },
    'Split squat': {
      muscles: isZh ? ['臀部', '腘绳肌'] : ['Glutes', 'Hamstrings'],
      steps: isZh
        ? ['前后站开，身体保持直立。', '垂直下沉，再通过前脚发力起身。', '前膝跟着脚尖方向走，不要内扣。']
        : ['Set up in a split stance.', 'Drop straight down and drive through the front foot.', 'Track the front knee over the toes.'],
    },
    'Single-leg Romanian deadlift': {
      muscles: isZh ? ['臀部', '腘绳肌'] : ['Glutes', 'Hamstrings'],
      steps: isZh
        ? ['单腿站稳，另一条腿向后伸。', '从髋部折叠，不要弯腰塌背。', '起身时主动夹臀回正。']
        : ['Balance on one leg and reach the other leg back.', 'Hinge from the hips instead of rounding forward.', 'Squeeze the glute to return tall.'],
    },
    'Standing calf raise': {
      muscles: isZh ? ['小腿'] : ['Calves'],
      steps: isZh
        ? ['双脚平均受力站稳。', '提起脚跟并保持身体拉长。', '缓慢下放，感受小腿发力。']
        : ['Stand evenly through both feet.', 'Lift the heels and stay tall through the body.', 'Lower slowly to load the calves.'],
    },
    'Side plank': {
      muscles: isZh ? ['核心'] : ['Core'],
      steps: isZh
        ? ['身体侧向排成一条线。', '主动提髋，不要塌腰。', '保持稳定呼吸，肩颈放松。']
        : ['Stack the body in one straight side line.', 'Lift the hips instead of sagging.', 'Breathe steadily and keep the neck relaxed.'],
    },
    'Glute bridge (pause at top)': {
      muscles: isZh ? ['臀部', '核心'] : ['Glutes', 'Core'],
      steps: isZh
        ? ['仰卧屈膝，双脚踩稳。', '把髋抬高到身体成斜线。', '顶部停住 1 秒，再慢慢放下。']
        : ['Lie down with knees bent and feet planted.', 'Drive the hips up into a long line.', 'Pause at the top before lowering.'],
    },
    'Tibialis wall raise': {
      muscles: isZh ? ['小腿前侧'] : ['Shins'],
      steps: isZh
        ? ['背靠墙或抓稳支撑。', '把前脚掌和脚尖提起来。', '缓慢下放，感受胫骨前侧发力。']
        : ['Lean back into a stable support.', 'Lift the forefoot and pull the toes up.', 'Lower with control and feel the front of the shin.'],
    },
    "World's greatest stretch": {
      muscles: isZh ? ['臀部', '核心'] : ['Glutes', 'Core'],
      steps: isZh
        ? ['进入长弓步位。', '一手撑地，另一手打开胸椎向上转。', '每次动作都带着呼吸和控制。']
        : ['Step into a long lunge.', 'One hand stays down while the other opens the chest up.', 'Move slowly and breathe through each rep.'],
    },
    'Ankle dorsiflexion rocks': {
      muscles: isZh ? ['踝关节'] : ['Ankles'],
      steps: isZh
        ? ['前脚掌和脚跟都踩稳。', '膝盖向前推，但脚跟不离地。', '来回轻推，找到踝关节活动度。']
        : ['Keep the front foot flat.', 'Drive the knee forward without lifting the heel.', 'Rock in and out to open ankle motion.'],
    },
    'Step-down (knee tracking)': {
      muscles: isZh ? ['臀部', '核心'] : ['Glutes', 'Core'],
      steps: isZh
        ? ['站在小台阶上。', '慢慢把另一只脚向地面点下去。', '支撑腿的膝盖始终对准脚尖。']
        : ['Stand on a small step.', 'Lower the free foot toward the floor slowly.', 'Keep the stance knee tracking clean over the foot.'],
    },
    'Hamstring curl (slider or machine)': {
      muscles: isZh ? ['腘绳肌'] : ['Hamstrings'],
      steps: isZh
        ? ['先把髋抬稳。', '用脚跟把滑盘或器械拉向身体。', '回程慢放，不要让髋掉下去。']
        : ['Start from a stable bridged position.', 'Pull the heels toward the body.', 'Return slowly without dropping the hips.'],
    },
    'Pallof press': {
      muscles: isZh ? ['核心'] : ['Core'],
      steps: isZh
        ? ['站稳，阻力从身体侧面来。', '双手向前推直。', '全程抗住身体被带偏。']
        : ['Stand tall with the resistance pulling from the side.', 'Press the hands straight out.', 'Fight rotation and keep the torso quiet.'],
    },
    'Farmer carry (suitcase)': {
      muscles: isZh ? ['核心', '臀部'] : ['Core', 'Glutes'],
      steps: isZh
        ? ['单手提重物并站高。', '走路时身体不要向一侧歪。', '步幅短一点，躯干稳定。']
        : ['Carry the load in one hand and stand tall.', 'Do not lean toward or away from the weight.', 'Walk with short steady steps and a braced trunk.'],
    },
    'Pogo hops': {
      muscles: isZh ? ['小腿'] : ['Calves'],
      steps: isZh
        ? ['像弹簧一样通过脚踝快速反弹。', '动作要短、轻、快。', '身体保持高，不做深蹲式跳跃。']
        : ['Bounce through the ankles like springs.', 'Keep the contacts short, light, and quick.', 'Stay tall instead of turning it into a squat jump.'],
    },
    'Skipping A-drill': {
      muscles: isZh ? ['臀部', '核心'] : ['Glutes', 'Core'],
      steps: isZh
        ? ['抬膝到接近髋高。', '脚下快速回弹，落点在身体正下方。', '手臂自然配合节奏。']
        : ['Lift the knee to around hip height.', 'Strike quickly under the body and bounce out.', 'Let the arms match the rhythm.'],
    },
    'Box step-up (explosive)': {
      muscles: isZh ? ['臀部', '小腿'] : ['Glutes', 'Calves'],
      steps: isZh
        ? ['整只脚踩上台面。', '快速向上驱动身体。', '下台时轻一点，不要砸地。']
        : ['Plant the whole foot on the box.', 'Drive up fast through the stance leg.', 'Step down softly with control.'],
    },
    'Single-leg hop (low amplitude)': {
      muscles: isZh ? ['小腿', '核心'] : ['Calves', 'Core'],
      steps: isZh
        ? ['单腿轻弹，不追求跳得很高。', '落地时膝盖稳定。', '每一下都像干净的小反弹。']
        : ['Hop lightly on one leg without chasing height.', 'Land with a quiet stable knee.', 'Think of crisp elastic contacts each rep.'],
    },
  };

  return guides[name] || {
    muscles: isZh ? ['跑者力量'] : ['Runner strength'],
    steps: isZh ? ['保持稳定。', '动作受控。', '全程均匀呼吸。'] : ['Stay stable.', 'Move with control.', 'Keep your breathing steady.'],
  };
}

export default function MuscleTraining() {
  const { isAuthenticated } = useAuth();
  const { lang, t } = useI18n();
  const { isMile } = useUnit();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [draft, setDraft] = useState(DEFAULT_PROFILE);
  const [plan, setPlan] = useState(null);
  const [checkInDraft, setCheckInDraft] = useState(DEFAULT_CHECK_IN_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [checkInNotice, setCheckInNotice] = useState('');
  const previousIsMileRef = useRef(isMile);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [shellProfile, setShellProfile] = useState(null);
  const [activeTarget, setActiveTarget] = useState('all');
  const [selectedExerciseKey, setSelectedExerciseKey] = useState('');
  const [expandedExerciseIdx, setExpandedExerciseIdx] = useState(null);

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
  const distanceUnitLabel = isMile ? t('muscle_training.miles_unit') : t('muscle_training.km_unit');


  const copy = useMemo(() => ({
    checkInTitle: t('muscle_training.check_in_title'),
    checkInHint: t('muscle_training.check_in_hint'),
    checkInTypeLabel: t('muscle_training.check_in_type_label'),
    checkInStateLabel: t('muscle_training.check_in_state_label'),
    checkInDistanceLabel: t('muscle_training.check_in_distance_label'),
    checkInDurationLabel: t('muscle_training.check_in_duration_label'),
    checkInSave: t('muscle_training.check_in_save'),
    checkInSaving: t('muscle_training.check_in_saving'),
    checkInReset: t('muscle_training.check_in_reset'),
    checkInSaved: t('muscle_training.check_in_saved'),
    checkInResetSuccess: t('muscle_training.check_in_reset_success'),
    checkInUpdatedAt: t('muscle_training.check_in_updated_at'),
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
  }), [t]);  const sessionByType = useMemo(
    () => new Map((plan?.sessions || []).map((session) => [session.sessionType, session])),
    [plan],
  );
  const todayPlan = useMemo(() => (plan?.days || [])[0] || null, [plan]);
  const featuredDay = todayPlan;
  const featuredSession = useMemo(
    () => (featuredDay?.strength ? sessionByType.get(featuredDay.strength.sessionType) : null),
    [featuredDay, sessionByType],
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
    settingsDisclosure: t('muscle_training.stitch_settings_disclosure'),
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
    plannedLabel: t('muscle_training.stitch_planned_label'),
    recommendedLabel: t('muscle_training.stitch_recommended_label'),
  }), [t]);

  const navItems = useMemo(
    () => getRunnerShellNavItems({ t, lang, activeKey: 'muscle' }),
    [t, lang],
  );
  // Count how many strength sessions are planned in the 7-day rolling window
  const weekDoseStats = useMemo(() => {
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
    const focusLabel = pickLabel(copy.sessionEmphasis, sessionType, '');
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

  const nextRunSummary = useMemo(() => {
    const days = plan?.days || [];
    const nextRunIndex = days.findIndex((day) => {
      const workoutType = day.run?.workoutType;
      return workoutType && workoutType !== 'REST';
    });

    if (nextRunIndex < 0) {
      return {
        label: stitchCopy.runwayEmpty,
        meta: stitchCopy.noRunContext,
      };
    }

    const nextRunDay = days[nextRunIndex];
    const runLabel = pickLabel(copy.workoutTypes, nextRunDay.run?.workoutType, stitchCopy.runDayBadge);
    const dayLabel = nextRunIndex === 0
      ? stitchCopy.todayBadge
      : formatDayLabel(nextRunDay.date, nextRunDay.dayLabel, displayLang);
    const distanceLabel = nextRunDay.run?.plannedDistanceKm != null
      ? formatDistance(nextRunDay.run.plannedDistanceKm, isZh, isMile)
      : '';
    const badges = [
      nextRunDay.run?.keyRun ? stitchCopy.keyRunBadge : '',
      nextRunDay.run?.longRun ? stitchCopy.longRunBadge : '',
    ].filter(Boolean);

    return {
      label: [dayLabel, runLabel].filter(Boolean).join(' - '),
      meta: [distanceLabel, ...badges].filter(Boolean).join(' · ') || stitchCopy.weekAlignLabel,
    };
  }, [copy.workoutTypes, displayLang, isMile, isZh, plan, stitchCopy]);

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

  const selectedProtocolItem = useMemo(() => (
    visibleExerciseItems.find((item) => getProtocolItemKey(item) === selectedExerciseKey)
    || visibleExerciseItems[0]
    || null
  ), [selectedExerciseKey, visibleExerciseItems]);

  const selectedExerciseCopy = useMemo(
    () => (selectedProtocolItem ? getExerciseContentForItem(selectedProtocolItem, isZh) : null),
    [isZh, selectedProtocolItem],
  );

  const volumeCompletion = useMemo(() => {
    const recommended = Math.max(weekDoseStats.recommended || weekDoseStats.planned || 1, 1);
    return Math.min(100, Math.round((weekDoseStats.planned / recommended) * 100));
  }, [weekDoseStats]);

  const nextKeyRunSummary = useMemo(() => {
    const keyDate = plan?.weekContext?.nextKeyRunDate;
    const keyType = plan?.weekContext?.nextKeyRunType;
    if (!keyDate && !keyType) return nextRunSummary;
    return {
      label: [keyDate ? formatShortDate(keyDate, displayLang) : '', pickLabel(copy.workoutTypes, keyType, '')].filter(Boolean).join(' - '),
      meta: stitchCopy.weekAlignLabel,
    };
  }, [copy.workoutTypes, displayLang, nextRunSummary, plan, stitchCopy.weekAlignLabel]);

  const nextStrengthSummary = useMemo(() => {
    const days = plan?.days || [];
    const nextStrengthIndex = days.findIndex((day) => !!day.strength);
    if (nextStrengthIndex < 0) {
      return {
        label: stitchCopy.noStrengthTitle,
        meta: stitchCopy.noStrengthHint,
      };
    }
    const strengthDay = days[nextStrengthIndex];
    const dayLabel = nextStrengthIndex === 0
      ? stitchCopy.todayBadge
      : formatDayLabel(strengthDay.date, strengthDay.dayLabel, displayLang);
    const sessionLabel = pickLabel(copy.sessionTypes, strengthDay.strength?.sessionType, stitchCopy.strengthDayBadge);
    const durationLabel = strengthDay.strength?.durationMinutes
      ? formatMinutes(strengthDay.strength.durationMinutes, isZh)
      : '';
    return {
      label: [dayLabel, sessionLabel].filter(Boolean).join(' - '),
      meta: [durationLabel, strengthDay.strength?.targetRpe != null ? `RPE ${strengthDay.strength.targetRpe}` : ''].filter(Boolean).join(' · ') || stitchCopy.weekAlignLabel,
    };
  }, [copy.sessionTypes, displayLang, isZh, plan, stitchCopy]);

  const currentSplitLabel = useMemo(() => (
    pickLabel(copy.currentFocus, plan?.weekContext?.currentFocus, featuredSession?.emphasis || stitchCopy.strength)
  ), [copy.currentFocus, featuredSession, plan, stitchCopy.strength]);

  const weeklyStrengthMinutes = useMemo(() => (
    (plan?.days || []).reduce((sum, day) => sum + (Number(day.strength?.durationMinutes) || 0), 0)
  ), [plan]);

  const recentStrengthPlaceholders = useMemo(() => ([
    {
      name: isZh ? '卧推 / 深蹲 / 硬拉' : 'Bench / Squat / Deadlift',
      meta: stitchCopy.historyPlaceholderBadge,
      value: stitchCopy.placeholderMetric,
    },
    {
      name: isZh ? '总重量 / 1RM / PR' : 'Total lifted / 1RM / PRs',
      meta: stitchCopy.historyPlaceholderHint,
      value: stitchCopy.placeholderMetric,
    },
  ]), [isZh, stitchCopy]);

  function handleTargetAreaSelect(targetKey) {
    setActiveTarget(targetKey);
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

  useEffect(() => {
    const previousIsMile = previousIsMileRef.current;
    if (previousIsMile === isMile) return;
    previousIsMileRef.current = isMile;
    setCheckInDraft((current) => ({
      ...current,
      distanceKm: convertDistanceInput(current.distanceKm, previousIsMile, isMile),
    }));
  }, [isMile]);

  const applyLoadedData = useCallback((nextProfile, nextPlan) => {
    const normalized = normalizeProfile(nextProfile);
    setProfile(normalized);
    setDraft(normalized);
    setPlan(nextPlan);
    setCheckInDraft(buildCheckInDraft(nextPlan, isMile));
  }, [isMile]);

  function applyPlanOnly(nextPlan) {
    setPlan(nextPlan);
    setCheckInDraft(buildCheckInDraft(nextPlan, isMile));
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
      setNotice('');
      setCheckInNotice('');
      try {
        const [nextProfile, nextPlan] = await Promise.all([
          apiJson('/api/training/muscle/profile'),
          apiJson('/api/training/muscle/plan'),
        ]);
        if (cancelled) return;
        applyLoadedData(nextProfile, nextPlan);
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

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateCheckInDraft(field, value) {
    setCheckInDraft((current) => ({ ...current, [field]: value }));
  }

  function togglePreferredDay(dayValue) {
    setDraft((current) => {
      const currentDays = new Set(current.preferredStrengthDays || []);
      if (currentDays.has(dayValue)) {
        if (currentDays.size === 1) {
          return current;
        }
        currentDays.delete(dayValue);
      } else {
        currentDays.add(dayValue);
      }

      return {
        ...current,
        preferredStrengthDays: DAY_OPTIONS
          .filter((day) => currentDays.has(day.value))
          .map((day) => day.value),
      };
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    setCheckInNotice('');
    try {
      const payload = {
        ...draft,
        sessionMinutes: Number(draft.sessionMinutes) || DEFAULT_PROFILE.sessionMinutes,
      };
      const nextProfile = await apiJson('/api/training/muscle/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const nextPlan = await apiJson('/api/training/muscle/plan');
      applyLoadedData(nextProfile, nextPlan);
      setNotice(copy.saveSuccess);
    } catch (cause) {
      setError(cause?.message || t('muscle_training.save_failed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckInSave(event) {
    event.preventDefault();
    setCheckInSaving(true);
    setError('');
    setNotice('');
    setCheckInNotice('');
    try {
      const distanceValue = parseOptionalNumber(checkInDraft.distanceKm);
      const payload = {
        runType: checkInDraft.runType,
        entryState: checkInDraft.entryState,
        distanceKm: distanceValue != null ? (isMile ? distanceValue * KM_PER_MILE : distanceValue) : null,
        durationMinutes: parseOptionalInteger(checkInDraft.durationMinutes),
      };
      await apiJson('/api/training/muscle/today', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const nextPlan = await apiJson('/api/training/muscle/plan');
      applyPlanOnly(nextPlan);
      setCheckInNotice(copy.checkInSaved);
    } catch (cause) {
      setError(cause?.message || 'Could not save today\'s training.');
    } finally {
      setCheckInSaving(false);
    }
  }

  async function handleCheckInReset() {
    setCheckInSaving(true);
    setError('');
    setNotice('');
    setCheckInNotice('');
    try {
      await apiJson('/api/training/muscle/today', { method: 'DELETE' });
      const nextPlan = await apiJson('/api/training/muscle/plan');
      applyPlanOnly(nextPlan);
      setCheckInNotice(copy.checkInResetSuccess);
    } catch (cause) {
      setError(cause?.message || 'Could not restore the coach schedule.');
    } finally {
      setCheckInSaving(false);
    }
  }

  function scrollToControls() {
    document.getElementById('muscle-controls')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('analysis.stitch_brand_subtitle')}</span>
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

        {loading && <div style={{ padding: '22px 0', color: 'var(--text-muted)' }}>{copy.loading}</div>}
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
            {/* ── Hero ── */}
            <section className="mt-hero" aria-labelledby="mt-hero-title">
              <div className="mt-hero-left">
                <span className="mt-kicker">{t('muscle_training.stitch_mt_hero_kicker')}</span>
                <h1 id="mt-hero-title" className="mt-hero-title">{t('muscle_training.stitch_mt_hero_title')}</h1>
                <p className="mt-hero-desc">{t('muscle_training.stitch_mt_hero_copy')}</p>
                <div className="mt-hero-chips">
                  <span className="mt-chip">
                    <AppIcon name="directions_run" />
                    {currentSplitLabel || stitchCopy.currentSplitBadge}
                  </span>
                  <span className="mt-chip">
                    <AppIcon name="schedule" />
                    {weeklyStrengthMinutes ? formatMinutes(weeklyStrengthMinutes, isZh) : '-'}
                    &nbsp;{t('muscle_training.stitch_mt_hero_total_time')}
                  </span>
                  <span className="mt-chip">
                    <AppIcon name="calendar_today" />
                    {`${weekDoseStats.planned}/${weekDoseStats.recommended || 0}`}&nbsp;{t('muscle_training.stitch_mt_hero_sessions')}
                  </span>
                </div>
              </div>
              <div className="mt-hero-right">
                <div className="mt-ring-wrap" aria-label={`${stitchCopy.weeklyCompletion} ${volumeCompletion}%`}>
                  <svg className="mt-ring-svg" viewBox="0 0 88 88" role="img" aria-hidden="true">
                    <circle cx="44" cy="44" r="34" className="mt-ring-track" />
                    <circle
                      cx="44"
                      cy="44"
                      r="34"
                      className="mt-ring-progress"
                      style={{
                        strokeDasharray: 2 * Math.PI * 34,
                        strokeDashoffset: 2 * Math.PI * 34 - (volumeCompletion / 100) * 2 * Math.PI * 34,
                      }}
                    />
                  </svg>
                  <div className="mt-ring-center">
                    <strong>{volumeCompletion}%</strong>
                    <span>{weekDoseStats.planned}/{weekDoseStats.recommended || 0}</span>
                  </div>
                </div>
                <div className="mt-ring-meta">
                  <span>{t('muscle_training.stitch_mt_hero_sessions')}</span>
                  <strong>{weekDoseStats.planned}/{weekDoseStats.recommended || 0}</strong>
                </div>
              </div>
            </section>

            {/* ── Recommendation Banner ── */}
            <section className="mt-recommend">
              <div className="mt-recommend-inner">
                <div className="mt-recommend-left">
                  <span className="mt-kicker">{t('muscle_training.stitch_mt_recommend_tag')}</span>
                  <p className="mt-recommend-title">{nextStrengthSummary.label || stitchCopy.guideSubtitle}</p>
                  <div className="mt-recommend-tags">
                    {nextStrengthSummary.meta && (
                      <span className="mt-chip mt-chip--sm">{nextStrengthSummary.meta}</span>
                    )}
                  </div>
                </div>
                <button type="button" className="mt-recommend-btn" onClick={scrollToControls}>
                  <AppIcon name="play_arrow" />
                  {t('muscle_training.stitch_mt_recommend_start')}
                </button>
              </div>
            </section>

            {/* ── Side Grid: Today Session + Target Areas ── */}
            <div className="mt-side-grid">
              {/* Today Session card */}
              <article className="mt-card mt-session-card">
                <div className="mt-card-head">
                  <span className="mt-kicker">{t('muscle_training.stitch_mt_session_kicker')}</span>
                  <h2 className="mt-card-title">{nextStrengthSummary.label || stitchCopy.readyTitle}</h2>
                </div>
                <div className="mt-session-meta">
                  <span>
                    <AppIcon name="schedule" />
                    {featuredSession?.durationMinutes ? formatMinutes(featuredSession.durationMinutes, isZh) : '-'}
                  </span>
                </div>
                <p className="mt-session-purpose">{todayCoachNarrative || stitchCopy.guideSubtitle}</p>
                <div className="mt-session-targets">
                  {targetAreaCards.filter((ta) => ta.planCount > 0).slice(0, 3).map((ta) => (
                    <button
                      key={ta.key}
                      type="button"
                      className={`mt-target-pill${activeTarget === ta.key ? ' is-active' : ''}`}
                      onClick={() => handleTargetAreaSelect(ta.key)}
                    >
                      {ta.label}
                    </button>
                  ))}
                </div>
              </article>

              {/* Target Areas card */}
              <article className="mt-card mt-targets-card" aria-labelledby="mt-targets-title">
                <div className="mt-card-head">
                  <span className="mt-kicker">{t('muscle_training.stitch_mt_targets_kicker')}</span>
                  <h2 id="mt-targets-title" className="mt-card-title">{stitchCopy.targetAreasTitle}</h2>
                </div>
                <div className="mt-target-grid">
                  {targetAreaCards.map((ta) => {
                    // Body-part-specific Heroicons-style outline icons. Each
                    // name maps to a dedicated case in AppIcon.jsx so the
                    // target-area grid no longer falls back to the generic
                    // dumbbell or running-figure glyph.
                    const iconMap = {
                      chest: 'chest',
                      shoulders: 'shoulders',
                      legs: 'legs',
                      core: 'core',
                      arms: 'arms',
                      back: 'back',
                    };
                    const icon = iconMap[ta.key] || 'fitness_center';
                    return (
                      <button
                        key={ta.key}
                        type="button"
                        className={`mt-target-area${activeTarget === ta.key ? ' is-active' : ''}`}
                        onClick={() => handleTargetAreaSelect(ta.key)}
                        aria-pressed={activeTarget === ta.key}
                      >
                        <div className="mt-target-icon">
                          <AppIcon name={icon} />
                        </div>
                        <div className="mt-target-info">
                          <strong>{ta.label}</strong>
                          <span>{ta.planCount}&nbsp;{t('muscle_training.stitch_mt_targets_exercises')}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </article>
            </div>

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
                    {ta.label}
                    <small>({ta.planCount})</small>
                  </button>
                ))}
              </div>
              <div className="mt-exercise-list" role="list">
                {visibleExerciseItems.map((item, idx) => {
                  const isLibrary = item.source === 'library';
                  const exerciseCopy = getExerciseContentForItem(item, isZh);
                  const itemKey = getProtocolItemKey(item);
                  const isExpanded = expandedExerciseIdx === idx;
                  return (
                    <div key={itemKey} className="mt-exercise-row" role="listitem">
                      <div
                        className="mt-exercise-main"
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        aria-controls={`mt-ex-detail-${idx}`}
                        onClick={() => setExpandedExerciseIdx(isExpanded ? null : idx)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedExerciseIdx(isExpanded ? null : idx); } }}
                      >
                        <span className="mt-exercise-num">{String(idx + 1).padStart(2, '0')}</span>
                        <div className="mt-exercise-info">
                          <strong>{exerciseCopy.name}</strong>
                          <span className="mt-exercise-meta">
                            {formatLocalizedExercisePrescription(item.exercise, isZh)}
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
                          {(() => {
                            const heatmapSlugs = muscleSlugsForExercise(exerciseCopy.muscles);
                            if (heatmapSlugs.length === 0) return null;
                            const heatmapData = heatmapSlugs.map((slug) => ({ slug, intensity: 2 }));
                            const muscleLabel = exerciseCopy.muscles.join(' / ');
                            return (
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
                            );
                          })()}
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

            {/* ── Side Grid: Load History + Recovery Status ── */}
            <div className="mt-side-grid">
              {/* Load History card */}
              <article className="mt-card mt-history-card" aria-labelledby="mt-history-title">
                <div className="mt-card-head">
                  <span className="mt-kicker">{t('muscle_training.stitch_mt_history_kicker')}</span>
                  <h2 id="mt-history-title" className="mt-card-title">{t('muscle_training.stitch_mt_history_title')}</h2>
                </div>
                <div className="mt-history-list">
                  {recentStrengthPlaceholders.slice(0, 2).map((record, ri) => (
                    <div key={record.name} className="mt-history-row">
                      <div className="mt-history-info">
                        <strong>{record.name}</strong>
                        <span>{record.meta}</span>
                      </div>
                      <div className="mt-history-bar-wrap">
                        <div className="mt-history-bar" style={{ width: `${ri === 0 ? 60 : 40}%` }} />
                      </div>
                      <span className="mt-history-value">{record.value}</span>
                    </div>
                  ))}
                  {recentStrengthPlaceholders.length === 0 && (
                    <p className="mt-history-empty">{stitchCopy.historyPlaceholderHint}</p>
                  )}
                </div>
              </article>

              {/* Recovery Status card */}
              {(() => {
                const gateKey = plan.weekContext?.recoveryGate;
                const level = gateKey === 'OPEN' ? 'good' : gateKey === 'CAUTION' ? 'caution' : 'warning';
                const recoveryTitle = pickLabel(copy.recoveryGate, gateKey);
                const suggestions = [
                  { icon: 'directions_run', label: nextKeyRunSummary.label },
                  { icon: 'speed', label: plan.weekContext?.acwr != null ? `ACWR ${trimNumber(plan.weekContext.acwr, 2)}` : null },
                ].filter((s) => s.label);
                return (
                  <article className={`mt-card mt-recovery-card is-${level}`} aria-labelledby="mt-recovery-title">
                    <div className="mt-card-head mt-card-head--split">
                      <div>
                        <span className="mt-kicker">{t('muscle_training.stitch_mt_recovery_kicker')}</span>
                        <h2 id="mt-recovery-title" className="mt-card-title">{recoveryTitle}</h2>
                      </div>
                      <span className={`mt-recovery-badge is-${level}`}>{gateKey || level.toUpperCase()}</span>
                    </div>
                    <p className="mt-recovery-copy">{todayCoachNarrative || stitchCopy.guideSubtitle}</p>
                    {suggestions.length > 0 && (
                      <ul className="mt-recovery-suggestions">
                        {suggestions.map((s) => (
                          <li key={s.label}>
                            <AppIcon name={s.icon} />
                            {s.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })()}
            </div>
          </>
        )}

        {!loading && !error && plan && (
          <>
            {/* ── COACH CONTROLS: check-in + preferences behind disclosure ── */}
            <section id="muscle-controls" className="strength-plan-control-deck">

            <details className="mt-settings-disclosure">
              <summary className="mt-settings-summary">
                <AppIcon name="settings" className="mt-settings-icon" />
                {stitchCopy.settingsDisclosure}
              </summary>

            <section className="card muscle-panel muscle-preference-panel muscle-checkin-panel">
              <div className="muscle-preference-head">
                <div>
                  <h2>{copy.checkInTitle}</h2>
                  <p>{copy.checkInHint}</p>
                </div>
                <div className="muscle-preference-baseline">
                  <span className="muscle-pill muscle-pill-source">
                    {pickLabel(copy.sourcePills, plan.planSource, plan.planSource)}
                  </span>
                  {plan.todayCheckIn?.updatedAt && (
                    <span className="muscle-pill">
                      {formatCopyTemplate(copy.checkInUpdatedAt, { date: formatTimestamp(plan.todayCheckIn.updatedAt, displayLang) })}
                    </span>
                  )}
                </div>
              </div>

              <div className="muscle-status-source">
                <strong>{copy.planSourceLabel}</strong>
                <span>{pickLabel(copy.sourceSummary, plan.planSource, '')}</span>
              </div>

              <form onSubmit={handleCheckInSave} className="muscle-pref-grid">
                <label className="muscle-pref-field muscle-checkin-field muscle-checkin-field-wide">
                  <span>{copy.checkInStateLabel}</span>
                  <div className="muscle-choice-row">
                    {CHECK_IN_ENTRY_STATES.map((state) => (
                      <button
                        key={state}
                        type="button"
                        className={`muscle-day-chip${checkInDraft.entryState === state ? ' active' : ''}`}
                        onClick={() => updateCheckInDraft('entryState', state)}
                      >
                        {pickLabel(copy.checkInStateOptions, state, state)}
                      </button>
                    ))}
                  </div>
                </label>

                <label className="muscle-pref-field muscle-checkin-field muscle-checkin-field-wide">
                  <span>{copy.checkInTypeLabel}</span>
                  <div className="muscle-choice-row">
                    {CHECK_IN_RUN_TYPES.map((runType) => (
                      <button
                        key={runType}
                        type="button"
                        className={`muscle-day-chip${checkInDraft.runType === runType ? ' active' : ''}`}
                        onClick={() => updateCheckInDraft('runType', runType)}
                        aria-pressed={checkInDraft.runType === runType}
                      >
                        {pickLabel(copy.workoutTypes, runType, runType)}
                      </button>
                    ))}
                  </div>
                </label>

                <label className="muscle-pref-field">
                  <span>{`${copy.checkInDistanceLabel} (${distanceUnitLabel})`}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={checkInDraft.distanceKm}
                    onChange={(event) => updateCheckInDraft('distanceKm', event.target.value)}
                    placeholder={formatDistanceValue(todayPlan?.run?.plannedDistanceKm, isMile) ?? ''}
                  />
                </label>

                <label className="muscle-pref-field">
                  <span>{copy.checkInDurationLabel}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={checkInDraft.durationMinutes}
                    onChange={(event) => updateCheckInDraft('durationMinutes', event.target.value)}
                    placeholder={todayPlan?.run?.plannedDurationMinutes != null ? String(todayPlan.run.plannedDurationMinutes) : ''}
                  />
                </label>

                <div className="muscle-pref-actions">
                  <button type="submit" className="primary-action-btn" disabled={checkInSaving}>
                    {checkInSaving ? copy.checkInSaving : copy.checkInSave}
                  </button>
                  <button
                    type="button"
                    className="muscle-secondary-btn"
                    disabled={checkInSaving || !plan.todayCheckIn}
                    onClick={handleCheckInReset}
                  >
                    {copy.checkInReset}
                  </button>
                  {checkInNotice && <span className="muscle-pref-notice">{checkInNotice}</span>}
                </div>
              </form>
            </section>

            <section className="card muscle-panel muscle-preference-panel">
              <div className="muscle-preference-head">
                <div>
                  <h2>{copy.profileTitle}</h2>
                  <p>{copy.profileHint}</p>
                </div>
                <div className="muscle-preference-baseline">
                  <span className="muscle-pill">{pickLabel(copy.experienceOptions, profile.experienceLevel)}</span>
                  <span className="muscle-pill">{pickLabel(copy.equipmentOptions, profile.equipmentLevel)}</span>
                </div>
              </div>

              <form onSubmit={handleSave} className="muscle-pref-grid">
                <label className="muscle-pref-field">
                  <span>{copy.experienceLabel}</span>
                  <select value={draft.experienceLevel} onChange={(event) => updateDraft('experienceLevel', event.target.value)}>
                    {Object.entries(copy.experienceOptions).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="muscle-pref-field">
                  <span>{copy.equipmentLabel}</span>
                  <select value={draft.equipmentLevel} onChange={(event) => updateDraft('equipmentLevel', event.target.value)}>
                    {Object.entries(copy.equipmentOptions).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="muscle-pref-field">
                  <span>{copy.sessionMinutesLabel}</span>
                  <input
                    type="number"
                    min="15"
                    max="75"
                    step="5"
                    value={draft.sessionMinutes}
                    onChange={(event) => updateDraft('sessionMinutes', event.target.value)}
                  />
                </label>

                <label className="muscle-pref-field">
                  <span>{copy.noiseLabel}</span>
                  <select value={draft.noisePreference} onChange={(event) => updateDraft('noisePreference', event.target.value)}>
                    {Object.entries(copy.noiseOptions).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <div className="muscle-pref-field muscle-pref-days">
                  <span>{copy.preferredDaysLabel}</span>
                  <div className="muscle-day-chip-row">
                    {DAY_OPTIONS.map((day) => {
                      const active = (draft.preferredStrengthDays || []).includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          className={`muscle-day-chip${active ? ' active' : ''}`}
                          onClick={() => togglePreferredDay(day.value)}
                          aria-pressed={active}
                        >
                          {isZh ? day.zh : day.en}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="muscle-pref-actions">
                  <button type="submit" className="primary-action-btn" disabled={saving}>
                    {saving ? copy.saving : copy.save}
                  </button>
                  {notice && <span className="muscle-pref-notice">{notice}</span>}
                </div>
              </form>
            </section>

            </details>

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
