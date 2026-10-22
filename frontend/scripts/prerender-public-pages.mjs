import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));
const pages = [['/', 'home'], ['/terms', 'terms'], ['/privacy', 'privacy']];
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function assertPublicClientBoundary(manifest) {
  if (!manifest['public.html']) throw new Error('Public client entry missing from manifest');
  const visited = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Public client dependency missing: ${key}`);
    if (key === 'index.html' || /(?:^|\/)i18n-(?:en|zh-CN)-/.test(chunk.file)) {
      throw new Error(`Private application dependency in public client: ${key}`);
    }
    for (const dependency of [...(chunk.imports || []), ...(chunk.dynamicImports || [])]) visit(dependency);
  }
  visit('public.html');
}

export function renderPublicDocument(template, { content, metadata }, styles = []) {
  const meta = (attribute, key, value) => `<meta ${attribute}="${key}" content="${escape(value)}" />`;
  const head = [
    `<title>${escape(metadata.title)}</title>`,
    `<link rel="canonical" href="${escape(metadata.canonicalUrl)}" />`,
    meta('name', 'description', metadata.description), meta('name', 'robots', metadata.robots),
    meta('name', 'author', 'HermesRuns'), meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', 'HermesRuns'), meta('property', 'og:url', metadata.url),
    meta('property', 'og:title', metadata.title), meta('property', 'og:description', metadata.description),
    meta('property', 'og:locale', metadata.locale), meta('property', 'og:image', 'https://hermesruns.com/og-image.png'),
    meta('property', 'og:image:alt', metadata.imageAlt), meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', metadata.title), meta('name', 'twitter:description', metadata.description),
    meta('name', 'twitter:url', metadata.url), meta('name', 'twitter:image', 'https://hermesruns.com/og-image.png'),
    meta('name', 'twitter:image:alt', metadata.imageAlt),
    `<script id="hermes-seo-jsonld" type="application/ld+json">${JSON.stringify(metadata.structuredData).replace(/</g, '\\u003c')}</script>`,
    ...styles.map((file) => `<link rel="stylesheet" href="/${escape(file)}" />`),
  ].join('\n');
  return template.replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta\b[^>]*name="robots"[^>]*>/, '')
    .replace('</head>', `${head}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${content}</div>`);
}

export async function prerenderPublicPages(outputDir) {
  const template = await fs.readFile(path.join(outputDir, 'public.html'), 'utf8');
  const manifest = JSON.parse(await fs.readFile(path.join(outputDir, 'public-page-assets.json'), 'utf8'));
  assertPublicClientBoundary(manifest);
  const server = await createServer({
    configFile: false, root: frontendRoot, plugins: [react()], appType: 'custom', logLevel: 'error',
    server: { middlewareMode: true, watch: null, hmr: false },
  });
  try {
    const { renderPublicPage } = await server.ssrLoadModule('/src/publicPageEntry.jsx');
    await fs.mkdir(path.join(outputDir, 'public-pages'), { recursive: true });
    for (const [route, name] of pages) {
      const styles = route === '/' ? [] : manifest['src/pages/legal/LegalPage.jsx']?.css;
      if (route !== '/' && !styles?.length) throw new Error('Legal route stylesheet missing from client manifest');
      let html = renderPublicDocument(template, renderPublicPage(route), styles);
      for (const [source, asset] of Object.entries(manifest)) {
        if (source.startsWith('src/')) html = html.replaceAll(`/${source}`, `/${asset.file}`);
      }
      if (/\/src\//.test(html)) throw new Error(`Unresolved public page assets: ${route}`);
      for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)) {
        await fs.access(path.join(outputDir, match[1]));
      }
      await fs.writeFile(path.join(outputDir, 'public-pages', `${name}.html`), html);
    }
    // The helper template is a build input, not a fourth public route.
    await fs.unlink(path.join(outputDir, 'public.html'));
  } finally {
    await server.close();
  }
  console.log('[frontend] Prerendered home, terms and privacy from the public React components.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await prerenderPublicPages(path.resolve(process.argv[2]));
}
