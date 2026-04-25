import { homedir } from "node:os";
import { join } from "node:path";

export const HANDOFF_DIR = ".handoff";
export const CURRENT_HANDOFF = join(HANDOFF_DIR, "current.md");

export function claudeSessionDir(): string {
  return process.env.CLAUDE_CONFIG_DIR
    ? join(process.env.CLAUDE_CONFIG_DIR, "projects")
    : join(homedir(), ".claude", "projects");
}

export function codexSessionDir(): string {
  return process.env.CODEX_HOME
    ? join(process.env.CODEX_HOME, "sessions")
    : join(homedir(), ".codex", "sessions");
}
