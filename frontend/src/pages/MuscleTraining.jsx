import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import translations from '../i18n/translations';
import { apiJson } from '../api';

function clampSessions(sessionsPerWeek, sessions) {
  if (!Array.isArray(sessions)) return [];
  if (sessionsPerWeek <= 1) return sessions.slice(0, 1);
  return sessions.slice(0, 2);
}

function pageValue(language, key) {
  return key.split('.').reduce((current, part) => current && current[part], translations[language]);
}

function pageT(language, key, replacements) {
  const fallbackValue = pageValue('zh-CN', key);
  const value = pageValue(language, key) || fallbackValue || key;
  if (typeof value !== 'string') return key;
  if (!replacements) return value;
  return Object.entries(replacements).reduce((result, [token, tokenValue]) => {
    return result.replaceAll(`{${token}}`, tokenValue);
  }, value);
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
    'World’s greatest stretch': 'world greatest stretch exercise demo',
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

  const query = queries[name] || `${name} exercise demo`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function MuscleMap({ isZh }) {
  const labels = isZh
    ? { glutes: '臀部', hamstrings: '腘绳肌', calves: '小腿', core: '核心' }
    : { glutes: 'Glutes', hamstrings: 'Hamstrings', calves: 'Calves', core: 'Core' };

  return (
    <div className="muscle-map-card">
      <svg viewBox="0 0 240 220" className="muscle-map-figure" aria-hidden="true">
        <defs>
          <linearGradient id="muscleGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
        <g transform="translate(18 12)">
          <ellipse cx="58" cy="180" rx="34" ry="8" fill="rgba(148, 163, 184, 0.16)" />
          <ellipse cx="58" cy="18" rx="18" ry="19" fill="#f8d8c0" />
          <path d="M28 48 C30 24 42 12 58 12 C74 12 86 24 88 48 C90 82 84 116 68 140 L48 140 C32 116 26 82 28 48 Z" fill="#f8d8c0" />
          <path d="M54 48 L34 112" fill="none" stroke="#f8d8c0" strokeWidth="12" strokeLinecap="round" />
          <path d="M62 48 L82 112" fill="none" stroke="#f8d8c0" strokeWidth="12" strokeLinecap="round" />
          <rect x="46" y="46" width="24" height="34" rx="10" fill="url(#muscleGlow)" opacity="0.74" />
          <ellipse cx="48" cy="126" rx="12" ry="10" fill="url(#muscleGlow)" opacity="0.86" />
          <ellipse cx="68" cy="126" rx="12" ry="10" fill="url(#muscleGlow)" opacity="0.86" />
          <path d="M52 140 C46 160 44 178 46 198" fill="none" stroke="url(#muscleGlow)" strokeWidth="12" strokeLinecap="round" opacity="0.74" />
          <path d="M64 140 C70 160 72 178 70 198" fill="none" stroke="url(#muscleGlow)" strokeWidth="12" strokeLinecap="round" opacity="0.74" />
          <path d="M50 168 C48 180 48 192 50 204" fill="none" stroke="url(#muscleGlow)" strokeWidth="8" strokeLinecap="round" opacity="0.62" />
          <path d="M66 168 C68 180 68 192 66 204" fill="none" stroke="url(#muscleGlow)" strokeWidth="8" strokeLinecap="round" opacity="0.62" />
        </g>
        <g transform="translate(122 12)">
          <ellipse cx="42" cy="180" rx="30" ry="8" fill="rgba(148, 163, 184, 0.16)" />
          <ellipse cx="42" cy="18" rx="18" ry="19" fill="#f8d8c0" />
          <path d="M16 48 C18 24 28 12 42 12 C56 12 66 24 68 48 C70 82 66 116 54 140 L30 140 C18 116 14 82 16 48 Z" fill="#f8d8c0" />
          <path d="M36 50 C32 70 30 90 30 112" fill="none" stroke="url(#muscleGlow)" strokeWidth="13" strokeLinecap="round" opacity="0.78" />
          <path d="M48 50 C52 70 54 90 54 112" fill="none" stroke="url(#muscleGlow)" strokeWidth="13" strokeLinecap="round" opacity="0.78" />
          <path d="M38 140 C32 160 30 178 32 198" fill="none" stroke="url(#muscleGlow)" strokeWidth="12" strokeLinecap="round" opacity="0.74" />
          <path d="M48 140 C54 160 56 178 54 198" fill="none" stroke="url(#muscleGlow)" strokeWidth="12" strokeLinecap="round" opacity="0.74" />
        </g>
      </svg>
      <div className="muscle-map-labels">
        {Object.entries(labels).map(([key, value]) => (
          <span key={key} className={`muscle-pill muscle-pill-${key}`}>{value}</span>
        ))}
      </div>
    </div>
  );
}

function DemoPanel({ x, step, children }) {
  return (
    <g transform={`translate(${x} 24)`}>
      <rect x="0" y="0" width="74" height="112" rx="18" className="muscle-demo-panel" />
      <circle cx="16" cy="16" r="10" className="muscle-demo-step-dot" />
      <text x="16" y="20" textAnchor="middle" className="muscle-demo-step-text">{step}</text>
      {children}
    </g>
  );
}

function MuscleFigure({ pose = 'standing', target = 'core', phase = 'start' }) {
  const torsoTransform = phase === 'finish' && pose === 'hinge'
    ? 'translate(20 16) rotate(-26 28 44)'
    : 'translate(20 16)';
  const bridgeShift = pose === 'bridge' && phase === 'finish' ? 28 : 40;
  const splitShiftY = phase === 'finish' ? 24 : 16;

  if (pose === 'bridge') {
    return (
      <g className={`muscle-human muscle-human-${pose} muscle-human-${phase}`}>
        <ellipse cx="48" cy="96" rx="26" ry="7" className="muscle-human-shadow" />
        <line x1="10" y1="102" x2="66" y2="102" className="muscle-demo-floor" />
        <g transform={`translate(8 ${bridgeShift})`}>
          <ellipse cx="16" cy="34" rx="8" ry="8" className="muscle-human-head" />
          <path d={phase === 'finish' ? 'M24 34 L38 26 L54 20' : 'M24 34 L40 34 L54 40'} className="muscle-human-leg" />
          <path d={phase === 'finish' ? 'M54 20 L64 34' : 'M54 40 L64 50'} className="muscle-human-leg" />
          <path d={phase === 'finish' ? 'M38 26 L34 58' : 'M40 34 L36 62'} className="muscle-human-leg" />
          <path d={phase === 'finish' ? 'M56 22 L62 62' : 'M54 40 L62 70'} className="muscle-human-leg" />
          <ellipse cx={phase === 'finish' ? '40' : '44'} cy={phase === 'finish' ? '28' : '38'} rx="11" ry="8" className="muscle-human-highlight" />
        </g>
      </g>
    );
  }

  if (pose === 'plank') {
    return (
      <g className={`muscle-human muscle-human-${pose} muscle-human-${phase}`}>
        <ellipse cx="48" cy="98" rx="28" ry="7" className="muscle-human-shadow" />
        <line x1="10" y1="102" x2="66" y2="102" className="muscle-demo-floor" />
        <g transform={`translate(8 ${phase === 'finish' ? 8 : 18})`}>
          <ellipse cx="16" cy="44" rx="8" ry="8" className="muscle-human-head" />
          <path d="M24 46 L50 40" className="muscle-human-leg" />
          <path d="M28 54 L20 72" className="muscle-human-leg" />
          <path d={phase === 'finish' ? 'M34 44 L42 18' : 'M34 46 L40 30'} className="muscle-human-arm" />
          <path d="M46 42 L60 54 M50 40 L64 48" className="muscle-human-leg" />
          <rect x="30" y="36" width="18" height="11" rx="5" className="muscle-human-highlight-core" />
        </g>
      </g>
    );
  }

  if (pose === 'deadbug') {
    return (
      <g className={`muscle-human muscle-human-${pose} muscle-human-${phase}`}>
        <ellipse cx="48" cy="98" rx="28" ry="7" className="muscle-human-shadow" />
        <line x1="10" y1="102" x2="66" y2="102" className="muscle-demo-floor" />
        <g transform="translate(8 28)">
          <ellipse cx="16" cy="44" rx="8" ry="8" className="muscle-human-head" />
          <path d="M24 44 L42 38 L58 38" className="muscle-human-leg" />
          <path d={phase === 'finish' ? 'M36 38 L22 22 M50 38 L64 18' : 'M36 38 L36 20 M50 38 L50 20'} className="muscle-human-arm" />
          <path d={phase === 'finish' ? 'M42 38 L32 56 L18 66 M42 38 L54 54 L66 54' : 'M42 38 L32 56 L32 68 M42 38 L54 56 L54 68'} className="muscle-human-leg" />
          <rect x="34" y="34" width="18" height="11" rx="5" className="muscle-human-highlight-core" />
        </g>
      </g>
    );
  }

  return (
    <g className={`muscle-human muscle-human-${pose} muscle-human-${phase}`}>
      <ellipse cx="48" cy="102" rx="28" ry="7" className="muscle-human-shadow" />
      <line x1="16" y1="106" x2="82" y2="106" className="muscle-demo-floor" />
      <g transform={torsoTransform}>
        <ellipse cx="28" cy="10" rx="10" ry="11" className="muscle-human-head" />
        <path d="M10 28 C12 12 20 4 28 4 C36 4 44 12 46 28 C48 44 46 58 38 70 L18 70 C10 58 8 44 10 28 Z" className="muscle-human-torso" />
        <path d={phase === 'finish' && pose === 'split' ? 'M16 28 L6 46' : 'M16 28 L8 42'} className="muscle-human-arm" />
        <path d={phase === 'finish' && pose === 'split' ? 'M40 28 L50 44' : 'M40 28 L48 42'} className="muscle-human-arm" />
        <ellipse cx="28" cy="64" rx="12" ry="8" className="muscle-human-pelvis" />
        <path d={pose === 'hop' && phase === 'finish' ? 'M22 72 L12 88 L6 96' : pose === 'split' ? `M22 72 L12 ${88 + splitShiftY} L2 102` : 'M22 72 L18 94 L14 106'} className="muscle-human-leg" />
        <path d={pose === 'hinge' && phase === 'finish' ? 'M34 72 L48 78 L64 94' : pose === 'split' ? `M34 72 L44 ${84 + splitShiftY / 2} L54 106` : pose === 'hop' && phase === 'finish' ? 'M34 72 L44 90 L54 98' : 'M34 72 L38 94 L42 106'} className="muscle-human-leg" />

        {target === 'glutes' && (
          <>
            <ellipse cx="22" cy="66" rx="8" ry="7" className="muscle-human-highlight" />
            <ellipse cx="34" cy="66" rx="8" ry="7" className="muscle-human-highlight" />
          </>
        )}
        {target === 'hamstrings' && (
          <>
            <path d="M22 72 C18 82 16 94 14 106" className="muscle-human-highlight-line" />
            <path d="M34 72 C40 80 46 88 54 100" className="muscle-human-highlight-line" />
          </>
        )}
        {target === 'calves' && (
          <>
            <path d="M14 92 C12 98 12 104 14 108" className="muscle-human-highlight-line" />
            <path d="M42 92 C44 98 44 104 42 108" className="muscle-human-highlight-line" />
          </>
        )}
        {target === 'core' && (
          <rect x="18" y="26" width="20" height="24" rx="8" className="muscle-human-highlight-core" />
        )}
      </g>

      {pose === 'hop' && (
        <path d={phase === 'finish' ? 'M16 108 L22 102 M50 98 L56 92' : 'M18 106 L22 100 M40 106 L44 100'} className="muscle-demo-burst" />
      )}
    </g>
  );
}

function ExerciseIllustration({ type, intensity, exerciseName }) {
  const demoKey = (() => {
    switch (exerciseName) {
      case 'Dead bug':
        return 'deadbug';
      case 'Side plank':
        return 'sideplank';
      case 'Glute bridge (pause at top)':
      case 'Hamstring curl (slider or machine)':
        return 'bridge';
      case 'Split squat':
      case 'Step-down (knee tracking)':
        return 'splitsquat';
      case 'Single-leg Romanian deadlift':
      case 'Hip airplanes':
        return 'hinge';
      case 'Calf raises (slow tempo)':
      case 'Standing calf raise':
      case 'Tibialis wall raise':
        return 'calfraise';
      case 'Pallof press':
        return 'pallof';
      case 'Farmer carry (suitcase)':
        return 'carry';
      case 'Pogo hops':
      case 'Skipping A-drill':
      case 'Single-leg hop (low amplitude)':
      case 'Box step-up (explosive)':
        return 'hop';
      case 'World’s greatest stretch':
      case 'Ankle dorsiflexion rocks':
        return 'mobility';
      default:
        return type || 'standing';
    }
  })();

  return (
    <svg viewBox="0 0 180 160" className="muscle-exercise-figure" aria-hidden="true">
      <rect x="10" y="10" width="160" height="140" rx="28" className="muscle-exercise-bg" />
      <DemoPanel x={18} step="1">
        {demoKey === 'deadbug' && <MuscleFigure pose="deadbug" target="core" phase="start" />}
        {demoKey === 'sideplank' && <MuscleFigure pose="plank" target="core" phase="start" />}
        {demoKey === 'bridge' && <MuscleFigure pose="bridge" target="glutes" phase="start" />}
        {demoKey === 'splitsquat' && <MuscleFigure pose="split" target="glutes" phase="start" />}
        {demoKey === 'hinge' && <MuscleFigure pose="hinge" target="hamstrings" phase="start" />}
        {demoKey === 'calfraise' && <MuscleFigure pose="standing" target="calves" phase="start" />}
        {demoKey === 'pallof' && <MuscleFigure pose="standing" target="core" phase="start" />}
        {demoKey === 'carry' && <MuscleFigure pose="standing" target="core" phase="start" />}
        {demoKey === 'hop' && <MuscleFigure pose="hop" target="calves" phase="start" />}
        {demoKey === 'mobility' && <MuscleFigure pose="split" target="core" phase="start" />}
        {demoKey === 'pallof' && <path d="M74 78 C86 76 92 68 92 54" className="muscle-demo-band" />}
        {demoKey === 'carry' && <rect x="38" y="88" width="12" height="18" rx="3" className="muscle-demo-weight" />}
      </DemoPanel>

      <g className={`muscle-demo-transfer${intensity === 'sound' ? ' sound' : ''}`}>
        <path d="M84 80 H100" className="muscle-demo-arrow-line" />
        <path d="M96 74 L104 80 L96 86" className="muscle-demo-arrow-head" />
      </g>

      <DemoPanel x={88} step="2">
        {demoKey === 'deadbug' && <MuscleFigure pose="deadbug" target="core" phase="finish" />}
        {demoKey === 'sideplank' && <MuscleFigure pose="plank" target="core" phase="finish" />}
        {demoKey === 'bridge' && <MuscleFigure pose="bridge" target="glutes" phase="finish" />}
        {demoKey === 'splitsquat' && <MuscleFigure pose="split" target="glutes" phase="finish" />}
        {demoKey === 'hinge' && <MuscleFigure pose="hinge" target="hamstrings" phase="finish" />}
        {demoKey === 'calfraise' && <MuscleFigure pose="standing" target="calves" phase="finish" />}
        {demoKey === 'pallof' && <MuscleFigure pose="standing" target="core" phase="finish" />}
        {demoKey === 'carry' && <MuscleFigure pose="standing" target="core" phase="finish" />}
        {demoKey === 'hop' && <MuscleFigure pose="hop" target="calves" phase="finish" />}
        {demoKey === 'mobility' && <MuscleFigure pose="split" target="core" phase="finish" />}
        {demoKey === 'pallof' && <path d="M144 78 C156 76 162 68 162 54" className="muscle-demo-band" />}
        {demoKey === 'carry' && <rect x="126" y="88" width="12" height="18" rx="3" className="muscle-demo-weight" />}
      </DemoPanel>
    </svg>
  );
}

function getExerciseGuide(name, isZh) {
  const guides = {
    'Hip airplanes': {
      type: 'standing',
      intensity: 'quiet',
      muscles: isZh ? ['臀部', '核心'] : ['Glutes', 'Core'],
      steps: isZh
        ? ['单腿站稳，髋部保持方正。', '身体像门轴一样缓慢打开再合上。', '膝盖微屈，别让骨盆乱晃。']
        : ['Stand tall on one leg with the hips square.', 'Open and close the pelvis slowly like a hinge.', 'Keep a soft knee and avoid wobbling the trunk.'],
    },
    'Calf raises (slow tempo)': {
      type: 'standing',
      intensity: 'quiet',
      muscles: isZh ? ['小腿'] : ['Calves'],
      steps: isZh
        ? ['脚掌踩稳地面。', '缓慢抬起脚跟，在最高点停一下。', '控制下降，不要直接掉下去。']
        : ['Press through the ball of the foot.', 'Rise slowly and pause at the top.', 'Lower under control instead of dropping.'],
    },
    'Dead bug': {
      type: 'plank',
      intensity: 'quiet',
      muscles: isZh ? ['核心'] : ['Core'],
      steps: isZh
        ? ['仰卧，腰背贴地。', '对侧手脚同时伸直。', '保持腹部收紧，别让下背拱起。']
        : ['Lie on your back with the ribs down.', 'Reach opposite arm and leg away together.', 'Keep the low back quiet and the core braced.'],
    },
    'Split squat': {
      type: 'squat',
      intensity: 'quiet',
      muscles: isZh ? ['臀部', '腘绳肌'] : ['Glutes', 'Hamstrings'],
      steps: isZh
        ? ['前后站姿拉开。', '身体垂直下沉，前脚发力起身。', '前膝对准脚尖，不要内扣。']
        : ['Set up in a split stance.', 'Drop straight down and drive through the front foot.', 'Track the front knee over the toes.'],
    },
    'Single-leg Romanian deadlift': {
      type: 'hinge',
      intensity: 'quiet',
      muscles: isZh ? ['臀部', '腘绳肌'] : ['Glutes', 'Hamstrings'],
      steps: isZh
        ? ['单腿站稳，另一条腿向后伸。', '从髋部折叠，不是弯腰塌背。', '起身时主动夹臀。']
        : ['Balance on one leg and reach the other leg back.', 'Hinge from the hips instead of rounding forward.', 'Squeeze the glute to return tall.'],
    },
    'Standing calf raise': {
      type: 'standing',
      intensity: 'quiet',
      muscles: isZh ? ['小腿'] : ['Calves'],
      steps: isZh
        ? ['双脚平放。', '脚跟向上抬起，身体保持高。', '下放时慢一点，感受小腿发力。']
        : ['Stand evenly through both feet.', 'Lift the heels and stay tall through the body.', 'Lower slowly to load the calves.'],
    },
    'Side plank': {
      type: 'plank',
      intensity: 'quiet',
      muscles: isZh ? ['核心'] : ['Core'],
      steps: isZh
        ? ['前臂撑地，身体侧向成一直线。', '臀部抬高，不要塌腰。', '呼吸平稳，保持颈部放松。']
        : ['Stack the body in one straight side line.', 'Lift the hips instead of sagging.', 'Breathe steadily and keep the neck relaxed.'],
    },
    'Glute bridge (pause at top)': {
      type: 'bridge',
      intensity: 'quiet',
      muscles: isZh ? ['臀部', '核心'] : ['Glutes', 'Core'],
      steps: isZh
        ? ['仰卧屈膝，脚踩稳。', '抬髋到身体成斜线。', '顶端停住 1 秒，再慢慢放下。']
        : ['Lie down with knees bent and feet planted.', 'Drive the hips up into a long line.', 'Pause at the top for one beat before lowering.'],
    },
    'Tibialis wall raise': {
      type: 'standing',
      intensity: 'quiet',
      muscles: isZh ? ['小腿'] : ['Calves'],
      steps: isZh
        ? ['背靠墙或站稳支撑。', '抬起前脚掌，让脚尖朝向小腿。', '控制回落，感受胫骨前侧。']
        : ['Lean back into a stable support.', 'Lift the forefoot and pull the toes up.', 'Lower with control and feel the front of the shin.'],
    },
    'World’s greatest stretch': {
      type: 'standing',
      intensity: 'quiet',
      muscles: isZh ? ['臀部', '核心'] : ['Glutes', 'Core'],
      steps: isZh
        ? ['进入弓步位。', '一手撑地，另一手向上打开胸椎。', '每次动作都保持呼吸和控制。']
        : ['Step into a long lunge.', 'One hand stays down while the other opens the chest up.', 'Move slowly and breathe through each rep.'],
    },
    'Ankle dorsiflexion rocks': {
      type: 'standing',
      intensity: 'quiet',
      muscles: isZh ? ['小腿'] : ['Calves'],
      steps: isZh
        ? ['前脚踩稳。', '膝盖向前送，脚跟不要离地。', '来回轻推，找踝关节活动度。']
        : ['Keep the front foot flat.', 'Drive the knee forward without lifting the heel.', 'Rock in and out to open ankle motion.'],
    },
    'Step-down (knee tracking)': {
      type: 'squat',
      intensity: 'quiet',
      muscles: isZh ? ['臀部', '核心'] : ['Glutes', 'Core'],
      steps: isZh
        ? ['站在台阶上。', '慢慢把一只脚向地面点下去。', '支撑腿膝盖保持对准脚尖。']
        : ['Stand on a small step.', 'Lower the free foot toward the floor slowly.', 'Keep the stance knee tracking clean over the foot.'],
    },
    'Hamstring curl (slider or machine)': {
      type: 'bridge',
      intensity: 'quiet',
      muscles: isZh ? ['腘绳肌'] : ['Hamstrings'],
      steps: isZh
        ? ['先抬髋稳定。', '脚跟把滑盘或器械拉向身体。', '回程慢放，别让臀部掉下去。']
        : ['Start from a stable bridged position.', 'Pull the heels toward the body.', 'Return slowly without dropping the hips.'],
    },
    'Pallof press': {
      type: 'standing',
      intensity: 'quiet',
      muscles: isZh ? ['核心'] : ['Core'],
      steps: isZh
        ? ['站稳，阻力从身体侧面来。', '双手向前推直。', '保持身体不被拉歪。']
        : ['Stand tall with the resistance pulling from the side.', 'Press the hands straight out.', 'Fight rotation and keep the torso quiet.'],
    },
    'Farmer carry (suitcase)': {
      type: 'carry',
      intensity: 'sound',
      muscles: isZh ? ['核心', '臀部'] : ['Core', 'Glutes'],
      steps: isZh
        ? ['单手提重物站高。', '走路时身体别向一边歪。', '小步稳走，肋骨收住。']
        : ['Carry the load in one hand and stand tall.', 'Do not lean toward or away from the weight.', 'Walk with short steady steps and a braced trunk.'],
    },
    'Pogo hops': {
      type: 'hop',
      intensity: 'sound',
      muscles: isZh ? ['小腿'] : ['Calves'],
      steps: isZh
        ? ['脚踝像弹簧一样快速反弹。', '动作短、轻、快。', '上身保持稳定，不要深蹲式起跳。']
        : ['Bounce through the ankles like springs.', 'Keep the contacts short, light, and quick.', 'Stay tall instead of turning it into a squat jump.'],
    },
    'Skipping A-drill': {
      type: 'hop',
      intensity: 'sound',
      muscles: isZh ? ['臀部', '核心'] : ['Glutes', 'Core'],
      steps: isZh
        ? ['抬膝到髋部附近。', '前脚掌快速落地反弹。', '手臂自然配合，保持节奏感。']
        : ['Lift the knee to around hip height.', 'Strike quickly under the body and bounce out.', 'Let the arms match the rhythm.'],
    },
    'Box step-up (explosive)': {
      type: 'hop',
      intensity: 'sound',
      muscles: isZh ? ['臀部', '小腿'] : ['Glutes', 'Calves'],
      steps: isZh
        ? ['整只脚踩上台阶。', '快速向上驱动身体。', '下台时轻一点，别砸下来。']
        : ['Plant the whole foot on the box.', 'Drive up fast through the stance leg.', 'Step down softly with control.'],
    },
    'Single-leg hop (low amplitude)': {
      type: 'hop',
      intensity: 'sound',
      muscles: isZh ? ['小腿', '核心'] : ['Calves', 'Core'],
      steps: isZh
        ? ['单腿轻弹，不需要跳很高。', '落地时膝盖保持稳定。', '每一下都像干净的小反弹。']
        : ['Hop lightly on one leg without chasing height.', 'Land with a quiet stable knee.', 'Think of crisp elastic contacts each rep.'],
    },
  };

  return guides[name] || {
    type: 'standing',
    intensity: 'quiet',
    muscles: isZh ? ['跑者力量'] : ['Runner strength'],
    steps: isZh ? ['保持稳定。', '动作受控。', '全程均匀呼吸。'] : ['Stay stable.', 'Move with control.', 'Keep your breathing steady.'],
  };
}

export default function MuscleTraining() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [displayLang, setDisplayLang] = useState(lang);
  const isZh = displayLang === 'zh-CN';
  const placeholder = '—';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mt = useMemo(() => {
    return (key, replacements) => pageT(displayLang, key, replacements);
  }, [displayLang]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiJson('/api/training/muscle/recommendation');
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e?.message || t('common.connection_failed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, navigate, t]);

  const sessions = useMemo(() => {
    const sessionsPerWeek = Number(data?.sessionsPerWeek || 0);
    return clampSessions(sessionsPerWeek, data?.sessions || []);
  }, [data]);

  const translateMuscleText = useMemo(() => {
    const dict = {
      'glutes · hamstrings · calves · trunk stability': mt('muscle_training.focus_value'),
      'Separate heavy strength from your hardest run by ~24h when possible; if you train both in one day, prefer strength after easy running, not before key sessions.': mt('muscle_training.recovery_value'),
      'Weekly running volume estimate uses the last 28 days of runs (km/week).': mt('muscle_training.rationale_volume'),
      'Load ratio (acute vs chronic training load proxy) is used to avoid stacking strength on top of a spike in running stress.': mt('muscle_training.rationale_load'),
      'Exercise selection favors unilateral + posterior-chain work common in runner S&C programs.': mt('muscle_training.rationale_selection'),
      'Session A — strength + control': mt('muscle_training.session_a'),
      'Session B — stiffness + resilience': mt('muscle_training.session_b'),
      'Session C — power + elasticity (short)': mt('muscle_training.session_c'),
      'Warm-up': mt('muscle_training.block_warmup'),
      'Main': mt('muscle_training.block_main'),
      'Accessory': mt('muscle_training.block_accessory'),
      'Prep': mt('muscle_training.block_prep'),
      'Hip airplanes': mt('muscle_training.exercise_hip_airplanes'),
      'Calf raises (slow tempo)': mt('muscle_training.exercise_calf_raises'),
      'Dead bug': mt('muscle_training.exercise_dead_bug'),
      'Split squat': mt('muscle_training.exercise_split_squat'),
      'Single-leg Romanian deadlift': mt('muscle_training.exercise_single_leg_rdl'),
      'Standing calf raise': mt('muscle_training.exercise_standing_calf_raise'),
      'Side plank': mt('muscle_training.exercise_side_plank'),
      'Glute bridge (pause at top)': mt('muscle_training.exercise_glute_bridge'),
      'Tibialis wall raise': mt('muscle_training.exercise_tibialis_raise'),
      'World’s greatest stretch': mt('muscle_training.exercise_worlds_greatest_stretch'),
      'Ankle dorsiflexion rocks': mt('muscle_training.exercise_ankle_rocks'),
      'Step-down (knee tracking)': mt('muscle_training.exercise_step_down'),
      'Hamstring curl (slider or machine)': mt('muscle_training.exercise_hamstring_curl'),
      'Pallof press': mt('muscle_training.exercise_pallof_press'),
      'Farmer carry (suitcase)': mt('muscle_training.exercise_farmer_carry'),
      'Pogo hops': mt('muscle_training.exercise_pogo_hops'),
      'Skipping A-drill': mt('muscle_training.exercise_skipping_a'),
      'Box step-up (explosive)': mt('muscle_training.exercise_box_step_up'),
      'Single-leg hop (low amplitude)': mt('muscle_training.exercise_single_leg_hop'),
    };

    return (value) => {
      if (!value) return value;
      return dict[value] || value;
    };
  }, [mt]);

  function bucketExercises(exercises) {
    return (exercises || []).reduce((acc, ex) => {
      const guide = getExerciseGuide(ex.name, isZh);
      const key = guide.intensity === 'sound' ? 'sound' : 'quiet';
      acc[key].push({ ex, guide });
      return acc;
    }, { quiet: [], sound: [] });
  }

  return (
    <div className="dashboard-body page-shell muscle-training-shell">
      <TopNav backLink={{ to: '/profile', label: 'HERMES' }} />

      <div className="dashboard-container page-body muscle-training-page">
        <div className="muscle-training-hero">
          <div className="muscle-training-hero-copy">
            <div className="muscle-page-tools">
              <div>
                <h1>{mt('muscle_training.heading')}</h1>
                <p>{mt('muscle_training.subheading')}</p>
              </div>
              <div className="muscle-lang-toggle" role="tablist" aria-label={mt('muscle_training.language_toggle_label')}>
                <button type="button" className={displayLang === 'zh-CN' ? 'active' : ''} onClick={() => setDisplayLang('zh-CN')}>
                  {mt('common.lang_zh')}
                </button>
                <button type="button" className={displayLang === 'en' ? 'active' : ''} onClick={() => setDisplayLang('en')}>
                  {mt('common.lang_en')}
                </button>
              </div>
            </div>
          </div>
          <MuscleMap isZh={isZh} />
        </div>

        {loading && <div style={{ padding: '22px 0', color: 'var(--text-muted)' }}>{mt('muscle_training.loading')}</div>}

        {(!loading && error) && <div className="error-alert" style={{ display: 'block', marginTop: 18 }}>{error}</div>}

        {(!loading && !error && data) && (
          <>
            <div className="muscle-training-metrics">
              <div className="muscle-metric-card">
                <div className="muscle-metric-label">{mt('muscle_training.weekly_volume')}</div>
                <strong>{data.weeklyKmEstimate ?? placeholder} {mt('muscle_training.weekly_volume_unit')}</strong>
              </div>
              <div className="muscle-metric-card">
                <div className="muscle-metric-label">{mt('muscle_training.recommended_frequency')}</div>
                <strong>{data.sessionsPerWeek ?? placeholder} {mt('muscle_training.sessions_per_week')}</strong>
              </div>
              <div className="muscle-metric-card">
                <div className="muscle-metric-label">{mt('muscle_training.focus')}</div>
                <strong>{translateMuscleText(data.focus) || placeholder}</strong>
              </div>
            </div>

            <div className="muscle-training-panels">
              {data.recoveryHint && (
                <section className="card muscle-panel muscle-panel-warm">
                  <h2>{mt('muscle_training.recovery_title')}</h2>
                  <p>{translateMuscleText(data.recoveryHint)}</p>
                </section>
              )}

              <section className="card muscle-panel">
                <h2>{mt('muscle_training.rationale_title')}</h2>
                <p>{mt('muscle_training.evidence_note')}</p>
                {Array.isArray(data.rationale) && data.rationale.length > 0 && (
                  <ul className="muscle-rationale-list">
                    {data.rationale.map((line, i) => <li key={`r-${i}`}>{translateMuscleText(line)}</li>)}
                  </ul>
                )}
              </section>
            </div>

            <div className="muscle-session-stack">
              {sessions.map((s, idx) => (
                <section key={`${s.title || 'session'}-${idx}`} className="card muscle-session-card">
                  <div className="muscle-session-head">
                    <div>
                      <div className="muscle-session-kicker">{mt('muscle_training.session')} {idx + 1}</div>
                      <h2>{translateMuscleText(s.title) || mt('muscle_training.session')}</h2>
                    </div>
                    <div className="muscle-session-duration">{mt('muscle_training.duration', { minutes: s.durationMin ?? placeholder })}</div>
                  </div>

                  <div className="muscle-block-stack">
                    {(s.blocks || []).map((b, bi) => (
                      <div key={`${b.title || 'block'}-${bi}`} className="muscle-block-card">
                        <div className="muscle-block-title">{translateMuscleText(b.title)}</div>
                        {(() => {
                          const buckets = bucketExercises(b.exercises);
                          const sections = [
                            { key: 'quiet', label: mt('muscle_training.sound_quiet'), items: buckets.quiet },
                            { key: 'sound', label: mt('muscle_training.sound_loud'), items: buckets.sound },
                          ];
                          return sections.filter(section => section.items.length > 0).map((section) => (
                            <div key={section.key} className="muscle-sound-section">
                              <div className={`muscle-sound-head muscle-sound-head-${section.key}`}>
                                <span className="muscle-sound-dot" />
                                <strong>{section.label}</strong>
                                <span>{section.key === 'quiet'
                                  ? mt('muscle_training.sound_quiet_hint')
                                  : mt('muscle_training.sound_loud_hint')}</span>
                              </div>
                              <div className="muscle-exercise-grid">
                                {section.items.map(({ ex, guide }, ei) => (
                                  <article key={`${section.key}-${ex.name || 'ex'}-${ei}`} className={`muscle-exercise-card muscle-exercise-card-${section.key}`}>
                                    <ExerciseIllustration type={guide.type} intensity={guide.intensity} exerciseName={ex.name} />
                                    <div className="muscle-exercise-copy">
                                      <div className="muscle-exercise-top">
                                        <div>
                                          <h3>{translateMuscleText(ex.name)}</h3>
                                          <div className="muscle-exercise-prescription">{ex.prescription}</div>
                                        </div>
                                        <div className="muscle-exercise-tags">
                                          {guide.muscles.map((muscle) => (
                                            <span key={muscle} className="muscle-tag">{muscle}</span>
                                          ))}
                                        </div>
                                      </div>
                                      <ol className="muscle-step-list">
                                        {guide.steps.map((step) => <li key={step}>{step}</li>)}
                                      </ol>
                                      <div className="muscle-exercise-actions">
                                        <a
                                          href={getExerciseVideoUrl(ex.name)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="muscle-video-link"
                                        >
                                          {mt('muscle_training.watch_demo')}
                                        </a>
                                      </div>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
