import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(path.resolve(".tools/refresh-architecture-diagrams.mjs")).href;
const { runArchitectureDiagramRefresh } = await import(moduleUrl);

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-arch-diagrams-"));
  const write = (relPath, content) => {
    const target = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  };

  write("README.md", "# Hermes\n\n### AI-Agent Workflow (Shared) /\n\nplaceholder\n");
  write("frontend/src/App.jsx", `
import React from 'react';
const Landing = React.lazy(() => import('./pages/Landing'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Runs = React.lazy(() => import('./pages/Runs'));
const Settings = React.lazy(() => import('./pages/Settings'));
function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/admin" element={<AdminOnlyRoute><Dashboard /></AdminOnlyRoute>} />
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
