import { parseOptions } from "../lib/args.js";
import { getSessionId, getSessionSource, listSessions, sessionPath, sessionTime, sessionTitle } from "../lib/continues.js";
import { pickChoice } from "../lib/choicePicker.js";
import { repoRoot } from "../lib/git.js";
import { pickSession } from "../lib/sessionPicker.js";
import type { Agent } from "../lib/types.js";

interface InspectRow {
  source: string;
  id: string;
  updated: string;
  repo: string;
  title: string;
}

export async function runInspect(argv: string[]): Promise<void> {
  const options = parseOptions(argv, { source: "value" });
  if (options.source && (typeof options.source !== "string" || !["claude", "codex"].includes(options.source))) {
    throw new Error("--source must be claude or codex.");
  }

  const root = await repoRoot(process.cwd());
  const source = typeof options.source === "string"
    ? options.source as Agent
    : await pickInspectSource();
  const sessions = await listSessions({ cwd: root, source });

  if (sessions.length === 0) {
    console.log("No sessions found.");
    return;
  }

  if (options.pick) {
    const selected = await pickSession(sessions);
    console.log(getSessionId(selected));
    return;
  }

  const rows: InspectRow[] = sessions
    .sort((a, b) => sessionTime(b) - sessionTime(a))
    .slice(0, 30)
    .map((session) => ({
      source: getSessionSource(session) || "-",
      id: getSessionId(session) || "-",
      updated: formatTime(sessionTime(session)),
      repo: sessionPath(session) || "-",
      title: sessionTitle(session) || "-",
    }));

  printRows(rows);
}

async function pickInspectSource(): Promise<Agent | undefined> {
  const value = await pickChoice("Inspect sessions from which source?", [
    { label: "all", value: "all", description: "show Claude and Codex sessions" },
    { label: "claude", value: "claude", description: "Claude Code sessions only" },
    { label: "codex", value: "codex", description: "Codex sessions only" },
  ]);
  return value === "all" ? undefined : value;
}

function printRows(rows: InspectRow[]): void {
  const headers: (keyof InspectRow)[] = ["source", "id", "updated", "repo", "title"];
  const widths = Object.fromEntries(headers.map((header) => [
    header,
    Math.min(48, Math.max(header.length, ...rows.map((row) => String(row[header]).length))),
  ])) as Record<keyof InspectRow, number>;

  console.log(headers.map((header) => pad(header, widths[header])).join("  "));
  console.log(headers.map((header) => "-".repeat(widths[header])).join("  "));
  for (const row of rows) {
    console.log(headers.map((header) => pad(truncate(String(row[header]), widths[header]), widths[header])).join("  "));
  }
}

function formatTime(time: number): string {
  return time ? new Date(time).toISOString() : "-";
}

function truncate(value: string, width: number): string {
  return value.length > width ? `${value.slice(0, Math.max(0, width - 1))}…` : value;
}

function pad(value: string, width: number): string {
  return value.padEnd(width, " ");
}
