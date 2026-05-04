import readline from "node:readline";
import { enterAlternateScreen, exitAlternateScreen } from "./screen.js";
import {
  getSessionId,
  getSessionSource,
  inspectSessionMarkdown,
  sessionPath,
  sessionTime,
  sessionTitle,
} from "./continues.js";
import type { SessionCandidate } from "./types.js";

interface PickerState {
  query: string;
  cursor: number;
  offset: number;
  showDetail: boolean;
}

interface DetailEntry {
  status: "loading" | "ready" | "error";
  preview?: string;
  error?: string;
}

const detailCache = new Map<string, DetailEntry>();

const styles = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  selected: "\x1b[48;5;60m\x1b[97m",
};

export async function pickSession(sessions: SessionCandidate[], options: { cwd?: string } = {}): Promise<SessionCandidate> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive session picker requires a TTY. Re-run with --latest or --session <id>.");
  }

  const state: PickerState = { query: "", cursor: 0, offset: 0, showDetail: false };
  const previousRawMode = process.stdin.isRaw;
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      process.stdin.off("keypress", onKeypress);
      process.stdin.setRawMode(previousRawMode);
      process.stdin.pause();
      exitAlternateScreen();
    };

    const finish = (session: SessionCandidate): void => {
      cleanup();
      resolve(session);
    };

    const fail = (error: Error): void => {
      cleanup();
      reject(error);
    };

    const requestDetail = (session: SessionCandidate | undefined): void => {
      if (!session || !state.showDetail) return;
      const id = getSessionId(session);
      if (!id || detailCache.has(id)) return;
      detailCache.set(id, { status: "loading" });
      inspectSessionMarkdown(id, { cwd: options.cwd })
        .then((md) => {
          detailCache.set(id, { status: "ready", preview: extractLatestMessage(md) });
          render(sessions, state);
        })
        .catch((error: unknown) => {
          detailCache.set(id, { status: "error", error: error instanceof Error ? error.message : String(error) });
          render(sessions, state);
        });
    };

    const rerender = (): void => {
      const matches = filteredSessions(sessions, state.query);
      requestDetail(matches[state.cursor]);
      render(sessions, state);
    };

    const onKeypress = (input: string, key: readline.Key): void => {
      const matches = filteredSessions(sessions, state.query);
      if (key.ctrl && key.name === "c") {
        fail(new Error("Session selection cancelled."));
        return;
      }
      if (key.name === "return") {
        const selected = matches[state.cursor];
        if (selected) finish(selected);
        return;
      }
      if (key.name === "escape") {
        fail(new Error("Session selection cancelled."));
        return;
      }
      if (key.name === "tab") {
        state.showDetail = !state.showDetail;
        rerender();
        return;
      }
      if (key.name === "backspace") {
        state.query = state.query.slice(0, -1);
        state.cursor = 0;
        state.offset = 0;
        rerender();
        return;
      }
      if (key.name === "up") {
        state.cursor = Math.max(0, state.cursor - 1);
        rerender();
        return;
      }
      if (key.name === "down") {
        state.cursor = Math.min(Math.max(0, matches.length - 1), state.cursor + 1);
        rerender();
        return;
      }
      if (input && input >= " " && input !== "\x7f") {
        state.query += input;
        state.cursor = 0;
        state.offset = 0;
        rerender();
      }
    };

    enterAlternateScreen();
    process.stdin.on("keypress", onKeypress);
    render(sessions, state);
  });
}

function render(sessions: SessionCandidate[], state: PickerState): void {
  const matches = filteredSessions(sessions, state.query);
  if (state.cursor >= matches.length) state.cursor = Math.max(0, matches.length - 1);
  const visibleCount = visibleSessionCount(state.showDetail);
  state.offset = scrollOffset(state.offset, state.cursor, visibleCount, matches.length);

  renderClear();
  const shown = Math.min(matches.length, visibleCount);
  const windowed = matches.slice(state.offset, state.offset + shown);
  process.stdout.write(`${styles.bold}Select session${styles.reset}  ${styles.dim}${matches.length}/${sessions.length} matches${styles.reset}\n`);
  process.stdout.write(`${styles.dim}Type to fuzzy search. Up/Down move. Enter choose. Tab toggle detail. Esc cancel.${styles.reset}\n\n`);
  process.stdout.write(`${styles.cyan}?${styles.reset} ${state.query || styles.dim + "search sessions" + styles.reset}\n\n`);

  if (matches.length === 0) {
    process.stdout.write(`${styles.yellow}No matching sessions.${styles.reset}\n`);
    return;
  }

  if (state.offset > 0) {
    process.stdout.write(`${styles.dim}↑ ${state.offset} previous results${styles.reset}\n\n`);
  }

  for (const [index, session] of windowed.entries()) {
    const absoluteIndex = state.offset + index;
    process.stdout.write(formatSessionRow(session, absoluteIndex === state.cursor, state.query));
    process.stdout.write("\n");
  }

  const remaining = matches.length - state.offset - shown;
  if (remaining > 0) {
    process.stdout.write(`${styles.dim}↓ ${remaining} more results. Keep pressing Down or refine the query.${styles.reset}\n`);
  }

  if (state.showDetail) {
    const selected = matches[state.cursor];
    process.stdout.write("\n");
    process.stdout.write(`${styles.bold}── Latest message ──${styles.reset}\n`);
    process.stdout.write(formatDetailPanel(selected));
    process.stdout.write("\n");
  }
}

