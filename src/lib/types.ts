export type Agent = "claude" | "codex";
export type TargetAgent = Agent;
export type Locale = "en" | "ja";

export interface CommandSpec {
  bin: string;
  args: string[];
}

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  shell?: boolean;
}

export interface RunResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface ParsedOptions {
  _: string[];
  [key: string]: string | boolean | string[];
}

export interface SessionCandidate {
  id?: string;
  sessionId?: string;
  shortId?: string;
  source?: string;
  tool?: string;
  agent?: string;
  cwd?: string;
  path?: string;
  projectPath?: string;
  repository?: string;
  repo?: string;
  updatedAt?: string;
  lastModified?: string;
  timestamp?: string;
  createdAt?: string;
  mtime?: string;
  title?: string;
  summary?: string;
  name?: string;
  description?: string;
}

export interface HandoffData {
  generatedAt: string;
  repository: string;
  sourceAgent?: string;
  targetAgent?: string;
  sessionId?: string;
  sessionSummary?: string;
  modifiedFiles: string[];
  gitStatus: string;
  gitDiffStat: string;
  diff?: string;
  repoInstructions: string[];
  locale: Locale;
}
