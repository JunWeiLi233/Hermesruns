/**
 * Ready-to-run workflow templates surfaced in the empty state.
 *
 * Each template is a `{ nodes, edges }` graph in the same shape the workflow
 * store accepts via `loadWorkflow`. Position values are tuned for the default
 * canvas viewport so the user sees the whole graph at fitView.
 */

export const WORKFLOW_TEMPLATES = [
  {
    id: 'tpl-vdot',
    titleZh: 'VDOT 速测',
    titleEn: 'VDOT Quick Estimate',
    descZh: '输入一次代表跑距离 → VDOT analyst 估算 → 输出今日轻松跑配速。',
    descEn: 'Pipe a representative distance into the VDOT analyst and surface today\'s easy pace.',
    accent: '#f07561',
    nodes: [
      { id: 't1_input', type: 'input', position: { x: 80, y: 140 }, data: { label: '10 km' } },
      { id: 't1_agent', type: 'agent', position: { x: 360, y: 140 }, data: { agentType: 'vdot-analyst' } },
      { id: 't1_output', type: 'output', position: { x: 660, y: 140 }, data: { output: '' } },
    ],
    edges: [
      { id: 't1_e1', source: 't1_input', target: 't1_agent', type: 'smart', animated: true },
      { id: 't1_e2', source: 't1_agent', target: 't1_output', type: 'smart', animated: true },
    ],
  },
  {
    id: 'tpl-race-brief',
    titleZh: '赛前简报',
    titleEn: 'Race-Day Brief',
    descZh: '输入目标赛距 → Race planner 给训练大纲 → Weather advisor 补充天气 → 输出。',
    descEn: 'Race planner drafts the training arc, weather advisor layers in the day-of plan.',
    accent: '#a0392a',
    nodes: [
      { id: 't2_input', type: 'input', position: { x: 80, y: 140 }, data: { label: '21.1 km' } },
      { id: 't2_planner', type: 'agent', position: { x: 360, y: 60 }, data: { agentType: 'race-planner' } },
      { id: 't2_weather', type: 'agent', position: { x: 360, y: 240 }, data: { agentType: 'weather-advisor' } },
      { id: 't2_output', type: 'output', position: { x: 700, y: 140 }, data: { output: '' } },
    ],
    edges: [
      { id: 't2_e1', source: 't2_input', target: 't2_planner', type: 'smart', animated: true },
      { id: 't2_e2', source: 't2_input', target: 't2_weather', type: 'smart', animated: true },
      { id: 't2_e3', source: 't2_planner', target: 't2_output', type: 'smart', animated: true },
      { id: 't2_e4', source: 't2_weather', target: 't2_output', type: 'smart', animated: true },
    ],
  },
  {
    id: 'tpl-recovery',
    titleZh: '伤病自测',
    titleEn: 'Injury Self-Check',
    descZh: '记录现状 → Injury screener 分析 → Transform 取首行总结 → 输出。',
    descEn: 'Drop in your current symptoms, the injury screener flags risk, transform extracts the headline.',
    accent: '#0891b2',
    nodes: [
      { id: 't3_input', type: 'input', position: { x: 80, y: 140 }, data: { label: 'mild knee soreness after 12 km' } },
      { id: 't3_screener', type: 'agent', position: { x: 360, y: 140 }, data: { agentType: 'injury-screener' } },
      { id: 't3_transform', type: 'transform', position: { x: 660, y: 140 }, data: { operation: 'first-line' } },
      { id: 't3_output', type: 'output', position: { x: 940, y: 140 }, data: { output: '' } },
    ],
    edges: [
      { id: 't3_e1', source: 't3_input', target: 't3_screener', type: 'smart', animated: true },
      { id: 't3_e2', source: 't3_screener', target: 't3_transform', type: 'smart', animated: true },
      { id: 't3_e3', source: 't3_transform', target: 't3_output', type: 'smart', animated: true },
    ],
  },
];

export function findTemplate(id) {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id) || null;
}
