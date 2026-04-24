/**
 * coachVoice.js - Synthesizes metrics and recommendations into warm, personal guidance.
 */

export function generateMorningBriefing({ recommendation, metrics, lang }) {
  const isZh = lang === 'zh-CN';
  
  // 1. Warm Greeting
  const greetings = isZh 
    ? ['早上好！', '嘿，准备好出发了吗？', '今天感觉怎么样？'] 
    : ['Good morning!', 'Hey there, ready to move?', 'How are you feeling today?'];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  // 2. State Summary (VDOT, ACWR, Recovery)
  let stateSentence = '';
  if (isZh) {
    stateSentence = `你的 VDOT 保持在 ${metrics.bestVdot.toFixed(1)}，训练负荷 (ACWR) 处于 ${metrics.acwr?.toFixed(2) || '--'} 的健康区间。`;
    if (metrics.recoveryHours > 0) {
      stateSentence += ` 虽然你还需要约 ${metrics.recoveryHours} 小时才能彻底恢复，但今天的安排已经考虑了这一点。`;
    } else {
      stateSentence += ` 你的身体已经完全恢复，蓄势待发。`;
    }
  } else {
    stateSentence = `Your VDOT is solid at ${metrics.bestVdot.toFixed(1)}, and your load (ACWR) is at ${metrics.acwr?.toFixed(2) || '--'} within the healthy zone.`;
    if (metrics.recoveryHours > 0) {
      stateSentence += ` You still have about ${metrics.recoveryHours} hours of recovery left, which we've accounted for.`;
    } else {
      stateSentence += ` You are fully recovered and ready to push.`;
    }
  }

  // 3. The "Why" for Today
  let whySentence = '';
  if (isZh) {
    if (recommendation.type.includes('质量') || recommendation.type.includes('Quality')) {
      whySentence = `根据你最近的节奏，今天是一个适合提升强度的日子，让我们来一点 ${recommendation.type}。`;
    } else if (recommendation.type.includes('恢复') || recommendation.type.includes('Recovery')) {
      whySentence = `今天我们的重点是“主动恢复”，通过 ${recommendation.type} 让双腿保持活力，同时不增加额外负担。`;
    } else {
      whySentence = `今天安排了一趟 ${recommendation.type}，这是维持体能基底的关键。`;
    }
  } else {
    if (recommendation.type.includes('Quality') || recommendation.type.includes('质量')) {
      whySentence = `Based on your recent rhythm, today is a great day to pick up the intensity with a ${recommendation.type} session.`;
    } else if (recommendation.type.includes('Recovery') || recommendation.type.includes('恢复')) {
      whySentence = `We're focusing on 'active recovery' today. A ${recommendation.type} will keep your legs moving without overtaxing you.`;
    } else {
      whySentence = `A ${recommendation.type} is on the menu today, essential for maintaining your aerobic base.`;
    }
  }

  // 4. Closing Encouragement
  const closures = isZh
    ? ['加油，跑得开心！', '享受今天的训练。', '我们在终点见。']
    : ['Go get it, and have a great run!', 'Enjoy your session today.', 'See you out there.'];
  const closure = closures[Math.floor(Math.random() * closures.length)];

  return `${greeting} ${stateSentence} ${whySentence} ${closure}`;
}
