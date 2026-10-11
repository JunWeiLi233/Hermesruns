// A second throwaway stack beside the suite's own, for a test that needs the app configured another way (see tools/stack.mjs).
//
//   const strict = await startStack({ name: 'strict', port: 18082, env: { APP_TRUSTED_PROXIES: 'none' } });
//   ... new Api(strict.baseUrl) ...
//   await strict.stop();
//
// It is a real Spring Boot process with a database of its own, so it takes a while to start (the first request waits for it): start it
// once per spec file, in a beforeAll, and stop it in an afterAll.
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const tool = path.resolve(import.meta.dirname, '..', 'tools', 'stack.mjs');

export interface NamedStack {
  baseUrl: string;
  stop(): Promise<void>;
}

export async function startStack(options: { name: string; port: number; env?: Record<string, string> }): Promise<NamedStack> {
  const env = { ...process.env, E2E_STACK_NAME: options.name, E2E_PORT: String(options.port), ...(options.env ?? {}) };
  // A stack left over from an interrupted run would answer with whatever settings it had.
  await run(process.execPath, [tool, 'stop'], { env }).catch(() => undefined);
  await run(process.execPath, [tool, 'start'], { env, timeout: 300_000 });
  return {
    baseUrl: `http://127.0.0.1:${options.port}`,
    stop: async () => {
      await run(process.execPath, [tool, 'stop'], { env }).catch(() => undefined);
    },
  };
}