function formatDetailPanel(session: SessionCandidate | undefined): string {
  if (!session) return `${styles.dim}(no session selected)${styles.reset}\n`;
  const id = getSessionId(session);
  if (!id) return `${styles.dim}(session has no id)${styles.reset}\n`;
  const entry = detailCache.get(id);
  if (!entry || entry.status === "loading") {
    return `${styles.dim}Loading latest message...${styles.reset}\n`;
  }
  if (entry.status === "error") {
    return `${styles.yellow}Failed to load: ${entry.error ?? "unknown error"}${styles.reset}\n`;
  }
  if (!entry.preview) {
    return `${styles.dim}(no recent message available)${styles.reset}\n`;
  }
  const lines = entry.preview.split("\n").slice(0, detailPanelLineLimit());
  return lines.map((line) => `  ${truncateForWidth(line, terminalWidth() - 2)}`).join("\n") + "\n";
}

function truncateForWidth(value: string, width: number): string {
  if (value.length <= width) return value;
  return `${value.slice(0, Math.max(0, width - 1))}…`;
}

function detailPanelLineLimit(): number {
  return 8;
}

export function extractLatestMessage(markdown: string): string {
  if (!markdown) return "";
  const lines = markdown.split("\n");
  const messageHeader = /^###\s+(User|Assistant)\b/;
  let lastMessageIndex = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (messageHeader.test(lines[i])) {
      lastMessageIndex = i;
      break;
    }
  }
  if (lastMessageIndex === -1) return lines.slice(-12).join("\n").trim();

  let endIndex = lines.length;
  for (let i = lastMessageIndex + 1; i < lines.length; i += 1) {
    if (/^#{2,6}\s/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }
  return lines.slice(lastMessageIndex, endIndex).join("\n").trim();
}

function renderClear(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

function filteredSessions(sessions: SessionCandidate[], query: string): SessionCandidate[] {
  const sorted = [...sessions].sort((a, b) => sessionTime(b) - sessionTime(a));
  const normalized = normalize(query);
  if (!normalized) return sorted;
  return sorted
    .map((session) => ({ session, score: fuzzyScore(searchText(session), normalized) }))
    .filter((item): item is { session: SessionCandidate; score: number } => item.score !== null)
    .sort((a, b) => b.score - a.score || sessionTime(b.session) - sessionTime(a.session))
    .map((item) => item.session);
}

function formatSessionRow(session: SessionCandidate, selected: boolean, query: string): string {
  const source = getSessionSource(session) || "-";
  const id = getSessionId(session) || "-";
  const updated = formatRelativeTime(sessionTime(session));
  const title = sessionTitle(session) || "-";
  const path = sessionPath(session) || "-";
  const width = terminalWidth();

  if (selected) {
    return [
      selectedLine(`> [${source}] ${id}  ${updated}`, width),
      selectedLine(`  ${title}`, width),
      selectedLine(`  ${path}`, width),
    ].join("\n");
  }

  return [
    `  ${styles.bold}[${source}]${styles.reset} ${styles.cyan}${id}${styles.reset}  ${styles.dim}${updated}${styles.reset}`,
    `  ${highlight(title, query)}`,
    `  ${styles.dim}${highlight(path, query)}${styles.reset}`,
  ].join("\n");
}

function searchText(session: SessionCandidate): string {
  return normalize([
    getSessionSource(session),
    getSessionId(session),
    sessionTitle(session),
    sessionPath(session),
  ].join(" "));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function formatRelativeTime(time: number): string {
  if (!time) return "-";
  const delta = Date.now() - time;
  const abs = Math.abs(delta);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return "just now";
  if (abs < hour) return `${Math.round(delta / minute)}m ago`;
  if (abs < day) return `${Math.round(delta / hour)}h ago`;
  if (abs < 14 * day) return `${Math.round(delta / day)}d ago`;
  return new Date(time).toISOString().slice(0, 10);
}

function highlight(value: string, query: string): string {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return value;

  let output = "";
  let queryIndex = 0;
  const lower = value.toLowerCase();
  for (let index = 0; index < value.length; index += 1) {
    if (queryIndex < normalizedQuery.length && lower[index] === normalizedQuery[queryIndex]) {
      output += `${styles.yellow}${styles.bold}${value[index]}${styles.reset}`;
      queryIndex += 1;
    } else {
      output += value[index];
    }
  }
  return output;
}

function selectedLine(value: string, width: number): string {
  return `${styles.selected}${padOrTrim(value, width)}${styles.reset}`;
}

function padOrTrim(value: string, width: number): string {
  const plain = stripAnsi(value);
  if (plain.length === width) return value;
  if (plain.length < width) return value + " ".repeat(width - plain.length);
  return `${plain.slice(0, Math.max(0, width - 1))}…`;
}

function terminalWidth(): number {
  return Math.max(40, process.stdout.columns || 80);
}

function visibleSessionCount(showDetail = false): number {
  const rows = process.stdout.rows || 24;
  const reservedRows = 8 + (showDetail ? detailPanelLineLimit() + 2 : 0);
  const rowHeight = 4;
  return Math.max(1, Math.min(12, Math.floor((rows - reservedRows) / rowHeight)));
}

function scrollOffset(offset: number, cursor: number, visibleCount: number, total: number): number {
  if (total <= visibleCount) return 0;
  let nextOffset = offset;
  if (cursor < nextOffset) nextOffset = cursor;
  if (cursor >= nextOffset + visibleCount) nextOffset = cursor - visibleCount + 1;
  return Math.max(0, Math.min(nextOffset, total - visibleCount));
}

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, "");
}

function fuzzyScore(text: string, query: string): number | null {
  let score = 0;
  let textIndex = 0;
  let previousMatch = -1;

  for (const char of query) {
    const found = text.indexOf(char, textIndex);
    if (found === -1) return null;
    score += found === previousMatch + 1 ? 3 : 1;
    previousMatch = found;
    textIndex = found + 1;
  }

  return score - text.length / 1000;
}
