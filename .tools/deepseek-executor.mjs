/**
 * DeepSeek Executor Bridge
 *
 * Sends a commander-authored brief to DeepSeek and writes the implementation response.
 *
 * Usage:
 *   node .tools/deepseek-executor.mjs --brief <brief-file> [--out <output-file>] [--model <model>] [--max-tokens <n>] [--apply] [--dry-run]
 *
 * Env vars:
 *   DEEPSEEK_API_KEY  (required, must look like a real key — not a placeholder)
 *   DEEPSEEK_BASE_URL (optional, default: https://api.deepseek.com)
 *   DEEPSEEK_MODEL    (optional, default: deepseek-v4-flash)
 *
 * Models (per https://api-docs.deepseek.com/quick_start/pricing):
 *   deepseek-v4-flash  default — fast, both thinking + non-thinking
 *   deepseek-v4-pro    higher quality, slower, also dual-mode
 *   deepseek-chat      legacy alias (deprecated — kept for compatibility)
 *   deepseek-reasoner  legacy alias (deprecated — kept for compatibility)
 *
 * Exit codes:
 *   0  success
 *   1  invalid arguments / missing or placeholder API key / brief not found
 *   2  network or API error
 *
 * Output format: markdown with fenced code blocks per changed file, plus a
 *   <!-- CHANGED_FILES: ... --> summary that the commander parses.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

// Resolve --brief / --out / auto-apply paths relative to the CALLER's working
// directory, not the executor's install location. This makes the script
// location-independent: the same file works whether it lives in a project's
// .tools/ folder or is installed globally at ~/.claude/tools/. Absolute paths
// pass through resolve() unchanged.
const CWD = process.cwd();

// ── Dedicated DeepSeek key/config holder ─────────────────────────────────────
// A single global holder JUST for the deepseek command, read by every runtime
// (Claude, Codex, ad-hoc CLI). Lives at ~/.deepseek/config.json so the key
// doesn't have to be duplicated into each runtime's env block. Honored fields:
//   { "apiKey": "sk-...", "baseUrl": "https://api.deepseek.com",
//     "model": "deepseek-v4-flash", "maxTokens": 8192 }
// Override precedence (highest first): CLI flag → env var → holder → built-in default.
const HOLDER_PATH = join(
  process.env.DEEPSEEK_CONFIG || join(homedir(), '.deepseek', 'config.json'),
);
function loadHolder() {
  try {
    if (!existsSync(HOLDER_PATH)) return {};
    const cfg = JSON.parse(readFileSync(HOLDER_PATH, 'utf8'));
    return cfg && typeof cfg === 'object' ? cfg : {};
  } catch {
    return {};
  }
}
const holder = loadHolder();
const holderApiKey = holder.apiKey || holder.DEEPSEEK_API_KEY || null;
const holderBaseUrl = holder.baseUrl || holder.DEEPSEEK_BASE_URL || null;
const holderModel = holder.model || holder.DEEPSEEK_MODEL || null;
const holderMaxTokens = holder.maxTokens || holder.DEEPSEEK_MAX_TOKENS || null;

// ── Arg parsing ──────────────────────────────────────────────────────────────
function arg(flag) {
  const idx = process.argv.indexOf(`--${flag}`);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const briefPath  = arg('brief');
const outPath    = arg('out') || '.ai-sync/deepseek-output.md';
const model      = arg('model') || process.env.DEEPSEEK_MODEL || holderModel || 'deepseek-v4-flash';
const maxTokens  = parseInt(arg('max-tokens') || process.env.DEEPSEEK_MAX_TOKENS || holderMaxTokens || '8192', 10);
const baseUrl    = (process.env.DEEPSEEK_BASE_URL || holderBaseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
// Key precedence: a REAL env value wins; but a placeholder env value (e.g. a
// runtime that injects "YOUR_DEEPSEEK_KEY_HERE" into every session) must NOT
// shadow a real key in the dedicated holder. So: env-if-real → holder → env
// (the last so the "not set / placeholder" error still reports the env value
// when neither source has a real key). looksLikeApiKeyPlaceholder is a hoisted
// function declaration, so it's callable here.
const envKey     = process.env.DEEPSEEK_API_KEY;
const envKeyReal = envKey && !looksLikeApiKeyPlaceholder(envKey);
const apiKey     = envKeyReal ? envKey : (holderApiKey || envKey);
const dryRun     = hasFlag('dry-run');
const autoApply  = hasFlag('apply');

// ── API-key shape validation ─────────────────────────────────────────────────
// Catches the YOUR_DEEPSEEK_KEY_HERE / placeholder shapes before paying for an
// HTTP round trip just to get a 401. Real DeepSeek keys start with `sk-` and
// are roughly 35+ characters.
function looksLikeApiKeyPlaceholder(key) {
  if (!key) return true;
  const k = key.trim();
  if (k.length < 25) return true;
  if (/^(YOUR_|<|>|TODO|PLACEHOLDER|REPLACE_|HERE$|\.\.\.|XXX)/i.test(k)) return true;
  if (/_HERE$|_PLACEHOLDER|_TODO/i.test(k)) return true;
  return false;
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert software engineer executing implementation tasks.
You receive a structured brief written by a commander (Claude Opus or GPT-4.5+).
The brief contains: task description, current file contents, and a step-by-step plan.

Your job is to implement the plan exactly — no extra features, no redesign.

## Output format rules (STRICT — commander will parse this):
1. For each file you change or create, output a fenced code block with the lang and path:
   \`\`\`tsx:frontend/src/components/Foo.tsx
   // full file content here — never truncate
   \`\`\`
2. After all code blocks, output a CHANGED FILES section:
   <!-- CHANGED_FILES: file1.tsx, file2.css, file3.java -->
3. After that, a SHORT verification note (1-3 lines) explaining what you did and any edge cases.
4. Do NOT output commentary between code blocks — only code, then the summary sections.
5. Include COMPLETE file content. Never use "..." or placeholder comments.
6. If a file needs no changes, do not include it.`;

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Validate key + args before any network call.
  if (!apiKey) {
    console.error('[deepseek-executor] ERROR: no DeepSeek API key found.');
    console.error(`  Preferred: put it in the dedicated holder ${HOLDER_PATH}`);
    console.error('    { "apiKey": "sk-..." }');
    console.error('  Or set the env var:  $env:DEEPSEEK_API_KEY="sk-..."  (PowerShell)');
    console.error('                       export DEEPSEEK_API_KEY="sk-..."  (bash/zsh)');
    console.error('  Get a key at https://platform.deepseek.com/api_keys');
    return 1;
  }
  if (looksLikeApiKeyPlaceholder(apiKey)) {
    const k = apiKey.trim();
    const masked = k.length <= 8 ? k : `${k.slice(0, 4)}…${k.slice(-4)} (${k.length} chars)`;
    console.error(`[deepseek-executor] ERROR: the DeepSeek API key looks like a placeholder: ${masked}`);
    console.error('  Real DeepSeek keys start with "sk-" and are ~35+ characters.');
    console.error(`  Set a real key in the dedicated holder ${HOLDER_PATH} ({ "apiKey": "sk-..." })`);
    console.error('  or in the DEEPSEEK_API_KEY env var. Get one at https://platform.deepseek.com/api_keys');
    return 1;
  }
  if (!briefPath) {
    console.error('[deepseek-executor] ERROR: --brief <path> is required.');
    return 1;
  }
  const absBrief = resolve(CWD, briefPath);
  if (!existsSync(absBrief)) {
    console.error(`[deepseek-executor] ERROR: Brief file not found: ${absBrief}`);
    return 1;
  }

  const brief = readFileSync(absBrief, 'utf8');

  // 2. --dry-run short-circuits before the API call. Useful in CI smoke tests
  //    to confirm env + brief are valid without burning DeepSeek credits.
  if (dryRun) {
    const keySource = envKeyReal
      ? 'env DEEPSEEK_API_KEY'
      : (holderApiKey ? `holder ${HOLDER_PATH}` : 'env DEEPSEEK_API_KEY');
    console.log('[deepseek-executor] --dry-run OK');
    console.log(`  Model: ${model}`);
    console.log(`  Base URL: ${baseUrl}`);
    console.log(`  API key: ${apiKey.slice(0, 4)}…${apiKey.slice(-4)} (${apiKey.length} chars) — from ${keySource}`);
    console.log(`  Brief: ${briefPath} (${brief.length} chars)`);
    console.log(`  Max tokens: ${maxTokens}`);
    return 0;
  }

  console.log(`[deepseek-executor] Model: ${model}`);
  console.log(`[deepseek-executor] Brief: ${briefPath} (${brief.length} chars)`);
  console.log(`[deepseek-executor] Calling ${baseUrl}/chat/completions ...`);

  // 3. Call DeepSeek. Drain the body fully (even on error) before returning so
  //    the underlying socket closes cleanly — this matters on Node 24 + Windows
  //    where leftover fetch handles can trigger a libuv assertion at process
  //    teardown.
  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: brief },
        ],
        max_tokens: maxTokens,
        temperature: 0.1,
        stream: false,
      }),
    });
  } catch (err) {
    console.error(`[deepseek-executor] Network error: ${err.message}`);
    return 2;
  }

  let bodyText;
  try {
    bodyText = await response.text();
  } catch (err) {
    console.error(`[deepseek-executor] Body read error: ${err.message}`);
    return 2;
  }

  if (!response.ok) {
    console.error(`[deepseek-executor] API error ${response.status}: ${bodyText}`);
    // Common 401 message includes "Your api key: ****<last4> is invalid" — surface
    // a friendly hint when DeepSeek rejects our key.
    if (response.status === 401) {
      console.error('  → The key was accepted at the placeholder check but rejected by DeepSeek.');
      console.error('  → Check for typos or rotate the key at https://platform.deepseek.com/api_keys');
    }
    return 2;
  }

  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    console.error(`[deepseek-executor] Non-JSON response: ${bodyText.slice(0, 400)}`);
    return 2;
  }
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    console.error(`[deepseek-executor] No content in response: ${JSON.stringify(json).slice(0, 400)}`);
    return 2;
  }

  // 4. Write output + log token usage.
  const absOut = resolve(CWD, outPath);
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, content, 'utf8');
  const usage = json.usage || {};
  console.log(`[deepseek-executor] Done. Output: ${absOut}`);
  console.log(`[deepseek-executor] Tokens — prompt: ${usage.prompt_tokens || '?'}, completion: ${usage.completion_tokens || '?'}, total: ${usage.total_tokens || '?'}`);

  const changedMatch = content.match(/<!--\s*CHANGED_FILES:\s*([^-]+?)\s*-->/);
  if (changedMatch) {
    const files = changedMatch[1].split(',').map(f => f.trim()).filter(Boolean);
    console.log(`[deepseek-executor] Changed files reported by DeepSeek: ${files.join(', ')}`);
  }

  // 5. Optional auto-apply — write each fenced code block to its declared path.
  if (autoApply) {
    const blockRe = /^```[a-z]*:([^\n]+)\n([\s\S]*?)^```/gm;
    let match;
    const applied = [];
    while ((match = blockRe.exec(content)) !== null) {
      const [, filePath, fileContent] = match;
      const absFilePath = resolve(CWD, filePath.trim());
      mkdirSync(dirname(absFilePath), { recursive: true });
      writeFileSync(absFilePath, fileContent, 'utf8');
      applied.push(filePath.trim());
    }
    if (applied.length) {
      console.log(`[deepseek-executor] Auto-applied ${applied.length} file(s): ${applied.join(', ')}`);
    } else {
      console.log('[deepseek-executor] --apply: no parseable code blocks found in output.');
    }
  }

  return 0;
}

// ── Entry point ──────────────────────────────────────────────────────────────
// Run main() and set process.exitCode from its return. Crucially, we DO NOT
// call process.exit() — that races with undici's fetch socket teardown on
// Node 24 + Windows and triggers a libuv async-handle assertion. Setting
// process.exitCode lets the event loop drain cleanly and Node exits naturally.
try {
  process.exitCode = await main();
} catch (err) {
  console.error(`[deepseek-executor] FATAL: ${err && err.stack ? err.stack : err}`);
  process.exitCode = 2;
}

// On Node 24 Windows specifically, undici's global dispatcher can hold a
// background socket open after the response is drained. Close it explicitly
// so the event loop drains and the process exits without the libuv assertion.
try {
  const undici = await import('undici');
  if (typeof undici.getGlobalDispatcher === 'function') {
    await undici.getGlobalDispatcher().close();
  }
} catch {
  // undici not bundled with this Node — fine, the explicit body drain above
  // already gives the keep-alive socket time to close on most platforms.
}
