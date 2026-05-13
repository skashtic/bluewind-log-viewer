# Frontend — Bluewind Log Viewer

Angular UI for importing server-side logs and browsing parsed entries with simple filters.

**Full-project setup:** see the [root README](../README.md).

## Stack

- Angular **21**, standalone components, **Signals**
- Reactive forms for filters
- **Vitest** via `ng test` (with **happy-dom**); no Karma / browser test runner in this project
- Plain CSS (no Angular Material)

## Commands

```bash
npm install
npm start         # ng serve — http://localhost:4200
npm run build     # production build → dist/
npm test          # unit tests (watch)
npm run test:ci   # ng test --watch=false (used by root npm test)
```

## API calls

`LogsApiService` uses **relative URLs** under `/api` (e.g. `/api/logs/import`). In development, **`proxy.conf.json`** forwards `/api` to `http://127.0.0.1:3000`. Hosting the UI and API on different origins would require a configurable base URL (not implemented here).

## State

**`LogsStore`** (injectable, `providedIn: 'root'`) holds Signals for logs, summary, parse errors, loading, errors, and coordinates import + `GET` flows. **`LogsPageComponent`** binds the filter form and delegates to the store.

## UI flow

1. **Empty state** when there are no log entries in the backend summary — message and **Import Logs** (reads `backend/data/log.txt` on the server).
2. After data exists: **summary** cards, **filters** (severity, search, from/to), **logs** table, and **parse errors** when the last import produced any.
3. The list **reloads in full** after a successful import (and when opening the app if data is already present). **Apply Filters** runs a filtered `GET /api/logs`; **Clear** resets the form and loads all entries again. **Apply** is disabled and muted while the form matches the last successful load or a request is in flight.

## Layout (feature folder)

`src/app/logs/` — `logs-page.component.*`, `logs.store.ts`, `logs-api.service.ts`, `logs.types.ts`
