import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, before, after } from 'node:test';
import { checkArchitecture, loadFrontendParser, readClassMetadata } from './check-architecture.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parser = loadFrontendParser(repositoryRoot);
const sourcePrefix = 'backend/src/main/java/';
const application = `${sourcePrefix}com/hermes/backend/BackendApplication.java`;
const roots = [];

function write(root, file, content) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}

function fixture(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-architecture-'));
  roots.push(root);
  for (const [file, content] of Object.entries({
    [application]: 'package com.hermes.backend; public class BackendApplication {}',
    'frontend/package.json': '{}',
    'frontend/src/main.js': 'export const ready = true;',
    ...files,
  })) write(root, file, content);
  return root;
}

after(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

const check = (rootDir, options = {}) => checkArchitecture({ rootDir, parser, ...options });
const codes = (report) => report.errors.map((error) => error.code);

test('source checks accept JSX/TS, type-only cycles, assets, index resolution, and dynamic routes', () => {
  const root = fixture({
    'frontend/src/main.js': "import './components/Card.jsx'; import './types/a.ts';",
    'frontend/src/components/Card.jsx': "import { load } from '../utils/routePreload.js'; import icon from '../icon.svg?url'; export default () => <button onClick={load}>{icon}</button>;",
    'frontend/src/utils/routePreload.js': "export const load = () => import('../pages/example/Route.jsx');",
    'frontend/src/pages/example/Route.jsx': "import Card from '../../components/Card.jsx'; export default Card;",
    'frontend/src/types/a.ts': "import type { B } from './b'; export type A = { b?: B };",
    'frontend/src/types/b.ts': "export type { A } from './a'; export type B = { ok: boolean };",
    'frontend/src/types/star.ts': "export type * from './a';",
    'frontend/src/types/c.ts': "import { type A } from './a'; import type { D } from './decl'; export type C = A & D;",
    'frontend/src/types/decl.d.ts': "import type { C } from './c'; export interface D { nested?: C }",
    'frontend/src/icon.svg': '<svg/>',
    'frontend/src/utils/index.js': "export { value } from './value';",
    'frontend/src/utils/value.ts': 'export const value = 1;',
    // JS output specifiers in TypeScript use the TypeScript source during bundling.
    'frontend/src/indexConsumer.ts': "import { value } from './utils/value.js'; export { value };",
    'frontend/src/directoryConsumer.js': "import { value } from './utils'; export { value };",
  });
  const report = check(root);
  assert.deepEqual(report.errors, []);
  assert.equal(report.compiled.verified, false);
  assert.equal(report.compiled.requested, false);
  assert.ok(report.frontend.typeImports >= 4);
  assert.equal(report.frontend.dynamicImports, 1);
});

test('Babel sees real imports and re-exports, not comments or strings', () => {
  const root = fixture({
    'frontend/src/main.js': "// import './missing.js';\nconst example = \"import './also-missing.js'\"; export { b } from './b.js';",
    'frontend/src/b.js': "export * from './c.js'; export const b = true;",
    'frontend/src/c.js': "import './main.js'; export {};",
  });
  const report = check(root);
  assert.equal(codes(report).filter((code) => code === 'FRONTEND_CYCLE').length, 1);
  assert.ok(!codes(report).includes('FRONTEND_IMPORT'));
  assert.match(report.errors[0].message, /main\.js/);
});

test('mixed type/value imports, require calls, and self imports create runtime cycles', () => {
  const root = fixture({
    'frontend/src/a.ts': "import { type T, b } from './b'; export const a = b;",
    'frontend/src/b.ts': "import { a } from './a'; export type T = number; export const b = a;",
    'frontend/src/one.cjs': "module.exports = require('./two.cjs');",
    'frontend/src/two.cjs': "module.exports = require('./one.cjs');",
    'frontend/src/self.js': "import './self.js';",
  });
  assert.equal(codes(check(root)).filter((code) => code === 'FRONTEND_CYCLE').length, 3);
});

test('unresolved static, dynamic, type-only, and asset imports fail', () => {
  const root = fixture({
    'frontend/src/main.js': "import './missing.js'; import './missing.svg?url'; const p = import('./missing-page.jsx');",
    'frontend/src/types.ts': "import type { T } from './absent'; export type X = T;",
  });
  assert.equal(codes(check(root)).filter((code) => code === 'FRONTEND_IMPORT').length, 4);
});

test('shared layers cannot statically import pages, including re-exports and types', () => {
  const files = { 'frontend/src/pages/Screen.ts': 'export type T = string; export const value = 1;' };
  for (const directory of ['contexts', 'hooks', 'api', 'contracts', 'components', 'utils']) files[`frontend/src/${directory}/bad.ts`] = "export { value } from '../pages/Screen';";
  files['frontend/src/api.ts'] = "import type { T } from './pages/Screen'; export type X = T;";
  assert.equal(codes(check(fixture(files))).filter((code) => code === 'FRONTEND_LAYER').length, 7);
});

test('tests and test-only helpers are excluded without hiding runtime imports of them', () => {
  const root = fixture({
    'frontend/src/a.test.js': "import './missing.js'; invalid syntax [",
    'frontend/src/b.vitest.ts': "import './missing';",
    'frontend/src/test/setup.js': "import '../missing';",
    'frontend/src/__fixtures__/helper.ts': 'invalid syntax [',
    'frontend/src/testUtils.ts': 'invalid syntax [',
    'frontend/src/i18n/translations.js': "import './not-runtime.js';",
  });
  assert.deepEqual(check(root).errors, []);
  write(root, 'frontend/src/main.js', "import './i18n/translations.js';");
  assert.ok(codes(check(root)).includes('FRONTEND_TEST_DEPENDENCY'));
});

test('package/path mismatches, missing packages, and extra root types fail', () => {
  const root = fixture({
    [`${sourcePrefix}com/hermes/backend/Extra.java`]: 'package com.hermes.backend; public class Extra {}',
    [`${sourcePrefix}com/hermes/backend/StartupPhaseDiagnosticsLogger.java`]: 'package com.hermes.backend; class StartupPhaseDiagnosticsLogger {} class HiddenProduct {}',
    [`${sourcePrefix}com/hermes/backend/domain/Wrong.java`]: 'package com.hermes.backend.old; class Wrong {}',
    [`${sourcePrefix}com/hermes/backend/domain/Missing.java`]: '// package com.hermes.backend.domain;\nclass Missing {}',
  });
  const result = codes(check(root));
  assert.equal(result.filter((code) => code === 'JAVA_PACKAGE').length, 2);
  assert.equal(result.filter((code) => code === 'JAVA_ROOT_TYPE').length, 2);
});

test('flat page implementations are rejected while feature folders and tests remain valid', () => {
  const root = fixture({
    'frontend/src/pages/UnsortedPage.jsx': 'export default function UnsortedPage() { return null; }',
    'frontend/src/pages/runs/RunDetail.jsx': 'export default function RunDetail() { return null; }',
    'frontend/src/pages/runs/__tests__/detail.test.js': 'test-only source is outside the runtime graph',
  });
  assert.deepEqual(codes(check(root)), ['FRONTEND_ROUTE_LOCATION']);
});

test('parse errors and missing source directories fail closed', () => {
  const root = fixture({ 'frontend/src/main.js': 'export const =' });
  assert.ok(codes(check(root)).includes('FRONTEND_PARSE'));
  const absent = path.join(root, 'missing');
  assert.deepEqual(codes(check(absent)).sort(), ['FRONTEND_SCAN', 'JAVA_SCAN']);
});

function runJdk(command, args) {
  const executable = command + (process.platform === 'win32' ? '.exe' : '');
  const configured = process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, 'bin', executable);
  const result = spawnSync(configured && fs.existsSync(configured) ? configured : executable, args, { encoding: 'utf8', timeout: 60000, windowsHide: true });
  assert.equal(result.status, 0, `${command} fixture setup failed: ${result.error?.message || result.stderr}`);
  return result;
}

