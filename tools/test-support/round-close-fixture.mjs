import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runAutoHermesRoundClose } from '../auto-hermes-round-close.mjs';

const stateFiles = {
  qualityAudit: 'QUALITY_AUDIT.md',
  contextLedger: 'CONTEXT_LEDGER.md',
  loopState: 'LOOP_STATE.md',
  loopStateJson: 'AUTO_HERMES_LOOP_STATE.json',
  humanLoop: 'HUMAN_LOOP.md',
  selfCheckJson: 'AUTO_HERMES_SELF_CHECK.json',
  selfCheckMd: 'AUTO_HERMES_SELF_CHECK.md',
  traceToSkillRoundsDir: 'trace-to-skill/rounds',
  traceToSkillJson: 'AUTO_HERMES_TRACE_TO_SKILL.json',
  traceToSkillMd: 'AUTO_HERMES_TRACE_TO_SKILL.md',
  roundResultJson: 'AUTO_HERMES_ROUND_RESULT.json',
  roundResultMd: 'AUTO_HERMES_ROUND_RESULT.md',
  promotionJson: 'AUTO_HERMES_PROMOTION.json',
  promotionMd: 'AUTO_HERMES_PROMOTION.md',
  controllerJson: 'AUTO_HERMES_CONTROLLER.json',
  controllerMd: 'AUTO_HERMES_CONTROLLER.md',
  loopJson: 'AUTO_HERMES_LOOP.json',
  loopMd: 'AUTO_HERMES_LOOP.md',
  coordinatorJson: 'AUTO_HERMES_COORDINATOR.json',
  coordinatorMd: 'AUTO_HERMES_COORDINATOR.md',
  promptFile: 'AUTO_HERMES_NEXT_PROMPT.md',
  finishJson: 'AUTO_HERMES_FINISH.json',
  finishMd: 'AUTO_HERMES_FINISH.md',
  agentSyncMd: 'AGENT_SYNC.md',
  agentSyncJson: 'AGENT_SYNC.json',
  selfEvolvingAudit: 'SELF_EVOLVING_AUDIT.md',
  telemetryJson: 'AUTO_HERMES_TELEMETRY.json',
  errorLedger: 'error.md',
};

function isWithin(directory, target) {
  const relative = path.relative(directory, target);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function roundCloseFixtureOptions(args) {
  assert.ok(path.isAbsolute(args.tasks), 'Round-close tests require an absolute fixture TASKS.md.');
  const root = fs.realpathSync(path.dirname(args.tasks));
  assert.ok(isWithin(fs.realpathSync(os.tmpdir()), root), 'Round-close tests must use a temporary fixture.');
  const defaults = Object.fromEntries(Object.entries(stateFiles).map(([key, file]) => [key, path.join(root, '.workspace/state', file)]));
  const options = { ...defaults, ...args };
  for (const key of Object.keys(stateFiles)) {
    assert.ok(path.isAbsolute(options[key]) && isWithin(root, options[key]), `${key} must stay inside the fixture.`);
  }
  return options;
}

export function runFixtureRoundClose(args) {
  return runAutoHermesRoundClose(roundCloseFixtureOptions(args));
}
