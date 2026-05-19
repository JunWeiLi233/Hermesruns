import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');

function read(relativePath) {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

const appSource = read('App.jsx');
const pageSource = read('pages/WorkflowBuilder.jsx');
const canvasSource = read('components/workflow/WorkflowCanvas.jsx');
const paletteSource = read('components/workflow/NodePalette.jsx');
const inputNodeSource = read('components/workflow/nodes/InputNode.jsx');
const outputNodeSource = read('components/workflow/nodes/OutputNode.jsx');
const transformNodeSource = read('components/workflow/nodes/TransformNode.jsx');
const agentNodeSource = read('components/workflow/nodes/AgentNode.jsx');
const styleSource = read('styles/style.css');
const enSource = read('i18n/locales/en.js');
const zhSource = read('i18n/locales/zh-CN.js');

assert.match(
  appSource,
  /path="\/workflows"[\s\S]*<WorkflowBuilder/,
  'App should expose Workflow Builder at /workflows.',
);

assert.match(
  pageSource,
  /class WorkflowCanvasBoundary extends Component[\s\S]*getDerivedStateFromError[\s\S]*componentDidCatch[\s\S]*fallback/,
  'WorkflowBuilder should wrap the canvas in an error boundary with a fallback.',
);

assert.match(
  pageSource,
  /const \[isCanvasLoading,\s*setIsCanvasLoading\] = useState\(true\);[\s\S]*window\.requestAnimationFrame\(\(\) => \{[\s\S]*setIsCanvasLoading\(false\);/,
  'WorkflowBuilder should show a bounded loading state before mounting the canvas.',
);

assert.match(
  pageSource,
  /role="status" aria-live="polite"[\s\S]*workflow_builder\.loading_kicker[\s\S]*workflow_builder\.loading_title[\s\S]*workflow_builder\.loading_copy/,
  'WorkflowBuilder loading state should be announced and use i18n copy.',
);

assert.match(
  pageSource,
  /role="alert"[\s\S]*workflow_builder\.error_kicker[\s\S]*workflow_builder\.error_title[\s\S]*workflow_builder\.error_copy[\s\S]*workflow_builder\.retry/,
  'WorkflowBuilder error state should be announced, localized, and retryable.',
);

assert.match(
  pageSource,
  /const isCanvasEmpty = !isCanvasLoading && !canvasError && nodes\.length === 0;[\s\S]*aria-live="polite"[\s\S]*workflow_builder\.empty_title[\s\S]*workflow_builder\.empty_cta/,
  'WorkflowBuilder should render a localized empty state with a CTA when no nodes exist.',
);

assert.match(
  pageSource,
  /const handleEmptyCta = \(\) => \{[\s\S]*addNode\('input', \{ x: 120, y: 120 \}\);[\s\S]*\};/,
  'WorkflowBuilder empty CTA should start the user with an input node.',
);

assert.doesNotMatch(
  pageSource,
  /lang\s*===\s*['"]zh-CN['"]\s*\?/,
  'WorkflowBuilder should not bypass i18n with inline language ternaries.',
);

assert.match(
  canvasSource,
  /aria-label=\{t\('workflow_builder\.canvas_label'\)\}[\s\S]*ariaLabelConfig=\{\{[\s\S]*controls\.zoomIn\.ariaLabel[\s\S]*controls\.zoomOut\.ariaLabel[\s\S]*controls\.fitView\.ariaLabel[\s\S]*minimap\.ariaLabel[\s\S]*handle\.ariaLabel/,
  'WorkflowCanvas should provide localized ARIA labels for canvas controls, minimap, and handles.',
);

assert.match(
  canvasSource,
  /<Controls className="wf-controls" aria-label=\{t\('workflow_builder\.controls_label'\)\}/,
  'React Flow controls should carry a localized aria-label.',
);

assert.match(
  canvasSource,
  /<MiniMap[\s\S]*aria-label=\{t\('workflow_builder\.minimap_label'\)\}[\s\S]*ariaLabel=\{t\('workflow_builder\.minimap_label'\)\}/,
  'React Flow minimap should carry localized ARIA labels.',
);

assert.match(
  paletteSource,
  /event\.key !== 'Enter' && event\.key !== ' '[\s\S]*onAddNode\?\.\(type, DEFAULT_POSITIONS\[type\]\);[\s\S]*onKeyDown=\{\(e\) => handlePaletteKeyDown\(e, type\)\}/,
  'Node palette items should support keyboard add via Enter and Space.',
);

assert.match(
  styleSource,
  /\.wf-canvas-wrapper\s*\{[\s\S]*min-height:\s*640px;[\s\S]*\}/,
  'Workflow canvas wrapper should have an explicit minimum height for React Flow.',
);

assert.match(
  styleSource,
  /\.wf-canvas\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*640px;[\s\S]*\}/,
  'Workflow React Flow canvas should have explicit height and minimum height.',
);

for (const [label, source, expectations] of [
  [
    'input node',
    inputNodeSource,
    [
      /role="group"/,
      /aria-label=\{t\('workflow_builder\.input_node_label'\)\}/,
      /aria-label=\{t\('workflow_builder\.input_node_source_label'\)\}/,
      /aria-label=\{t\('workflow_builder\.input_node_textarea_label'\)\}/,
    ],
  ],
  [
    'output node',
    outputNodeSource,
    [
      /role="group"/,
      /aria-label=\{t\('workflow_builder\.output_node_label'\)\}/,
      /aria-label=\{t\('workflow_builder\.output_node_target_label'\)\}/,
      /role="status" aria-live="polite"/,
    ],
  ],
  [
    'transform node',
    transformNodeSource,
    [
      /role="group"/,
      /aria-label=\{t\('workflow_builder\.transform_node_label'\)\}/,
      /aria-label=\{t\('workflow_builder\.transform_node_target_label'\)\}/,
      /aria-label=\{t\('workflow_builder\.transform_node_source_label'\)\}/,
    ],
  ],
  [
    'agent node',
    agentNodeSource,
    [
      /role="group"/,
      /aria-label=\{t\('workflow_builder\.agent_node_label'\)\}/,
      /aria-label=\{t\('workflow_builder\.agent_node_target_label'\)\}/,
      /aria-label=\{t\('workflow_builder\.agent_node_source_label'\)\}/,
      /aria-label=\{t\('workflow_builder\.agent_node_select_label'\)\}/,
    ],
  ],
]) {
  for (const expectation of expectations) {
    assert.match(source, expectation, `${label} should satisfy ${expectation}.`);
  }
}

for (const [localeName, localeSource] of [['en', enSource], ['zh-CN', zhSource]]) {
  for (const key of [
    'error_kicker',
    'error_title',
    'error_copy',
    'retry',
    'loading_kicker',
    'loading_title',
    'loading_copy',
    'empty_kicker',
    'empty_title',
    'empty_copy',
    'empty_cta',
    'canvas_label',
    'controls_label',
    'controls_zoom_in_label',
    'controls_zoom_out_label',
    'controls_fit_view_label',
    'controls_interactive_label',
    'minimap_label',
    'handle_label',
    'agent_node_label',
    'input_node_label',
    'output_node_label',
    'transform_node_label',
  ]) {
    assert.match(
      localeSource,
      new RegExp(`"${key}"\\s*:`),
      `${localeName} locale should include workflow_builder.${key}.`,
    );
  }
}

console.log('[PASS] Workflow Builder state and accessibility guardrails passed.');
