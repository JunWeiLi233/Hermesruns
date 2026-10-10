// Small API client for the e2e suite: sign in, sign up, import a GPX file, call any route.
// Specs use it to arrange data and to check what the UI did, never to replace the UI step under test.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface StackState {
  baseUrl: string;
  runnerEmail: string;
  runnerPassword: string;
}

export interface ApiResult<T = any> {
  status: number;
  ok: boolean;
  json: T;
  headers: Headers;
}

const stateFile = path.resolve(import.meta.dirname, '..', '.auth', 'stack.json');

/** Where the stack is and who the seeded runner is: environment first, then the file stack.mjs wrote. */
export function stackState(): StackState {
  const baseUrl = process.env.E2E_BASE_URL;
  if (baseUrl) {
    const runnerEmail = process.env.E2E_RUNNER_EMAIL;
    const runnerPassword = process.env.E2E_RUNNER_PASSWORD;
    if (!runnerEmail || !runnerPassword) {
      throw new Error('E2E_BASE_URL needs E2E_RUNNER_EMAIL and E2E_RUNNER_PASSWORD (a runner the suite may fill with test runs)');
    }
    return { baseUrl: baseUrl.replace(/\/$/, ''), runnerEmail, runnerPassword };
  }
  return JSON.parse(fs.readFileSync(stateFile, 'utf8')) as StackState;
}

// On Windows a new local connection is sometimes refused with ENOBUFS (or EADDRNOTAVAIL) while the machine is short of socket
// buffers or ports, which happens with several browsers, JVMs and databases open at once. It is refused before a single byte is
// sent, so it is safe to try again, a few times, before a test is failed over something that says nothing about the app.
const realFetch = globalThis.fetch.bind(globalThis);
const connectRefusals = new Set(['ENOBUFS', 'EADDRNOTAVAIL']);
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await realFetch(input, init);
    } catch (error) {
      const code = (error as { cause?: { code?: string } } | undefined)?.cause?.code ?? '';
      if (attempt >= 5 || !connectRefusals.has(code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
}) as typeof fetch;

/** A password that passes the sign-up rules; generated per run, never printed. */
export function strongPassword(): string {
  return `Aa1!${randomBytes(18).toString('base64url')}`;
}

let nextAddress = Math.floor(Math.random() * 0xfffff);

/**
 * A made-up client address, different on every call.
 *
 * The backend keys its rate limits (60 a minute per auth route, the 10-failure login lock, 8 sign-ups an hour) on the
 * first X-Forwarded-For value, which any client can set (BUG-001). The suite sends its own address on every browser
 * context and API client, so one test's page loads do not eat another test's budget. If that header stops being
 * trusted, run the stack behind a proxy that sets it, or restart the stack between runs.
 */
export function freshClientAddress(): string {
  nextAddress = (nextAddress + 1) & 0xffffff;
  return `10.${(nextAddress >> 16) & 255}.${(nextAddress >> 8) & 255}.${nextAddress & 255}`;
}

export class Api {
  readonly baseUrl: string;
  token: string | null;
  /** Sent as X-Forwarded-For. A new address per client unless you set one on purpose. */
  clientIp: string | null = freshClientAddress();

  constructor(baseUrl: string, token: string | null = null) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async request<T = any>(
    method: string,
    route: string,
    options: { body?: unknown; form?: FormData; token?: string | null; headers?: Record<string, string> } = {},
  ): Promise<ApiResult<T>> {
    const token = options.token === undefined ? this.token : options.token;
    const headers: Record<string, string> = { ...(options.headers ?? {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (this.clientIp) headers['X-Forwarded-For'] = this.clientIp;
    let body: BodyInit | undefined;
    if (options.form) body = options.form;
    else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    const res = await fetch(this.baseUrl + route, { method, headers, body, signal: AbortSignal.timeout(60_000) });
    const text = await res.text();
    let json: any = text;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* not JSON: keep the text */
    }
    return { status: res.status, ok: res.ok, json, headers: res.headers };
  }

  get = <T = any>(route: string, options?: { token?: string | null; headers?: Record<string, string> }) =>
    this.request<T>('GET', route, options);
  post = <T = any>(route: string, body?: unknown, options?: { token?: string | null }) =>
    this.request<T>('POST', route, { body, ...options });
  put = <T = any>(route: string, body?: unknown) => this.request<T>('PUT', route, { body });
  patch = <T = any>(route: string, body?: unknown) => this.request<T>('PATCH', route, { body });
  delete = <T = any>(route: string, body?: unknown) => this.request<T>('DELETE', route, { body });

  /** Signs in and keeps the token. Throws unless it works; use `request` to test a failure. */
  async login(email: string, password: string): Promise<{ token: string; email: string; role: string }> {
    const res = await this.request('POST', '/api/auth/login', { body: { email, password }, token: null });
    if (!res.ok) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.json)}`);
    this.token = res.json.token;
    return res.json;
  }

  /** Creates a runner (the local stack skips e-mail verification) and signs in as it. */
  async signUp(email: string, password: string): Promise<void> {
    const res = await this.request('POST', '/api/auth/signup', { body: { email, password }, token: null });
    if (!res.ok) throw new Error(`signup failed for ${email}: ${res.status} ${JSON.stringify(res.json)}`);
    await this.login(email, password);
  }

  /** POST /api/import/files with one workout file. */
  async importFile(filename: string, content: string | Uint8Array, provider = 'GARMIN'): Promise<ApiResult> {
    const form = new FormData();
    form.set('provider', provider);
    form.set('file', new Blob([content as BlobPart]), filename);
    return this.request('POST', '/api/import/files', { form });
  }

  /** Imports a file and returns the new run's id. Throws when nothing was imported. */
  async importRun(filename: string, content: string | Uint8Array): Promise<number> {
    const before = new Set((await this.get('/api/activities')).json.map((run: { id: number }) => run.id));
    const res = await this.importFile(filename, content);
    if (!res.ok || res.json.importedActivities !== 1) {
      throw new Error(`import of ${filename} failed: ${res.status} ${JSON.stringify(res.json)}`);
    }
    const after = (await this.get('/api/activities')).json as Array<{ id: number }>;
    const created = after.find((run) => !before.has(run.id));
    if (!created) throw new Error(`import of ${filename} reported success but no new run appeared`);
    return created.id;
  }
}

/** A throwaway runner for a spec that must not disturb the seeded one. */
export async function newRunner(label: string): Promise<{ api: Api; email: string; password: string }> {
  const { baseUrl } = stackState();
  const api = new Api(baseUrl);
  const email = `e2e-${label}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}@example.com`;
  const password = strongPassword();
  await api.signUp(email, password);
  return { api, email, password };
}

/** Polls `check` until it returns a truthy value (analysis runs off the request thread after an import). */
export async function eventually<T>(check: () => Promise<T | null | undefined | false>, what: string, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`timed out after ${timeoutMs / 1000}s waiting for ${what}${last ? `: ${String(last)}` : ''}`);
}
