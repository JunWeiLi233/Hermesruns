import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiJson } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import FooterNavLinks from '../components/FooterNavLinks';
import TopbarNotifications from '../components/TopbarNotifications';

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
  'World鈥檚 greatest stretch': { zh: '世界最强拉伸', en: "World's greatest stretch" },
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

const EXERCISE_ALIAS_MAP = {
  'World’s greatest stretch': "World's greatest stretch",
  'World鈥檚 greatest stretch': "World's greatest stretch",
  'World閳ユ獨 greatest stretch': "World's greatest stretch",
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
  if (!name) return '';
  return EXERCISE_ALIAS_MAP[name] || name;
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

function resolveExerciseVisualKey(name) {
  switch (normalizeExerciseName(name)) {
    case 'Dead bug':
      return 'deadbug';
    case 'Side plank':
    case 'Pallof press':
    case 'Farmer carry (suitcase)':
      return 'core';
    case 'Glute bridge (pause at top)':
    case 'Hamstring curl (slider or machine)':
      return 'bridge';
    case 'Split squat':
    case 'Step-down (knee tracking)':
    case "World's greatest stretch":
    case 'World鈥檚 greatest stretch':
      return 'split';
    case 'Single-leg Romanian deadlift':
    case 'Hip airplanes':
      return 'hinge';
    case 'Standing calf raise':
    case 'Calf raises (slow tempo)':
    case 'Tibialis wall raise':
    case 'Ankle dorsiflexion rocks':
      return 'calf';
    case 'Pogo hops':
    case 'Skipping A-drill':
    case 'Box step-up (explosive)':
    case 'Single-leg hop (low amplitude)':
      return 'hop';
    default:
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
    'World鈥檚 greatest stretch': 'world greatest stretch exercise demo',
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

function MuscleMap({ isZh }) {
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

function ExerciseIllustration({ exerciseName }) {
  const mode = resolveExerciseVisualKey(exerciseName);
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
    deadbug: { frontPrimary: ['abs'], frontSecondary: ['obliqueLeft', 'obliqueRight', 'hipFlexorLeft', 'hipFlexorRight'], backSecondary: ['lowerBack'] },
    core: { frontPrimary: ['abs', 'obliqueLeft', 'obliqueRight'], backSecondary: ['lowerBack'] },
    bridge: { backPrimary: ['gluteLeft', 'gluteRight', 'hamLeft', 'hamRight'], frontSecondary: ['abs'] },
    split: { frontPrimary: ['quadsLeft', 'quadsRight', 'adductorLeft', 'adductorRight'], backSecondary: ['gluteLeft', 'gluteRight', 'hamLeft', 'hamRight'] },
    hinge: { backPrimary: ['gluteLeft', 'gluteRight', 'hamLeft', 'hamRight', 'lowerBack'], frontSecondary: ['abs'] },
    calf: { backPrimary: ['calfLeft', 'calfRight'], frontSecondary: ['shinLeft', 'shinRight'] },
    hop: { frontPrimary: ['quadsLeft', 'quadsRight', 'calfLeft', 'calfRight'], backSecondary: ['gluteLeft', 'gluteRight', 'hamLeft', 'hamRight'] },
    standing: { frontPrimary: ['quadsLeft', 'quadsRight'], backSecondary: ['gluteLeft', 'gluteRight'] },
  };

  const active = regionSets[mode] || regionSets.standing;

  function renderRegions(side, names, tone) {
    return (names || []).map((name) => (
      <path key={`${side}-${tone}-${name}`} d={regions[side][name]} className={tone === 'primary' ? 'muscle-region-primary' : 'muscle-region-secondary'} />
    ));
  }

  function renderBody(side, label, x) {
    return (
      <g transform={`translate(${x} 18)`}>
        <rect x="0" y="0" width="92" height="138" rx="28" className="muscle-map-panel" />
        <text x="46" y="16" textAnchor="middle" className="muscle-map-panel-label">{label}</text>
        <ellipse cx="46" cy="126" rx="24" ry="6" className="muscle-map-shadow" />
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
    <svg viewBox="0 0 220 176" className="muscle-exercise-figure" aria-hidden="true">
      <rect x="8" y="8" width="204" height="160" rx="30" className="muscle-exercise-bg" />
      {renderBody('back', 'BACK', 16)}
      {renderBody('front', 'FRONT', 112)}
      <text x="110" y="162" textAnchor="middle" className="muscle-map-legend-copy">Primary / Secondary</text>
      <circle cx="82" cy="159" r="4" className="muscle-region-primary" />
      <circle cx="138" cy="159" r="4" className="muscle-region-secondary" />
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
    'World鈥檚 greatest stretch': {
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

function createPageCopy(isZh) {
  return {
    checkInTitle: isZh ? '\u4eca\u65e5\u8bad\u7ec3\u786e\u8ba4' : "Today's training check-in",
    checkInHint: isZh
      ? '\u5148\u786e\u8ba4\u4f60\u4eca\u5929\u5b9e\u9645\u6253\u7b97\u600e\u4e48\u7ec3\uff0c\u529b\u91cf\u5efa\u8bae\u4f1a\u7acb\u5373\u91cd\u7b97\u672a\u6765 7 \u5929\u3002'
      : 'Confirm what you are actually doing today and the next 7 days of strength placement will refresh immediately.',
    checkInTypeLabel: isZh ? '\u4eca\u65e5\u8bad\u7ec3\u7c7b\u578b' : "Today's run type",
    checkInStateLabel: isZh ? '\u8f93\u5165\u72b6\u6001' : 'Entry state',
    checkInDistanceLabel: isZh ? '\u53ef\u9009\u516c\u91cc' : 'Optional distance',
    checkInDurationLabel: isZh ? '\u53ef\u9009\u65f6\u957f' : 'Optional minutes',
    checkInSave: isZh ? '\u4fdd\u5b58\u4eca\u65e5\u786e\u8ba4' : 'Save today',
    checkInSaving: isZh ? '\u4fdd\u5b58\u4e2d...' : 'Saving...',
    checkInReset: isZh ? '\u6062\u590d\u6559\u7ec3\u8ba1\u5212' : 'Restore coach schedule',
    checkInSaved: isZh ? '\u4eca\u65e5\u8bad\u7ec3\u786e\u8ba4\u5df2\u4fdd\u5b58\uff0c\u529b\u91cf\u8ba1\u5212\u5df2\u5237\u65b0\u3002' : 'Today\'s check-in was saved and the strength plan was refreshed.',
    checkInResetSuccess: isZh ? '\u5df2\u6e05\u9664\u4eba\u5de5\u786e\u8ba4\uff0c\u6062\u590d\u6309\u6559\u7ec3\u8ba1\u5212\u63a8\u65ad\u3002' : 'Manual check-in cleared. The page is back to coach-schedule mode.',
    checkInUpdatedAt: isZh ? '\u6700\u540e\u66f4\u65b0' : 'Last updated',
    planSourceLabel: isZh ? '\u5efa\u8bae\u6765\u6e90' : 'Recommendation source',
    sourcePills: {
      COACH_SCHEDULE: isZh ? '\u57fa\u4e8e\u6559\u7ec3\u8ba1\u5212' : 'Coach schedule',
      USER_PLANNED: isZh ? '\u4f60\u7684\u4eca\u65e5\u8ba1\u5212' : 'Your plan for today',
      USER_ACTUAL: isZh ? '\u4f60\u7684\u5b9e\u9645\u5b8c\u6210' : 'Your actual session',
    },
    sourceSummary: {
      COACH_SCHEDULE: isZh ? '\u5f53\u524d\u529b\u91cf\u5efa\u8bae\u57fa\u4e8e\u6559\u7ec3\u8ba1\u5212\u63a8\u65ad\uff0c\u5f85\u786e\u8ba4\u3002' : 'The current strength recommendation is inferred from your coach schedule and is still waiting for confirmation.',
      USER_PLANNED: isZh ? '\u5f53\u524d\u529b\u91cf\u5efa\u8bae\u57fa\u4e8e\u4f60\u4eca\u5929\u4e3b\u52a8\u586b\u5199\u7684\u8ba1\u5212\u3002' : 'The current strength recommendation is based on the plan you entered for today.',
      USER_ACTUAL: isZh ? '\u5f53\u524d\u529b\u91cf\u5efa\u8bae\u57fa\u4e8e\u4f60\u4eca\u5929\u5df2\u786e\u8ba4\u7684\u5b9e\u9645\u8bad\u7ec3\u3002' : 'The current strength recommendation is based on the actual session you confirmed for today.',
    },
    checkInStateOptions: {
      PLANNED: isZh ? '\u8ba1\u5212' : 'Planned',
      ACTUAL: isZh ? '\u5b9e\u9645\u5b8c\u6210' : 'Actual',
    },
    heading: isZh ? '力量训练 2.0' : 'Strength Training 2.0',
    subheading: isZh
      ? '基于最近跑量、恢复门控、比赛阶段和个人偏好，给你从今天开始的 7 天滚动力量周计划。'
      : 'A rolling 7-day strength plan built from your recent running load, recovery gate, race phase, and preferences.',
    languageToggleLabel: isZh ? '切换页面语言' : 'Switch page language',
    loading: isZh ? '正在生成 7 天力量周计划...' : 'Building your 7-day strength plan...',
    profileTitle: isZh ? '力量偏好设置' : 'Strength preferences',
    profileHint: isZh
      ? '这些设置会保存到你的档案，并直接影响动作选择、排课频率和静音过滤。'
      : 'These settings are saved to your profile and directly shape exercise selection, weekly frequency, and quiet-mode filtering.',
    experienceLabel: isZh ? '力量经验' : 'Strength experience',
    equipmentLabel: isZh ? '可用器械' : 'Available equipment',
    sessionMinutesLabel: isZh ? '每次时长' : 'Minutes per session',
    noiseLabel: isZh ? '训练环境' : 'Training environment',
    preferredDaysLabel: isZh ? '偏好训练日' : 'Preferred training days',
    save: isZh ? '保存设置' : 'Save settings',
    saving: isZh ? '保存中...' : 'Saving...',
    saveSuccess: isZh ? '力量偏好已保存，周计划已刷新。' : 'Preferences saved and plan refreshed.',
    statusTitle: isZh ? '本周状态' : 'This week',
    rationaleTitle: isZh ? '安排逻辑' : 'Why this plan',
    weekTitle: isZh ? '滚动 7 天安排' : 'Rolling 7-day schedule',
    weekHint: isZh
      ? '力量优先安排在轻松跑后、恢复日或低压力日，并尽量避开关键跑和长跑前 24 小时。'
      : 'Strength is placed after easy runs, on recovery days, or in low-cost slots, while avoiding the 24 hours before key runs and long runs.',
    conservativeBanner: isZh
      ? '跑步数据不足，当前为保守起步版：先给 1 次 20-30 分钟的静音基础力量。'
      : 'Running data is limited, so this is a conservative starter plan: one quiet 20-30 minute foundation session.',
    summaryFrequency: isZh ? '推荐频率' : 'Recommended frequency',
    summaryRecovery: isZh ? '恢复门控' : 'Recovery gate',
    summaryUpcoming: isZh ? '下一次关键跑 / 长跑' : 'Next key run / long run',
    summaryFocus: isZh ? '当前力量重点' : 'Current strength focus',
    noKeyRun: isZh ? '未来 7 天没有关键跑' : 'No key run in the next 7 days',
    noLongRun: isZh ? '未来 7 天没有长跑' : 'No long run in the next 7 days',
    runContext: isZh ? '跑步上下文' : 'Run context',
    strengthTitle: isZh ? '今天的力量安排' : "Today's strength slot",
    noStrengthTitle: isZh ? '今天不建议做力量' : 'Why strength is not scheduled today',
    placementTitle: isZh ? '为什么安排在今天' : 'Why it lands here',
    durationTitle: isZh ? '时长' : 'Duration',
    rpeTitle: isZh ? '目标 RPE' : 'Target RPE',
    optionalTitle: isZh ? '课程属性' : 'Session flag',
    optionalYes: isZh ? '可选' : 'Optional',
    optionalNo: isZh ? '主课' : 'Primary',
    noteTitle: isZh ? '注意事项' : 'Caution',
    watchDemo: isZh ? '看动作示范' : 'Watch demo',
    intentLabel: isZh ? '动作意图' : 'Intent',
    regression: isZh ? '退阶' : 'Regression',
    progression: isZh ? '进阶' : 'Progression',
    readinessAdjusted: isZh ? '已按恢复状态调整跑步安排' : 'Run adjusted for readiness',
    experienceOptions: {
      BEGINNER: isZh ? '新手 / 刚恢复' : 'Beginner / returning',
      INTERMEDIATE: isZh ? '有规律做过' : 'Intermediate',
      CONSISTENT: isZh ? '长期稳定训练' : 'Consistent',
    },
    equipmentOptions: {
      BODYWEIGHT: isZh ? '徒手' : 'Bodyweight',
      BAND: isZh ? '弹力带' : 'Band',
      DUMBBELL: isZh ? '哑铃' : 'Dumbbell',
      GYM: isZh ? '完整健身房' : 'Gym',
    },
    noiseOptions: {
      NORMAL: isZh ? '正常环境' : 'Normal',
      QUIET_ONLY: isZh ? '只能静音训练' : 'Quiet only',
    },
    sessionTypes: {
      FOUNDATION_STRENGTH: isZh ? '基础力量' : 'Foundation strength',
      RESILIENCE_CAPACITY: isZh ? '韧性容量' : 'Resilience capacity',
      OPTIONAL_ELASTICITY: isZh ? '可选弹性激活' : 'Optional elasticity',
    },
    sessionEmphasis: {
      FOUNDATION_STRENGTH: isZh ? '单腿力量、后链稳定和小腿韧性' : 'Single-leg strength, posterior chain, and calf resilience',
      RESILIENCE_CAPACITY: isZh ? '组织容量、躯干控制和低成本耐受' : 'Tissue capacity, trunk control, and low-cost durability',
      OPTIONAL_ELASTICITY: isZh ? '短促弹性接触与协调激活' : 'Short elastic contacts and coordination',
    },
    workoutTypes: {
      QUALITY: isZh ? '\u8d28\u91cf\u8bfe' : 'Quality session',
      REST: isZh ? '休息' : 'Rest',
      EASY: isZh ? '轻松跑' : 'Easy run',
      RECOVERY: isZh ? '恢复跑' : 'Recovery run',
      TEMPO: isZh ? '节奏跑' : 'Tempo',
      THRESHOLD: isZh ? '阈值课' : 'Threshold',
      INTERVALS: isZh ? '间歇课' : 'Intervals',
      LONG_RUN: isZh ? '长跑' : 'Long run',
      CROSS_TRAIN: isZh ? '交叉训练' : 'Cross-train',
    },
    loadStatus: {
      CONSERVATIVE: isZh ? '保守起步' : 'Conservative start',
      STEADY: isZh ? '负荷稳定' : 'Steady load',
      SPIKING: isZh ? '负荷上冲' : 'Load spike',
      HIGH_VOLUME: isZh ? '高跑量周' : 'High-volume week',
      RACE_WEEK: isZh ? '比赛周' : 'Race week',
    },
    recoveryGate: {
      OPEN: isZh ? '开放' : 'Open',
      CAUTION: isZh ? '谨慎' : 'Caution',
      PROTECT: isZh ? '保护' : 'Protect',
    },
    currentFocus: {
      RECOVERY_CAPACITY: isZh ? '恢复与容量维护' : 'Recovery and capacity',
      QUIET_POSTERIOR_CHAIN: isZh ? '静音后链稳定' : 'Quiet posterior-chain stability',
      ELASTIC_STIFFNESS: isZh ? '低剂量弹性维持' : 'Elastic stiffness maintenance',
      POSTERIOR_CHAIN_STABILITY: isZh ? '后链与单腿稳定' : 'Posterior-chain stability',
    },
    rationale: {
      R_VOLUME_28D: isZh ? '最近 28 天跑量决定了本周力量频率的起点。' : 'The last 28 days of running volume set the base weekly strength frequency.',
      R_COACH_SCHEDULE: isZh ? '结合当前跑步周计划，主动避开关键跑和长跑前 24 小时。' : 'Placement accounts for your current run schedule and avoids the 24 hours before key or long runs.',
      R_EQUIPMENT_FILTER: isZh ? '动作会按器械条件自动替换，而不是只改名字。' : 'Exercises are swapped based on equipment, not just renamed.',
      R_CONSERVATIVE_DATA: isZh ? '跑步数据不足，所以先给保守版本。' : 'Running data is limited, so the plan starts conservatively.',
      R_RECOVERY_GATE: isZh ? '恢复信号触发了强度保护。' : 'Recovery signals triggered a protective downgrade.',
      R_LOAD_SPIKE: isZh ? '近期跑步负荷上冲，力量课自动降级。' : 'Recent running stress is spiking, so strength work was downgraded.',
      R_HIGH_VOLUME: isZh ? '高跑量周更重视低成本韧性和小剂量弹性。' : 'High-volume weeks emphasize low-cost resilience and small elastic doses.',
      R_RACE_WEEK: isZh ? '比赛周避免额外肌肉损伤和残余酸痛。' : 'Race week avoids extra muscle damage and residual soreness.',
      R_QUIET_FILTER: isZh ? '静音模式已过滤跳跃和明显落地声动作。' : 'Quiet mode removed jumping and high-impact options.',
      R_SKIP_WEEK: isZh ? '当前周建议跳过正式力量课或只保留激活。' : 'This week may skip formal strength or keep only a light activation.',
    },
    placementReasons: {
      ASSIGN_AFTER_EASY_RUN: isZh ? '放在轻松跑后，减少对关键课的干扰。' : 'Placed after an easy run to avoid interfering with key sessions.',
      ASSIGN_ON_RECOVERY_DAY: isZh ? '放在恢复或低压力日，训练成本更低。' : 'Placed on a recovery or low-cost day.',
      ASSIGN_OPTIONAL_LOW_IMPACT_SLOT: isZh ? '放在低压力日，只保留短促弹性激活。' : 'Placed in a low-cost slot as a short elastic activation.',
    },
    noStrengthReasons: {
      SKIP_KEY_RUN_DAY: isZh ? '今天是关键跑，不叠加下肢力量。' : 'Today is a key run day, so lower-body strength stays off the table.',
      SKIP_LONG_RUN_DAY: isZh ? '今天是长跑日，不再加正式力量课。' : 'Today is a long-run day, so no formal strength work is added.',
      SKIP_KEY_RUN_TOMORROW: isZh ? '明天有关键跑，今天留恢复缓冲。' : 'A key run is tomorrow, so today stays clear as a buffer.',
      SKIP_LONG_RUN_TOMORROW: isZh ? '明天有长跑，今天不放重下肢。' : 'A long run is tomorrow, so heavy lower-body work is avoided.',
      SKIP_RECOVERY_GATE: isZh ? '恢复门控提示本周应降级或跳过。' : 'The recovery gate suggests downgrading or skipping this week.',
      SKIP_SESSION_CAP_REACHED: isZh ? '本周推荐频率已经达到。' : 'You have already reached the recommended weekly frequency.',
      SKIP_BUFFER_DAY: isZh ? '今天更适合当作跑步恢复缓冲。' : 'Today works better as a run-recovery buffer.',
    },
    cautionCodes: {
      CAUTION_KEEP_SUBMAXIMAL: isZh ? '这次强度保持次最大，保留 2-3 次余量。' : 'Keep this session submaximal and leave 2-3 reps in reserve.',
      CAUTION_RACE_WEEK: isZh ? '比赛周只保留轻量刺激，不追求疲劳。' : 'Race week keeps only light stimulus and avoids fatigue.',
    },
    blockTitles: {
      Prep: isZh ? '准备' : 'Prep',
      Main: isZh ? '主训练' : 'Main',
      Accessory: isZh ? '补充' : 'Accessory',
    },
    exerciseNoise: {
      QUIET: isZh ? '静音友好' : 'Quiet',
      SOUND: isZh ? '有落地声' : 'Impact / sound',
    },
    exerciseEquipment: {
      BODYWEIGHT: isZh ? '徒手' : 'Bodyweight',
      BAND: isZh ? '弹力带' : 'Band',
      DUMBBELL: isZh ? '哑铃' : 'Dumbbell',
      GYM: isZh ? '健身房器械' : 'Gym',
    },
  };
}

export default function MuscleTraining() {
  const { isAuthenticated } = useAuth();
  const { lang, t } = useI18n();
  const { isMile } = useUnit();
  const navigate = useNavigate();
  const location = useLocation();
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
  const distanceUnitLabel = isMile ? (isZh ? '\u82f1\u91cc' : 'mi') : (isZh ? '\u516c\u91cc' : 'km');
  const distanceWindowLabel = isZh ? `${distanceUnitLabel} / 7 \u5929` : `${distanceUnitLabel} / 7d`;
  const copy = useMemo(() => createPageCopy(isZh), [isZh]);
  const sessionByType = useMemo(
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
    if (featuredDay?.strength?.optional) tags.push(isZh ? '可选剂量' : 'Optional dose');
    if (featuredDay?.run?.keyRun) tags.push(isZh ? '关键跑保护' : 'Key-run safe');
    if (featuredDay?.run?.longRun) tags.push(isZh ? '长跑周边' : 'Long-run support');
    if (featuredSession?.emphasis) tags.push(featuredSession.emphasis);
    return tags.slice(0, 3);
  }, [featuredDay, featuredSession, isZh]);
  const stitchCopy = useMemo(() => ({
    dashboard: isZh ? '仪表盘' : 'Dashboard',
    analysis: isZh ? '分析' : 'Analysis',
    schedule: isZh ? '计划' : 'Schedule',
    strength: isZh ? '力量' : 'Strength',
    seriesLabel: isZh ? '力量模块' : 'Strength block',
    durationLabel: isZh ? '时长' : 'Duration',
    burnLabel: isZh ? '负荷估算' : 'Load burn',
    loadLabel: isZh ? '动作数' : 'Exercise count',
    protocolTitle: isZh ? '今日协议' : 'Today protocol',
    readyTitle: isZh ? '准备开练？' : 'Ready to lift?',
    readyHint: isZh ? '先完成上方协议，再在下方控制台记录今天的训练与恢复反馈。' : 'Run the protocol above, then use the control deck below to log the session and update coach state.',
    startWorkout: isZh ? '开始训练' : 'Start workout',
    enterWorkout: isZh ? '打开控制台' : 'Open control deck',
    noStrengthTitle: isZh ? '今天不安排正式力量' : 'No formal strength today',
    noStrengthHint: isZh ? '教练引擎把今天留给跑步恢复或关键课前缓冲。' : 'The coach engine is keeping today clear for run recovery or a key-session buffer.',
    muscleFocusTitle: isZh ? '肌群焦点' : 'Muscle focus',
    coachingCuesTitle: isZh ? '执行提示' : 'Coaching cues',
    recoveryImpactTitle: isZh ? '恢复影响' : 'Recovery impact',
    coachDeckTitle: isZh ? '教练控制台' : 'Coach control deck',
    coachDeckHint: isZh ? '下面保留了真实 Hermes 偏好、check-in、周状态和 7 天力量计划，让这个页面既像成品，也继续像工具。' : 'The real Hermes preferences, check-in, weekly status, and 7-day planner stay live below so this surface keeps its coach utility.',
    support: isZh ? '支持' : 'Support',
    settings: isZh ? '设置' : 'Settings',
  }), [isZh]);

  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights' },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'weather_engine', label: lang === 'zh-CN' ? '天气' : 'Weather', route: '/weather', icon: 'thermostat' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
    { key: 'strength', label: stitchCopy.strength, route: '/muscle-training', icon: 'fitness_center' },
  ].map((item) => ({
    ...item,
    active: location.pathname === item.route || location.pathname.startsWith(`${item.route}/`),
  }));
  const heroTheme = useMemo(() => {
    const focus = pickLabel(copy.currentFocus, plan?.weekContext?.currentFocus, featuredSession?.emphasis || '');
    const split = String(focus || '').split(/[\s/]+/).filter(Boolean);
    if (split.length >= 2) {
      return { lineOne: split[0], lineTwo: split.slice(1).join(' ') };
    }
    return {
      lineOne: isZh ? '力量' : 'Strength',
      lineTwo: focus || (isZh ? '就绪' : 'Ready'),
    };
  }, [copy.currentFocus, featuredSession, isZh, plan]);

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
          setError(cause?.message || (isZh ? '连接失败，请稍后再试。' : 'Connection failed. Please try again.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyLoadedData, isAuthenticated, isZh, navigate]);

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
      setError(cause?.message || (isZh ? '保存失败，请稍后再试。' : 'Could not save the profile.'));
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
        <div className="muscle-training-hero">
          <div className="muscle-training-hero-copy">
            <div className="muscle-page-tools">
              <div>
                <h1>{copy.heading}</h1>
                <p>{copy.subheading}</p>
              </div>{/*
                  中文
              </div>
            */}</div>
          </div>

          <MuscleMap isZh={isZh} />
        </div>

        {!loading && !error && plan && (
          <section className="strength-plan-hero-shell">
            <section className="strength-plan-hero">
              <div className="strength-plan-hero-copy">
                <span className="strength-plan-kicker">{stitchCopy.seriesLabel}</span>
                <h1>
                  {heroTheme.lineOne}
                  <span>{heroTheme.lineTwo}</span>
                </h1>
                <div className="strength-plan-metrics">
                  <div>
                    <span>{stitchCopy.durationLabel}</span>
                    <strong>{featuredDay?.strength?.durationMinutes ? formatMinutes(featuredDay.strength.durationMinutes, isZh) : '-'}</strong>
                  </div>
                  <div>
                    <span>{stitchCopy.burnLabel}</span>
                    <strong>{estimatedBurn != null ? `${estimatedBurn} kcal` : '-'}</strong>
                  </div>
                  <div>
                    <span>{stitchCopy.loadLabel}</span>
                    <strong>{String(protocolItems.length).padStart(2, '0')}</strong>
                  </div>
                </div>
              </div>

              <div className="strength-plan-hero-actions">
                <button type="button" className="strength-plan-primary-btn" onClick={scrollToControls}>
                  {stitchCopy.startWorkout}
                </button>
                <div className="strength-plan-hero-tags">
                  {heroTags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              </div>
            </section>

            <section className="strength-plan-content-grid">
              <div className="strength-plan-protocol">
                <span className="strength-plan-section-label">{stitchCopy.protocolTitle}</span>
                {protocolItems.length > 0 ? (
                  <div className="strength-plan-protocol-list">
                    {protocolItems.map(({ block, blockIndex, exercise, exerciseIndex }) => {
                      const exerciseCopy = getExerciseCardContent(exercise, isZh);
                      return (
                        <article key={`${block.title}-${exercise.name}-${exerciseIndex}`} className="strength-plan-exercise-row">
                          <div className="strength-plan-exercise-media">
                            <ExerciseIllustration exerciseName={exercise.name} />
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
                              <span>{isZh ? '组数 x 次数/时长' : 'Sets x reps/duration'}</span>
                              <strong>{exercise.sets} x {exercise.repsOrDuration}</strong>
                            </div>
                            <em>RPE {exercise.targetRpe}</em>
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

              <aside className="strength-plan-rail">
                <section className="strength-plan-rail-card">
                  <span className="strength-plan-section-label">{stitchCopy.muscleFocusTitle}</span>
                  <div className="strength-plan-map-wrap">
                    <MuscleMap isZh={isZh} />
                  </div>
                  <div className="strength-plan-focus-pills">
                    {muscleFocus.map((muscle) => <span key={muscle}>{muscle}</span>)}
                  </div>
                </section>

                <section className="strength-plan-rail-card">
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

                <section className="strength-plan-impact-card">
                  <span className="strength-plan-section-label">{stitchCopy.recoveryImpactTitle}</span>
                  <strong>{plan.weekContext?.acwr != null ? trimNumber(plan.weekContext.acwr, 2) : '0.00'}</strong>
                  <p>{pickLabel(copy.recoveryGate, plan.weekContext?.recoveryGate)} · {pickLabel(copy.loadStatus, plan.weekContext?.loadStatus)}</p>
                </section>
              </aside>
            </section>
          </section>
        )}

        {loading && <div style={{ padding: '22px 0', color: 'var(--text-muted)' }}>{copy.loading}</div>}
        {!loading && error && <div className="error-alert" style={{ display: 'block', marginTop: 18 }}>{error}</div>}

        {!loading && !error && plan && (
          <>
            <section id="muscle-controls" className="strength-plan-control-deck">
              <div className="strength-plan-control-head">
                <div>
                  <span className="strength-plan-section-label">{stitchCopy.coachDeckTitle}</span>
                  <p>{stitchCopy.coachDeckHint}</p>
                </div>
              </div>

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

            <section className="muscle-week-overview">
              <div className="muscle-section-head">
                <h2>{copy.statusTitle}</h2>
              </div>

              <div className="muscle-status-source">
                <strong>{copy.planSourceLabel}</strong>
                <span>{pickLabel(copy.sourceSummary, plan.planSource, '')}</span>
              </div>

              {plan.weekContext?.conservativeMode && (
                <div className="muscle-banner-note">{copy.conservativeBanner}</div>
              )}

              <div className="muscle-status-grid">
                <div className="muscle-status-card">
                  <div className="muscle-metric-label">{copy.summaryFrequency}</div>
                  <strong>{plan.weekContext?.recommendedSessionsPerWeek ?? 0} {isZh ? '次 / 周' : 'sessions / week'}</strong>
                  <span>{pickLabel(copy.loadStatus, plan.weekContext?.loadStatus)}</span>
                </div>

                <div className="muscle-status-card">
                  <div className="muscle-metric-label">{copy.summaryRecovery}</div>
                  <strong>{pickLabel(copy.recoveryGate, plan.weekContext?.recoveryGate)}</strong>
                  <span>{plan.weekContext?.acwr != null ? `ACWR ${trimNumber(plan.weekContext.acwr, 2)}` : (isZh ? '无 ACWR' : 'No ACWR')}</span>
                </div>

                <div className="muscle-status-card">
                  <div className="muscle-metric-label">{copy.summaryUpcoming}</div>
                  <strong>
                    {plan.weekContext?.nextKeyRunDate
                      ? `${formatShortDate(plan.weekContext.nextKeyRunDate, displayLang)} · ${pickLabel(copy.workoutTypes, plan.weekContext.nextKeyRunType)}`
                      : copy.noKeyRun}
                  </strong>
                  <span>
                    {plan.weekContext?.nextLongRunDate
                      ? `${formatShortDate(plan.weekContext.nextLongRunDate, displayLang)} · ${formatDistance(plan.weekContext.nextLongRunKm, isZh, isMile)}`
                      : copy.noLongRun}
                  </span>
                </div>

                <div className="muscle-status-card muscle-status-card-focus">
                  <div className="muscle-metric-label">{copy.summaryFocus}</div>
                  <strong>{pickLabel(copy.currentFocus, plan.weekContext?.currentFocus)}</strong>
                  <span className="muscle-status-distance-window">{formatDistanceValue(plan.weekContext?.volumeKm7d ?? 0, isMile) ?? '0'} {distanceWindowLabel}</span>
                  <span>{trimNumber(plan.weekContext?.volumeKm7d, 1) ?? '0'} {isZh ? '公里 / 7 天' : 'km / 7d'}</span>
                </div>
              </div>

              <section className="card muscle-panel">
                <h2>{copy.rationaleTitle}</h2>
                <ul className="muscle-rationale-list">
                  {(plan.rationale || []).map((code) => (
                    <li key={code}>{pickLabel(copy.rationale, code, code)}</li>
                  ))}
                </ul>
              </section>
            </section>

            <section className="muscle-week-plan">
              <div className="muscle-section-head">
                <div>
                  <h2>{copy.weekTitle}</h2>
                  <p>{copy.weekHint}</p>
                </div>
              </div>

              <div className="muscle-week-grid">
                {(plan.days || []).map((day) => {
                  const session = day.strength ? sessionByType.get(day.strength.sessionType) : null;
                  return (
                    <article key={day.date} className={`card muscle-day-card${day.strength ? ' is-strength' : ''}`}>
                      <div className="muscle-day-head">
                        <div>
                          <div className="muscle-session-kicker">{formatDayLabel(day.date, day.dayLabel, displayLang)}</div>
                          <h3>{formatShortDate(day.date, displayLang)}</h3>
                        </div>
                        <div className="muscle-day-tags">
                          <span className="muscle-pill">{pickLabel(copy.workoutTypes, day.run?.workoutType)}</span>
                          {day.run?.planSource && (
                            <span className="muscle-pill muscle-pill-source">
                              {pickLabel(copy.sourcePills, day.run.planSource, day.run.planSource)}
                            </span>
                          )}
                          {day.strength && (
                            <span className="muscle-pill muscle-pill-core">
                              {pickLabel(copy.sessionTypes, day.strength.sessionType, day.strength.title)}
                            </span>
                          )}
                        </div>
                      </div>

                      <section className="muscle-run-strip">
                        <div className="muscle-run-strip-head">{copy.runContext}</div>
                        <div className="muscle-run-strip-row">
                          <span className="muscle-mini-pill">{pickLabel(copy.workoutTypes, day.run?.workoutType)}</span>
                          {day.run?.plannedDistanceKm != null && (
                            <span className="muscle-mini-pill">{formatDistance(day.run.plannedDistanceKm, isZh, isMile)}</span>
                          )}
                          {day.run?.plannedDurationMinutes != null && (
                            <span className="muscle-mini-pill">{formatMinutes(day.run.plannedDurationMinutes, isZh)}</span>
                          )}
                          {day.run?.keyRun && <span className="muscle-mini-pill muscle-mini-pill-alert">{isZh ? '关键课' : 'Key run'}</span>}
                          {day.run?.longRun && <span className="muscle-mini-pill muscle-mini-pill-alert">{isZh ? '长跑' : 'Long run'}</span>}
                          {day.run?.readinessAdjusted && <span className="muscle-mini-pill">{copy.readinessAdjusted}</span>}
                        </div>
                        {day.run?.notes && <p className="muscle-run-note">{day.run.notes}</p>}
                      </section>

                      {day.strength ? (
                        <>
                          <section className="muscle-day-summary">
                            <div className="muscle-run-strip-head">{copy.strengthTitle}</div>
                            <h4>{pickLabel(copy.sessionTypes, day.strength.sessionType, day.strength.title)}</h4>
                            <p>{pickLabel(copy.sessionEmphasis, day.strength.sessionType, session?.emphasis || day.strength.emphasis)}</p>

                            <div className="muscle-day-meta">
                              <div>
                                <span>{copy.durationTitle}</span>
                                <strong>{formatMinutes(day.strength.durationMinutes, isZh)}</strong>
                              </div>
                              <div>
                                <span>{copy.rpeTitle}</span>
                                <strong>RPE {day.strength.targetRpe}</strong>
                              </div>
                              <div>
                                <span>{copy.optionalTitle}</span>
                                <strong>{day.strength.optional ? copy.optionalYes : copy.optionalNo}</strong>
                              </div>
                            </div>

                            <div className="muscle-note">
                              <strong>{copy.placementTitle}</strong>
                              <span>{pickLabel(copy.placementReasons, day.strength.placementReasonCode, day.strength.placementReasonCode)}</span>
                            </div>

                            {day.strength.cautionCode && (
                              <div className="muscle-note muscle-note-caution">
                                <strong>{copy.noteTitle}</strong>
                                <span>{pickLabel(copy.cautionCodes, day.strength.cautionCode, day.strength.cautionCode)}</span>
                              </div>
                            )}
                          </section>

                          {session && (
                            <div className="muscle-plan-blocks">
                              {(session.blocks || []).map((block) => (
                                <section key={`${day.date}-${block.title}`} className="muscle-block-card">
                                  <div className="muscle-block-title">{pickLabel(copy.blockTitles, block.title, block.title)}</div>
                                  <div className="muscle-exercise-grid">
                                    {(block.exercises || []).map((exercise) => {
                                      const exerciseCopy = getExerciseCardContent(exercise, isZh);
                                      const legacyGuide = getExerciseGuide(exercise.name, isZh);
                                      const legacyCopy = getLocalizedExerciseContent(exercise, isZh);
                                      const exerciseTitle = `${formatExercisePrescription(exercise, isZh)} · ${legacyGuide.muscles.join(' / ')}`;
                                      return (
                                        <article
                                          key={`${day.date}-${block.title}-${exercise.name}`}
                                          className="muscle-exercise-card muscle-exercise-plan-card"
                                          title={exerciseTitle}
                                          data-legacy-intent={legacyCopy.intent || ''}
                                        >
                                          <ExerciseIllustration exerciseName={exercise.name} />
                                          <div className="muscle-exercise-copy">
                                            <div className="muscle-exercise-top">
                                              <div className="muscle-exercise-heading">
                                                <h3>{exerciseCopy.name}</h3>
                                                <div className="muscle-exercise-prescription muscle-exercise-prescription-localized">
                                                  {formatLocalizedExercisePrescription(exercise, isZh)}
                                                </div>
                                              </div>
                                              <div className="muscle-exercise-tags">
                                                {exerciseCopy.muscles.map((muscle) => (
                                                  <span key={`${exercise.name}-${muscle}`} className="muscle-tag">{muscle}</span>
                                                ))}
                                                <span className="muscle-tag">{pickLabel(copy.exerciseNoise, exercise.noiseLevel, exercise.noiseLevel)}</span>
                                                <span className="muscle-tag">{pickLabel(copy.exerciseEquipment, exercise.equipmentNeeded, exercise.equipmentNeeded)}</span>
                                              </div>
                                            </div>

                                            <p className="muscle-exercise-intent">
                                              <strong>{copy.intentLabel}:</strong> {exerciseCopy.intent}
                                            </p>

                                            <ol className="muscle-step-list">
                                              {exerciseCopy.steps.map((step) => <li key={`${exercise.name}-${step}`}>{step}</li>)}
                                            </ol>

                                            <div className="muscle-exercise-swaps">
                                              <div>
                                                <strong>{copy.regression}</strong>
                                                <p>{exerciseCopy.regression}</p>
                                              </div>
                                              <div>
                                                <strong>{copy.progression}</strong>
                                                <p>{exerciseCopy.progression}</p>
                                              </div>
                                            </div>

                                            <div className="muscle-exercise-actions">
                                              <a
                                                href={getExerciseVideoUrl(exercise.name)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="muscle-video-link"
                                              >
                                                {copy.watchDemo}
                                              </a>
                                            </div>
                                          </div>
                                        </article>
                                      );
                                    })}
                                  </div>
                                </section>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <section className="muscle-day-summary">
                          <div className="muscle-run-strip-head">{copy.noStrengthTitle}</div>
                          <p>{pickLabel(copy.noStrengthReasons, day.noStrengthReasonCode, day.noStrengthReasonCode)}</p>
                        </section>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
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