let compiledFixture;
before(() => {
  compiledFixture = fixture({
    [`${sourcePrefix}jakarta/persistence/Entity.java`]: 'package jakarta.persistence; import java.lang.annotation.*; @Retention(RetentionPolicy.RUNTIME) public @interface Entity {}',
    [`${sourcePrefix}jakarta/persistence/MappedSuperclass.java`]: 'package jakarta.persistence; import java.lang.annotation.*; @Retention(RetentionPolicy.RUNTIME) public @interface MappedSuperclass {}',
    [`${sourcePrefix}com/hermes/backend/service/A.java`]: 'package com.hermes.backend.service; public class A { B b; public static class Nested {} }',
    [`${sourcePrefix}com/hermes/backend/service/B.java`]: 'package com.hermes.backend.service; public class B { A.Nested a; }',
    [`${sourcePrefix}com/hermes/backend/entity/A.java`]: 'package com.hermes.backend.entity; @jakarta.persistence.Entity public class A { B b; }',
    [`${sourcePrefix}com/hermes/backend/entity/B.java`]: 'package com.hermes.backend.entity; @jakarta.persistence.Entity public class B { A a; }',
    [`${sourcePrefix}com/hermes/backend/mapped/Base.java`]: 'package com.hermes.backend.mapped; @jakarta.persistence.MappedSuperclass public class Base { Child child; }',
    [`${sourcePrefix}com/hermes/backend/mapped/Child.java`]: 'package com.hermes.backend.mapped; @jakarta.persistence.Entity public class Child extends Base {}',
    [`${sourcePrefix}com/hermes/backend/mixed/A.java`]: 'package com.hermes.backend.mixed; @jakarta.persistence.Entity public class A { B b; }',
    [`${sourcePrefix}com/hermes/backend/mixed/B.java`]: 'package com.hermes.backend.mixed; /* @jakarta.persistence.Entity */ public class B { A a; @jakarta.persistence.Entity static class Nested {} }',
  });
  const javaFiles = fs.readdirSync(path.join(compiledFixture, sourcePrefix), { recursive: true }).filter((file) => file.endsWith('.java')).map((file) => path.join(compiledFixture, sourcePrefix, file));
  runJdk('javac', ['-d', path.join(compiledFixture, 'classes'), ...javaFiles]);
});

