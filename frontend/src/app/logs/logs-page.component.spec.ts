import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { LogsPageComponent } from './logs-page.component';
import { LogsStore } from './logs.store';
import { LogsSummaryResponse } from './logs.types';

function buildStoreSpy() {
  return {
    logs: signal([]),
    summary: signal<LogsSummaryResponse | null>(null),
    parseErrors: signal([]),
    loading: signal(false),
    errorMessage: signal(null),
    logQueryActive: signal(false),
    lastAppliedFiltersKey: signal<string | null>(null),
    loadLogs: vi.fn(),
    loadSummary: vi.fn(),
    loadErrors: vi.fn(),
    importLogs: vi.fn(),
  };
}

describe('LogsPageComponent', () => {
  let storeSpy: ReturnType<typeof buildStoreSpy>;

  beforeEach(async () => {
    storeSpy = buildStoreSpy();

    await TestBed.configureTestingModule({
      imports: [LogsPageComponent, ReactiveFormsModule],
      providers: [{ provide: LogsStore, useValue: storeSpy }],
    }).compileComponents();
  });

  it('creates the component without errors', () => {
    const fixture = TestBed.createComponent(LogsPageComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders an Import Logs button', () => {
    const fixture = TestBed.createComponent(LogsPageComponent);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.btn-primary');
    expect(button).toBeTruthy();
    expect(button.textContent?.trim()).toBe('Import Logs');
  });

  it('calls loadSummary and loadErrors on init but does not load logs', () => {
    const fixture = TestBed.createComponent(LogsPageComponent);
    fixture.detectChanges();

    expect(storeSpy.loadLogs).not.toHaveBeenCalled();
    expect(storeSpy.loadSummary).toHaveBeenCalledTimes(1);
    expect(storeSpy.loadErrors).toHaveBeenCalledTimes(1);
  });

  it('calls store.importLogs when Import Logs button is clicked', () => {
    const fixture = TestBed.createComponent(LogsPageComponent);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.btn-primary');
    button.click();

    expect(storeSpy.importLogs).toHaveBeenCalledTimes(1);
  });

  it('calls store.loadLogs with empty filters when Clear is clicked', () => {
    storeSpy.summary.set({
      total: 1,
      bySeverity: { INFO: 1, WARNING: 0, ERROR: 0, DEBUG: 0 },
    });
    const fixture = TestBed.createComponent(LogsPageComponent);
    fixture.detectChanges();

    const clearButton: HTMLButtonElement = fixture.nativeElement.querySelector('button.btn-secondary');
    clearButton.click();

    expect(storeSpy.loadLogs).toHaveBeenCalledWith({});
  });
});
