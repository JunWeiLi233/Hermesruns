import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, "../Runs.jsx"), 'utf8');
const modalSource = readFileSync(path.join(here, "../../../components/Modal.jsx"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/all-pages-liquid-glass.css"), 'utf8');

const deleteModalStart = runsSource.lastIndexOf('<Modal', runsSource.indexOf('shellClassName="runs-delete-modal-shell"'));
const deleteModalSource = runsSource.slice(deleteModalStart);
const runsPageRootStart = runsSource.lastIndexOf('className={`runner-shell-page', deleteModalStart);
const runsPageRootToDeleteModal = runsSource.slice(runsPageRootStart, deleteModalStart) + deleteModalSource;

assert.match(
  runsPageRootToDeleteModal,
  /^className=\{`runner-shell-page runner-dashboard-page runs-dashboard-page runs-ledger-page[\s\S]*?<Modal[\s\S]*?shellClassName="runs-delete-modal-shell"/,
  'The Runs delete modal should render inside the runner-shell-page root.',
);

assert.doesNotMatch(
  deleteModalSource,
  /icon=\{/,
  'The Runs delete modal should keep the title as the primary visual anchor.',
);

assert.doesNotMatch(
  deleteModalSource,
  /className="btn-primary runs-delete-modal-confirm"/,
  'The destructive action should not inherit the generic primary-button role.',
);

assert.match(
  deleteModalSource,
  /closeLabel=\{t\('profile\.close'\)\}/,
  'The Runs modal close control should use localized accessible text.',
);

assert.match(
  modalSource,
  /closeLabel = 'Close'/,
  'The shared modal should retain a safe default close label for existing callers.',
);

assert.match(
  modalSource,
  /className="modal-close"[^>]*aria-label=\{closeLabel\}/,
  'The shared modal close control should expose an accessible name.',
);

assert.match(
  modalSource,
  /icon = null/,
  'The shared modal should accept an optional header icon without changing existing callers.',
);

assert.match(
  modalSource,
  /className="modal-header-icon"/,
  'The shared modal should render the optional header icon in a dedicated slot.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-shell\s*\{[\s\S]*?background:\s*rgba\(23,\s*21,\s*18,\s*0\.48\);[\s\S]*?backdrop-filter:\s*blur\(12px\)/,
  'The delete dialog should use the reference modal overlay treatment.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-card\s*\{[\s\S]*?width:\s*min\(520px,[\s\S]*?border-radius:\s*28px;[\s\S]*?background:\s*#ffffff;/,
  'The delete dialog should use the compact white rounded reference card.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-card\s*\{[\s\S]*?background:\s*#ffffff;/,
  'The delete dialog light surface should be solid white.',
);

assert.match(
  styleSource,
  /#root\s+\.runner-shell-page\s+\.runs-delete-modal-card\s*\{[\s\S]*?background:\s*#ffffff\s*!important;/,
  'The delete dialog light surface should beat the runner dashboard modal cascade.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-midnight, \.theme-high-contrast\) #root\s+\.runner-shell-page\s+\.runs-delete-modal-card\s*\{[\s\S]*?background:\s*var\(--runs-profile-card-strong\)\s*!important;/,
  'The delete dialog should retain its dark-theme surface override.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-card \.modal-close\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;[\s\S]*?color:\s*#5b5d61;/,
  'The delete dialog close control should use the reference circular treatment.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-card \.modal-close\s*\{[^}]*border:\s*0[^}]*border-radius:\s*50%[^}]*background:\s*#f4f4f6/,
  'The delete dialog close control should have a quiet circular surface.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-card \.modal-close\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*28px;[\s\S]*?right:\s*26px;/,
  'The delete dialog close control should sit in the card\'s upper-right corner.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-card \.modal-close\s*\{[\s\S]*?display:\s*grid;[\s\S]*?place-items:\s*center;[\s\S]*?padding:\s*0;[\s\S]*?text-align:\s*center;/,
  'The delete dialog close glyph should be centered inside its circle.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-card \.modal-header h3\s*\{[\s\S]*?font-style:\s*normal;[\s\S]*?transform:\s*none;/,
  'The delete dialog title should use upright, unskewed typography.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-copy\s*\{[\s\S]*?font-weight:\s*400;/,
  'The delete confirmation line should use regular weight instead of bold text.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-warning\s*\{[\s\S]*?font-size:\s*clamp\(0\.86rem,\s*1\.5vw,\s*1rem\);/,
  'The delete warning should remain visibly smaller than the confirmation line.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  'The delete dialog actions should have equal reference width.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-actions\s*\{[\s\S]*?margin:\s*28px -36px -30px;[\s\S]*?padding:\s*24px 36px 26px;[\s\S]*?border-top:\s*1px solid\s+#e2e3e5;/,
  'The delete dialog actions should use the separated reference footer.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-actions :is\(\.btn-secondary, \.runs-delete-modal-confirm\)\s*\{[\s\S]*?min-height:\s*60px;[\s\S]*?border-radius:\s*10px\s*!important;/,
  'The delete dialog actions should use the reference button geometry.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-confirm\s*\{[\s\S]*?border:\s*2px solid\s+#ff6b66\s*!important;[\s\S]*?background:\s*#fff3f2\s*!important;[\s\S]*?color:\s*#ef302b\s*!important;[\s\S]*?box-shadow:\s*none\s*!important;/,
  'The delete action should use a pale red outlined destructive treatment.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*540px\)[\s\S]*?\.runs-delete-modal-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
  'The delete dialog actions should stack on small screens.',
);

console.log('[PASS] Runs delete modal reference-style guardrails passed.');
