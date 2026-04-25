import type { ParsedOptions } from "./types.js";

type OptionKind = "value";
type OptionSpec = Record<string, OptionKind>;

export function parseOptions(argv: string[], spec: OptionSpec = {}): ParsedOptions {
  const options: ParsedOptions = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      options._.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = camelCase(rawKey);
    const expectsValue = spec[key] === "value";

    if (expectsValue) {
      const value = inlineValue ?? argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for --${rawKey}`);
      }
      options[key] = value;
      if (inlineValue === undefined) index += 1;
    } else {
      options[key] = inlineValue ?? true;
    }
  }

  return options;
}

function camelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
