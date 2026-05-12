import { LogEntry } from "./logs.types";

export const mockLogEntries: LogEntry[] = [
  {
    id: "1",
    timestamp: "2026-05-12T08:00:00.000Z",
    severity: "INFO",
    message: "Application started successfully",
  },
  {
    id: "2",
    timestamp: "2026-05-12T08:01:15.000Z",
    severity: "DEBUG",
    message: "Loading configuration from environment",
  },
  {
    id: "3",
    timestamp: "2026-05-12T08:02:30.000Z",
    severity: "INFO",
    message: "Connected to database on port 5432",
  },
  {
    id: "4",
    timestamp: "2026-05-12T08:05:00.000Z",
    severity: "WARNING",
    message: "Memory usage exceeded 80% threshold",
  },
  {
    id: "5",
    timestamp: "2026-05-12T08:07:45.000Z",
    severity: "ERROR",
    message: "Failed to fetch user data: connection timeout",
  },
  {
    id: "6",
    timestamp: "2026-05-12T08:10:00.000Z",
    severity: "INFO",
    message: "Scheduled job started: log rotation",
  },
  {
    id: "7",
    timestamp: "2026-05-12T08:12:22.000Z",
    severity: "DEBUG",
    message: "Cache miss for key: user_session_4821",
  },
  {
    id: "8",
    timestamp: "2026-05-12T08:15:00.000Z",
    severity: "WARNING",
    message: "Retry attempt 2 of 3 for external API call",
  },
  {
    id: "9",
    timestamp: "2026-05-12T08:17:10.000Z",
    severity: "ERROR",
    message: "Unhandled exception in payment processor module",
  },
  {
    id: "10",
    timestamp: "2026-05-12T08:20:00.000Z",
    severity: "INFO",
    message: "Health check passed — all services responding",
  },
];
