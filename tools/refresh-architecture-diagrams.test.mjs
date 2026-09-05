import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(path.resolve("tools/refresh-architecture-diagrams.mjs")).href;
const { runArchitectureDiagramRefresh } = await import(moduleUrl);

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-arch-diagrams-"));
  const write = (relPath, content) => {
    const target = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  };

  write("README.md", "# Hermes\n\n### AI-Agent Workflow (Shared) /\n\nplaceholder\n");
  write("frontend/package.json", JSON.stringify({
    dependencies: {
      react: "^19.2.7",
      "react-router": "^8.3.0",
    },
  }, null, 2));
  write("frontend/src/App.jsx", `
    import React from 'react';
const Landing = React.lazy(() => import('./pages/Landing'));
const AdminLogin = React.lazy(() => import('./pages/AdminLogin'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const TodayRun = React.lazy(() => import('./pages/TodayRun'));
const Runs = React.lazy(() => import('./pages/Runs'));
const Settings = React.lazy(() => import('./pages/Settings'));
function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/dashboard/*" element={<AdminOnlyRoute><Dashboard /></AdminOnlyRoute>} />
      <Route path="/today-run" element={<UserOnlyRoute><TodayRun /></UserOnlyRoute>} />
      <Route path="/runs" element={<UserOnlyRoute><Runs /></UserOnlyRoute>} />
      <Route path="/settings" element={<UserOnlyRoute><Settings /></UserOnlyRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default App;
`);
  write(".codex/workflows/hermes-multi-agent.md", `
\`planning-agent\`
\`reviewer-agent\`
\`debugger-agent\`
\`frontend-agent\`
\`backend-agent\`
`);
  write(".codex/commands/auto-hermes.md", "# auto-hermes");
  write(".codex/commands/auto-hermes-max.md", "# auto-hermes-max");
  write(".codex/skills/architecture-diagram-generator/assets/template.html", "# template");
  return dir;
}

{
  const rootDir = fixture();
  const { result } = runArchitectureDiagramRefresh({
    rootDir,
    force: true,
    changedFiles: ["frontend/src/pages/NewPage.jsx"],
    outputDir: "docs/architecture",
    readmePath: "README.md",
    appPath: "frontend/src/App.jsx",
  });

  assert.equal(result.refreshed, true);
  assert.equal(fs.existsSync(path.join(rootDir, "docs/architecture/ai-agents-workflow.svg")), true);
  assert.equal(fs.existsSync(path.join(rootDir, "docs/architecture/saas-architecture.html")), true);

  const readme = fs.readFileSync(path.join(rootDir, "README.md"), "utf8");
  assert.match(readme, /AUTO-GENERATED ARCHITECTURE DIAGRAMS START/);
  assert.match(readme, /docs\/architecture\/ai-agents-workflow\.html/);
  assert.match(readme, /docs\/architecture\/saas-architecture\.svg/);

  const saasSvg = fs.readFileSync(path.join(rootDir, "docs/architecture/saas-architecture.svg"), "utf8");
  assert.match(saasSvg, /React Router 8/);
  assert.doesNotMatch(saasSvg, /React Router 7/);
  assert.match(saasSvg, /Admin Routes \(2\)/);
  assert.doesNotMatch(saasSvg, /Public Routes \(7\)/);
  assert.match(saasSvg, /\/admin/);
  assert.match(saasSvg, /\/today-run/);
  assert.match(saasSvg, /Auth Gates/);
  assert.match(saasSvg, /PostgreSQL production/);
  assert.match(saasSvg, /Bearer token on \/api/);
  assert.match(saasSvg, /Open-Meteo \+ NWS/);
  assert.ok(
    saasSvg.indexOf("Auth Gates") < saasSvg.indexOf("/api + token"),
    "Flow arrows must paint after boxes so they stay visible in the gutters.",
  );
  const dictionaries = fs.readFileSync(path.join(rootDir, "docs/architecture/data-dictionaries.svg"), "utf8");
  assert.match(dictionaries, /muscleSlugMapper\.js/);
  assert.doesNotMatch(dictionaries, /muscleMasks\.data\.json/);
}

{
  const rootDir = fixture();
  const { result } = runArchitectureDiagramRefresh({
    rootDir,
    changedFiles: ["frontend/src/utils/format.js"],
    outputDir: "docs/architecture",
    readmePath: "README.md",
    appPath: "frontend/src/App.jsx",
  });

  assert.equal(result.refreshed, false);
  assert.equal(fs.existsSync(path.join(rootDir, "docs/architecture/ai-agents-workflow.svg")), false);
}

console.log("PASS refresh-architecture-diagrams");
