function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function hasSubagentDelegation(subagentPlan = {}, route = {}) {
  const plannedAgents = Array.isArray(route?.recommendedAgents) ? route.recommendedAgents.filter(Boolean) : [];
  return Boolean(
    subagentPlan?.useCodexSubagents ||
      subagentPlan?.useGeminiParallelAgents ||
      plannedAgents.length > 0 ||
      route?.visibleMultiAgent
  );
}

export function inferWorkflowComposition({
  classification = {},
  route = {},
  subagentPlan = {},
  laneCount = 0,
} = {}) {
  const applied = ["routing"];
  const reasons = [];

  const parallel =
    route?.shape === "parallel-builders" ||
    classification?.crossStack ||
    Number(laneCount) > 1 ||
    (Array.isArray(subagentPlan?.parallelGroups) && subagentPlan.parallelGroups.some((group) => Array.isArray(group) && group.length > 1));
  const delegated = hasSubagentDelegation(subagentPlan, route);
  const evaluationRequired =
    parallel ||
    delegated ||
    classification?.reviewSensitive ||
    classification?.frontendDesignGateRequired ||
    classification?.backendLogicReviewRequired ||
    route?.shape === "pm-builder-reviewer";

  const executionPattern = parallel ? "parallel-processing" : "sequential-processing";
  applied.push(executionPattern);
  reasons.push(parallel ? "Round has disjoint lanes that can be processed in parallel." : "Round is bounded to a sequential execution path.");

  let coordinationPattern = "direct-routing";
  if (delegated || route?.visibleMultiAgent || route?.shape === "pm-builder-reviewer" || route?.shape === "parallel-builders") {
    coordinationPattern = "orchestrator-worker";
    applied.push(coordinationPattern);
    reasons.push("Controller selected an orchestrator/worker split for the bounded round.");
  }

  const qualityPattern = evaluationRequired ? "evaluation-feedback-loops" : "single-pass";
  if (qualityPattern === "evaluation-feedback-loops") {
    applied.push(qualityPattern);
    reasons.push("Round requires explicit review, verification, or feedback before close.");
  } else {
    reasons.push("Round is small enough for a single verification pass.");
  }

  const delegationPattern = delegated ? "subagents" : "none";
  if (delegationPattern !== "none") {
    applied.push(delegationPattern);
    reasons.push("Subagent-capable runtime or recommended specialist lanes are available.");
  }

  const primary = parallel
    ? "parallel-processing"
    : qualityPattern === "evaluation-feedback-loops"
      ? "evaluation-feedback-loops"
      : "sequential-processing";
  const normalizedApplied = unique(applied);

  return {
    primary,
    applied: normalizedApplied,
    executionPattern,
    coordinationPattern,
    qualityPattern,
    delegationPattern,
    reasons,
    summary: `${primary}: ${normalizedApplied.join(" -> ")}`,
  };
}
