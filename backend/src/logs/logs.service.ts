import { ILogSourceProvider } from "./log-source.provider";
import { parseLines } from "./log-parser.service";
import * as repository from "./in-memory-logs.repository";
import {
  ImportResponse,
  LogEntry,
  LogFilters,
  LogsSummaryResponse,
  LogsResponse,
  LogSeverity,
  ParseError,
} from "./logs.types";

const SEVERITIES: LogSeverity[] = ["INFO", "WARNING", "ERROR", "DEBUG"];

export async function importLogs(
  source: ILogSourceProvider
): Promise<ImportResponse> {
  const lines = await source.readRawLines();
  const { entries, errors } = parseLines(lines);

  repository.save(entries, errors);

  const bySeverity = SEVERITIES.reduce((acc, sev) => {
    acc[sev] = entries.filter((e) => e.severity === sev).length;
    return acc;
  }, {} as Record<LogSeverity, number>);

  return {
    summary: {
      totalLines: lines.length,
      validEntries: entries.length,
      parseErrors: errors.length,
      bySeverity,
    },
  };
}

export function getLogs(filter: LogFilters): LogsResponse {
  let entries: LogEntry[] = repository.getEntries();

  if (filter.severity) {
    entries = entries.filter((e) => e.severity === filter.severity);
  }

  if (filter.search) {
    const term = filter.search.toLowerCase();
    entries = entries.filter((e) => e.message.toLowerCase().includes(term));
  }

  if (filter.from) {
    const from = new Date(filter.from).getTime();
    entries = entries.filter((e) => new Date(e.timestamp).getTime() >= from);
  }

  if (filter.to) {
    const to = new Date(filter.to).getTime();
    entries = entries.filter((e) => new Date(e.timestamp).getTime() <= to);
  }

  return { items: entries, total: entries.length };
}

export function getLogsSummary(): LogsSummaryResponse {
  const all = repository.getEntries();

  const bySeverity = SEVERITIES.reduce((acc, sev) => {
    acc[sev] = all.filter((e) => e.severity === sev).length;
    return acc;
  }, {} as Record<LogSeverity, number>);

  return { total: all.length, bySeverity };
}

export function getParseErrors(): ParseError[] {
  return repository.getErrors();
}

export function resetImportedLogs(): { status: "reset" } {
  repository.clear();
  return { status: "reset" };
}
