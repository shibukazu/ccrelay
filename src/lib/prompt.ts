import type { Locale, TargetAgent } from "./types.js";

export function buildPrompt(target: TargetAgent, locale: Locale = "en"): string {
  if (locale === "ja") return buildJapanesePrompt(target);
  return buildEnglishPrompt(target);
}

function buildEnglishPrompt(target: TargetAgent): string {
  if (target === "codex") {
    return `Continue from the current working tree.
Read .handoff/current.md first.
Inspect git status and git diff before editing.
Treat the handoff as context, not as proof that files were changed.
Do not revert existing user changes.
Do not run destructive git commands unless explicitly requested.
Follow AGENTS.md instructions if present.`;
  }

  if (target === "claude") {
    return `Read .handoff/current.md first.
Then inspect the actual workspace with git status and git diff.
Continue from the current working tree.
Do not revert existing user changes.
Use the repo's existing conventions and AGENTS.md instructions.
If the handoff conflicts with the workspace, trust the workspace.`;
  }

  throw new Error(`Unknown target: ${target}`);
}

function buildJapanesePrompt(target: TargetAgent): string {
  if (target === "codex") {
    return `現在の working tree から作業を継続してください。
最初に .handoff/current.md を読んでください。
編集前に git status と git diff を確認してください。
handoff は文脈として扱い、実際にファイルが変更された証拠として扱わないでください。
既存のユーザー変更を revert しないでください。
明示的に依頼されない限り、破壊的な git コマンドを実行しないでください。
AGENTS.md が存在する場合はその指示に従ってください。
追加の handoff notes や説明は日本語で書いてください。
コマンド、ファイルパス、識別子、エラーメッセージは原文のまま保持してください。`;
  }

  if (target === "claude") {
    return `最初に .handoff/current.md を読んでください。
その後、git status と git diff で実際の workspace を確認してください。
現在の working tree から作業を継続してください。
既存のユーザー変更を revert しないでください。
リポジトリ既存の慣習と AGENTS.md の指示に従ってください。
handoff と workspace が矛盾する場合は workspace を信頼してください。
追加の handoff notes や説明は日本語で書いてください。
コマンド、ファイルパス、識別子、エラーメッセージは原文のまま保持してください。`;
  }

  throw new Error(`Unknown target: ${target}`);
}

export function targetCommand(target: TargetAgent): string {
  if (target === "codex") return process.env.AGENT_HANDOFF_CODEX_BIN ?? "codex";
  if (target === "claude") return process.env.AGENT_HANDOFF_CLAUDE_BIN ?? "claude";
  throw new Error(`Unknown target: ${target}`);
}
