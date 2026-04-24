import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

const copilotInstructions = readFileSync(path.join(repoRoot, '.github/copilot-instructions.md'), 'utf8');

const promptFiles = [
  {
    file: '.github/prompts/auto-hermes.prompt.md',
    command: '/auto-hermes',
    references: ['.codex/commands/auto-hermes.md', 'docs/auto-hermes/index.md'],
  },
  {
    file: '.github/prompts/auto-hermes-self.prompt.md',
    command: '/auto-hermes-self',
    references: ['.codex/commands/auto-hermes-self.md', '.tools/auto-hermes-self-loop.mjs'],
  },
  {
    file: '.github/prompts/auto-hermes-max.prompt.md',
    command: '/auto-hermes-max',
    references: ['.codex/commands/auto-hermes-max.md', '.codex/workflows/auto-hermes-architecture.md'],
  },
  {
    file: '.github/prompts/auto-hermes-market.prompt.md',
    command: '/auto-hermes-market',
    references: ['.codex/commands/auto-hermes-market.md', '.claude/commands/auto-hermes-market.md'],
  },
  {
    file: '.github/prompts/auto-hermes-attack.prompt.md',
    command: '/auto-hermes-attack',
    references: ['.codex/commands/auto-hermes-attack.md', '.tools/auto-hermes-security.mjs'],
  },
  {
    file: '.github/prompts/auto-hermes-security.prompt.md',
    command: '/auto-hermes-security',
    references: ['.codex/commands/auto-hermes-security.md', '.tools/auto-hermes-security.mjs'],
  },
  {
    file: '.github/prompts/auto-hermes-tech-debt.prompt.md',
    command: '/auto-hermes-tech-debt',
    references: ['.codex/commands/auto-hermes-tech-debt.md', '.codex/workflows/auto-hermes-tech-debt-contract.md'],
  },
  {
    file: '.github/prompts/auto-hermes-structure-update.prompt.md',
    command: '/auto-hermes-structure-update',
    references: ['.codex/commands/auto-hermes-structure-update.md', '.codex/workflows/auto-hermes-structure-update-contract.md'],
  },
  {
    file: '.github/prompts/auto-hermes-submit-main.prompt.md',
    command: '/auto-hermes-submit-main',
    references: ['.codex/commands/auto-hermes-submit-main.md', 'docs/repo-rules/git-and-publish.md'],
  },
];

assert.match(
  copilotInstructions,
  /\/auto-hermes-self/,
  'Repository Copilot instructions should advertise the Hermes prompt-file slash commands.',
);

for (const prompt of promptFiles) {
  const source = readFileSync(path.join(repoRoot, prompt.file), 'utf8');

  assert.match(
    source,
    /^---[\s\S]*agent:\s*'agent'[\s\S]*description:\s*'.+'[\s\S]*---/m,
    `${prompt.file} should define prompt-file frontmatter with agent and description.`,
  );

  assert.match(
    source,
    new RegExp(prompt.command.replaceAll('/', '\\/')),
    `${prompt.file} should mention its corresponding Copilot slash command.`,
  );

  for (const ref of prompt.references) {
    assert.match(
      source,
      new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${prompt.file} should reference ${ref} so the Copilot command stays aligned with Hermes source docs.`,
    );
  }
}

console.log('[PASS] GitHub Copilot Hermes prompt files are present and wired to canonical sources.');
