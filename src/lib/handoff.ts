import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CURRENT_HANDOFF, HANDOFF_DIR } from "./paths.js";
import type { HandoffData, TargetAgent } from "./types.js";

export async function writeHandoffFile(root: string, content: string): Promise<string> {
  await mkdir(join(root, HANDOFF_DIR), { recursive: true });
  const path = join(root, CURRENT_HANDOFF);
  await writeFile(path, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  return path;
}

export async function readHandoffFile(root: string): Promise<string> {
  return readFile(join(root, CURRENT_HANDOFF), "utf8");
}

export async function writePromptFile(root: string, target: TargetAgent, prompt: string): Promise<string> {
  await mkdir(join(root, HANDOFF_DIR), { recursive: true });
  const path = join(root, HANDOFF_DIR, target === "codex" ? "last-codex-prompt.md" : "last-claude-prompt.md");
  await writeFile(path, prompt.endsWith("\n") ? prompt : `${prompt}\n`, "utf8");
  return path;
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function buildHandoffMarkdown(data: HandoffData): string {
  if (data.locale === "ja") return buildJapaneseHandoffMarkdown(data);
  return buildEnglishHandoffMarkdown(data);
}

function buildEnglishHandoffMarkdown(data: HandoffData): string {
  const diffBlock = data.diff ? `\n## Git Diff\n\n\`\`\`diff\n${data.diff || "(no diff)"}\n\`\`\`\n` : "";
  const modifiedFiles = data.modifiedFiles.length > 0
    ? data.modifiedFiles.map((line) => `- \`${line}\``).join("\n")
    : "- (no modified files reported by git status)";
  const compactBlock = data.compactSummary
    ? `\n## Compact Summary\n\n${data.compactSummary}\n`
    : "";
  const sessionBlock = data.sessionSummary
    ? `\n## Session Summary\n\n${data.sessionSummary}\n`
    : "";

  return `# Agent Handoff

## Metadata
- Generated at: ${data.generatedAt}
- Repository: ${data.repository}
- Source agent: ${data.sourceAgent ?? "unknown"}
- Session id: ${data.sessionId ?? "unknown"}
- Detail: ${data.detail}

## Critical Instructions
- Continue from the current working tree.
- Inspect git status and git diff before editing.
- Do not revert existing user changes.
- Treat this handoff as context, not as proof.

## Goal
Continue the current repository work safely from the latest available agent session and actual git working tree.

## Current State
This handoff was generated from the current workspace plus the selected session summary. Verify the workspace before making edits.
${compactBlock}${sessionBlock}
## Modified Files
${modifiedFiles}

## Git Status

\`\`\`text
${data.gitStatus || "(clean)"}
\`\`\`

## Git Diff Stat

\`\`\`text
${data.gitDiffStat || "(no diff)"}
\`\`\`
${diffBlock}
## Next Steps
- Read this file.
- Run \`git status --short\`.
- Run \`git diff\`.
- Continue from the actual workspace state.

## Known Failures / Risks
- Session summaries can be incomplete or stale.
- If this handoff conflicts with the workspace, trust the workspace.

## Relevant Repo Instructions
${data.repoInstructions.length > 0 ? data.repoInstructions.map((item) => `- ${item}`).join("\n") : "- No AGENTS.md, CLAUDE.md, or .claude/ entry detected at repository root."}
`;
}

function buildJapaneseHandoffMarkdown(data: HandoffData): string {
  const diffBlock = data.diff ? `\n## Git Diff\n\n\`\`\`diff\n${data.diff || "(diff なし)"}\n\`\`\`\n` : "";
  const modifiedFiles = data.modifiedFiles.length > 0
    ? data.modifiedFiles.map((line) => `- \`${line}\``).join("\n")
    : "- (git status で変更中のファイルは検出されませんでした)";
  const compactBlock = data.compactSummary
    ? `\n## 要約\n\n${data.compactSummary}\n`
    : "";
  const sessionBlock = data.sessionSummary
    ? `\n## Session Summary\n\n以下は \`continues\` から得た session summary です。原文の情報を保つため、内容は翻訳せずそのまま残しています。\n\n${data.sessionSummary}\n`
    : "";

  return `# Agent Handoff

## メタデータ
- 生成日時: ${data.generatedAt}
- リポジトリ: ${data.repository}
- 引き継ぎ元 agent: ${data.sourceAgent ?? "unknown"}
- Session id: ${data.sessionId ?? "unknown"}
- Locale: ja
- Detail: ${data.detail}

## 重要な指示
- 現在の working tree から作業を継続すること。
- 編集前に必ず \`git status\` と \`git diff\` を確認すること。
- 既存のユーザー変更を revert しないこと。
- この handoff は文脈であり、実際にファイルが変更された証拠として扱わないこと。
- handoff と workspace が矛盾する場合は workspace を信頼すること。

## 目的
最新の agent session と現在の git working tree をもとに、安全に作業を継続する。

## 現在の状態
この handoff は、現在の workspace と選択された session summary から生成されています。作業前に必ず実際の workspace を確認してください。
${compactBlock}${sessionBlock}
## 変更中のファイル
${modifiedFiles}

## Git Status

\`\`\`text
${data.gitStatus || "(clean)"}
\`\`\`

## Git Diff Stat

\`\`\`text
${data.gitDiffStat || "(diff なし)"}
\`\`\`
${diffBlock}
## 次にやること
- このファイルを読む。
- \`git status --short\` を実行する。
- \`git diff\` を実行する。
- 実際の workspace の状態を信頼して作業を継続する。

## 既知の失敗 / リスク
- session summary は不完全または古い可能性があります。
- handoff と workspace が矛盾する場合は workspace を信頼してください。
- コマンド、ファイルパス、識別子、エラーメッセージは原文のまま扱ってください。

## 関連するリポジトリ指示
${data.repoInstructions.length > 0 ? data.repoInstructions.map((item) => `- ${item}`).join("\n") : "- リポジトリルートに AGENTS.md、CLAUDE.md、.claude/ は検出されませんでした。"}
`;
}
