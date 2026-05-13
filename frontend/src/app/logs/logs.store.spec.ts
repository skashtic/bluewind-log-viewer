import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LogsStore, logFiltersKey } from './logs.store';
import { LogsApiService } from './logs-api.service';
import { LogEntry, LogsSummaryResponse } from './logs.types';

const MOCK_ENTRIES: LogEntry[] = [
  { id: '1', lineNumber: 1, timestamp: '2023-07-04T08:00:00.000Z', severity: 'INFO', message: 'App started' },
  { id: '2', lineNumber: 2, timestamp: '2023-07-04T09:00:00.000Z', severity: 'ERROR', message: 'Something failed' },
];

const MOCK_SUMMARY: LogsSummaryResponse = {
  total: 2,
  bySeverity: { INFO: 1, WARNING: 0, ERROR: 1, DEBUG: 0 },
};

function buildApiSpy() {
  return {
    import: vi.fn(),
    getLogs: vi.fn(),
    getSummary: vi.fn(),
    getErrors: vi.fn(),
    reset: vi.fn(),
  };
}

describe('LogsStore', () => {
  let store: LogsStore;
  let apiSpy: ReturnType<typeof buildApiSpy>;

  beforeEach(() => {
    apiSpy = buildApiSpy();

    TestBed.configureTestingModule({
      providers: [{ provide: LogsApiService, useValue: apiSpy }],
    });

    store = TestBed.inject(LogsStore);
  });

  describe('initial state', () => {
    it('starts with empty logs and no loading or error', () => {
      expect(store.logs()).toEqual([]);
      expect(store.loading()).toBe(false);
      expect(store.errorMessage()).toBeNull();
      expect(store.summary()).toBeNull();
      expect(store.parseErrors()).toEqual([]);
      expect(store.logQueryActive()).toBe(false);
      expect(store.lastAppliedFiltersKey()).toBeNull();
    });
  });

  describe('loadLogs()', () => {
    it('calls getLogs with empty filters and shows all entries returned', () => {
      apiSpy.getLogs.mockReturnValue(of({ items: MOCK_ENTRIES, total: 2 }));

      store.loadLogs({});

      expect(apiSpy.getLogs).toHaveBeenCalledWith({});
      expect(store.logs()).toEqual(MOCK_ENTRIES);
      expect(store.logQueryActive()).toBe(true);
      expect(store.loading()).toBe(false);
      expect(store.lastAppliedFiltersKey()).toBe(logFiltersKey({}));
    });

    it('sets logs signal from the API response and clears loading', () => {
      apiSpy.getLogs.mockReturnValue(of({ items: MOCK_ENTRIES, total: 2 }));

      store.loadLogs({ severity: 'INFO' });

      expect(store.logs()).toEqual(MOCK_ENTRIES);
      expect(store.loading()).toBe(false);
      expect(store.logQueryActive()).toBe(true);
      expect(store.lastAppliedFiltersKey()).toBe(logFiltersKey({ severity: 'INFO' }));
    });

    it('sets loading to true while waiting, then clears it on success', () => {
      apiSpy.getLogs.mockReturnValue(of({ items: [], total: 0 }));

      store.loadLogs({ search: 'x' });

      expect(store.loading()).toBe(false);
    });

    it('sets errorMessage and clears loading on API error', () => {
      apiSpy.getLogs.mockReturnValue(
        throwError(() => ({ error: { error: 'Server error' } }))
      );

      store.loadLogs({ severity: 'ERROR' });

      expect(store.errorMessage()).toBe('Server error');
      expect(store.loading()).toBe(false);
    });

    it('falls back to a default error message when error body is missing', () => {
      apiSpy.getLogs.mockReturnValue(throwError(() => ({})));

      store.loadLogs({ severity: 'DEBUG' });

      expect(store.errorMessage()).toBe('Failed to load logs.');
    });

    it('leaves lastAppliedFiltersKey unchanged when getLogs fails after a prior success', () => {
      apiSpy.getLogs.mockReturnValueOnce(of({ items: MOCK_ENTRIES, total: 2 }));
      store.loadLogs({});
      expect(store.lastAppliedFiltersKey()).toBe(logFiltersKey({}));

      apiSpy.getLogs.mockReturnValueOnce(
        throwError(() => ({ error: { error: 'Server error' } }))
      );
      store.loadLogs({ search: 'nope' });

      expect(store.errorMessage()).toBe('Server error');
      expect(store.lastAppliedFiltersKey()).toBe(logFiltersKey({}));
    });
  });

  describe('importLogs()', () => {
    it('refreshes summary, loads errors, then loads all logs when import succeeds and total > 0', () => {
      apiSpy.import.mockReturnValue(of({ summary: {} }));
      apiSpy.getSummary.mockReturnValue(of(MOCK_SUMMARY));
      apiSpy.getErrors.mockReturnValue(of([]));
      apiSpy.getLogs.mockReturnValue(of({ items: MOCK_ENTRIES, total: 2 }));

      store.importLogs();

      expect(apiSpy.getSummary).toHaveBeenCalledTimes(1);
      expect(apiSpy.getErrors).toHaveBeenCalledTimes(1);
      expect(apiSpy.getLogs).toHaveBeenCalledWith({});
      expect(store.logs()).toEqual(MOCK_ENTRIES);
      expect(store.loading()).toBe(false);
      expect(store.lastAppliedFiltersKey()).toBe(logFiltersKey({}));
    });

    it('refreshes summary and skips getLogs when import succeeds but total is 0', () => {
      apiSpy.import.mockReturnValue(of({ summary: {} }));
      apiSpy.getSummary.mockReturnValue(
        of({ total: 0, bySeverity: { INFO: 0, WARNING: 0, ERROR: 0, DEBUG: 0 } })
      );
      apiSpy.getErrors.mockReturnValue(of([]));

      store.importLogs();

      expect(apiSpy.getSummary).toHaveBeenCalledTimes(1);
      expect(apiSpy.getErrors).toHaveBeenCalledTimes(1);
      expect(apiSpy.getLogs).not.toHaveBeenCalled();
      expect(store.loading()).toBe(false);
    });

    it('sets errorMessage on import failure after retries are exhausted', () => {
      apiSpy.import.mockReturnValue(
        throwError(() => ({ error: { error: 'Import failed.' } }))
      );

      store.importLogs();

      expect(apiSpy.import).toHaveBeenCalledTimes(3);
      expect(store.errorMessage()).toBe('Import failed.');
      expect(store.loading()).toBe(false);
    });

    it('succeeds without surfacing an error when a retry succeeds', () => {
      let attempt = 0;
      apiSpy.import.mockImplementation(() => {
        attempt += 1;
        if (attempt < 2) {
          return throwError(() => ({}));
        }
        return of({ summary: {} });
      });
      apiSpy.getSummary.mockReturnValue(of(MOCK_SUMMARY));
      apiSpy.getErrors.mockReturnValue(of([]));
      apiSpy.getLogs.mockReturnValue(of({ items: MOCK_ENTRIES, total: 2 }));

      store.importLogs();

      expect(apiSpy.import).toHaveBeenCalledTimes(2);
      expect(store.errorMessage()).toBeNull();
      expect(store.loading()).toBe(false);
    });
  });

  describe('loadSummary()', () => {
    it('sets summary signal from the API response', () => {
      apiSpy.getSummary.mockReturnValue(of(MOCK_SUMMARY));

      store.loadSummary();

      expect(store.summary()).toEqual(MOCK_SUMMARY);
    });
  });

  describe('loadErrors()', () => {
    it('sets parseErrors signal from the API response', () => {
      const errors = [{ lineNumber: 5, rawLine: 'bad', reason: 'No match' }];
      apiSpy.getErrors.mockReturnValue(of(errors));

      store.loadErrors();

      expect(store.parseErrors()).toEqual(errors);
    });
  });

  describe('resetDemoData()', () => {
    it('calls reset API and clears logs, summary, filters key, and query state', () => {
      apiSpy.reset.mockReturnValue(of({ status: 'reset' }));
      store.summary.set(MOCK_SUMMARY);
      store.logs.set(MOCK_ENTRIES);
      store.parseErrors.set([{ lineNumber: 1, rawLine: 'x', reason: 'No match' }]);
      store.logQueryActive.set(true);
      store.lastAppliedFiltersKey.set('{}');

      store.resetDemoData();

      expect(apiSpy.reset).toHaveBeenCalledTimes(1);
      expect(store.logs()).toEqual([]);
      expect(store.parseErrors()).toEqual([]);
      expect(store.summary()).toEqual({
        total: 0,
        bySeverity: { INFO: 0, WARNING: 0, ERROR: 0, DEBUG: 0 },
      });
      expect(store.logQueryActive()).toBe(false);
      expect(store.lastAppliedFiltersKey()).toBeNull();
      expect(store.loading()).toBe(false);
      expect(store.errorMessage()).toBeNull();
    });
  });
});
