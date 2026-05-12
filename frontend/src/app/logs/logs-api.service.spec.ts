import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { LogsApiService } from './logs-api.service';
import { LogsResponse, LogsSummaryResponse, ParseError, ImportResponse } from './logs.types';

describe('LogsApiService', () => {
  let service: LogsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LogsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('import() sends a POST to /api/logs/import', () => {
    const mockResponse: ImportResponse = {
      summary: { totalLines: 10, validEntries: 9, parseErrors: 1, bySeverity: { INFO: 5, WARNING: 2, ERROR: 1, DEBUG: 1 } },
    };

    service.import().subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/logs/import');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('getLogs() sends a GET to /api/logs with no params when filters are empty', () => {
    const mockResponse: LogsResponse = { items: [], total: 0 };

    service.getLogs({}).subscribe();

    const req = httpMock.expectOne('/api/logs');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush(mockResponse);
  });

  it('getLogs() appends only the provided filter params', () => {
    service.getLogs({ severity: 'ERROR', search: 'timeout' }).subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/logs');
    expect(req.request.params.get('severity')).toBe('ERROR');
    expect(req.request.params.get('search')).toBe('timeout');
    expect(req.request.params.has('from')).toBe(false);
    expect(req.request.params.has('to')).toBe(false);
    req.flush({ items: [], total: 0 });
  });

  it('getLogs() appends from and to params when provided', () => {
    service.getLogs({ from: '2023-01-01T00:00:00.000Z', to: '2023-12-31T23:59:59.000Z' }).subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/logs');
    expect(req.request.params.get('from')).toBe('2023-01-01T00:00:00.000Z');
    expect(req.request.params.get('to')).toBe('2023-12-31T23:59:59.000Z');
    req.flush({ items: [], total: 0 });
  });

  it('getSummary() sends a GET to /api/logs/summary', () => {
    const mockSummary: LogsSummaryResponse = {
      total: 5,
      bySeverity: { INFO: 2, WARNING: 1, ERROR: 1, DEBUG: 1 },
    };

    service.getSummary().subscribe((res) => {
      expect(res).toEqual(mockSummary);
    });

    const req = httpMock.expectOne('/api/logs/summary');
    expect(req.request.method).toBe('GET');
    req.flush(mockSummary);
  });

  it('getErrors() sends a GET to /api/logs/errors', () => {
    const mockErrors: ParseError[] = [
      { lineNumber: 3, rawLine: 'bad line', reason: 'Line does not match expected log format' },
    ];

    service.getErrors().subscribe((res) => {
      expect(res).toEqual(mockErrors);
    });

    const req = httpMock.expectOne('/api/logs/errors');
    expect(req.request.method).toBe('GET');
    req.flush(mockErrors);
  });
});
