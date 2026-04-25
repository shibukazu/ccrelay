let depth = 0;

export function enterAlternateScreen(): void {
  if (depth === 0) process.stdout.write("\x1b[?1049h\x1b[?25l");
  depth++;
}

export function exitAlternateScreen(): void {
  if (depth === 0) return;
  depth--;
  if (depth === 0) process.stdout.write("\x1b[?25h\x1b[?1049l");
}

export async function withAlternateScreen<T>(fn: () => Promise<T>): Promise<T> {
  enterAlternateScreen();
  try {
    return await fn();
  } finally {
    exitAlternateScreen();
  }
}
