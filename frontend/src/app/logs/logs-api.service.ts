import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ImportResponse,
  LogFilters,
  LogsResponse,
  LogsSummaryResponse,
  ParseError,
} from './logs.types';

@Injectable({ providedIn: 'root' })
export class LogsApiService {
  private readonly http = inject(HttpClient);

  import(): Observable<ImportResponse> {
    return this.http.post<ImportResponse>('/api/logs/import', null);
  }

  getLogs(filters: LogFilters): Observable<LogsResponse> {
    let params = new HttpParams();

    if (filters.severity) {
      params = params.set('severity', filters.severity);
    }
    if (filters.search) {
      params = params.set('search', filters.search);
    }
    if (filters.from) {
      params = params.set('from', filters.from);
    }
    if (filters.to) {
      params = params.set('to', filters.to);
    }

    return this.http.get<LogsResponse>('/api/logs', { params });
  }

  getSummary(): Observable<LogsSummaryResponse> {
    return this.http.get<LogsSummaryResponse>('/api/logs/summary');
  }

  getErrors(): Observable<ParseError[]> {
    return this.http.get<ParseError[]>('/api/logs/errors');
  }
}
