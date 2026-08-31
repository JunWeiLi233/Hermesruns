import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'MuscleTraining.jsx'), 'utf8');

assert.match(
  pageSource,
  /function resolveStrengthCoachGridDecision\(plan\)[\s\S]*?const engineDecision = plan\?\.strengthCoachDecision;[\s\S]*?const appliedFocus = engineDecision \? engineDecision\.appliedFocus : plan\?\.recommendedMuscleArea[\s\S]*?displayFocus: appliedFocus \|\| plan\?\.recommendedMuscleArea/,
  'The top grid should preserve a null applied focus for suppressed engine decisions while retaining the legacy display fallback.',
);

assert.match(
  pageSource,
  /function buildCheckInDraft\(plan, isMile\)[\s\S]*?resolveStrengthCoachGridDecision\(plan\)[\s\S]*?strengthFocus: coachDecision\.displayFocus[\s\S]*?strengthDose: coachDecision\.appliedDose/,
  'The check-in draft should be initialized from the backend applied focus and dose.',
);

assert.match(
  pageSource,
  /const gridStrengthDay = strengthCoachDecision\?\.appliedDate[\s\S]*?day\.date === strengthCoachDecision\.appliedDate[\s\S]*?: todayPlan;[\s\S]*?gridStrengthDay\?\.strength[\s\S]*?sessionByType\.get\(gridStrengthDay\.strength\.sessionType\)/,
  'The top action and reference panels should use the session assigned on the backend applied date.',
);

assert.ok(
  (pageSource.match(/resolveStrengthCoachGridDecision\(nextPlan\)/g) || []).length >= 2,
  'Initial plan load and plan-only refresh should both synchronize the backend strength decision.',
);

assert.match(
  pageSource,
  /className="mt-top-workbench"[\s\S]*?data-strength-algorithm=\{strengthCoachDecision\?\.algorithmVersion \|\| undefined\}[\s\S]*?data-strength-focus=\{strengthCoachDecision\?\.appliedFocus \|\| undefined\}[\s\S]*?data-strength-dose=\{strengthCoachDecision\?\.appliedDose \|\| undefined\}/,
  'The existing top grid should expose the backend algorithm, applied focus, and applied dose.',
);

assert.match(
  pageSource,
  /pickLabel\(copy\.strengthDoseOptions, strengthCoachDecision\?\.appliedDose, stitchCopy\.topActionsSelected\)/,
  'The top action panel should visibly label the backend applied dose.',
);

console.log('[PASS] Muscle Training strength coach grid wiring guardrails passed.');
