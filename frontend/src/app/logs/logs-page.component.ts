import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { LogsStore } from './logs.store';
import { LogFilters, LogSeverity } from './logs.types';

@Component({
  selector: 'app-logs-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './logs-page.component.html',
  styleUrl: './logs-page.component.css',
})
export class LogsPageComponent implements OnInit {
  readonly store = inject(LogsStore);
  private readonly fb = inject(FormBuilder);

  readonly severities: LogSeverity[] = ['INFO', 'WARNING', 'ERROR', 'DEBUG'];

  filterForm: FormGroup = this.fb.group({
    severity: [''],
    search: [''],
    from: [''],
    to: [''],
  });

  /** No summary yet, or repository has zero log entries — show empty-state only. */
  readonly showEmptyState = computed(() => {
    const s = this.store.summary();
    return s === null || s.total === 0;
  });

  constructor() {
    effect(() => {
      const s = this.store.summary();
      if (s === null || s.total === 0) return;
      if (this.store.logQueryActive()) return;
      if (this.store.logs().length > 0) return;
      if (this.store.loading()) return;
      this.store.loadLogs({});
    });
  }

  ngOnInit(): void {
    this.store.loadSummary();
    this.store.loadErrors();
  }

  onImport(): void {
    this.store.importLogs();
  }

  onApplyFilters(): void {
    const raw = this.filterForm.value;
    const filters: LogFilters = {};

    if (raw.severity) filters.severity = raw.severity as LogSeverity;
    if (raw.search?.trim()) filters.search = raw.search.trim();
    if (raw.from) filters.from = new Date(raw.from).toISOString();
    if (raw.to) filters.to = new Date(raw.to).toISOString();

    this.store.loadLogs(filters);
  }

  onClearFilters(): void {
    this.filterForm.reset({ severity: '', search: '', from: '', to: '' });
    this.store.loadLogs({});
  }

  formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleString();
  }
}
