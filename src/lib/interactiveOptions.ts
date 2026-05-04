import { pickChoice } from "./choicePicker.js";
import type { Detail, Locale } from "./types.js";

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

export function parseDetail(value: unknown): Detail {
  if (value === "summary" || value === "standard" || value === "full") return value;
  throw new Error("--detail must be summary, standard, or full.");
}

export async function resolveDetail(value: unknown): Promise<Detail> {
  if (value !== undefined) return parseDetail(value);
  return pickChoice("How much detail should the handoff include?", [
    { label: "summary", value: "summary", description: "LLM-compressed summary only (smallest context)" },
    { label: "standard", value: "standard", description: "full session summary from continues" },
    { label: "full", value: "full", description: "standard plus full git diff" },
  ]);
}
