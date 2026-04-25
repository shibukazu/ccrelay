import { run } from "./exec.js";

export async function repoRoot(cwd = process.cwd()): Promise<string> {
  const result = await run("git", ["rev-parse", "--show-toplevel"], { cwd });
  if (!result.ok) {
    throw new Error("Not inside a git repository.");
  }
  return result.stdout.trim();
}

export async function gitOutput(args: string[], cwd: string): Promise<string> {
  const result = await run("git", args, { cwd });
  if (!result.ok) {
    throw new Error(`git ${args.join(" ")} failed:\n${result.stderr.trim() || result.stdout.trim()}`);
  }
  return result.stdout.trimEnd();
}

export async function gitStatus(cwd: string): Promise<string> {
  return gitOutput(["status", "--short"], cwd);
}

export async function gitDiffStat(cwd: string): Promise<string> {
  return gitOutput(["diff", "--stat"], cwd);
}

export async function gitDiff(cwd: string): Promise<string> {
  return gitOutput(["diff"], cwd);
}
