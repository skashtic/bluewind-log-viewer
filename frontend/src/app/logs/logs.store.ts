import { Injectable, inject, signal } from '@angular/core';
import { LogsApiService } from './logs-api.service';
import {
  LogEntry,
  LogFilters,
  LogsSummaryResponse,
  ParseError,
} from './logs.types';

@Injectable({ providedIn: 'root' })
export class LogsStore {
  private readonly api = inject(LogsApiService);

  readonly logs = signal<LogEntry[]>([]);
  readonly summary = signal<LogsSummaryResponse | null>(null);
  readonly parseErrors = signal<ParseError[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  importLogs(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.import().subscribe({
      next: () => {
        this.loadSummary();
        this.loadErrors();
        this.loadLogs({});
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

    this.api.getLogs(filters).subscribe({
      next: (response) => {
        this.logs.set(response.items);
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
}
