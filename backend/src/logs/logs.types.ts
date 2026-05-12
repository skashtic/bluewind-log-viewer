export type LogSeverity = "INFO" | "WARNING" | "ERROR" | "DEBUG";

export interface LogEntry {
  id: string;
  lineNumber: number;
  timestamp: string;
  severity: LogSeverity;
  message: string;
}

export interface LogFilters {
  severity?: LogSeverity;
  search?: string;
  from?: string;
  to?: string;
}

export interface ParseError {
  lineNumber: number;
  rawLine: string;
  reason: string;
}

export interface ImportSummary {
  totalLines: number;
  validEntries: number;
  parseErrors: number;
  bySeverity: Record<LogSeverity, number>;
}

export interface ImportResponse {
  summary: ImportSummary;
}

export interface LogsResponse {
  items: LogEntry[];
  total: number;
}

export interface LogsSummaryResponse {
  total: number;
  bySeverity: Record<LogSeverity, number>;
}
