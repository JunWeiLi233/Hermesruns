#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const javaPackage = 'com.hermes.backend';
const rootTypes = new Set(['BackendApplication', 'StartupPhaseDiagnosticsLogger']);
const scriptExtension = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const declarationFile = /\.d\.[cm]?ts$/;
const extensions = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.cjs', '.cts', '.json'];
const portable = (file) => file.split(path.sep).join('/');
const relative = (root, file) => portable(path.relative(root, file));

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
  }).sort();
}

export function loadFrontendParser(rootDir = repositoryRoot) {
  return createRequire(path.join(rootDir, 'frontend/package.json'))('@babel/parser');
}

export function isTestOnly(file) {
  return /(?:^|\/)(?:test|tests|__tests__|__mocks__|__fixtures__|fixtures)\//.test(file)
    || /(?:^|\.)(?:test|spec|vitest)\.[cm]?[jt]sx?$/.test(file)
    || /(?:^|\/)(?:testUtils|testHelpers|test-utils|test-helpers)\.[cm]?[jt]sx?$/.test(file)
    || file === 'i18n/translations.js'; // Existing synchronous test/tooling locale shim.
}

export function stronglyConnectedComponents(graph) {
  let index = 0;
  const indices = new Map(), low = new Map(), stack = [], active = new Set(), result = [];
  function visit(node) {
    indices.set(node, index);
    low.set(node, index++);
    stack.push(node);
    active.add(node);
    for (const target of graph.get(node) || []) {
      if (!graph.has(target)) continue;
      if (!indices.has(target)) {
        visit(target);
        low.set(node, Math.min(low.get(node), low.get(target)));
      } else if (active.has(target)) low.set(node, Math.min(low.get(node), indices.get(target)));
    }
    if (low.get(node) !== indices.get(node)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      active.delete(member);
      component.push(member);
    } while (member !== node);
    if (component.length > 1 || graph.get(node)?.has(node)) result.push(component.sort());
  }
  for (const node of [...graph.keys()].sort()) if (!indices.has(node)) visit(node);
  return result;
}

function inspectJava(rootDir, report) {
  const sourceRoot = path.join(rootDir, 'backend/src/main/java');
  const files = walk(sourceRoot).filter((file) => file.endsWith('.java'));
  if (!files.length) throw new Error('No backend Java sources found.');
  const types = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const code = source.replace(/"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,
      (text) => text.replace(/[^\r\n]/g, ' '));
    if (path.basename(file) === 'module-info.java') continue;
    const expected = relative(sourceRoot, path.dirname(file)).replaceAll('/', '.');
    const declared = code.match(/\bpackage\s+([\w.]+)\s*;/)?.[1];
    if (declared !== expected) report.errors.push({ code: 'JAVA_PACKAGE', file: relative(rootDir, file), message: `Expected package ${expected}; found ${declared || '(missing)'}.` });
    let depth = 0;
    for (const match of code.matchAll(/[{}]|\b(?:class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/g)) {
      if (match[0] === '{') depth++;
      else if (match[0] === '}') depth--;
      else if (depth === 0) {
        const name = `${declared || expected}.${match[1]}`;
        if (types.has(name)) report.errors.push({ code: 'JAVA_DUPLICATE', file: relative(rootDir, file), message: `Duplicate source type ${name}.` });
        types.set(name, file);
        if (expected === javaPackage && !rootTypes.has(match[1])) report.errors.push({ code: 'JAVA_ROOT_TYPE', file: relative(rootDir, file), message: `Move product type ${match[1]} into a domain package.` });
      }
    }
  }
  report.java = { files: files.length, types: types.size };
  return { sourceRoot, files, types };
}

function literal(node) {
  if (node?.type === 'StringLiteral') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

function importReferences(ast) {
  const references = [];
  function add(node, source, typeOnly = false, dynamic = false) {
    references.push({ specifier: literal(source), typeOnly, dynamic, line: node.loc?.start.line });
  }
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ImportDeclaration') add(node, node.source, node.importKind === 'type'
      || (node.specifiers.length > 0 && node.specifiers.every((item) => item.importKind === 'type')));
    else if ((node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source) add(node, node.source, node.exportKind === 'type'
      || (node.specifiers?.length > 0 && node.specifiers.every((item) => item.exportKind === 'type')));
    else if (node.type === 'TSImportEqualsDeclaration' && node.moduleReference.type === 'TSExternalModuleReference') add(node, node.moduleReference.expression, node.importKind === 'type');
    else if (node.type === 'TSImportType') add(node, node.argument, true);
    else if (node.type === 'ImportExpression') add(node, node.source, false, true);
    else if (node.type === 'CallExpression' && node.callee.type === 'Import') add(node, node.arguments[0], false, true);
    else if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') add(node, node.arguments[0]);
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'comments', 'tokens', 'extra'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast.program);
  return references;
}

