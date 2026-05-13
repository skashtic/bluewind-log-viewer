import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { startWith } from 'rxjs';
import { LogsStore, logFiltersKey } from './logs.store';
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

  private readonly rawFilterFormValues = toSignal(
    this.filterForm.valueChanges.pipe(startWith(this.filterForm.getRawValue())),
    { initialValue: this.filterForm.getRawValue() }
  );

  /** Dim Apply when the form matches the last successful load (or while loading). */
  readonly applyFiltersButtonDisabled = computed(() => {
    if (this.store.loading()) return true;
    const applied = this.store.lastAppliedFiltersKey();
    if (applied === null) return false;
    const key = logFiltersKey(this.buildFiltersFromForm(this.rawFilterFormValues() ?? {}));
    return key === applied;
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
    this.store.loadLogs(this.buildFiltersFromForm(this.filterForm.getRawValue()));
  }

  onClearFilters(): void {
    this.filterForm.reset({ severity: '', search: '', from: '', to: '' });
    this.store.loadLogs({});
  }

  private buildFiltersFromForm(raw: Record<string, unknown>): LogFilters {
    const filters: LogFilters = {};
    const severity = raw['severity'];
    if (typeof severity === 'string' && severity) {
      filters.severity = severity as LogSeverity;
    }
    const search = raw['search'];
    if (typeof search === 'string' && search.trim()) {
      filters.search = search.trim();
    }
    const from = raw['from'];
    if (typeof from === 'string' && from) {
      filters.from = new Date(from).toISOString();
    }
    const to = raw['to'];
    if (typeof to === 'string' && to) {
      filters.to = new Date(to).toISOString();
    }
    return filters;
  }

  formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleString();
  }
}
