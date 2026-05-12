import { LogEntry, LogSeverity, ParseError } from "./logs.types";

// Strict match: known severity, correctly structured timestamp placeholder.
// Timestamp digit ranges are NOT validated by the regex — component re-check follows.
const VALID_LINE_REGEX =
  /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(INFO|WARNING|ERROR|DEBUG)\] (.+)$/;

// Same structure but accepts any ALL-CAPS severity word → UNSUPPORTED_SEVERITY.
const UNKNOWN_SEVERITY_REGEX =
  /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[([A-Z][A-Z0-9_]*)\] (.+)$/;

// Header-shaped line with a non-standard time field (e.g. "101645" instead of
// "10:16:45") → INVALID_TIMESTAMP. Checked after the strict regexes above.
const MALFORMED_TIMESTAMP_HEADER_REGEX =
  /^(\d{4}-\d{2}-\d{2} \S+) \[([A-Z][A-Z0-9_]*)\] (.+)$/;

// An embedded log header appearing after position 0 in a line.
// Must use the strict HH:MM:SS format to avoid false positives.
const EMBEDDED_HEADER_REGEX =
  /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \[[A-Z]+\] )/;

// A line that starts with a date-like prefix but failed all header patterns.
const DATE_LIKE_START_REGEX = /^\d{4}-\d{2}-\d{2}/;

interface ProcessedLine {
  lineNumber: number;
  rawLine: string;
}

// Split lines that contain an embedded log header after position 0.
// Both pieces keep the original line number.
// We search from position 1 so the line's own leading header (if any) is skipped.
function expandEmbeddedHeaders(inputLines: string[]): ProcessedLine[] {
  const result: ProcessedLine[] = [];

  for (let i = 0; i < inputLines.length; i++) {
    const lineNumber = i + 1;
    const line = inputLines[i];
    const match = EMBEDDED_HEADER_REGEX.exec(line.slice(1));

    if (match) {
      const splitAt = 1 + match.index;
      result.push({ lineNumber, rawLine: line.slice(0, splitAt).trimEnd() });
      result.push({ lineNumber, rawLine: line.slice(splitAt) });
    } else {
      result.push({ lineNumber, rawLine: line });
    }
  }

  return result;
}

// Verify that the Date produced from rawTimestamp has not silently overflowed
// to a different calendar date (e.g. Feb 30 → Mar 2).
// Uses local-time components since the log format has no timezone offset.
function isTimestampExact(rawTimestamp: string, date: Date): boolean {
  const parts = rawTimestamp.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
  );
  if (!parts) return false;

  const [, y, mo, d, h, mi, s] = parts.map(Number);
  return (
    date.getFullYear() === y &&
    date.getMonth() + 1 === mo &&
    date.getDate() === d &&
    date.getHours() === h &&
    date.getMinutes() === mi &&
    date.getSeconds() === s
  );
}

export interface ParseResult {
  entries: LogEntry[];
  errors: ParseError[];
}

export function parseLines(inputLines: string[]): ParseResult {
  const processedLines = expandEmbeddedHeaders(inputLines);
  const entries: LogEntry[] = [];
  const errors: ParseError[] = [];
  let entryIdCounter = 1;

  // True only immediately after a successfully parsed entry.
  // Reset to false whenever a malformed line is recorded as an error.
  // Blank lines do not affect this flag.
  let canContinue = false;

  for (const { lineNumber, rawLine: rawLineWithCR } of processedLines) {
    // Strip trailing \r to be robust against CRLF line endings passed directly.
    const rawLine = rawLineWithCR.replace(/\r$/, "");

    if (rawLine.trim() === "") {
      continue;
    }

    // Case 1: Full match — known severity, correct structure.
    const validMatch = VALID_LINE_REGEX.exec(rawLine);
    if (validMatch) {
      const [, rawTimestamp, severity, message] = validMatch;
      const date = new Date(rawTimestamp);

      if (isNaN(date.getTime()) || !isTimestampExact(rawTimestamp, date)) {
        errors.push({ lineNumber, rawLine, reason: "INVALID_TIMESTAMP" });
        canContinue = false;
        continue;
      }

      entries.push({
        id: String(entryIdCounter++),
        lineNumber,
        timestamp: date.toISOString(),
        severity: severity as LogSeverity,
        message,
      });
      canContinue = true;
      continue;
    }

    // Case 2: Correct HH:MM:SS structure but unrecognised severity.
    if (UNKNOWN_SEVERITY_REGEX.test(rawLine)) {
      errors.push({ lineNumber, rawLine, reason: "UNSUPPORTED_SEVERITY" });
      canContinue = false;
      continue;
    }

    // Case 3: Header-shaped but time portion is non-standard (e.g. "101645").
    if (MALFORMED_TIMESTAMP_HEADER_REGEX.test(rawLine)) {
      errors.push({ lineNumber, rawLine, reason: "INVALID_TIMESTAMP" });
      canContinue = false;
      continue;
    }

    // Case 4: Starts with a date-like prefix but is otherwise malformed.
    if (DATE_LIKE_START_REGEX.test(rawLine)) {
      errors.push({ lineNumber, rawLine, reason: "INVALID_FORMAT" });
      canContinue = false;
      continue;
    }

    // Case 5: Plain text — continuation only if the last parsed line was a
    // valid entry. If a malformed line appeared in between, treat as orphan.
    if (canContinue) {
      entries[entries.length - 1].message += "\n" + rawLine;
    } else {
      errors.push({ lineNumber, rawLine, reason: "ORPHAN_CONTINUATION_LINE" });
    }
  }

  return { entries, errors };
}
