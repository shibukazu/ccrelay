import { platform } from "node:os";
import { pickChoice } from "./choicePicker.js";
import { run } from "./exec.js";
import { withAlternateScreen } from "./screen.js";
import type { Locale } from "./types.js";

interface PbcopyOfferOptions {
  label: string;
  payload: string;
  locale?: Locale;
}

export async function maybeOfferPbcopy({ label, payload }: PbcopyOfferOptions): Promise<boolean> {
  if (platform() !== "darwin") return false;
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  if (!payload) return false;

  const choice = await withAlternateScreen(() => pickChoice<"yes" | "no">(`Copy ${label} to pbcopy?`, [
    { label: "yes", value: "yes", description: "send to clipboard" },
    { label: "no", value: "no", description: "skip" },
  ]));

  if (choice !== "yes") return false;

  const result = await run("pbcopy", [], { stdin: payload });
  if (!result.ok) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.code}`;
    console.warn(`pbcopy failed: ${detail}`);
    return false;
  }
  console.log(`Copied ${label} to pbcopy.`);
  return true;
}
