import assert from "node:assert/strict";
import { collectSuggestedTasks } from "./suggest-tasks.mjs";

const result = collectSuggestedTasks({ quiet: true, max: 20 });
const descriptions = (result.tasks || []).map((task) => task.desc || "");

assert.ok(
  !descriptions.some((desc) => /Landing page has no visible empty state/i.test(desc)),
  "suggest-tasks should not emit a runner empty-state task for the public Landing page."
);

assert.ok(
  !descriptions.some((desc) => /MuscleTraining may need mobile breakpoint review/i.test(desc)),
  "suggest-tasks should not emit a mobile breakpoint task for MuscleTraining when responsive layout rules already exist."
);

console.log("[PASS] suggest-tasks smoke test passed.");
