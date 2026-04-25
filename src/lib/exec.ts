import { spawn } from "node:child_process";
import type { RunOptions, RunResult } from "./types.js";

export async function run(command: string, args: string[] = [], options: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: options.shell ?? false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ ok: false, code: null, stdout, stderr: error.message });
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

export async function runInteractive(command: string, args: string[] = [], options: RunOptions = {}): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: options.shell ?? false,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", resolve);
  });
}

export function commandString(command: string, args: string[] = []): string {
  return [command, ...args].map(quoteArg).join(" ");
}

function quoteArg(value: string): string {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) return value;
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}
