# Bluewind Log Viewer

A log viewer application built as a home task assignment.

## Stack

- **Backend**: Node.js + TypeScript + Express
- **Frontend**: Angular 21 (standalone components, Signals)

---

## Running the Backend

```bash
cd backend
npm install
npm run dev       # development server with auto-reload on port 3000
npm run build     # compile TypeScript to dist/
npm start         # run compiled output
```

Place your log file at `backend/data/log.txt` before calling the import endpoint.

---

## Running the Frontend

```bash
cd frontend
npm install
npm start     # dev server on http://localhost:4200 (proxies /api to backend port 3000)
npm run build # production build to dist/
```

The frontend proxies all `/api/*` requests to the backend via `proxy.conf.json`. Both servers must run concurrently during development.

**Run both from the repository root** (after `npm install` in `backend/` and `frontend/` as shown above):

```bash
npm install   # once at repo root (installs concurrently)
npm run dev   # backend on :3000 + Angular on :4200
```

**Typical workflow:**

1. Start servers: either `npm run dev` from the repo root, or separately `cd backend && npm run dev` and `cd frontend && npm start`
2. Open `http://localhost:4200`
3. Click **Import Logs** to parse `backend/data/log.txt` and populate the view

---

## API Endpoints

### GET /api/health

Returns server health status.

```json
{ "status": "ok" }
```

---

### POST /api/logs/import

Reads `backend/data/log.txt`, parses all log lines into structured entries, and stores them in the in-memory repository. Call this once before querying logs.

Parsing happens here — not on every GET request.

```json
{
  "summary": {
    "totalLines": 120,
    "validEntries": 115,
    "parseErrors": 5,
    "bySeverity": { "INFO": 60, "WARNING": 20, "ERROR": 30, "DEBUG": 5 }
  }
}
```

---

### GET /api/logs

Returns filtered log entries from the in-memory repository.

**Query parameters (all optional):**

| Param      | Type   | Description                                     |
|------------|--------|-------------------------------------------------|
| `severity` | string | One of: `INFO`, `WARNING`, `ERROR`, `DEBUG`     |
| `search`   | string | Case-insensitive substring match on `message`   |
| `from`     | string | ISO 8601 date — include entries at or after     |
| `to`       | string | ISO 8601 date — include entries at or before    |

```json
{
  "items": [
    {
      "id": "5",
      "lineNumber": 14,
      "timestamp": "2023-07-04T07:18:02.000Z",
      "severity": "ERROR",
      "message": "Database connection failed: Connection timeout."
    }
  ],
  "total": 1
}
```

---

### GET /api/logs/summary

Returns total count and breakdown by severity from the in-memory repository.

```json
{
  "total": 115,
  "bySeverity": { "INFO": 60, "WARNING": 20, "ERROR": 30, "DEBUG": 5 }
}
```

---

### GET /api/logs/errors

Returns lines that could not be parsed during the last import.

```json
[
  { "lineNumber": 14, "rawLine": "...", "reason": "Line does not match expected log format" }
]
```

---

## Architecture

```
backend/
├── data/
│   └── log.txt                        # Log file to import (not committed)
└── src/
    ├── server.ts                      # Entry point — starts HTTP server
    ├── app.ts                         # Express app setup, routes, middleware wiring
    ├── logs/
    │   ├── logs.types.ts              # Shared TypeScript types
    │   ├── log-source.provider.ts     # ILogSourceProvider interface
    │   ├── file-system-log-source.provider.ts  # Reads log.txt from disk
    │   ├── log-parser.service.ts      # Parses raw lines into LogEntry + ParseError
    │   ├── in-memory-logs.repository.ts        # In-memory store for entries and errors
    │   ├── logs.service.ts            # Orchestrates import, filtering, summary
    │   └── logs.controller.ts         # Route handlers and query param validation
    └── middleware/
        ├── error-handler.ts           # Central 500 error middleware
        └── not-found-handler.ts       # 404 handler for unknown routes

frontend/src/app/
├── app.ts                             # Root component — renders LogsPageComponent
├── app.config.ts                      # Bootstrap config — provides HttpClient
└── logs/
    ├── logs.types.ts                  # Frontend types mirroring backend shapes
    ├── logs-api.service.ts            # HTTP calls only (import/getLogs/getSummary/getErrors)
    ├── logs.store.ts                  # Signals-based state + orchestration
    ├── logs-page.component.ts         # Thin component, reactive filter form
    ├── logs-page.component.html       # Template: header, summary, filters, table, errors
    └── logs-page.component.css        # Responsive plain CSS (grid + flex)
```

### Architecture decisions

- The file-system source is isolated behind `ILogSourceProvider`. Swapping it for an S3 provider later requires only a new class implementing that interface.
- Parsed data is held in a module-level in-memory repository. It can later be replaced with SQLite or Postgres without touching the service or controller layers.
- Parsing is triggered explicitly via `POST /api/logs/import`. GET endpoints read from the already-parsed repository — no file I/O on read.
- Malformed lines do not crash the import; they are collected as `ParseError` objects and accessible via `GET /api/logs/errors`.
- Continuation lines (plain text following a valid entry with no malformed line in between) are appended to the previous entry's message. If a malformed line appears between a valid entry and plain text, the plain text is reported as `ORPHAN_CONTINUATION_LINE` rather than silently attached to the wrong entry.

### Parser error handling

The parser is strict and does not guess or auto-correct corrupted data:

- Malformed lines are always reported as `ParseError` objects — they are never silently dropped.
- Each parse error includes `lineNumber`, `rawLine`, and one of four explicit reasons: `INVALID_FORMAT`, `INVALID_TIMESTAMP`, `UNSUPPORTED_SEVERITY`, `ORPHAN_CONTINUATION_LINE`.
- In a full log header with a known severity, a **compact** 6-digit time (`HHmmss`, e.g. `101645`) is normalized to `HH:mm:ss` (`10:16:45`). Other malformed time tokens are still reported as `INVALID_TIMESTAMP`.
- A line may be split where a second recognisable known-severity header appears (after position 0), using either `YYYY-MM-DD HH:MM:SS [SEVERITY]` or `YYYY-MM-DD HHmmss [SEVERITY]`. Message text outside those splits is preserved; continuation lines are still appended to the preceding **valid** entry only.

### Intentional simplifications (current step)

- No database — repository is in-memory only; data is lost on server restart.
- No S3 — `FileSystemLogSourceProvider` reads a local file.
- Frontend state is Signals-only — no NgRx, no third-party state library.
- No Angular Material or other UI libraries — plain CSS.
- No authentication, caching, or queuing.
