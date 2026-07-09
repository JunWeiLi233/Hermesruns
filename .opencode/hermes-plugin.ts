import { tool } from "@opencode-ai/plugin";
import { z } from "zod";

export default async function hermesPlugin(input) {
  const { $, directory } = input;

  return {
    tool: {
      "auto-hermes-structure-update": tool({
        description: "Run the Hermes structure-governance pass for runtime adapters, command registrations, and steering briefs.",
        args: {
          write: z.boolean().default(true).describe("Write the structure-update brief and state files."),
        },
        execute: async (args) => {
          const cmdArgs = [
            "node",
            ".tools/auto-hermes-structure-update.mjs",
          ];

          if (args.write) cmdArgs.push("--write");

          const result = await $`cd ${directory} && ${cmdArgs}`;
          return result.stdout;
        },
      }),

      "auto-hermes-tech-debt": tool({
        description: "Run a bounded Hermes tech-debt audit and write step-by-step tasks into TASKS.md.",
        args: {
          max: z.number().int().min(1).max(10).default(5).describe("Maximum number of tech-debt tasks to select."),
          write: z.boolean().default(true).describe("Write selected tasks into TASKS.md."),
          json: z.boolean().default(false).describe("Return JSON output."),
        },
        execute: async (args) => {
          const cmdArgs = [
            "node",
            ".tools/auto-hermes-tech-debt.mjs",
            "--command-name",
            "auto-hermes-tech-debt",
            "--max",
            String(args.max),
          ];

          if (args.write) cmdArgs.push("--write");
          if (args.json) cmdArgs.push("--json");

          const result = await $`cd ${directory} && ${cmdArgs}`;
          return result.stdout;
        },
      }),

      "auto-hermes-self": tool({
        description: "Run the true Ralph self-loop version of /auto-hermes. Keeps iterating until a real stop gate fires instead of treating a single bounded round as the finish state.",
        args: {
          scope: z.string().optional().describe("Optional bounded goal or surface hint"),
        },
        execute: async (args, context) => {
          const { worktree } = context;

          const humanLoopResult = await $`cd ${worktree} && cat .ai-sync/HUMAN_LOOP.md 2>/dev/null || echo "Status: active"`;
          if (humanLoopResult.stdout.includes("pause") || humanLoopResult.stdout.includes("stop") || humanLoopResult.stdout.includes("must-ask")) {
            return "HUMAN_LOOP.md indicates pause/stop/must-ask. Aborting.";
          }

          // /auto-hermes-self must not run generate-codex.js; the self-loop helper only writes state and briefs.
          await $`cd ${worktree} && node .tools/optimize-agent-context.mjs --agent codex --tasks TASKS.md --guide AGENTS.md --queue-mode first --write`;

          const cmdArgs = [
            "node",
            ".tools/auto-hermes-self-loop.mjs",
            "--write",
            "--runtime",
            "opencode",
          ];

          try {
            const result = await $`cd ${worktree} && ${cmdArgs}`;
            const scopeLine = args.scope ? `\n\nScope hint: ${args.scope}` : "";
            return `${result.stdout}${scopeLine}\n\nExecute the emitted work unit from .ai-sync/AUTO_HERMES_SELF_NEXT_PROMPT.md, then re-run /auto-hermes-self until a real stop gate fires.`;
          } catch (error) {
            return `Auto-Hermes self-loop owner failed: ${error.message}\n\nRun manually: node .tools/auto-hermes-self-loop.mjs --write --runtime opencode`;
          }
        },
      }),
    },
  };
}
