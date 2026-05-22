/**
 * Workflow execution engine.
 *
 * Walks a (nodes, edges) graph in topological order. Each node receives a
 * payload from its predecessors (concatenated when there are multiple), runs
 * its type-specific executor, and forwards the result to its successors.
 *
 * Reports per-node lifecycle (`pending` → `running` → `done` | `error`) via the
 * `onNodeUpdate(nodeId, patch)` callback so the store can re-render badges in
 * real time. `patch` is `{ status, output?, error? }`.
 *
 * Pure JS — no React, no Zustand imports. Safe to unit-test in isolation.
 */

const AGENT_RESPONSES = {
  'vdot-analyst': (input) => {
    const distance = parseDistanceKm(input);
    if (!distance) return formatAgentReply('VDOT analyst', '需要一次完整跑步距离 (例如「10 km」) 才能估算 VDOT。Provide a distance like "10 km" to estimate VDOT.');
    const vdot = Math.max(20, Math.min(85, Math.round(35 + distance * 0.6)));
    const easyPace = vdotToEasyPace(vdot);
    return formatAgentReply('VDOT analyst', `Estimated VDOT ≈ ${vdot}. Easy pace ${easyPace.minutes}:${easyPace.seconds}/km. 把这个配速作为今日轻松跑的目标。`);
  },
  'pace-zones': (input) => {
    const distance = parseDistanceKm(input);
    if (!distance) return formatAgentReply('Pace zones', '提供一次代表性跑步距离 (例如 10 km) 以推导训练区间。Provide a representative distance to derive zones.');
    const vdot = Math.max(20, Math.min(85, Math.round(35 + distance * 0.6)));
    const easy = vdotToPace(vdot, 1.18);
    const marathon = vdotToPace(vdot, 1.02);
    const threshold = vdotToPace(vdot, 0.94);
    const interval = vdotToPace(vdot, 0.88);
    return formatAgentReply('Pace zones',
      `VDOT ≈ ${vdot} · Easy ${easy} · Marathon ${marathon} · Threshold ${threshold} · Interval ${interval} (min:sec/km).`,
    );
  },
  'recovery-window': (input) => {
    const distance = parseDistanceKm(input) || 0;
    const hardKeyword = /(tempo|interval|race|hard|threshold|强度|比赛|节奏|间歇)/i.test(String(input || ''));
    let hours = 24;
    if (distance >= 30 || /marathon|马拉松/i.test(input || '')) hours = 96;
    else if (distance >= 20 || hardKeyword) hours = 48;
    else if (distance >= 10) hours = 36;
    return formatAgentReply('Recovery window',
      `建议在下一次高强度训练前留 ${hours} 小时低冲击恢复 (轻松慢跑 / 步行 / 交叉训练)。Plan ${hours} hours of low-impact recovery before the next quality session.`,
    );
  },
  'distance-progression': (input) => {
    const current = parseDistanceKm(input);
    if (!current) return formatAgentReply('Distance progression', '需要当前最长跑距才能给出递增建议。Need current longest run to project progression.');
    const week1 = (current * 1.1).toFixed(1);
    const week2 = (current * 1.21).toFixed(1);
    const week3 = (current * 1.0).toFixed(1);
    const week4 = (current * 1.32).toFixed(1);
    return formatAgentReply('Distance progression',
      `4-week build from ${current.toFixed(1)} km: wk1 ${week1} · wk2 ${week2} · wk3 ${week3} (recovery) · wk4 ${week4} km. Apply the 10% weekly increase rule with a recovery dip every third week.`,
    );
  },
  'shoe-advisor': (input) => {
    const distance = parseDistanceKm(input) || 5;
    const surface = /trail|越野/i.test(input) ? 'trail' : 'road';
    const cushioned = distance >= 15;
    return formatAgentReply('Shoe advisor', `${surface === 'trail' ? '越野场景' : 'Road run'} · ${distance} km · ${cushioned ? '高缓震 (Cushioned daily trainer / max-stack)' : '日常训练鞋 (Daily trainer)'} suits this effort.`);
  },
  'race-planner': (input) => {
    const distance = parseDistanceKm(input) || 21.1;
    const weeks = distance >= 42 ? 16 : distance >= 21 ? 12 : distance >= 10 ? 8 : 6;
    return formatAgentReply('Race planner', `${distance.toFixed(1)} km plan: ${weeks}-week build, 1 quality day + 1 long run + 2 easy. Taper 10 days out. 起步保守，距离比赛 6-8 周做一次模拟测试。`);
  },
  'weather-advisor': (input) => {
    const hot = /hot|warm|热|夏/i.test(input);
    const cold = /cold|cool|冷|冬/i.test(input);
    if (hot) return formatAgentReply('Weather advisor', '夏季高温：提前一小时补水 500 ml，配速放慢 10-15 秒/km，能阴凉就阴凉。Hydrate 500 ml an hour ahead, soften pace 10–15 s/km, seek shade.');
    if (cold) return formatAgentReply('Weather advisor', '冬季低温：分层穿着 (base + windproof shell)，前 10 分钟当作热身。Layer up; treat first 10 min as warm-up.');
    return formatAgentReply('Weather advisor', '常规天气：常规配速即可，注意补水。Normal pace; keep regular hydration.');
  },
  'injury-screener': (input) => {
    const pain = /pain|hurt|疼|痛|sore|酸/i.test(input);
    return formatAgentReply('Injury screener', pain
      ? '检测到不适关键词：建议今天改为非冲击训练 (单车 / 椭圆 / 游泳)，连续两天不缓解就预约理疗。Cross-train today; if symptoms persist 48 h, see a physio.'
      : '未检测到伤病关键词：可按计划进行。No injury signal detected — proceed with planned session.');
  },
};

