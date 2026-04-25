import { runDoctor } from "./commands/doctor.js";
import { runInspect } from "./commands/inspect.js";
import { runTo } from "./commands/to.js";
import { runWrite } from "./commands/write.js";
import type { TargetAgent } from "./lib/types.js";

export async function main(argv: string[]): Promise<void> {
  const [command, subcommand, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "doctor") {
    await runDoctor();
    return;
  }

  if (command === "inspect") {
    await runInspect([subcommand, ...rest].filter(Boolean));
    return;
  }

  if (command === "write") {
    await runWrite([subcommand, ...rest].filter(Boolean));
    return;
  }

  if (command === "to") {
    if (!["codex", "claude"].includes(subcommand)) {
      throw new Error("Usage: agent-handoff to <codex|claude> [--dry-run] [--from claude|codex] [--session id] [--no-write]");
    }
    await runTo(subcommand as TargetAgent, rest);
    return;
  }

  throw new Error(`Unknown command: ${command}\nRun agent-handoff --help for usage.`);
}

function printHelp(): void {
  console.log(`agent-handoff

Usage:
  agent-handoff doctor
  agent-handoff inspect [--source claude|codex] [--pick]
  agent-handoff write [--from claude|codex] [--locale en|ja] [--session id] [--latest] [--target claude|codex] [--include-diff]
  agent-handoff to codex [--dry-run] [--from claude|codex] [--locale en|ja] [--session id] [--latest] [--no-write]
  agent-handoff to claude [--dry-run] [--from claude|codex] [--locale en|ja] [--session id] [--latest] [--no-write]

Environment:
  AGENT_HANDOFF_CONTINUES_BIN="npx continues"
  AGENT_HANDOFF_CODEX_BIN="codex"
  AGENT_HANDOFF_CLAUDE_BIN="claude"`);
}
