import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseOptions } from "../lib/args.js";
import { pickChoice } from "../lib/choicePicker.js";
import { chooseSession, getSessionId, getSessionSource, inspectSessionMarkdown, listSessions } from "../lib/continues.js";
import { gitDiff, gitDiffStat, gitStatus, repoRoot } from "../lib/git.js";
import { buildHandoffMarkdown, fileExists, writeHandoffFile } from "../lib/handoff.js";
import { resolveLocale } from "../lib/interactiveOptions.js";
import { withAlternateScreen } from "../lib/screen.js";
import { pickSession } from "../lib/sessionPicker.js";
import type { Agent, Locale, SessionCandidate, TargetAgent } from "../lib/types.js";

interface WriteInjected {
  root?: string;
  silent?: boolean;
}

interface WriteResult {
  path: string;
  root: string;
  sessionId: string;
  sourceAgent: string;
}

export async function runWrite(argv: string[], injected: WriteInjected = {}): Promise<WriteResult> {
  const options = parseOptions(argv, {
    from: "value",
    locale: "value",
    session: "value",
    target: "value",
  });

  validateAgent(options.from, "--from");
  validateAgent(options.target, "--target");

  const root = injected.root ?? await repoRoot(process.cwd());

  const { locale, source, target, session } = await withAlternateScreen(async (): Promise<{
    locale: Locale;
    source: Agent;
    target: TargetAgent | "unspecified";
    session: SessionCandidate;
  }> => {
    const locale = await resolveLocale(options.locale);
    const source: Agent = typeof options.from === "string" ? options.from as Agent : await pickAgent("Create handoff from which source agent?");
    const target: TargetAgent | "unspecified" = typeof options.target === "string" ? options.target as TargetAgent : await pickTarget();

    const sessionIdOption = typeof options.session === "string" ? options.session : undefined;
    const sessions = await listSessions({ cwd: root, source });
    const session = sessionIdOption || options.latest
      ? chooseSession(sessions, { cwd: root, source, sessionId: sessionIdOption })
      : await pickSession(sessions);

    if (!session) {
      throw new Error(source ? `No ${source} session found by continues for this repository.` : "No session found by continues for this repository.");
    }

    return { locale, source, target, session };
  });

  const includeDiff = Boolean(options.includeDiff);

  const sessionId = getSessionId(session);
  if (!sessionId) {
    throw new Error("continues returned a session without an id.");
  }

  const sessionSummary = await inspectSessionMarkdown(sessionId, { cwd: root });
  const status = await gitStatus(root);
  const diffStat = await gitDiffStat(root);
  const diff = includeDiff ? await gitDiff(root) : "";
  const repoInstructions = await detectRepoInstructions(root);

  const content = buildHandoffMarkdown({
    generatedAt: new Date().toISOString(),
    repository: root,
    sourceAgent: source,
    targetAgent: target,
    sessionId,
    sessionSummary,
    modifiedFiles: status.split("\n").filter(Boolean),
    gitStatus: status,
    gitDiffStat: diffStat,
    diff,
    repoInstructions,
    locale,
  });

  const path = await writeHandoffFile(root, content);
  if (!injected.silent) {
    console.log(`Wrote ${path}`);
  }
  return { path, root, sessionId, sourceAgent: source };
}

async function pickAgent(title: string): Promise<Agent> {
  return pickChoice(title, [
    { label: "codex", value: "codex", description: "continue from a Codex session" },
    { label: "claude", value: "claude", description: "continue from a Claude Code session" },
  ]);
}

async function pickTarget(): Promise<TargetAgent | "unspecified"> {
  return pickChoice("Who is the target agent?", [
    { label: "unspecified", value: "unspecified", description: "write handoff only" },
    { label: "claude", value: "claude", description: "handoff is for Claude Code" },
    { label: "codex", value: "codex", description: "handoff is for Codex" },
  ]);
}

async function detectRepoInstructions(root: string): Promise<string[]> {
  const entries: string[] = [];
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    if (await fileExists(join(root, name))) entries.push(`\`${name}\` exists at repository root.`);
  }
  if (await fileExists(join(root, ".claude"))) {
    const names = await readdir(join(root, ".claude")).catch(() => []);
    entries.push(names.length > 0 ? "`.claude/` exists at repository root." : "`.claude/` exists at repository root and is empty.");
  }
  return entries;
}

function validateAgent(value: unknown, flag: string): asserts value is Agent | TargetAgent | undefined {
  if (value && (typeof value !== "string" || !["claude", "codex"].includes(value))) {
    throw new Error(`${flag} must be claude or codex.`);
  }
}
