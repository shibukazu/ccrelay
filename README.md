# ccrelay

`ccrelay` creates a handoff file so Claude Code and Codex can safely continue work from the same working tree.

The tool does not try to migrate a full conversation. It writes `.handoff/current.md` from:

- the selected `continues` session summary
- `git status --short`
- `git diff --stat`
- repository instruction files such as `AGENTS.md`, `CLAUDE.md`, and `.claude/`

## Install

```sh
npm install -g ccrelay
```

## Development

Clone the repository and install locally:

```sh
npm install -g .
```

Or run directly without installing:

```sh
npm run build
node dist/bin.js --help
```

## Commands

```sh
ccrelay doctor
ccrelay inspect [--source claude|codex] [--pick]
ccrelay write [--from claude|codex] [--locale en|ja] [--session <id>] [--latest] [--detail summary|standard|full]
ccrelay to codex [--dry-run] [--from claude] [--locale en|ja] [--session <id>] [--latest] [--detail summary|standard|full] [--no-write]
ccrelay to claude [--dry-run] [--from codex] [--locale en|ja] [--session <id>] [--latest] [--detail summary|standard|full] [--no-write]
```

`write` creates `.handoff/current.md` and does not launch another agent.

By default, commands ask for missing options interactively. For example, `write` asks for source agent, locale, handoff detail level, and then opens the session picker. `to codex` and `to claude` ask for the source agent and locale before choosing a session. `inspect` asks whether to show all sessions or filter by source.

The detail level controls how much context lands in `.handoff/current.md`:

- `summary` — invokes the source agent CLI to compress the session log into a short brief; the long `Session Summary` is omitted. Set `AGENT_HANDOFF_SUMMARIZER_BIN` to override the summarizer command (defaults to `claude --print` or `codex exec -`).
- `standard` — embeds the full `continues inspect` summary as before.
- `full` — `standard` plus the full `git diff`.

The session picker supports fuzzy search. Type to filter, use the arrow keys to move, press Tab to toggle a panel showing the latest message of the highlighted session, and press Enter to select. Use `--latest` to skip the picker and choose the newest matching session automatically, or `--session <id>` to choose a specific session.

On macOS, `write` asks whether to copy the generated handoff to `pbcopy` after writing it.

`to codex` and `to claude` update the handoff by default, write the target-specific prompt to `.handoff/last-codex-prompt.md` or `.handoff/last-claude-prompt.md`, and then launch the target agent unless `--dry-run` is set.

Use `--locale ja` to generate the fixed handoff sections and target prompt in Japanese while preserving the raw `continues` session summary.

```sh
ccrelay write --from codex --locale ja
ccrelay to claude --from codex --locale ja --dry-run
```

## Environment

```sh
AGENT_HANDOFF_CONTINUES_BIN="npx continues"
AGENT_HANDOFF_CODEX_BIN="codex"
AGENT_HANDOFF_CLAUDE_BIN="claude"
AGENT_HANDOFF_SUMMARIZER_BIN="claude --print"
```

## Safety

The CLI does not run destructive git commands. It does not stage, commit, reset, checkout, or delete repository files.

The generated handoff tells the receiving agent to inspect the real workspace with `git status` and `git diff` before editing, and to trust the workspace if it conflicts with the summary.
