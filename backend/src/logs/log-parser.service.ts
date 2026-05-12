import { LogEntry, LogSeverity, ParseError } from "./logs.types";

const LOG_LINE_REGEX =
  /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(INFO|WARNING|ERROR|DEBUG)\] (.+)$/;

// Lines that start with a 4-digit year followed by a dash look like broken log headers.
const BROKEN_HEADER_REGEX = /^\d{4}-/;

export interface ParseResult {
  entries: LogEntry[];
  errors: ParseError[];
}

export function parseLines(lines: string[]): ParseResult {
  const entries: LogEntry[] = [];
  const errors: ParseError[] = [];
  let entryIdCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];

    if (line.trim() === "") {
      continue;
    }

    const match = LOG_LINE_REGEX.exec(line);

    if (match) {
      const [, rawTimestamp, severity, message] = match;
      entries.push({
        id: String(entryIdCounter++),
        lineNumber,
        timestamp: new Date(rawTimestamp).toISOString(),
        severity: severity as LogSeverity,
        message,
      });
      continue;
    }

    // Non-matching, non-blank line — decide: continuation or parse error.
    const lastEntry = entries[entries.length - 1];
    if (lastEntry && !BROKEN_HEADER_REGEX.test(line)) {
      lastEntry.message += "\n" + line;
    } else {
      errors.push({
        lineNumber,
        rawLine: line,
        reason: "Line does not match expected log format",
      });
    }
  }

  return { entries, errors };
}
