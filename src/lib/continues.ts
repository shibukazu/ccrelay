import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { commandString, run } from "./exec.js";
import type { Agent, CommandSpec, SessionCandidate } from "./types.js";

interface ListSessionsOptions {
  cwd?: string;
  source?: Agent;
}

interface InspectSessionOptions {
  cwd?: string;
  preset?: string;
}

interface ChooseSessionOptions {
  cwd?: string;
  source?: Agent;
  sessionId?: string;
}

export function continuesCommand(): CommandSpec {
  const configured = process.env.AGENT_HANDOFF_CONTINUES_BIN ?? "npx continues";
  return splitCommand(configured);
}

export async function listSessions({ cwd, source }: ListSessionsOptions = {}): Promise<SessionCandidate[]> {
  const command = continuesCommand();
  const args = [...command.args, "list", "--json"];
  if (source) args.push("--source", source);
  let result = await run(command.bin, args, { cwd });
  if (!result.ok && /sessions\.jsonl/.test(`${result.stderr}\n${result.stdout}`)) {
    await run(command.bin, [...command.args, "scan"], { cwd });
    result = await run(command.bin, args, { cwd });
  }
  if (!result.ok) {
    throw new Error(`continues list failed (${commandString(command.bin, args)}):\n${result.stderr.trim() || result.stdout.trim()}`);
  }
  return parseSessionList(result.stdout);
}

export async function inspectSessionMarkdown(sessionId: string, { cwd, preset = "standard" }: InspectSessionOptions = {}): Promise<string> {
  const command = continuesCommand();
  const tempDir = await mkdtemp(join(tmpdir(), "agent-handoff-"));
  const outputPath = join(tempDir, "session.md");
  const args = [...command.args, "inspect", sessionId, "--preset", preset, "--write-md", outputPath];

  try {
    const result = await run(command.bin, args, { cwd });
    if (!result.ok) {
      throw new Error(`continues inspect failed (${commandString(command.bin, args)}):\n${result.stderr.trim() || result.stdout.trim()}`);
    }
    return (await readFile(outputPath, "utf8")).trim();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function chooseSession(sessions: SessionCandidate[], { cwd, source, sessionId }: ChooseSessionOptions = {}): SessionCandidate | null {
  if (sessionId) {
    const exact = sessions.find((session) => getSessionId(session) === sessionId || session.id === sessionId);
    return exact ?? { id: sessionId, source };
  }

  const filtered = sessions
    .filter((session) => !source || getSessionSource(session) === source)
    .filter((session) => isRepoSession(session, cwd));

  const candidates = filtered.length > 0 ? filtered : sessions.filter((session) => !source || getSessionSource(session) === source);
  return candidates.sort((a, b) => sessionTime(b) - sessionTime(a))[0] ?? null;
}

export function getSessionId(session: SessionCandidate): string {
  return String(session.id ?? session.sessionId ?? session.shortId ?? "");
}

export function getSessionSource(session: SessionCandidate): string {
  return String(session.source ?? session.tool ?? session.agent ?? "").toLowerCase();
}

export function sessionTime(session: SessionCandidate): number {
  const value = session.updatedAt ?? session.lastModified ?? session.timestamp ?? session.createdAt ?? session.mtime;
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sessionTitle(session: SessionCandidate): string {
  return session.title ?? session.summary ?? session.name ?? session.description ?? "";
}

export function sessionPath(session: SessionCandidate): string {
  return session.cwd ?? session.path ?? session.projectPath ?? session.repository ?? session.repo ?? "";
}

function parseSessionList(stdout: string): SessionCandidate[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as SessionCandidate[] | { sessions?: SessionCandidate[]; items?: SessionCandidate[] };
    return Array.isArray(parsed) ? parsed : parsed.sessions ?? parsed.items ?? [];
  } catch {
    return trimmed
      .split("\n")
      .map((line: string) => line.trim())
      .filter(Boolean)
      .map((line: string) => JSON.parse(line) as SessionCandidate);
  }
}

function isRepoSession(session: SessionCandidate, cwd?: string): boolean {
  const path = sessionPath(session);
  if (!path || !cwd) return true;
  const rel = relative(path, cwd);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

function splitCommand(value: string): CommandSpec {
  const parts = value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((part) => part.replace(/^["']|["']$/g, "")) ?? [];
  if (parts.length === 0) return { bin: "npx", args: ["continues"] };
  return { bin: parts[0], args: parts.slice(1) };
}
