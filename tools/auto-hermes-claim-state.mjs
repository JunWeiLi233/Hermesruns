export const AUTO_HERMES_CLAIM_STATES = Object.freeze([
  "unavailable",
  "configured",
  "requested",
  "prepared",
  "executing",
  "verified",
]);

export function claimStateFromFlags(flags = {}) {
  if (flags.verified) return "verified";
  if (flags.executing) return "executing";
  if (flags.prepared) return "prepared";
  if (flags.requested) return "requested";
  if (flags.configured) return "configured";
  return "unavailable";
}

export function makeClaim(subject, flagsOrState, options = {}) {
  const state = typeof flagsOrState === "string"
    ? flagsOrState
    : claimStateFromFlags(flagsOrState);
  return {
    subject,
    state,
    detail: options.detail || "",
    rationale: options.rationale || "",
    evidence: Array.isArray(options.evidence) ? options.evidence.filter(Boolean) : [],
  };
}

export function renderClaimMarkdown(claim) {
  const lines = [`- ${claim.subject}: ${claim.state}`];
  if (claim.detail) lines.push(`  detail: ${claim.detail}`);
  if (claim.rationale) lines.push(`  rationale: ${claim.rationale}`);
  for (const item of claim.evidence || []) {
    lines.push(`  evidence: ${item}`);
  }
  return lines;
}
