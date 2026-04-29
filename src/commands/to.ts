import { parseOptions } from "../lib/args.js";
import { pickChoice } from "../lib/choicePicker.js";
import { runInteractive } from "../lib/exec.js";
import { repoRoot } from "../lib/git.js";
import { readHandoffFile, writePromptFile } from "../lib/handoff.js";
import { resolveLocale } from "../lib/interactiveOptions.js";
import { buildPrompt, targetCommand } from "../lib/prompt.js";
import { withAlternateScreen } from "../lib/screen.js";
import type { CommandSpec, Locale, TargetAgent } from "../lib/types.js";
import { runWrite } from "./write.js";

export async function runTo(target: TargetAgent, argv: string[]): Promise<void> {
  const options = parseOptions(argv, {
    from: "value",
    locale: "value",
    session: "value",
  });

  const root = await repoRoot(process.cwd());

  let locale: Locale;

  if (!options.noWrite) {
    // Wrap locale picker + from picker + all write pickers in one screen session.
    // runWrite has its own withAlternateScreen; nesting is handled by the depth counter.
    locale = await withAlternateScreen(async () => {
      const resolvedLocale = await resolveLocale(options.locale);
      const from = typeof options.from === "string" ? options.from : await pickFromAgent(target);

      const writeArgs: string[] = ["--from", from, "--locale", resolvedLocale, "--target", target];
      if (typeof options.session === "string") writeArgs.push("--session", options.session);
      if (options.latest) writeArgs.push("--latest");

      await runWrite(writeArgs, { root, silent: true });
      return resolvedLocale;
    });
  } else {
    await readHandoffFile(root).catch(() => {
      throw new Error(".handoff/current.md does not exist. Run ccrelay write first or omit --no-write.");
    });
    locale = await resolveLocale(options.locale);
  }

  const prompt = buildPrompt(target, locale);
  const promptPath = await writePromptFile(root, target, prompt);

  if (options.dryRun) {
    console.log(prompt);
    console.error(`\nWrote ${promptPath}`);
    return;
  }

  const configured = targetCommand(target);
  const { bin, args } = splitCommand(configured);
  const code = await runInteractive(bin, [...args, prompt], { cwd: root });
  if (code !== 0) {
    throw new Error(`${target} exited with code ${code ?? "unknown"}.`);
  }
}

async function pickFromAgent(target: TargetAgent): Promise<TargetAgent> {
  const recommended = target === "codex" ? "claude" : "codex";
  const other = target === "codex" ? "codex" : "claude";
  return pickChoice(`Continue to ${target} from which source agent?`, [
    { label: recommended, value: recommended, description: "recommended default handoff direction" },
    { label: other, value: other, description: "use this source instead" },
  ]);
}

function splitCommand(value: string): CommandSpec {
  const parts = value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((part) => part.replace(/^["']|["']$/g, "")) ?? [];
  if (parts.length === 0) throw new Error("Empty agent command.");
  return { bin: parts[0], args: parts.slice(1) };
}
