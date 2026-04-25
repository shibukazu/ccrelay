import { pickChoice } from "./choicePicker.js";
import type { Locale } from "./types.js";

export function parseLocale(value: unknown): Locale {
  if (value === "en" || value === "ja") return value;
  throw new Error("--locale must be en or ja.");
}

export async function resolveLocale(value: unknown): Promise<Locale> {
  if (value !== undefined) return parseLocale(value);
  return pickChoice("Generate handoff in which locale?", [
    { label: "ja", value: "ja", description: "Japanese handoff sections and prompts" },
    { label: "en", value: "en", description: "English handoff sections and prompts" },
  ]);
}
