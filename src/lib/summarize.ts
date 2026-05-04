import { run } from "./exec.js";
import { targetCommand } from "./prompt.js";
import type { Agent, CommandSpec, Locale } from "./types.js";

interface SummarizeOptions {
  source: Agent;
  locale: Locale;
  cwd?: string;
}

export async function summarizeSession(sessionMarkdown: string, { source, locale, cwd }: SummarizeOptions): Promise<string> {
  if (!sessionMarkdown.trim()) return "";

  const command = summarizerCommand(source);
  const prompt = buildSummarizerPrompt(sessionMarkdown, locale);
  const result = await run(command.bin, command.args, { cwd, stdin: prompt });
  if (!result.ok) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.code}`;
    throw new Error(`Summarizer failed (${command.bin} ${command.args.join(" ")}): ${detail}`);
  }
  return result.stdout.trim();
}

function summarizerCommand(source: Agent): CommandSpec {
  const configured = process.env.AGENT_HANDOFF_SUMMARIZER_BIN;
  if (configured) return splitCommand(configured);

  const base = splitCommand(targetCommand(source));
  if (source === "claude") return { bin: base.bin, args: [...base.args, "--print"] };
  if (source === "codex") return { bin: base.bin, args: [...base.args, "exec", "-"] };
  return base;
}

function buildSummarizerPrompt(sessionMarkdown: string, locale: Locale): string {
  if (locale === "ja") {
    return [
      "以下はコーディング agent のセッション ログです。次の agent が作業を継続できるよう、最大 25 行で要約してください。",
      "",
      "出力には以下を含めてください:",
      "- 目的 / 達成しようとしていること",
      "- 現在の状態 / 完了済みの作業",
      "- 未解決の事項 / 次のアクション",
      "- 重要な決定事項や制約",
      "",
      "コマンド、ファイルパス、識別子、エラーメッセージは原文のまま保持してください。",
      "前置きや補足は書かず、要約本文のみ返してください。",
      "",
      "--- session log ---",
      sessionMarkdown,
    ].join("\n");
  }

  return [
    "The following is a coding agent session log. Summarize it in at most 25 lines so the next agent can continue.",
    "",
    "Include:",
    "- Goal / what is being attempted",
    "- Current state / what is done",
    "- Open items / next actions",
    "- Key decisions or constraints",
    "",
    "Preserve commands, file paths, identifiers, and error messages verbatim.",
    "Output only the summary, no preamble.",
    "",
    "--- session log ---",
    sessionMarkdown,
  ].join("\n");
}

function splitCommand(value: string): CommandSpec {
  const parts = value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((part) => part.replace(/^["']|["']$/g, "")) ?? [];
  if (parts.length === 0) throw new Error("Empty command.");
  return { bin: parts[0], args: parts.slice(1) };
}
