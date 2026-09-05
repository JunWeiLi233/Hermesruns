import { readFileSync } from 'node:fs';

// Source contracts follow only the admin modules imported by the route entry.
// Keep declarations before orchestration and sections after it for cross-owner assertions.
export function readDashboardSources() {
  const entryUrl = new URL('./Dashboard.jsx', import.meta.url);
  const adminRoot = new URL('./', import.meta.url).href;
  const visited = new Set();
  const declarations = [];
  const sections = [];

  function visit(url) {
    if (visited.has(url.href)) return;
    visited.add(url.href);
    const source = readFileSync(url, 'utf8');
    for (const match of source.matchAll(/^import\s+[^;]*?\sfrom\s+['"]([^'"]+)['"];?/gm)) {
      if (!match[1].startsWith('.')) continue;
      const dependency = new URL(match[1], url);
      if (dependency.href.startsWith(adminRoot)) visit(dependency);
    }
    if (url.href === entryUrl.href) return source;
    (url.pathname.endsWith('Section.jsx') ? sections : declarations).push(source);
  }

  const entrySource = visit(entryUrl);
  return [...declarations, entrySource, ...sections].join('\n');
}
