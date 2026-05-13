import { LogEntry, LogSeverity, ParseError } from "./logs.types";

const KNOWN_SEVERITY_GROUP = "(?:INFO|WARNING|ERROR|DEBUG)";

// Known-severity header starting anywhere in the line (used to split concatenated entries).
const EMBEDDED_KNOWN_HEADER_REGEX = new RegExp(
  `\\d{4}-\\d{2}-\\d{2} (?:\\d{2}:\\d{2}:\\d{2}|\\d{6}) \\[${KNOWN_SEVERITY_GROUP}\\] `,
  "g"
);

// Known severity; time is either HH:mm:ss or exactly 6 digits (compact HHmmss).
const VALID_LINE_KNOWN_SEVERITY_REGEX =
  /^(\d{4}-\d{2}-\d{2}) (?:(\d{2}:\d{2}:\d{2})|(\d{6})) \[(INFO|WARNING|ERROR|DEBUG)\] (.+)$/;

// Any ALL-CAPS severity; time is colon or 6-digit compact.
const UNKNOWN_SEVERITY_REGEX =
  /^(\d{4}-\d{2}-\d{2}) (?:(\d{2}:\d{2}:\d{2})|(\d{6})) \[([A-Z][A-Z0-9_]*)\] (.+)$/;

// Header-shaped line: date, non-empty time token, bracketed severity — but time is
// neither HH:mm:ss nor exactly 6 digits (e.g. partial or alphabetic time field).
const MALFORMED_TIMESTAMP_HEADER_REGEX =
  /^(\d{4}-\d{2}-\d{2}) (\S+) \[([A-Z][A-Z0-9_]*)\] (.+)$/;

// A line that starts with a date-like prefix but failed all header patterns.
const DATE_LIKE_START_REGEX = /^\d{4}-\d{2}-\d{2}/;

interface ProcessedLine {
  lineNumber: number;
  rawLine: string;
}

/** HHmmss (6 digits) → HH:mm:ss. Returns null if not exactly 6 digits or out of range. */
function normalizeCompactSixDigits(compact: string): string | null {
  if (!/^\d{6}$/.test(compact)) return null;
  const hh = parseInt(compact.slice(0, 2), 10);
  const mm = parseInt(compact.slice(2, 4), 10);
  const ss = parseInt(compact.slice(4, 6), 10);
  if (hh > 23 || mm > 59 || ss > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function buildRawTimestamp(
  datePart: string,
  colonTime: string | undefined,
  compactTime: string | undefined
): { rawTimestamp: string } | null {
  if (colonTime) {
    return { rawTimestamp: `${datePart} ${colonTime}` };
  }
  if (compactTime) {
    const normalized = normalizeCompactSixDigits(compactTime);
    if (!normalized) return null;
    return { rawTimestamp: `${datePart} ${normalized}` };
  }
  return null;
}

// Split physical lines at every embedded known-severity log header. Fragments keep
// the original line number (same as previous expandEmbeddedHeaders contract).
function expandEmbeddedHeaders(inputLines: string[]): ProcessedLine[] {
  const result: ProcessedLine[] = [];

  for (let i = 0; i < inputLines.length; i++) {
    const lineNumber = i + 1;
    const line = inputLines[i];
    const matches = [...line.matchAll(EMBEDDED_KNOWN_HEADER_REGEX)];

    if (matches.length === 0) {
      result.push({ lineNumber, rawLine: line });
      continue;
    }

    const firstIdx = matches[0].index ?? 0;
    if (firstIdx > 0) {
      const prefix = line.slice(0, firstIdx).trimEnd();
      if (prefix.length > 0) {
        result.push({ lineNumber, rawLine: prefix });
      }
    }

    for (let k = 0; k < matches.length; k++) {
      const start = matches[k].index!;
      const end = k + 1 < matches.length ? matches[k + 1].index! : line.length;
      result.push({ lineNumber, rawLine: line.slice(start, end).trimEnd() });
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

function tryParseMalformedTimeToken(timeToken: string): boolean {
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeToken)) return false;
  if (/^\d{6}$/.test(timeToken)) return false;
  return true;
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

    // Case 1: Known severity; time is HH:mm:ss or compact 6 digits.
    const validMatch = VALID_LINE_KNOWN_SEVERITY_REGEX.exec(rawLine);
    if (validMatch) {
      const [, datePart, colonTime, compactTime, severity, message] = validMatch;
      const built = buildRawTimestamp(datePart, colonTime, compactTime);
      if (!built) {
        errors.push({ lineNumber, rawLine, reason: "INVALID_TIMESTAMP" });
        canContinue = false;
        continue;
      }
      const { rawTimestamp } = built;
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

    // Case 2: Colon or 6-digit time structure but unrecognised severity.
    if (UNKNOWN_SEVERITY_REGEX.test(rawLine)) {
      errors.push({ lineNumber, rawLine, reason: "UNSUPPORTED_SEVERITY" });
      canContinue = false;
      continue;
    }

    // Case 3: Header-shaped date + bracketed severity but time token is neither
    // HH:mm:ss nor exactly six digits.
    const malformedParts = MALFORMED_TIMESTAMP_HEADER_REGEX.exec(rawLine);
    if (malformedParts) {
      const timeToken = malformedParts[2];
      if (tryParseMalformedTimeToken(timeToken)) {
        errors.push({ lineNumber, rawLine, reason: "INVALID_TIMESTAMP" });
        canContinue = false;
        continue;
      }
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
