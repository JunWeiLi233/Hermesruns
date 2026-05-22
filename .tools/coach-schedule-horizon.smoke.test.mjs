import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const automatedCoachService = fs.readFileSync(path.resolve("backend/src/main/java/com/hermes/backend/AutomatedCoachService.java"), "utf8");

assert.match(
  automatedCoachService,
  /ConcurrentMap<\s*Long,\s*Object\s*>\s+scheduleHorizonLocks/,
  "AutomatedCoachService should serialize schedule-horizon generation per runner to avoid duplicate inserts.",
);

assert.match(
  automatedCoachService,
  /findByRunnerAndScheduledDateBetween\(/,
  "AutomatedCoachService should pre-load existing scheduled dates in one range query instead of probing each day independently.",
);

assert.match(
  automatedCoachService,
  /saveAll\(toCreate\)/,
  "AutomatedCoachService should save only the missing workouts gathered for the current horizon pass.",
);

console.log("PASS coach schedule horizon guard");
