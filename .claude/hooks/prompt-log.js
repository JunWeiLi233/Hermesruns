#!/usr/bin/env node
/**
 * UserPromptSubmit hook — Hermes prompt logger.
 * Appends each user prompt (normalized hash + truncated text) to
 * .claude/prompt-log.jsonl so session-start can detect repeated patterns
 * and auto-extract them into skills.
 *
 * Must exit quickly and never block the prompt.
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

let raw = '';
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const data   = JSON.parse(raw);
    const prompt = (data.prompt || '').trim();
    if (!prompt || prompt.length < 20) { process.exit(0); return; }

    // Normalize: lowercase, strip punctuation, collapse whitespace
    const normalized = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const hash    = crypto.createHash('md5').update(normalized).digest('hex').slice(0, 8);
    const logPath = path.join(process.cwd(), '.claude', 'prompt-log.jsonl');
    const entry   = JSON.stringify({ ts: Date.now(), hash, text: prompt.slice(0, 300) }) + '\n';

    fs.appendFileSync(logPath, entry, 'utf-8');
  } catch { /* never block the prompt */ }

  process.exit(0);
});
