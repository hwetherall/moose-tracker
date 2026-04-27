/**
 * CLI: pnpm eval:brief <date> [--prompt path/to/file] [--model slug]
 *
 * Replays a historical brief through the current prompt (or a candidate file)
 * and prints a unified diff. No automated scoring in V2 — humans read the
 * diffs. See claude-2.md §10.
 */
import { readFileSync } from "node:fs";
import { evalBrief } from "../lib/agent/brief/eval";

function parseArgs(argv: string[]): {
  date: string;
  promptPath?: string;
  modelOverride?: string;
} {
  if (argv.length === 0) {
    console.error("Usage: pnpm eval:brief <YYYY-MM-DD> [--prompt path] [--model slug]");
    process.exit(2);
  }
  const out: { date: string; promptPath?: string; modelOverride?: string } = {
    date: argv[0]
  };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--prompt" && argv[i + 1]) {
      out.promptPath = argv[++i];
    } else if (argv[i] === "--model" && argv[i + 1]) {
      out.modelOverride = argv[++i];
    }
  }
  return out;
}

async function main() {
  const { date, promptPath, modelOverride } = parseArgs(process.argv.slice(2));
  const promptOverride = promptPath ? readFileSync(promptPath, "utf-8") : undefined;

  const result = await evalBrief({
    brief_date: date,
    prompt_override: promptOverride,
    model_override: modelOverride
  });

  console.log(`Original (model: ${result.modelOriginal})`);
  console.log("--------------------------------------------------");
  console.log(result.original);
  console.log("\nCandidate (model: " + result.modelCandidate + ")");
  console.log("--------------------------------------------------");
  console.log(result.candidate);
  console.log("\nDiff");
  console.log("--------------------------------------------------");
  console.log(result.diff);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
