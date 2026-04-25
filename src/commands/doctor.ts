import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { continuesCommand } from "../lib/continues.js";
import { commandString, run } from "../lib/exec.js";
import { repoRoot } from "../lib/git.js";
import { claudeSessionDir, codexSessionDir, HANDOFF_DIR } from "../lib/paths.js";
import { targetCommand } from "../lib/prompt.js";
import type { CommandSpec } from "../lib/types.js";

interface DoctorCheck {
  pass: boolean;
  label: string;
  detail?: string;
}

export async function runDoctor(): Promise<void> {
  const checks: DoctorCheck[] = [];
  checks.push(await commandCheck("node", ["--version"], "node is available"));
  checks.push(await commandCheck("npx", ["--version"], "npx is available"));

  const continues = continuesCommand();
  checks.push(await commandCheck(continues.bin, [...continues.args, "--help"], `continues is executable (${commandString(continues.bin, continues.args)})`));

  checks.push(await commandCheck(splitCommand(targetCommand("codex")).bin, [...splitCommand(targetCommand("codex")).args, "--version"], "codex is executable"));
  checks.push(await commandCheck(splitCommand(targetCommand("claude")).bin, [...splitCommand(targetCommand("claude")).args, "--version"], "claude is executable"));

  let root = null;
  try {
    root = await repoRoot(process.cwd());
    checks.push(ok("inside a git repository"));
  } catch (error) {
    checks.push(fail("inside a git repository", errorMessage(error)));
  }

  checks.push(await pathCheck(claudeSessionDir(), "Claude session directory is visible"));
  checks.push(await pathCheck(codexSessionDir(), "Codex session directory is visible"));

  if (root) {
    try {
      await mkdir(join(root, HANDOFF_DIR), { recursive: true });
      await access(join(root, HANDOFF_DIR));
      checks.push(ok(".handoff/ is writable"));
    } catch (error) {
      checks.push(fail(".handoff/ is writable", errorMessage(error)));
    }
  }

  for (const check of checks) {
    console.log(`${check.pass ? "ok  " : "fail"} ${check.label}${check.detail ? `\n     ${check.detail}` : ""}`);
  }

  if (checks.some((check) => !check.pass)) {
    process.exitCode = 1;
  }
}

async function commandCheck(bin: string, args: string[], label: string): Promise<DoctorCheck> {
  const result = await run(bin, args);
  return result.ok ? ok(label) : fail(label, result.stderr.trim() || result.stdout.trim() || `command failed: ${commandString(bin, args)}`);
}

async function pathCheck(path: string, label: string): Promise<DoctorCheck> {
  try {
    await access(path);
    return ok(label);
  } catch (error) {
    return fail(label, `${path}: ${errorMessage(error)}`);
  }
}

function ok(label: string): DoctorCheck {
  return { pass: true, label };
}

function fail(label: string, detail: string): DoctorCheck {
  return { pass: false, label, detail };
}

function splitCommand(value: string): CommandSpec {
  const parts = value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((part) => part.replace(/^["']|["']$/g, "")) ?? [];
  if (parts.length === 0) throw new Error("Empty command.");
  return { bin: parts[0], args: parts.slice(1) };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