function compiledCopy() {
  const root = fixture();
  fs.cpSync(compiledFixture, root, { recursive: true });
  return root;
}

test('actual jdeps finds service/nested-type cycles and permits only annotated JPA SCCs', () => {
  const report = check(compiledFixture, { classesDir: 'classes' });
  assert.equal(report.compiled.verified, true, JSON.stringify(report.errors));
  assert.equal(report.compiled.allowedJpaCycles.length, 2);
  const cycles = report.errors.filter((error) => error.code === 'COMPILED_CYCLE');
  assert.equal(cycles.length, 2);
  assert.ok(cycles.some((error) => /service\.A, com\.hermes\.backend\.service\.B/.test(error.message)));
  assert.ok(cycles.some((error) => /mixed\.A, com\.hermes\.backend\.mixed\.B/.test(error.message)));
  assert.ok(cycles.every((error) => !error.message.includes('$')));
});

test('class metadata uses compiled class annotations, not nested annotations or source comments', () => {
  const read = (name) => readClassMetadata(fs.readFileSync(path.join(compiledFixture, 'classes', name)));
  assert.ok(read('com/hermes/backend/entity/A.class').annotations.has('Ljakarta/persistence/Entity;'));
  assert.equal(read('com/hermes/backend/mixed/B.class').annotations.size, 0);
  assert.ok(read('com/hermes/backend/mixed/B$Nested.class').annotations.has('Ljakarta/persistence/Entity;'));
});

test('stale flat-package class output is rejected before jdeps can claim proof', () => {
  const root = compiledCopy();
  fs.renameSync(path.join(root, application), path.join(root, sourcePrefix, 'com/hermes/backend/service/BackendApplication.java'));
  write(root, `${sourcePrefix}com/hermes/backend/service/BackendApplication.java`, 'package com.hermes.backend.service; public class BackendApplication {}');
  let calls = 0;
  const report = check(root, { classesDir: 'classes', runJdeps() { calls++; assert.fail('jdeps must not run on stale output'); } });
  assert.equal(calls, 0);
  assert.ok(codes(report).includes('COMPILED_PATH'));
  assert.ok(codes(report).includes('COMPILED_MISSING'));
  assert.equal(report.compiled.verified, false);
});

