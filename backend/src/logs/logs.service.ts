import { mockLogEntries } from "./mock-log-entries";
import {
  LogEntry,
  LogsFilter,
  LogsResponse,
  LogsSummaryResponse,
  Severity,
} from "./logs.types";

const SEVERITIES: Severity[] = ["INFO", "WARNING", "ERROR", "DEBUG"];

export function getLogs(filter: LogsFilter): LogsResponse {
  let entries: LogEntry[] = [...mockLogEntries];

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
  const bySeverity = SEVERITIES.reduce((acc, sev) => {
    acc[sev] = mockLogEntries.filter((e) => e.severity === sev).length;
    return acc;
  }, {} as Record<Severity, number>);

  return { total: mockLogEntries.length, bySeverity };
}