const TRANSFORM_OPERATIONS = {
  uppercase: (value) => String(value || '').toUpperCase(),
  lowercase: (value) => String(value || '').toLowerCase(),
  trim: (value) => String(value || '').trim(),
  reverse: (value) => String(value || '').split('').reverse().join(''),
  'word-count': (value) => {
    const text = String(value || '').trim();
    if (!text) return '0 words';
    return `${text.split(/\s+/).length} words`;
  },
  'first-line': (value) => String(value || '').split(/\r?\n/)[0] || '',
  'extract-numbers': (value) => {
    const matches = String(value || '').match(/-?\d+(?:\.\d+)?/g) || [];
    return matches.length ? matches.join(', ') : '(none)';
  },
  'split-lines': (value) => {
    const lines = String(value || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.length ? lines.map((l, i) => `${i + 1}. ${l}`).join('\n') : '(empty)';
  },
  'capitalize': (value) => {
    return String(value || '').replace(/\b([a-zÀ-ɏ])/g, (m) => m.toUpperCase());
  },
  'replace-spaces': (value) => {
    return String(value || '').replace(/\s+/g, '_');
  },
  'summarize-100': (value) => {
    const text = String(value || '').trim();
    if (text.length <= 100) return text;
    return `${text.slice(0, 97)}…`;
  },
};

function parseDistanceKm(input) {
  const text = String(input || '');
  const km = text.match(/(\d+(?:\.\d+)?)\s*(km|公里|千米|k(?![a-z]))/i);
  if (km) return parseFloat(km[1]);
  const miles = text.match(/(\d+(?:\.\d+)?)\s*(mile|mi|英里)/i);
  if (miles) return parseFloat(miles[1]) * 1.609;
  const bareNum = text.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  if (bareNum) return parseFloat(bareNum[1]);
  return null;
}

function vdotToEasyPace(vdot) {
  const total = 480 - vdot * 3.5;
  const minutes = Math.floor(total / 60);
  const seconds = String(Math.round(total % 60)).padStart(2, '0');
  return { minutes, seconds };
}

/** vdot → pace string formatted as `m:ss/km`, scaled around the easy-pace baseline. */
function vdotToPace(vdot, scale) {
  const easyTotal = 480 - vdot * 3.5;
  const total = Math.max(180, Math.round(easyTotal * (scale || 1)));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatAgentReply(agentName, message) {
  return `[${agentName}] ${message}`;
}

/**
 * Topologically sort a workflow graph. Returns `{ order, hasCycle }`.
 * If a cycle is detected the remaining nodes are appended in arbitrary order
 * so the runner can mark them as `cycle-detected` errors rather than hanging.
 */
export function topoSort(nodes, edges) {
  const adjacency = new Map();
  const indegree = new Map();
  nodes.forEach((n) => {
    adjacency.set(n.id, []);
    indegree.set(n.id, 0);
  });
  edges.forEach((e) => {
    if (!adjacency.has(e.source) || !indegree.has(e.target)) return;
    adjacency.get(e.source).push(e.target);
    indegree.set(e.target, (indegree.get(e.target) || 0) + 1);
  });
  const queue = nodes.filter((n) => (indegree.get(n.id) || 0) === 0).map((n) => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    (adjacency.get(id) || []).forEach((next) => {
      indegree.set(next, (indegree.get(next) || 0) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    });
  }
  return { order, hasCycle: order.length !== nodes.length };
}

/**
 * Hermes data-source executor. Pulls live runner telemetry (`/api/profile/me` and
 * `/api/activities`) via the standard apiJson fetcher, summarizes one shape of
 * runner state, and emits the summary as a string for downstream nodes.
 *
 * Sources supported (selected via `node.data.source`):
 *   • `longest-run`   — `<km> km` of the longest single activity
 *   • `last-run`      — `<km> km` of the most recent activity
 *   • `lifetime-km`   — career-total km (number)
 *   • `total-runs`    — career count
 *   • `summary`       — multi-line briefing (default)
 */
async function executeDataSource(node, apiJson) {
  if (typeof apiJson !== 'function') {
    throw new Error('API client not available — data-source nodes need the apiJson runtime.');
  }
  const source = node.data?.source || 'summary';
  const [profile, activities] = await Promise.all([
    apiJson('/api/profile/me').catch(() => null),
    apiJson('/api/activities').catch(() => []),
  ]);
  const runs = Array.isArray(activities) ? activities : [];
  const longest = runs.reduce((best, r) => Math.max(best, Number(r?.distanceKm || 0)), 0);
  const lifetime = runs.reduce((sum, r) => sum + Number(r?.distanceKm || 0), 0);
  const sortedByTime = [...runs].sort((a, b) => {
    const ta = new Date(a?.startTime || a?.startDate || 0).getTime();
    const tb = new Date(b?.startTime || b?.startDate || 0).getTime();
    return tb - ta;
  });
  const lastRun = sortedByTime[0] || null;
  const lastKm = Number(lastRun?.distanceKm || 0);

  switch (source) {
    case 'longest-run':
      return longest > 0 ? `${longest.toFixed(1)} km` : 'no runs recorded';
    case 'last-run':
      return lastKm > 0 ? `${lastKm.toFixed(1)} km` : 'no recent run';
    case 'lifetime-km':
      return lifetime > 0 ? `${lifetime.toFixed(0)} km lifetime` : '0 km lifetime';
    case 'total-runs':
      return `${runs.length} runs`;
    case 'summary':
    default: {
      const lines = [];
      if (profile?.displayName || profile?.email) {
        lines.push(`Runner: ${profile.displayName || profile.email}`);
      }
      lines.push(`Total runs: ${runs.length}`);
      lines.push(`Lifetime distance: ${lifetime.toFixed(1)} km`);
      lines.push(`Longest single run: ${longest.toFixed(1)} km`);
      if (lastRun) {
        const when = lastRun.startTime || lastRun.startDate || '';
        lines.push(`Last run: ${lastKm.toFixed(1)} km · ${when}`);
      }
      return lines.join('\n');
    }
  }
}

/**
 * Execute one node given its merged input payload. Returns the produced value.
 * Throws on unknown node type or executor error so the runner can record it.
 */
async function executeNode(node, input, runtime) {
  switch (node.type) {
    case 'input': {
      const value = String(node.data?.label ?? '').trim();
      if (!value) throw new Error('Empty input — type something in the Input node first.');
      return value;
    }
    case 'data-source':
      return executeDataSource(node, runtime?.apiJson);
    case 'transform': {
      const op = node.data?.operation || 'trim';
      const fn = TRANSFORM_OPERATIONS[op];
      if (!fn) throw new Error(`Unknown transform: ${op}`);
      return fn(input);
    }
    case 'agent': {
      const agentType = node.data?.agentType || 'vdot-analyst';
      const fn = AGENT_RESPONSES[agentType];
      if (!fn) throw new Error(`Unknown agent: ${agentType}`);
      // Simulate latency so the running badge is visible.
      await new Promise((resolve) => setTimeout(resolve, 350));
      return fn(input || '');
    }
    case 'output': {
      return input ?? '(no output)';
    }
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

/**
 * Run the whole workflow. Returns the final per-node output map keyed by node id.
 *
 * @param {Array} nodes  React Flow node array
 * @param {Array} edges  React Flow edge array
 * @param {Function} onNodeUpdate callback(nodeId, patch) — invoked on status/output changes
 * @param {Object} [runtime] optional runtime injections: { apiJson } for data-source nodes
 */
export async function runWorkflow(nodes, edges, onNodeUpdate, runtime) {
  const notify = typeof onNodeUpdate === 'function' ? onNodeUpdate : () => {};
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map();
  nodes.forEach((n) => incoming.set(n.id, []));
  edges.forEach((e) => {
    if (incoming.has(e.target)) incoming.get(e.target).push(e.source);
  });

  // Reset state.
  nodes.forEach((n) => notify(n.id, { status: 'pending', output: null, error: null }));

  const { order, hasCycle } = topoSort(nodes, edges);
  if (hasCycle) {
    // Mark nodes that didn't make it into the linear order as errors so the
    // user can see the cycle visually without the runner deadlocking.
    const visited = new Set(order);
    nodes.forEach((n) => {
      if (!visited.has(n.id)) notify(n.id, { status: 'error', error: 'Cycle detected' });
    });
  }

  const outputs = new Map();
  for (const nodeId of order) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const sources = incoming.get(nodeId) || [];
    const upstream = sources.map((s) => outputs.get(s)).filter((v) => v != null);
    const merged = upstream.length <= 1 ? upstream[0] : upstream.join('\n');
    notify(nodeId, { status: 'running', output: null, error: null });
    try {
      const value = await executeNode(node, merged, runtime);
      outputs.set(nodeId, value);
      notify(nodeId, { status: 'done', output: value, error: null });
    } catch (err) {
      const message = err?.message || String(err);
      outputs.set(nodeId, null);
      notify(nodeId, { status: 'error', output: null, error: message });
      // Cascade: anything downstream of this failed node also fails.
      const downstream = new Set();
      const stack = [nodeId];
      while (stack.length) {
        const cur = stack.pop();
        edges.forEach((e) => {
          if (e.source === cur && !downstream.has(e.target)) {
            downstream.add(e.target);
            stack.push(e.target);
          }
        });
      }
      downstream.forEach((id) => notify(id, { status: 'error', error: 'Upstream failed' }));
      // Skip the rest of the linear order for downstream nodes by removing them.
      // (We simply leave their status as error; the loop continues with siblings.)
    }
  }

  return Object.fromEntries(outputs.entries());
}

export const TRANSFORM_OPS = Object.keys(TRANSFORM_OPERATIONS);
export const AGENT_TYPES = Object.keys(AGENT_RESPONSES);
export const DATA_SOURCES = ['summary', 'last-run', 'longest-run', 'lifetime-km', 'total-runs'];
