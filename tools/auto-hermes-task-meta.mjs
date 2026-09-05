const BACKEND_TEXT_RE =
  /\b(controller|service|repository|entity|scheduler|migration|jdbc|jpa|spring|java|mvnw|api|endpoint|validation|request|response|h2|postgres|sql)\b/i;
const FRONTEND_TEXT_RE =
  /\b(frontend|react|jsx|tsx|vite|npm run lint|npm run build|component|hook|layout|theme|translation|i18n|page|modal|shell|hero|card|empty state|loading state|error state)\b/i;

function collapseWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeFiles(value) {
  return String(value || "")
    .split(",")
    .flatMap((item) => item.split("||"))
    .map((item) => item.trim().replace(/^`|`$/g, ""))
    .filter(Boolean);
}

function humanizeIdentifier(value) {
  return collapseWhitespace(
    String(value || "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " "),
  );
}

function stripSurfaceSuffixes(value) {
  return collapseWhitespace(
    String(value || "").replace(
      /\b(controller|service|repository|entity|scheduler|tests?|page|screen|dashboard|detail|modal|layout|flow|panel|route)\b/gi,
      "",
    ),
  );
}

function taskHelperValue(task, key) {
  const prefix = `${key}:`;
  const hit = Array.isArray(task?.helpers) ? task.helpers.find((line) => line.startsWith(prefix)) : null;
  return hit ? hit.slice(prefix.length).trim() : "";
}

function filesFromTask(task) {
  return normalizeFiles(taskHelperValue(task, "Files"));
}

function titleCandidates(title) {
  const cleaned = String(title || "")
    .replace(/[–—]/g, "-")
    .replace(/\bhas no\b.*$/i, "")
    .replace(/\badd\b.*$/i, "")
    .replace(/\bfix\b.*$/i, "")
    .replace(/\bmake\b.*$/i, "")
    .replace(/\brestore\b.*$/i, "")
    .replace(/\bupdate\b.*$/i, "")
    .split("-")[0]
    .trim();

  const candidates = [];
  const camel = cleaned.match(/\b[A-Z][A-Za-z0-9]+(?:Controller|Service|Repository|Entity|Scheduler|Tests?)\b/);
  if (camel) candidates.push(camel[0]);
  if (cleaned) candidates.push(cleaned);
  return candidates;
}

function deriveSurfaceFromFiles(files) {
  for (const file of files) {
    const normalized = file.replace(/\\/g, "/");
    const pageMatch = normalized.match(/frontend\/src\/pages\/([^/]+)\.[a-z0-9]+$/i);
    if (pageMatch) return stripSurfaceSuffixes(humanizeIdentifier(pageMatch[1]));
    const backendMatch = normalized.match(/backend\/src\/(?:main|test)\/java\/.+\/([^/]+)\.java$/i);
    if (backendMatch) return stripSurfaceSuffixes(humanizeIdentifier(backendMatch[1]));
  }
  return "";
}

function deriveSurfaceFromTitle(title) {
  for (const candidate of titleCandidates(title)) {
    const stripped = stripSurfaceSuffixes(humanizeIdentifier(candidate));
    if (stripped) return stripped;
  }
  return "";
}

export function inferSurfaceFromTask(task, options = {}) {
  const explicit = taskHelperValue(task, "Surface");
  if (explicit) return explicit;

  const files = filesFromTask(task);
  const activeClaims = Array.isArray(options.activeClaims) ? options.activeClaims : [];
  const capsules = Array.isArray(options.capsules) ? options.capsules : [];

  const matchingClaim = activeClaims.find((claim) => {
    const claimFiles = Array.isArray(claim?.files) ? claim.files : [];
    const overlappingFile = claimFiles.some((file) => files.includes(file));
    return overlappingFile || collapseWhitespace(claim?.task).toLowerCase() === collapseWhitespace(task?.title).toLowerCase();
  });
  if (matchingClaim?.surface) return matchingClaim.surface;

  const fromFiles = deriveSurfaceFromFiles(files);
  if (fromFiles) return fromFiles;

  const fromTitle = deriveSurfaceFromTitle(task?.title);
  if (fromTitle) return fromTitle;

  const context = taskHelperValue(task, "Context");
  const taskHaystack = collapseWhitespace(`${task?.title || ""} ${context} ${files.join(" ")}`).toLowerCase();
  const capsule = capsules.find((entry) => {
    const surface = collapseWhitespace(entry?.surface).toLowerCase();
    return surface && taskHaystack.includes(surface);
  });
  if (capsule?.surface) return capsule.surface;

  return task?.section || options.defaultSurface || "unknown";
}

export function inferStackFromTask(task, surface = "") {
  const files = filesFromTask(task);
  const verify = taskHelperValue(task, "Verify");
  const context = taskHelperValue(task, "Context");
  const text = collapseWhitespace(`${task?.title || ""} ${context} ${verify} ${surface}`);

  const touchesFrontend =
    files.some((file) => file.replace(/\\/g, "/").includes("frontend/")) ||
    (!files.some((file) => file.replace(/\\/g, "/").includes("backend/")) && FRONTEND_TEXT_RE.test(text));
  const touchesBackend =
    files.some((file) => file.replace(/\\/g, "/").includes("backend/")) ||
    (!files.some((file) => file.replace(/\\/g, "/").includes("frontend/")) && BACKEND_TEXT_RE.test(text));
  const touchesDocsOnly = files.length > 0 && !touchesFrontend && !touchesBackend;

  return {
    files,
    touchesFrontend,
    touchesBackend,
    touchesDocsOnly,
  };
}
