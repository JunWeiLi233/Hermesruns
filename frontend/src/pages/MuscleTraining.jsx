import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import FooterNavLinks from '../components/FooterNavLinks';
import TopbarNotifications from '../components/TopbarNotifications';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';
import anatomyAnteriorGray from '../assets/anatomy/muscles-anterior-gray.png';
import anatomyPosteriorGray from '../assets/anatomy/muscles-posterior-gray-unlabeled.png';

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
const DEFAULT_CHECK_IN_DRAFT = {
  runType: 'EASY',
  entryState: 'PLANNED',
  distanceKm: '',
  durationMinutes: '',
};
const KM_PER_MILE = 1.60934;

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
const POSTERIOR_RASTER_ALIGNMENT_TRANSFORM = 'translate(0 0)';
const POSTERIOR_SVG_ALIGNMENT_TRANSFORM = 'matrix(0.9665354331 0 0 0.9665354331 32.3948031496 18.805511811)';
const POSTERIOR_REGION_ALIGNMENT_TRANSFORM = 'matrix(0.9665354331 0 0 0.9665354331 72.3948031496 18.805511811)';
const POSTERIOR_GLUTE_REGION_ALIGNMENT_TRANSFORM = 'matrix(0.9665354331 0 0 0.9665354331 62.3948031496 18.805511811)';
const POSTERIOR_LEG_REGION_ALIGNMENT_TRANSFORM = 'matrix(0.9665354331 0 0 0.9665354331 46.3948031496 18.805511811)';

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
    paths: ['M179 98 C185 106 195 106 201 98 C205 112 208 122 210 132 C198 136 182 136 170 132 C172 122 175 112 179 98 Z'],
  },
  {
    key: 'traps-front',
    label: { en: 'Traps', zh: '斜方肌' },
    tokens: ['trapezius', 'trap', '斜方肌'],
    callout: { from: [148, 130], elbow: [100, 114], label: [80, 104], side: 'left' },
    paths: [
      'M143 126 C158 112 178 115 190 132 C178 141 162 146 140 143 C139 136 140 130 143 126 Z',
      'M237 126 C222 112 202 115 190 132 C202 141 218 146 240 143 C241 136 240 130 237 126 Z',
    ],
  },
  {
    key: 'deltoids',
    label: { en: 'Shoulders', zh: '肩' },
    tokens: ['shoulder', 'deltoid', '肩', '三角肌'],
    callout: { from: [122, 148], elbow: [78, 140], label: [58, 130], side: 'left' },
    paths: [
      'M127 137 C112 136 99 149 93 169 C96 181 109 182 124 173 C134 166 140 154 141 143 C136 139 132 137 127 137 Z',
      'M253 137 C268 136 281 149 287 169 C284 181 271 182 256 173 C246 166 240 154 239 143 C244 139 248 137 253 137 Z',
    ],
  },
  {
    key: 'pectorals',
    label: { en: 'Chest', zh: '胸' },
    tokens: ['pectoral', 'chest', '胸', '胸大肌'],
    callout: { from: [230, 155], elbow: [278, 144], label: [298, 134], side: 'right' },
    paths: [
      'M142 142 C156 129 175 126 189 145 C184 162 169 171 145 168 C137 159 135 149 142 142 Z',
      'M238 142 C224 129 205 126 191 145 C196 162 211 171 235 168 C243 159 245 149 238 142 Z',
    ],
  },
  {
    key: 'biceps',
    label: { en: 'Biceps', zh: '肱二头肌' },
    tokens: ['biceps', 'arm', 'elbow', '肱二头肌', '手臂'],
    callout: { from: [278, 190], elbow: [310, 188], label: [332, 178], side: 'right' },
    paths: [
      'M92 154 C104 165 108 188 104 209 C100 219 91 222 84 214 C80 201 80 173 86 159 Z',
      'M288 154 C276 165 272 188 276 209 C280 219 289 222 296 214 C300 201 300 173 294 159 Z',
    ],
  },
  {
    key: 'forearms-front',
    label: { en: 'Forearms', zh: '前臂' },
    tokens: ['forearm', 'brachioradialis', 'wrist', '手腕', '前臂'],
    callout: { from: [296, 248], elbow: [326, 256], label: [348, 254], side: 'right' },
    paths: [
      'M81 223 C93 229 97 250 94 275 C91 291 82 302 74 300 C71 284 72 244 78 226 Z',
      'M299 223 C287 229 283 250 286 275 C289 291 298 302 306 300 C309 284 308 244 302 226 Z',
    ],
  },
  {
    key: 'abdominals',
    label: { en: 'Abs', zh: '腹部' },
    tokens: ['core', 'abs', 'abdominals', 'trunk', '腹', '核心'],
    callout: { from: [190, 220], elbow: [264, 218], label: [286, 218], side: 'right' },
    paths: [
      'M173 170 C178 162 185 159 190 166 L189 259 C183 265 176 262 172 252 Z',
      'M207 170 C202 162 195 159 190 166 L191 259 C197 265 204 262 208 252 Z',
      'M145 165 C157 181 164 214 160 249 C151 261 140 261 132 249 C131 221 135 186 145 165 Z',
      'M235 165 C223 181 216 214 220 249 C229 261 240 261 248 249 C249 221 245 186 235 165 Z',
    ],
  },
  {
    key: 'quadriceps',
    label: { en: 'Quadriceps', zh: '股四头肌' },
    tokens: ['quad', 'quadriceps', 'knee', 'thigh', '股四头肌', '大腿'],
    callout: { from: [226, 346], elbow: [278, 368], label: [300, 372], side: 'right' },
    paths: [
      'M136 274 C154 286 162 320 160 372 C158 408 151 435 141 446 C129 424 125 308 130 280 Z',
      'M244 274 C226 286 218 320 220 372 C222 408 229 435 239 446 C251 424 255 308 250 280 Z',
      'M166 282 C177 304 179 349 176 396 C173 420 168 438 162 446 C156 416 156 316 161 286 Z',
      'M214 282 C203 304 201 349 204 396 C207 420 212 438 218 446 C224 416 224 316 219 286 Z',
    ],
  },
  {
    key: 'calves-front',
    label: { en: 'Shins', zh: '胫骨前肌' },
    tokens: ['shin', 'shins', 'tibialis', 'ankle', '胫骨', '胫骨前肌', '踝'],
    callout: { from: [230, 462], elbow: [278, 480], label: [300, 480], side: 'right' },
    paths: [
      'M145 438 C158 452 160 486 154 520 C148 528 140 524 136 512 C133 484 136 452 141 441 Z',
      'M235 438 C222 452 220 486 226 520 C232 528 240 524 244 512 C247 484 244 452 239 441 Z',
    ],
  },

  /* ── BACK VIEW ───────────────────────────────────────────────── */
  {
    key: 'trapezius',
    label: { en: 'Traps', zh: '斜方肌' },
    tokens: ['trapezius', 'trap', '斜方肌'],
    callout: { from: [542, 112], elbow: [616, 96], label: [630, 86], side: 'left' },
    paths: [
      'M494 90 C517 102 529 122 536 149 C521 151 503 146 482 131 C480 113 484 99 494 90 Z',
      'M566 90 C543 102 531 122 524 149 C539 151 557 146 578 131 C580 113 576 99 566 90 Z',
      'M508 108 C519 126 524 154 524 185 C510 172 499 138 496 111 Z',
      'M552 108 C541 126 536 154 536 185 C550 172 561 138 564 111 Z',
    ],
    highlightPaths: [
      'M502 104 C516 111 526 128 530 150 C520 150 507 144 494 133 C493 120 496 110 502 104 Z',
      'M558 104 C544 111 534 128 530 150 C540 150 553 144 566 133 C567 120 564 110 558 104 Z',
      'M516 128 C524 145 526 166 524 184 C514 172 507 149 506 131 Z',
      'M544 128 C536 145 534 166 536 184 C546 172 553 149 554 131 Z',
    ],
    markers: [
      { cx: 516, cy: 128, rx: 4.4, ry: 4.4 },
      { cx: 544, cy: 128, rx: 4.4, ry: 4.4 },
      { cx: 526, cy: 166, rx: 3.7, ry: 5 },
      { cx: 534, cy: 166, rx: 3.7, ry: 5 },
    ],
  },
  {
    key: 'shoulders-back',
    label: { en: 'Shoulders', zh: '肩' },
    tokens: ['shoulder', 'deltoid', 'infraspinatus', '肩', '三角肌', '冈下肌'],
    callout: { from: [594, 154], elbow: [620, 144], label: [630, 134], side: 'left' },
    paths: [
      'M463 136 C482 125 504 132 514 154 C510 168 495 172 473 167 C462 157 458 146 463 136 Z',
      'M597 136 C578 125 556 132 546 154 C550 168 565 172 587 167 C598 157 602 146 597 136 Z',
    ],
    highlightPaths: [
      'M466 143 C482 134 500 139 509 155 C505 166 492 168 476 164 C467 157 464 149 466 143 Z',
      'M594 143 C578 134 560 139 551 155 C555 166 568 168 584 164 C593 157 596 149 594 143 Z',
    ],
    markers: [
      { cx: 488, cy: 154, rx: 5.4, ry: 4.2 },
      { cx: 572, cy: 154, rx: 5.4, ry: 4.2 },
    ],
  },
  {
    key: 'lats',
    label: { en: 'Lats', zh: '背阔肌' },
    tokens: ['lat', 'lats', 'back', 'latissimus', '背阔肌', '背', 'upper back'],
    callout: { from: [592, 224], elbow: [620, 240], label: [630, 240], side: 'left' },
    paths: [
      'M465 165 C490 178 504 208 504 245 C494 264 475 274 456 268 C451 230 454 186 465 165 Z',
      'M595 165 C570 178 556 208 556 245 C566 264 585 274 604 268 C609 230 606 186 595 165 Z',
    ],
    highlightPaths: [
      'M478 176 C494 187 503 211 501 238 C493 252 477 259 464 254 C462 222 466 192 478 176 Z',
      'M582 176 C566 187 557 211 559 238 C567 252 583 259 596 254 C598 222 594 192 582 176 Z',
    ],
    markers: [
      { cx: 484, cy: 214, rx: 5.2, ry: 8.4 },
      { cx: 576, cy: 214, rx: 5.2, ry: 8.4 },
    ],
  },
  {
    key: 'triceps',
    label: { en: 'Triceps', zh: '肱三头肌' },
    tokens: ['triceps', 'arm', '肱三头肌', '手臂'],
    callout: { from: [622, 208], elbow: [632, 210], label: [630, 210], side: 'left' },
    paths: [
      'M437 154 C451 168 454 194 450 219 C445 231 435 232 428 221 C425 201 427 171 432 158 Z',
      'M623 154 C609 168 606 194 610 219 C615 231 625 232 632 221 C635 201 633 171 628 158 Z',
    ],
    highlightPaths: [
      'M434 171 C445 181 447 200 441 218 C432 210 427 189 428 175 Z',
      'M626 171 C615 181 613 200 619 218 C628 210 633 189 632 175 Z',
    ],
    markers: [
      { cx: 440, cy: 194, rx: 3.6, ry: 6.8 },
      { cx: 620, cy: 194, rx: 3.6, ry: 6.8 },
    ],
  },
  {
    key: 'forearms-back',
    label: { en: 'Forearms', zh: '前臂' },
    tokens: ['forearm', 'wrist', '前臂', '手腕'],
    callout: { from: [624, 262], elbow: [632, 270], label: [630, 270], side: 'left' },
    paths: [
      'M424 229 C435 238 437 260 433 286 C428 300 420 308 412 304 C409 279 412 244 418 232 Z',
      'M636 229 C625 238 623 260 627 286 C632 300 640 308 648 304 C651 279 648 244 642 232 Z',
    ],
    highlightPaths: [
      'M413 235 C423 244 426 265 422 286 C413 280 407 256 407 240 Z',
      'M647 235 C637 244 634 265 638 286 C647 280 653 256 653 240 Z',
    ],
    markers: [
      { cx: 424, cy: 266, rx: 3.4, ry: 7.2 },
      { cx: 636, cy: 266, rx: 3.4, ry: 7.2 },
    ],
  },
  {
    key: 'lower-back',
    label: { en: 'Lower Back', zh: '下背' },
    tokens: ['spine', 'erector', 'lower back', '竖脊肌', '腰'],
    callout: { from: [530, 240], elbow: [612, 274], label: [630, 278], side: 'left' },
    paths: [
      'M520 160 C527 192 528 232 523 284 C516 298 508 295 505 279 C505 233 508 191 514 163 Z',
      'M540 160 C533 192 532 232 537 284 C544 298 552 295 555 279 C555 233 552 191 546 163 Z',
    ],
    highlightPaths: [
      'M516 181 C525 209 526 248 522 280 C517 290 511 288 508 276 C508 236 511 204 516 181 Z',
      'M544 181 C535 209 534 248 538 280 C543 290 549 288 552 276 C552 236 549 204 544 181 Z',
    ],
    markers: [
      { cx: 518, cy: 228, rx: 4, ry: 8.4 },
      { cx: 542, cy: 228, rx: 4, ry: 8.4 },
    ],
  },
  {
    key: 'glutes',
    label: { en: 'Glutes', zh: '臀部' },
    tokens: ['glute', 'hip', 'posterior chain', '臀'],
    callout: { from: [566, 326], elbow: [612, 340], label: [630, 344], side: 'left' },
    posteriorAlignmentTransform: POSTERIOR_GLUTE_REGION_ALIGNMENT_TRANSFORM,
    paths: [
      'M502 300 C515 291 526 298 529 318 C524 333 513 341 500 338 C493 326 494 309 502 300 Z',
      'M550 300 C540 291 532 298 531 318 C535 333 544 340 556 337 C562 326 560 309 550 300 Z',
    ],
    highlightPaths: [
      'M506 304 C516 298 525 303 527 318 C523 329 514 335 504 333 C499 323 500 310 506 304 Z',
      'M554 304 C544 298 535 303 533 318 C537 329 546 335 556 333 C561 323 560 310 554 304 Z',
    ],
    fibers: [
      'M508 313 C516 307 523 309 526 318',
      'M534 318 C538 309 545 307 552 313',
      'M505 326 C512 332 520 333 527 326',
      'M533 326 C541 333 549 332 555 326',
    ],
    markers: [
      { cx: 520, cy: 321, rx: 4, ry: 4 },
      { cx: 548, cy: 321, rx: 4, ry: 4 },
    ],
  },
  {
    key: 'hamstrings',
    label: { en: 'Hamstrings', zh: '腘绳肌' },
    tokens: ['hamstring', 'posterior thigh', 'posterior chain', '腘绳肌', '大腿'],
    callout: { from: [576, 396], elbow: [612, 406], label: [630, 406], side: 'left' },
    posteriorAlignmentTransform: POSTERIOR_LEG_REGION_ALIGNMENT_TRANSFORM,
    paths: [
      'M512 346 C526 360 529 394 525 440 C522 456 516 469 508 473 C501 450 504 379 511 350 Z',
      'M537 350 C547 371 547 405 542 450 C539 464 533 474 526 478 C522 450 524 378 532 352 Z',
      'M547 350 C540 371 540 405 545 450 C548 464 554 474 561 478 C565 450 563 378 556 352 Z',
      'M574 346 C562 360 558 394 563 440 C567 456 574 469 582 473 C587 450 584 379 576 350 Z',
    ],
    highlightPaths: [
      'M512 354 C523 365 524 396 520 435 C518 449 513 460 508 464 C504 440 506 378 512 354 Z',
      'M532 356 C542 376 541 407 537 444 C535 456 531 466 526 470 C523 445 526 380 532 356 Z',
      'M556 356 C546 376 547 407 551 444 C553 456 557 466 562 470 C565 445 562 380 556 356 Z',
      'M574 354 C563 365 562 396 566 435 C568 449 573 460 578 464 C582 440 580 378 574 354 Z',
    ],
    fibers: [
      'M516 358 C520 385 519 421 513 456',
      'M531 360 C535 389 534 426 528 462',
      'M551 360 C548 389 549 426 556 462',
      'M570 358 C566 385 567 421 576 456',
    ],
    markers: [
      { cx: 524, cy: 382, rx: 4, ry: 4 },
      { cx: 532, cy: 430, rx: 4, ry: 4 },
      { cx: 554, cy: 382, rx: 4, ry: 4 },
      { cx: 566, cy: 430, rx: 4, ry: 4 },
    ],
  },
  {
    key: 'gastrocnemius',
    label: { en: 'Calves', zh: '小腿' },
    tokens: ['calf', 'calves', 'gastrocnemius', 'soleus', 'ankle', '小腿', '腓肠肌', '踝'],
    callout: { from: [576, 490], elbow: [612, 508], label: [630, 508], side: 'left' },
    posteriorAlignmentTransform: POSTERIOR_LEG_REGION_ALIGNMENT_TRANSFORM,
    paths: [
      'M528 470 C540 482 541 508 535 532 C530 542 523 545 517 536 C514 512 516 486 522 472 Z',
      'M565 470 C556 482 555 508 561 532 C566 542 573 545 579 536 C581 512 579 486 574 472 Z',
    ],
    highlightPaths: [
      'M524 478 C535 490 536 510 531 530 C527 538 522 540 518 533 C516 512 518 490 524 478 Z',
      'M568 478 C558 490 557 510 562 530 C566 538 571 540 575 533 C577 512 575 490 568 478 Z',
    ],
    fibers: [
      'M526 476 C532 492 532 514 526 535',
      'M537 478 C540 497 539 517 533 536',
      'M563 478 C560 497 561 517 567 536',
      'M573 476 C568 492 568 514 574 535',
    ],
    markers: [
      { cx: 528, cy: 494, rx: 4, ry: 4 },
      { cx: 532, cy: 524, rx: 4, ry: 4 },
      { cx: 566, cy: 494, rx: 4, ry: 4 },
      { cx: 570, cy: 524, rx: 4, ry: 4 },
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
    'mt-body-real-human-atlas',
    'mt-body-medical-atlas',
    'mt-body-lean-runner-atlas',
    compact ? 'mt-body-measure-atlas--compact' : '',
  ].filter(Boolean).join(' ');

  const renderRegion = (region) => {
    const isPlanActive = planRegions.has(region.key);
    const isFocused = hoveredRegionKey === region.key;
    const isPosteriorRegion = region.callout.from[0] > REFERENCE_BODY_MEASURE_VIEWBOX.width / 2;
    const posteriorRegionTransform = isPosteriorRegion ? getPosteriorRegionAlignmentTransform(region) : undefined;
    const hasCalibratedPosteriorHighlight = isPosteriorRegion && Boolean(region.highlightPaths?.length);
    const visibleRegionPaths = hasCalibratedPosteriorHighlight ? region.highlightPaths : region.paths;
    const hitTargetPaths = hasCalibratedPosteriorHighlight ? visibleRegionPaths : region.paths;
    const regionLabel = region.label[isZh ? 'zh' : 'en'];
    const regionInspection = inspection.get(region.key);
    const regionExerciseNames = (regionInspection?.exercises || []).map((item) => item.name).slice(0, 2).join(' / ');
    const regionAriaLabel = regionExerciseNames
      ? `${regionLabel}, ${bodyMeasureCopy.trainedByLabel || ''} ${regionExerciseNames}`.trim()
      : regionLabel;
    return (
      <g
        key={region.key}
        className={`mt-body-measure-region${highlightedRegions.has(region.key) ? ' is-active' : ''}${isPlanActive ? ' is-plan-active' : ''}${regionInspection?.exercises?.length ? ' is-trainable' : ''}${isFocused ? ' is-focused' : ''}`}
        data-region={region.key}
        data-training-count={regionInspection?.exercises?.length || 0}
        data-view={isPosteriorRegion ? 'posterior' : 'anterior'}
        data-highlight-geometry={hasCalibratedPosteriorHighlight ? 'posterior-calibrated' : undefined}
        transform={posteriorRegionTransform}
        clipPath={isPosteriorRegion ? 'url(#mtBodyPosteriorPlate)' : 'url(#mtBodyClinicalClip)'}
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
        {hitTargetPaths.map((d, index) => (
          <path
            key={`${region.key}-hit-${index}`}
            className="mt-body-measure-hit-target"
            d={d}
            aria-hidden="true"
          />
        ))}
        {visibleRegionPaths.map((d, index) => (
          <path
            key={`${region.key}-path-${index}`}
            className={hasCalibratedPosteriorHighlight ? 'mt-body-posterior-highlight-path' : undefined}
            d={d}
          />
        ))}
        {(region.fibers || []).map((d, index) => <path key={`${region.key}-fiber-${index}`} d={d} className="mt-body-muscle-fiber" />)}
      </g>
    );
  };

  const renderRegionBed = (region) => {
    const isPosteriorRegion = region.callout.from[0] > REFERENCE_BODY_MEASURE_VIEWBOX.width / 2;
    const posteriorRegionTransform = isPosteriorRegion ? getPosteriorRegionAlignmentTransform(region) : undefined;
    return (
      <g
        key={`${region.key}-bed`}
        className="mt-body-measure-region-bed"
        data-region={region.key}
        data-view={isPosteriorRegion ? 'posterior' : 'anterior'}
        transform={posteriorRegionTransform}
        clipPath={isPosteriorRegion ? 'url(#mtBodyPosteriorPlate)' : undefined}
        aria-hidden="true"
      >
        {region.paths.map((d, index) => <path key={`${region.key}-bed-path-${index}`} d={d} />)}
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
            <g className="mt-body-reference-image-layer" aria-hidden="true">
              <image
                href={anatomyAnteriorGray}
                x="58"
                y="42"
                width="264"
                height="508"
                data-align-level="shared-anatomy-baseline"
                data-visual-scale="frame-contained-slice"
                preserveAspectRatio="xMidYMid slice"
                clipPath="url(#mtBodyAnteriorPlate)"
                className="mt-body-reference-image"
              />
            </g>
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
            <g className="mt-body-reference-image-layer" transform={POSTERIOR_RASTER_ALIGNMENT_TRANSFORM} aria-hidden="true">
              <image
                href={anatomyPosteriorGray}
                x="411.12"
                y="59.4"
                width="370.2"
                height="491.2"
                data-align-level="shared-anatomy-baseline"
                data-crop-align="posterior-body-axis-fitted"
                data-visual-scale="posterior-matched-person-grid-fit"
                preserveAspectRatio="xMidYMid meet"
                clipPath="url(#mtBodyPosteriorPlate)"
                className="mt-body-reference-image"
              />
            </g>
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
  const distanceWindowLabel = isZh ? `${distanceUnitLabel} / 7 \u5929` : `${distanceUnitLabel} / 7d`;


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
  const protocolItems = useMemo(
    () => (featuredSession?.blocks || []).flatMap((block, blockIndex) => (
      (block.exercises || []).map((exercise, exerciseIndex) => ({
        block,
        blockIndex,
        exercise,
        exerciseIndex,
      }))
    )),
    [featuredSession],
  );
  const muscleFocus = useMemo(() => {
    const labels = [];
    protocolItems.forEach(({ exercise }) => {
      getExerciseCardContent(exercise, isZh).muscles.forEach((muscle) => {
        if (!labels.includes(muscle)) labels.push(muscle);
      });
    });
    return labels.slice(0, 4);
  }, [isZh, protocolItems]);
  const muscleInspection = useMemo(() => {
    const registry = new Map();
    protocolItems.forEach(({ block, exercise, exerciseIndex }) => {
      const exerciseCopy = getExerciseCardContent(exercise, isZh);
      const regionKeys = resolveReferenceBodyMeasureRegionKeys(exerciseCopy.muscles);
      regionKeys.forEach((regionKey) => {
        const current = registry.get(regionKey) || { exercises: [] };
        if (!current.exercises.some((item) => item.name === exerciseCopy.name)) {
          current.exercises.push({
            name: exerciseCopy.name,
            prescription: formatLocalizedExercisePrescription(exercise, isZh),
            cue: exerciseCopy.intent || exerciseCopy.steps?.[0] || '',
            blockTitle: pickLabel(copy.blockTitles, block.title, block.title),
            order: exerciseIndex + 1,
          });
        }
        registry.set(regionKey, current);
      });
    });
    return registry;
  }, [copy.blockTitles, isZh, protocolItems]);
  const coachingCues = useMemo(
    () => protocolItems.slice(0, 3).map(({ exercise, exerciseIndex }) => {
      const content = getExerciseCardContent(exercise, isZh);
      return {
        key: `${exercise.name}-${exerciseIndex}`,
        title: content.name,
        body: content.steps[0] || content.intent,
      };
    }),
    [isZh, protocolItems],
  );
  const estimatedBurn = useMemo(() => {
    const minutes = featuredDay?.strength?.durationMinutes;
    if (minutes == null) return null;
    const rpe = featuredDay?.strength?.targetRpe || 6;
    const loadFactor = rpe >= 8 ? 10.2 : rpe >= 7 ? 9.4 : 8.6;
    return Math.round(minutes * loadFactor);
  }, [featuredDay]);
  const heroTags = useMemo(() => {
    const tags = [];
    if (featuredDay?.strength?.optional) tags.push(t('muscle_training.tag_optional_session'));
    if (featuredDay?.run?.keyRun) tags.push(t('muscle_training.tag_safe_before_key_run'));
    if (featuredDay?.run?.longRun) tags.push(t('muscle_training.tag_long_run_support'));
    if (featuredSession?.emphasis) tags.push(featuredSession.emphasis);
    return tags.slice(0, 3);
  }, [featuredDay, featuredSession, t]);
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
    coachDeckTitle: t('muscle_training.stitch_coach_deck_title'),
    coachDeckHint: t('muscle_training.stitch_coach_deck_hint'),
    support: t('muscle_training.stitch_support'),
    settings: t('muscle_training.stitch_settings'),
    todayLabel: t('muscle_training.stitch_today_label'),
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
  }), [t]);

  const navItems = useMemo(
    () => getRunnerShellNavItems({ t, lang, activeKey: 'muscle' }),
    [t, lang],
  );
  // heroTheme retained for possible future use but not rendered above-fold in this redesign
  // eslint-disable-next-line no-unused-vars
  const heroTheme = useMemo(() => {
    const focus = pickLabel(copy.currentFocus, plan?.weekContext?.currentFocus, featuredSession?.emphasis || '');
    const split = String(focus || '').split(/[\s/]+/).filter(Boolean);
    if (split.length >= 2) {
      return { lineOne: split[0], lineTwo: split.slice(1).join(' ') };
    }
    return {
      lineOne: t('muscle_training.stitch_strength'),
      lineTwo: focus || t('muscle_training.stitch_ready_label'),
    };
  }, [copy.currentFocus, featuredSession, t, plan]);

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
      await apiJson('/api/training/muscle/check-in/today', {
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
      await apiJson('/api/training/muscle/check-in/today', { method: 'DELETE' });
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
            <div className="runner-shell-topnav">
              <span className="runner-shell-topnav-link is-active">{stitchCopy.strength}</span>
            </div>
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
          <div className="dashboard-container page-body muscle-training-page">

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
            <section
              className="mt-strength-lab"
              aria-labelledby="mt-strength-lab-title"
              data-session-state={featuredDay?.strength ? 'active' : 'recovery'}
            >
            {/* ── ZONE 1: What should I do for strength today? ── */}
              <section className="mt-anatomy-command-board" aria-label={stitchCopy.muscleFocusTitle}>
                <div className="mt-anatomy-command-map">
                  <ReferenceMuscleMap
                    isZh={isZh}
                    focusMuscles={muscleFocus}
                    weekContext={plan.weekContext}
                    weekDoseStats={weekDoseStats}
                    inspection={muscleInspection}
                    copy={{
                      title: stitchCopy.bodyMeasureTitle,
                      desc: stitchCopy.bodyMeasureDesc,
                      loadLabel: stitchCopy.bodyMeasureLoadLabel,
                      balanceLabel: stitchCopy.bodyMeasureBalanceLabel,
                      anterior: stitchCopy.bodyMeasureAnterior,
                      posterior: stitchCopy.bodyMeasurePosterior,
                      interactionHint: stitchCopy.bodyMeasureInteractionHint,
                      selectedLabel: stitchCopy.bodyMeasureSelectedLabel,
                      trainedByLabel: stitchCopy.bodyMeasureTrainedByLabel,
                      planFocusLabel: stitchCopy.bodyMeasurePlanFocusLabel,
                      inspectHint: stitchCopy.bodyMeasureInspectHint,
                    }}
                  />
                </div>
                <div className="mt-anatomy-command-copy">
                  <span className="strength-plan-section-label">{stitchCopy.muscleFocusTitle}</span>
                  <strong>{stitchCopy.bodyMeasureTitle}</strong>
                  <p>{stitchCopy.bodyMeasureInteractionHint}</p>
                  {muscleFocus.length > 0 && (
                    <div className="strength-plan-focus-pills">
                      {muscleFocus.map((muscle) => <span key={muscle}>{muscle}</span>)}
                    </div>
                  )}
                </div>
              </section>

              <div className="mt-strength-lab-header">
                <div>
                  <span className="strength-plan-section-label">{stitchCopy.seriesLabel}</span>
                  <h1 id="mt-strength-lab-title">{stitchCopy.strength}</h1>
                </div>
              </div>

              <section className="mt-coach-cockpit">
              <div className="mt-coach-cockpit-main">
                <section className={`mt-today-card${featuredDay?.strength ? ' has-session' : ' is-recovery-session'}`}>
                  <div className="mt-today-verdict">
                    <div className="mt-today-card-kicker">
                      <AppIcon name="fitness_center" className="mt-today-kicker-icon" />
                      <span>{stitchCopy.todayLabel}</span>
                      {featuredDay?.strength && (
                        <span className="mt-today-badge mt-today-badge-strength">
                          {pickLabel(copy.sessionTypes, featuredDay.strength.sessionType)}
                        </span>
                      )}
                      {!featuredDay?.strength && (
                        <span className="mt-today-badge mt-today-badge-rest">
                          {stitchCopy.noStrengthTitle}
                        </span>
                      )}
                    </div>

                    <p className="mt-today-narrative">{todayCoachNarrative}</p>
                  </div>

                  <div className="mt-readiness-deck">
                    <article className="mt-readiness-card mt-readiness-card--decision">
                      <span>{stitchCopy.decisionLabel}</span>
                      <strong>
                        {featuredDay?.strength
                          ? pickLabel(copy.sessionTypes, featuredDay.strength.sessionType)
                          : stitchCopy.noStrengthTitle}
                      </strong>
                      <p>{featuredDay?.strength ? (heroTags[0] || stitchCopy.readyHint) : stitchCopy.noStrengthHint}</p>
                    </article>

                    <article className="mt-readiness-card mt-readiness-card--dose">
                      <span>{stitchCopy.weekDoseLabel}</span>
                      <strong>
                        {weekDoseStats.planned}
                        <small> / {weekDoseStats.recommended || 0}</small>
                      </strong>
                      <p>
                        {plan.weekContext?.volumeKm7d != null
                          ? `${formatDistanceValue(plan.weekContext.volumeKm7d, isMile, 1) ?? '0'} ${isMile ? t('muscle_training.miles_unit') : t('muscle_training.km_unit')} / 7d`
                          : stitchCopy.weekAlignLabel}
                      </p>
                    </article>

                    <article className="mt-readiness-card mt-readiness-card--next-run">
                      <span>{stitchCopy.nextRunLabel}</span>
                      <strong>{nextRunSummary.label}</strong>
                      <p>{nextRunSummary.meta}</p>
                    </article>

                    <article className="mt-readiness-card mt-readiness-card--gate">
                      <span>{stitchCopy.recoveryGateLabel}</span>
                      <strong>{pickLabel(copy.recoveryGate, plan.weekContext?.recoveryGate)}</strong>
                      <p>
                        {plan.weekContext?.acwr != null
                          ? `ACWR ${trimNumber(plan.weekContext.acwr, 2)} · ${pickLabel(copy.loadStatus, plan.weekContext?.loadStatus)}`
                          : pickLabel(copy.loadStatus, plan.weekContext?.loadStatus)}
                      </p>
                    </article>
                  </div>

                  {featuredDay?.strength && (
                    <div className="mt-today-metrics">
                      <div className="mt-today-metric">
                        <span>{stitchCopy.durationLabel}</span>
                        <strong>{featuredDay.strength.durationMinutes ? formatMinutes(featuredDay.strength.durationMinutes, isZh) : '-'}</strong>
                      </div>
                      <div className="mt-today-metric">
                        <span>{copy.rpeTitle}</span>
                        <strong>RPE {featuredDay.strength.targetRpe ?? '-'}</strong>
                      </div>
                      <div className="mt-today-metric">
                        <span>{stitchCopy.loadLabel}</span>
                        <strong>{String(protocolItems.length).padStart(2, '0')}</strong>
                      </div>
                      {estimatedBurn != null && (
                        <div className="mt-today-metric">
                          <span>{stitchCopy.burnLabel}</span>
                          <strong>{estimatedBurn} kcal</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {featuredDay?.strength && (
                    <div className="mt-today-actions">
                      <button type="button" className="strength-plan-primary-btn" onClick={scrollToControls}>
                        {stitchCopy.startWorkout}
                      </button>
                      {heroTags.length > 0 && (
                        <div className="strength-plan-hero-tags">
                          {heroTags.map((tag) => <span key={tag}>{tag}</span>)}
                        </div>
                      )}
                    </div>
                  )}
                </section>

              </div>

              <aside className="mt-coach-cockpit-rail">
                <section className="mt-coach-rail-card mt-coach-rail-card--focus">
                  <span className="strength-plan-section-label">{stitchCopy.recoveryImpactTitle}</span>
                  <strong>{pickLabel(copy.currentFocus, plan.weekContext?.currentFocus)}</strong>
                  <p>{pickLabel(copy.recoveryGate, plan.weekContext?.recoveryGate)} - {pickLabel(copy.loadStatus, plan.weekContext?.loadStatus)}</p>
                </section>
              </aside>
            </section>

            {/* ZONE 3: Does it match my running plan this week? */}
            <section className="mt-week-strip">
              <span className="strength-plan-section-label">{stitchCopy.weekStripLabel}</span>
              <div className="mt-week-strip-grid">
                {(plan.days || []).map((day, idx) => {
                  const hasStrength = !!day.strength;
                  const isKeyRun = day.run?.keyRun;
                  const isLongRun = day.run?.longRun;
                  const isRest = day.run?.workoutType === 'REST' || (!day.run?.workoutType && !hasStrength);
                  const isToday = idx === 0;
                  let dayType = 'run';
                  if (isRest && !hasStrength) dayType = 'rest';
                  return (
                    <div
                      key={day.date || idx}
                      className={`mt-strip-day${hasStrength ? ' has-strength' : ''}${isToday ? ' is-today' : ''}${isKeyRun ? ' has-key-run' : ''}${isLongRun ? ' has-long-run' : ''} day-type-${dayType}`}
                    >
                      <div className="mt-strip-day-label">
                        {isToday
                          ? stitchCopy.todayBadge
                          : formatDayLabel(day.date, day.dayLabel, displayLang)}
                      </div>
                      <div className="mt-strip-day-badges">
                        {hasStrength && (
                          <span className="mt-strip-badge mt-strip-badge-strength">
                            {stitchCopy.strengthDayBadge}
                          </span>
                        )}
                        {isKeyRun && (
                          <span className="mt-strip-badge mt-strip-badge-key">
                            {stitchCopy.keyRunBadge}
                          </span>
                        )}
                        {isLongRun && (
                          <span className="mt-strip-badge mt-strip-badge-long">
                            {stitchCopy.longRunBadge}
                          </span>
                        )}
                        {!hasStrength && !isKeyRun && !isLongRun && (
                          <span className="mt-strip-badge mt-strip-badge-run">
                            {isRest ? stitchCopy.restDayBadge : stitchCopy.runDayBadge}
                          </span>
                        )}
                      </div>
                      {day.run?.plannedDistanceKm != null && (
                        <div className="mt-strip-day-dist">
                          {formatDistance(day.run.plannedDistanceKm, isZh, isMile)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── PROTOCOL: Full exercise list (disclosed on demand on mobile) ── */}
            </section>

            {featuredDay?.strength && (
              <section className="strength-plan-hero-shell mt-protocol-board">
                <section className="strength-plan-content-grid">
                  <div className="strength-plan-protocol">
                    <span className="strength-plan-section-label">{stitchCopy.protocolTitle}</span>
                    {protocolItems.length > 0 ? (
                      <div className="strength-plan-protocol-list">
                        {protocolItems.map(({ block, blockIndex, exercise, exerciseIndex }) => {
                          const exerciseCopy = getExerciseCardContent(exercise, isZh);
                          return (
                            <article
                              key={`${block.title}-${exercise.name}-${exerciseIndex}`}
                              className="strength-plan-exercise-row"
                              data-block-index={blockIndex + 1}
                              data-exercise-index={exerciseIndex + 1}
                            >
                              <div className="strength-plan-exercise-media">
                                <span className="strength-plan-exercise-order" aria-hidden="true">
                                  {String(exerciseIndex + 1).padStart(2, '0')}
                                </span>
                                <ExerciseIllustration exerciseName={exercise.name} muscles={exerciseCopy.muscles} isZh={isZh} />
                              </div>
                              <div className="strength-plan-exercise-copy">
                                <span className="strength-plan-exercise-kicker">
                                  {String(blockIndex + 1).padStart(2, '0')} / {pickLabel(copy.blockTitles, block.title, block.title)}
                                </span>
                                <h3>{exerciseCopy.name}</h3>
                                <p>{exerciseCopy.steps.slice(0, 2).join(' ')}</p>
                              </div>
                              <div className="strength-plan-exercise-meta">
                                <div>
                                  <span>{t('muscle_training.sets_reps_duration')}</span>
                                  <strong>{formatLocalizedExercisePrescription(exercise, isZh)}</strong>
                                </div>
                                <em>{exerciseCopy.intent}</em>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="strength-plan-empty-panel">
                        <h3>{stitchCopy.noStrengthTitle}</h3>
                        <p>{pickLabel(copy.noStrengthReasons, featuredDay?.noStrengthReasonCode, stitchCopy.noStrengthHint)}</p>
                      </div>
                    )}

                    <div className="strength-plan-cta-panel">
                      <h3>{stitchCopy.readyTitle}</h3>
                      <p>{stitchCopy.readyHint}</p>
                      <button type="button" className="strength-plan-primary-btn" onClick={scrollToControls}>
                        {stitchCopy.enterWorkout}
                      </button>
                    </div>
                  </div>

                  <aside className="strength-plan-rail strength-plan-rail--cues-only">
                    <section className="strength-plan-rail-card strength-plan-rail-card--cues">
                      <span className="strength-plan-section-label">{stitchCopy.coachingCuesTitle}</span>
                      <div className="strength-plan-cues">
                        {coachingCues.map((cue, index) => (
                          <article key={cue.key} className="strength-plan-cue">
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            <div>
                              <h4>{cue.title}</h4>
                              <p>{cue.body}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  </aside>
                </section>
              </section>
            )}

            {/* ── COACH CONTROLS: check-in + preferences behind disclosure ── */}
            <section id="muscle-controls" className="strength-plan-control-deck">
              <div className="strength-plan-control-head">
                <div>
                  <span className="strength-plan-section-label">{stitchCopy.coachDeckTitle}</span>
                  <p>{stitchCopy.coachDeckHint}</p>
                </div>
              </div>

            <details className="mt-settings-disclosure">
              <summary className="mt-settings-summary">
                <AppIcon name="tune" className="mt-settings-icon" />
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
                      {copy.checkInUpdatedAt}: {formatTimestamp(plan.todayCheckIn.updatedAt, displayLang)}
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
                        >
                          {t(day.zh ? 'muscle_training.weekday_zh' : 'muscle_training.weekday_en')}
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