function resolveImport(importer, specifier, typeOnly) {
  const clean = specifier.split(/[?#]/)[0];
  const target = path.resolve(path.dirname(importer), clean);
  const candidates = [target];
  if (!path.extname(target)) candidates.push(...extensions.map((extension) => target + extension));
  if (/\.[cm]?tsx?$/.test(importer)) {
    const replacements = { '.js': ['.ts', '.tsx'], '.jsx': ['.tsx'], '.mjs': ['.mts'], '.cjs': ['.cts'] };
    for (const extension of replacements[path.extname(target)] || []) candidates.push(target.slice(0, -path.extname(target).length) + extension);
  }
  candidates.push(...extensions.map((extension) => path.join(target, `index${extension}`)));
  if (typeOnly) candidates.push(target + '.d.ts', path.join(target, 'index.d.ts'));
  return candidates.find((file) => {
    try { return fs.statSync(file).isFile(); } catch { return false; }
  });
}

function inspectFrontend(rootDir, report, parser) {
  const sourceRoot = path.join(rootDir, 'frontend/src');
  const scripts = walk(sourceRoot).filter((file) => scriptExtension.test(file));
  const queue = scripts.filter((file) => !isTestOnly(relative(sourceRoot, file)));
  if (!queue.length) throw new Error('No non-test frontend modules found.');
  const queued = new Set(queue), graph = new Map();
  let staticEdges = 0, dynamicImports = 0, typeImports = 0, computedImports = 0;
  for (const file of queue) {
    const label = relative(rootDir, file), local = relative(sourceRoot, file);
    if (/^pages\/[^/]+\.[cm]?[jt]sx?$/.test(local)) {
      report.errors.push({ code: 'FRONTEND_ROUTE_LOCATION', file: label,
        message: 'Put route code and private helpers in pages/<feature>/; keep feature tests in __tests__/.' });
    }
    const declaration = declarationFile.test(file);
    if (!declaration) graph.set(file, new Set());
    let ast;
    try {
      ast = parser.parse(fs.readFileSync(file, 'utf8'), {
        sourceType: 'unambiguous', createImportExpressions: true,
        plugins: ['jsx', ...(/\.[cm]?tsx?$/.test(file) ? [['typescript', { dts: declaration }]] : [])],
      });
    } catch (error) {
      report.errors.push({ code: 'FRONTEND_PARSE', file: label, line: error.loc?.line, message: error.message });
      continue;
    }
    for (const reference of importReferences(ast)) {
      if (reference.dynamic) dynamicImports++;
      if (reference.typeOnly) typeImports++;
      if (reference.specifier === null) { computedImports++; continue; }
      if (!/^\.\.?\//.test(reference.specifier)) continue;
      const target = resolveImport(file, reference.specifier, reference.typeOnly || declaration);
      if (!target) {
        report.errors.push({ code: 'FRONTEND_IMPORT', file: label, line: reference.line, message: `Unresolved relative import ${reference.specifier}.` });
        continue;
      }
      if (!reference.dynamic && /^(?:(?:contexts|hooks|api|contracts|components|utils)\/|api\.[cm]?[jt]sx?$)/.test(local)
          && relative(sourceRoot, target).startsWith('pages/')) {
        report.errors.push({ code: 'FRONTEND_LAYER', file: label, line: reference.line, message: `Shared module statically imports page ${relative(sourceRoot, target)}.` });
      }
      const assetQuery = /[?&](?:raw|url|worker)(?:[&#]|$)/.test(reference.specifier);
      if (declaration || reference.typeOnly || reference.dynamic || assetQuery || !scriptExtension.test(target) || declarationFile.test(target)) continue;
      if (isTestOnly(relative(sourceRoot, target))) {
        report.errors.push({ code: 'FRONTEND_TEST_DEPENDENCY', file: label, line: reference.line, message: `Runtime import reaches test-only module ${relative(sourceRoot, target)}.` });
        continue;
      }
      graph.get(file).add(target);
      staticEdges++;
      if (!queued.has(target)) { queued.add(target); queue.push(target); }
    }
  }
  for (const cycle of stronglyConnectedComponents(graph)) report.errors.push({ code: 'FRONTEND_CYCLE', file: relative(rootDir, cycle[0]), message: `Static runtime SCC: ${cycle.map((file) => relative(sourceRoot, file)).join(', ')}.` });
  report.frontend = { files: queue.length, excludedTestFiles: scripts.length - scripts.filter((file) => !isTestOnly(relative(sourceRoot, file))).length, staticEdges, dynamicImports, typeImports, computedImports };
}

// Only class identity and class-level annotation attributes are needed; no code is executed.
export function readClassMetadata(buffer) {
  let offset = 0;
  function take(length) {
    const start = offset;
    offset += length;
    if (offset > buffer.length) throw new Error('Truncated class file.');
    return start;
  }
  const u1 = () => buffer.readUInt8(take(1));
  const u2 = () => buffer.readUInt16BE(take(2));
  const u4 = () => buffer.readUInt32BE(take(4));
  if (u4() !== 0xcafebabe) throw new Error('Invalid class file magic.');
  take(4);
  const pool = new Array(u2());
  for (let index = 1; index < pool.length; index++) {
    const tag = u1();
    if (tag === 1) { const length = u2(); pool[index] = buffer.toString('utf8', take(length), offset); }
    else if (tag === 7) pool[index] = { nameIndex: u2() };
    else if ([3, 4, 9, 10, 11, 12, 17, 18].includes(tag)) take(4);
    else if ([5, 6].includes(tag)) { take(8); index++; }
    else if ([8, 16, 19, 20].includes(tag)) take(2);
    else if (tag === 15) take(3);
    else throw new Error(`Unknown constant-pool tag ${tag}.`);
  }
  take(2);
  const name = pool[pool[u2()]?.nameIndex]?.replaceAll('/', '.');
  if (!name) throw new Error('Class identity is missing.');
  take(2);
  take(u2() * 2);
  for (let section = 0; section < 2; section++) {
    const count = u2();
    for (let index = 0; index < count; index++) {
      take(6);
      const attributes = u2();
      for (let attr = 0; attr < attributes; attr++) { take(2); take(u4()); }
    }
  }
  const annotations = new Set();
  function annotation(collect) {
    const type = pool[u2()];
    if (collect) annotations.add(type);
    const pairs = u2();
    for (let pair = 0; pair < pairs; pair++) { take(2); element(); }
  }
  function element() {
    const tag = String.fromCharCode(u1());
    if ('BCDFIJSZsc'.includes(tag)) take(2);
    else if (tag === 'e') take(4);
    else if (tag === '@') annotation(false);
    else if (tag === '[') { const count = u2(); for (let index = 0; index < count; index++) element(); }
    else throw new Error(`Unknown annotation value tag ${tag}.`);
  }
  const attributes = u2();
  for (let attr = 0; attr < attributes; attr++) {
    const attribute = pool[u2()], length = u4(), end = offset + length;
    if (end > buffer.length) throw new Error('Truncated class attribute.');
    if (['RuntimeVisibleAnnotations', 'RuntimeInvisibleAnnotations'].includes(attribute)) {
      const count = u2();
      for (let index = 0; index < count; index++) annotation(true);
      if (offset !== end) throw new Error('Invalid annotation attribute length.');
    }
    offset = end;
  }
  return { name, annotations };
}

function jdkTool(name) {
  const executable = name + (process.platform === 'win32' ? '.exe' : '');
  const candidate = process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, 'bin', executable);
  return candidate && fs.existsSync(candidate) ? candidate : executable;
}

function inspectCompiled(rootDir, classesDir, sources, report, runJdeps) {
  const directory = path.resolve(rootDir, classesDir);
  const files = walk(directory).filter((file) => file.endsWith('.class'));
  const metadata = new Map(), outerClasses = new Map();
  const initialErrors = report.errors.length;
  if (!files.length) throw new Error(`No class files in ${directory}.`);
  for (const file of files) {
    try {
      const item = readClassMetadata(fs.readFileSync(file));
      if (relative(directory, file) !== `${item.name.replaceAll('.', '/')}.class`) throw new Error(`Binary identity ${item.name} does not match its class path.`);
      const outer = item.name.split('$')[0];
      if (outer === 'module-info' || outer.endsWith('.package-info')) {
        if (!fs.existsSync(path.join(sources.sourceRoot, relative(directory, file).replace(/\.class$/, '.java')))) throw new Error(`Metadata class ${outer} has no current source path.`);
        continue;
      }
      if (!sources.types.has(outer)) throw new Error(`Stale class ${item.name}: no matching current source type.`);
      metadata.set(item.name, item);
      if (item.name === outer) outerClasses.set(outer, item);
    } catch (error) {
      report.errors.push({ code: 'COMPILED_PATH', file: relative(rootDir, file), message: error.message });
    }
  }
  for (const [name, source] of sources.types) if (!outerClasses.has(name)) report.errors.push({ code: 'COMPILED_MISSING', file: relative(rootDir, source), message: `Missing current compiled outer class ${name}; rebuild the supplied class directory.` });
  if (report.errors.length !== initialErrors) return;
  const result = runJdeps(jdkTool('jdeps'), ['--ignore-missing-deps', '-verbose:class', '-filter:none', directory], {
    cwd: rootDir, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.signal || result.status !== 0) throw new Error(`jdeps failed: ${result.error?.message || result.signal || result.stderr || `exit ${result.status}`}`);
  const graph = new Map([...outerClasses.keys()].map((name) => [name, new Set()]));
  const seen = new Set();
  for (const line of String(result.stdout).split(/\r?\n/)) {
    const match = line.match(/^\s*(\S+)\s+->\s+(\S+)/);
    if (!match || !metadata.has(match[1])) continue;
    seen.add(match[1]);
    const from = match[1].split('$')[0], to = match[2].split('$')[0];
    if (to.startsWith(`${javaPackage}.`) && !graph.has(to)) {
      report.errors.push({ code: 'COMPILED_REFERENCE', file: relative(rootDir, sources.types.get(from)), message: `Compiled ${from} still references ${to}, which has no current compiled/source type.` });
    }
    if (from !== to && graph.has(to)) graph.get(from).add(to);
  }
  const unseen = [...metadata.keys()].filter((name) => !seen.has(name));
  if (unseen.length) throw new Error(`jdeps did not emit class-level evidence for: ${unseen.join(', ')}.`);
  if (report.errors.length !== initialErrors) return;
  const allowedJpaCycles = [];
  for (const cycle of stronglyConnectedComponents(graph)) {
    const persistenceOnly = cycle.every((name) => [...outerClasses.get(name).annotations]
      .some((annotation) => /^L(?:jakarta|javax)\/persistence\/(?:Entity|MappedSuperclass);$/.test(annotation)));
    if (persistenceOnly) allowedJpaCycles.push(cycle);
    else report.errors.push({ code: 'COMPILED_CYCLE', file: relative(rootDir, sources.types.get(cycle[0])), message: `Compiled class SCC (not entirely JPA entities/mapped superclasses): ${cycle.join(', ')}.` });
  }
  report.compiled = { requested: true, verified: true, directory, classes: metadata.size, edges: [...graph.values()].reduce((count, targets) => count + targets.size, 0), allowedJpaCycles };
}

export function checkArchitecture({ rootDir = repositoryRoot, classesDir, parser, runJdeps = spawnSync } = {}) {
  rootDir = path.resolve(rootDir);
  const report = { errors: [], java: null, frontend: null, compiled: { requested: Boolean(classesDir), verified: false } };
  let sources;
  try { sources = inspectJava(rootDir, report); }
  catch (error) { report.errors.push({ code: 'JAVA_SCAN', message: error.message }); }
  try { inspectFrontend(rootDir, report, parser || loadFrontendParser(rootDir)); }
  catch (error) { report.errors.push({ code: 'FRONTEND_SCAN', message: error.message }); }
  if (classesDir && sources) {
    try { inspectCompiled(rootDir, classesDir, sources, report, runJdeps); }
    catch (error) { report.errors.push({ code: 'COMPILED_SCAN', message: error.message }); }
  }
  return report;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--classes' || !args[1])) {
    console.error('Usage: node tools/check-architecture.mjs [--classes DIR]');
    process.exitCode = 1;
    return;
  }
  const report = checkArchitecture({ classesDir: args[1] });
  for (const error of report.errors) console.error(`[architecture] ${error.code} ${error.file || ''}${error.line ? `:${error.line}` : ''}: ${error.message}`);
  console.log(`[architecture] Source: ${report.java?.files ?? 0} Java files; ${report.frontend?.files ?? 0} frontend modules; ${report.frontend?.staticEdges ?? 0} static runtime imports.`);
  if (report.compiled.verified) {
    console.log(`[architecture] Compiled jdeps: ${report.compiled.classes} class files, ${report.compiled.edges} outer-class edges; ${report.compiled.allowedJpaCycles.length} JPA-only SCCs allowed.`);
    for (const cycle of report.compiled.allowedJpaCycles) console.log(`[architecture] JPA-only SCC: ${cycle.join(', ')}`);
  } else console.log(`[architecture] Compiled graph ${report.compiled.requested ? 'NOT verified (see errors)' : 'not checked; source-only result (supply --classes DIR)'}.`);
  console.log(`[architecture] ${report.errors.length} violation(s).`);
  process.exitCode = report.errors.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
