import { Injectable, inject, signal } from '@angular/core';
import { LogsApiService } from './logs-api.service';
import {
  LogEntry,
  LogFilters,
  LogsSummaryResponse,
  ParseError,
} from './logs.types';
import { defer, retry } from 'rxjs';

/** Stable string for comparing applied filter payloads (empty fields omitted). */
export function logFiltersKey(filters: LogFilters): string {
  const normalized: LogFilters = {};
  if (filters.severity) normalized.severity = filters.severity;
  if (filters.search != null && filters.search.trim() !== '') {
    normalized.search = filters.search.trim();
  }
  if (filters.from) normalized.from = filters.from;
  if (filters.to) normalized.to = filters.to;
  return JSON.stringify(normalized);
}

@Injectable({ providedIn: 'root' })
export class LogsStore {
  private readonly api = inject(LogsApiService);

  readonly logs = signal<LogEntry[]>([]);
  readonly summary = signal<LogsSummaryResponse | null>(null);
  readonly parseErrors = signal<ParseError[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly logQueryActive = signal(false);
  /** Set after each successful `loadLogs` (including auto-load and import). `null` until first success. */
  readonly lastAppliedFiltersKey = signal<string | null>(null);

  private readonly emptySummary: LogsSummaryResponse = {
    total: 0,
    bySeverity: { INFO: 0, WARNING: 0, ERROR: 0, DEBUG: 0 },
  };

  importLogs(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const importRetries = 2;

    defer(() => this.api.import())
      .pipe(retry(importRetries))
      .subscribe({
        next: () => {
          this.loadErrors();
          this.api.getSummary().subscribe({
            next: (data) => {
              this.summary.set(data);
              if (data.total > 0) {
                this.loadLogs({});
              } else {
                this.loading.set(false);
              }
            },
            error: () => {
              this.loading.set(false);
            },
          });
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.error ?? 'Import failed.');
          this.loading.set(false);
        },
      });
  }

  loadLogs(filters: LogFilters): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.logQueryActive.set(true);

    this.api.getLogs(filters).subscribe({
      next: (response) => {
        this.logs.set(response.items);
        this.lastAppliedFiltersKey.set(logFiltersKey(filters));
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? 'Failed to load logs.');
        this.loading.set(false);
      },
    });
  }

  loadSummary(): void {
    this.api.getSummary().subscribe({
      next: (data) => this.summary.set(data),
      error: () => {},
    });
  }

  loadErrors(): void {
    this.api.getErrors().subscribe({
      next: (data) => this.parseErrors.set(data),
      error: () => {},
    });
  }

  resetDemoData(onComplete?: () => void): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.reset().subscribe({
      next: () => {
        this.logs.set([]);
        this.parseErrors.set([]);
        this.summary.set(this.emptySummary);
        this.logQueryActive.set(false);
        this.lastAppliedFiltersKey.set(null);
        this.loading.set(false);
        onComplete?.();
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? 'Reset failed.');
        this.loading.set(false);
      },
    });
  }
}
