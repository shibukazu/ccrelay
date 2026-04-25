import readline from "node:readline";
import { enterAlternateScreen, exitAlternateScreen } from "./screen.js";

export interface Choice<T extends string> {
  label: string;
  value: T;
  description?: string;
}

interface ChoiceState {
  cursor: number;
}

const styles = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  selected: "\x1b[48;5;60m\x1b[97m",
};

export async function pickChoice<T extends string>(title: string, choices: Choice<T>[]): Promise<T> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(`${title} requires interactive input. Pass the corresponding CLI flag instead.`);
  }
  if (choices.length === 0) throw new Error(`No choices available for ${title}.`);

  const state: ChoiceState = { cursor: 0 };
  const previousRawMode = process.stdin.isRaw;
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      process.stdin.off("keypress", onKeypress);
      process.stdin.setRawMode(previousRawMode);
      process.stdin.pause();
      exitAlternateScreen();
    };

    const onKeypress = (_input: string, key: readline.Key): void => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Selection cancelled."));
        return;
      }
      if (key.name === "escape") {
        cleanup();
        reject(new Error("Selection cancelled."));
        return;
      }
      if (key.name === "return") {
        const selected = choices[state.cursor];
        cleanup();
        resolve(selected.value);
        return;
      }
      if (key.name === "up") {
        state.cursor = Math.max(0, state.cursor - 1);
        renderChoice(title, choices, state);
        return;
      }
      if (key.name === "down") {
        state.cursor = Math.min(choices.length - 1, state.cursor + 1);
        renderChoice(title, choices, state);
      }
    };

    enterAlternateScreen();
    process.stdin.on("keypress", onKeypress);
    renderChoice(title, choices, state);
  });
}

function renderChoice<T extends string>(title: string, choices: Choice<T>[], state: ChoiceState): void {
  process.stdout.write("\x1b[2J\x1b[H");
  process.stdout.write(`${styles.bold}${title}${styles.reset}\n`);
  process.stdout.write(`${styles.dim}Use Up/Down, Enter choose, Esc cancel.${styles.reset}\n\n`);

  const width = Math.max(40, process.stdout.columns || 80);
  for (const [index, choice] of choices.entries()) {
    const text = `${index === state.cursor ? "> " : "  "}${choice.label}${choice.description ? `  ${choice.description}` : ""}`;
    if (index === state.cursor) {
      process.stdout.write(`${styles.selected}${padOrTrim(text, width)}${styles.reset}\n`);
    } else {
      process.stdout.write(`  ${choice.label}`);
      if (choice.description) process.stdout.write(`  ${styles.dim}${choice.description}${styles.reset}`);
      process.stdout.write("\n");
    }
  }
}

function padOrTrim(value: string, width: number): string {
  if (value.length === width) return value;
  if (value.length < width) return value + " ".repeat(width - value.length);
  return `${value.slice(0, Math.max(0, width - 1))}…`;
}
