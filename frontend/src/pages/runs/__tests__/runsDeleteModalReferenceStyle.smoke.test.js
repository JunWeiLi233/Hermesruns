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

assert.match(
  deleteModalSource,
  /icon=\{<AppIcon name="delete_sweep" className="runs-delete-modal-icon" \/>\}/,
  'The Runs delete modal should use a contextual icon above its title.',
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
  /\.runs-delete-modal-card\s*\{[\s\S]*?width:\s*min\(440px,[\s\S]*?border-radius:\s*28px;[\s\S]*?background:\s*#ffffff;/,
  'The delete dialog should use a compact white rounded sheet.',
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
  /\.runs-delete-modal-card \.modal-close\s*\{[\s\S]*?width:\s*42px;[\s\S]*?height:\s*42px;[\s\S]*?color:\s*var\(--runs-profile-ink\)/,
  'The delete dialog close control should match the plain-X reference treatment.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-card \.modal-close\s*\{[^}]*border:\s*0[^}]*border-radius:\s*0[^}]*background:\s*transparent/,
  'The delete dialog close control should show only the X without an outer circle.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-card \.modal-close\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*26px;[\s\S]*?right:\s*28px;/,
  'The delete dialog close control should sit in the card\'s upper-right corner.',
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
  /\.runs-delete-modal-warning\s*\{[\s\S]*?font-size:\s*0\.84rem;/,
  'The delete warning should remain visibly smaller than the confirmation line.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-actions\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*0\.72fr\) minmax\(0,\s*1\.28fr\)/,
  'The delete dialog should give the primary action more visual weight.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-confirm\s*\{[\s\S]*?clip-path:\s*none\s*!important;/,
  'The delete action should use a rounded button instead of the legacy trapezoid treatment.',
);

assert.match(
  styleSource,
  /\.runs-delete-modal-actions :is\(\.btn-secondary, \.runs-delete-modal-confirm\)\s*\{[\s\S]*?border-radius:\s*999px\s*!important;/,
  'The delete action should use the rounded reference button geometry.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*540px\)[\s\S]*?\.runs-delete-modal-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
  'The delete dialog actions should stack on small screens.',
);

console.log('[PASS] Runs delete modal reference-style guardrails passed.');
