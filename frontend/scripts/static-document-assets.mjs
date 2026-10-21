import fs from 'node:fs';
import path from 'node:path';

export function collectMissingDocumentAssets(staticDir) {
  const documents = ['index.html', 'public-pages/home.html', 'public-pages/terms.html', 'public-pages/privacy.html'];
  const missing = new Set();
  for (const document of documents) {
    const file = path.join(staticDir, document);
    if (!fs.existsSync(file)) { missing.add(document); continue; }
    const html = fs.readFileSync(file, 'utf8');
    const refs = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
    for (const match of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
      for (const candidate of match[1].split(',')) refs.push(candidate.trim().split(/\s+/)[0]);
    }
    for (const candidate of refs) {
      const ref = candidate.trim().split('#')[0].split('?')[0];
      if (!ref || /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//')) continue;
      const relative = ref.replace(/^\/+/, '');
      // Navigation routes are not emitted asset files.
      if (!relative.split('/').pop()?.includes('.')) continue;
      if (!fs.existsSync(path.join(staticDir, ...relative.split('/')))) missing.add(relative);
    }
  }
  return [...missing].sort();
}