test('missing classes, wrong binary paths, and invalid class files fail closed', () => {
  const root = compiledCopy();
  fs.unlinkSync(path.join(root, 'classes/com/hermes/backend/entity/A.class'));
  fs.copyFileSync(path.join(root, 'classes/com/hermes/backend/entity/B.class'), path.join(root, 'classes/com/hermes/backend/entity/Wrong.class'));
  write(root, 'classes/Broken.class', 'not bytecode');
  const report = check(root, { classesDir: 'classes', runJdeps() { assert.fail('must not run'); } });
  assert.ok(codes(report).includes('COMPILED_MISSING'));
  assert.equal(codes(report).filter((code) => code === 'COMPILED_PATH').length, 2);
  assert.equal(report.compiled.verified, false);
});

test('jdeps errors or empty output cannot be presented as compiled proof', () => {
  for (const outcome of [{ status: 1, stderr: 'analysis failed' }, { status: 0, stdout: '' }, { error: new Error('missing jdeps') }]) {
    const report = check(compiledFixture, { classesDir: 'classes', runJdeps(command, args) {
      assert.match(command, /jdeps(?:\.exe)?$/);
      assert.ok(args.includes('--ignore-missing-deps'));
      assert.ok(args.includes('-verbose:class'));
      assert.ok(args.includes('-filter:none'));
      return outcome;
    } });
    assert.ok(codes(report).includes('COMPILED_SCAN'));
    assert.equal(report.compiled.verified, false);
  }
});

test('missing external libraries are ignored by the real jdeps invocation', () => {
  const root = fixture({
    [`${sourcePrefix}com/hermes/backend/domain/UsesExternal.java`]: 'package com.hermes.backend.domain; public class UsesExternal { public external.Dependency dependency; }',
  });
  const dependency = write(root, 'dependency/external/Dependency.java', 'package external; public class Dependency {}');
  runJdk('javac', ['-d', path.join(root, 'classes'), dependency, path.join(root, application), path.join(root, sourcePrefix, 'com/hermes/backend/domain/UsesExternal.java')]);
  fs.unlinkSync(path.join(root, 'classes/external/Dependency.class'));
  const report = check(root, { classesDir: 'classes' });
  assert.deepEqual(report.errors, []);
  assert.equal(report.compiled.verified, true);
});

test('old internal package references are stale output, not ignorable external libraries', () => {
  const legacyFile = `${sourcePrefix}com/hermes/backend/Legacy.java`;
  const callerFile = `${sourcePrefix}com/hermes/backend/domain/Caller.java`;
  const root = fixture({
    [legacyFile]: 'package com.hermes.backend; public class Legacy {}',
    [callerFile]: 'package com.hermes.backend.domain; public class Caller { com.hermes.backend.Legacy dependency; }',
  });
  runJdk('javac', ['-d', path.join(root, 'classes'), path.join(root, application), path.join(root, legacyFile), path.join(root, callerFile)]);
  fs.unlinkSync(path.join(root, legacyFile));
  fs.unlinkSync(path.join(root, 'classes/com/hermes/backend/Legacy.class'));
  const moved = write(root, `${sourcePrefix}com/hermes/backend/domain/Legacy.java`, 'package com.hermes.backend.domain; public class Legacy {}');
  write(root, callerFile, 'package com.hermes.backend.domain; public class Caller { Legacy dependency; }');
  // Leave Caller.class untouched to simulate an incomplete incremental rebuild.
  runJdk('javac', ['-d', path.join(root, 'classes'), moved]);
  const report = check(root, { classesDir: 'classes' });
  assert.deepEqual(codes(report), ['COMPILED_REFERENCE']);
  assert.equal(report.compiled.verified, false);
});
