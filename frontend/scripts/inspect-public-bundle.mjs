import { build } from 'vite';
import fs from 'node:fs/promises';

await build({
  logLevel: 'silent',
  build: { write: false },
  plugins: [{
    name: 'inspect-public-module-boundary',
    async generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((item) => item.type === 'chunk');
      const entry = chunks.find((chunk) => chunk.isEntry && chunk.name === 'public');
      const seen = new Set();
      const report = [];
      function walk(file) {
        if (seen.has(file)) return;
        seen.add(file);
        const chunk = bundle[file];
        report.push({ file, imports: chunk.imports, modules: Object.keys(chunk.modules) });
        chunk.imports.forEach(walk);
      }
      walk(entry.fileName);
      await fs.writeFile('../output/seo/2026-10-20/performance-fix/public-module-boundary.json', JSON.stringify(report, null, 2));
      for (const chunk of report) console.log(JSON.stringify({ file: chunk.file, modules: chunk.modules.filter((id) => !id.includes('/node_modules/')) }));
    },
  }],
});
