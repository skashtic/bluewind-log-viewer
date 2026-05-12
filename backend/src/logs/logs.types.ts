export type Severity = "INFO" | "WARNING" | "ERROR" | "DEBUG";

export interface LogEntry {
  id: string;
  timestamp: string;
  severity: Severity;
  message: string;
}

export interface LogsFilter {
  severity?: Severity;
  search?: string;
  from?: string;
  to?: string;
}

export interface LogsResponse {
  items: LogEntry[];
  total: number;
}

export interface LogsSummaryResponse {
  total: number;
  bySeverity: Record<Severity, number>;
}
