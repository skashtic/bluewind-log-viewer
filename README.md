# Bluewind Log Viewer

A log viewer application built as a home task assignment.

## Stack

- **Backend**: Node.js + TypeScript + Express
- **Frontend**: Angular (not yet implemented)

---

## Running the Backend

```bash
cd backend
npm install
npm run dev       # development server with auto-reload on port 3000
npm run build     # compile TypeScript to dist/
npm start         # run compiled output
```

---

## API Endpoints

### GET /api/health

Returns server health status.

```json
{ "status": "ok" }
```

---

### GET /api/logs

Returns a filtered list of log entries.

**Query parameters (all optional):**

| Param      | Type   | Description                                     |
|------------|--------|-------------------------------------------------|
| `severity` | string | One of: `INFO`, `WARNING`, `ERROR`, `DEBUG`     |
| `search`   | string | Case-insensitive substring match on `message`   |
| `from`     | string | ISO 8601 date — include entries at or after     |
| `to`       | string | ISO 8601 date — include entries at or before    |

**Response:**

```json
{
  "items": [
    {
      "id": "5",
      "timestamp": "2026-05-12T08:07:45.000Z",
      "severity": "ERROR",
      "message": "Failed to fetch user data: connection timeout"
    }
  ],
  "total": 1
}
```

---

### GET /api/logs/summary

Returns total count and breakdown by severity.

```json
{
  "total": 10,
  "bySeverity": {
    "INFO": 4,
    "WARNING": 2,
    "ERROR": 2,
    "DEBUG": 2
  }
}
```

---

## Architecture

```
backend/src/
├── server.ts                      # Entry point — starts HTTP server
├── app.ts                         # Express app setup, routes, middleware wiring
├── logs/
│   ├── logs.types.ts              # Shared TypeScript types and interfaces
│   ├── mock-log-entries.ts        # Hardcoded mock data (replaces file/S3 source later)
│   ├── logs.service.ts            # Filtering logic over log entries
│   └── logs.controller.ts        # Route handlers, query param validation
└── middleware/
    ├── error-handler.ts           # Central 500 error middleware
    └── not-found-handler.ts      # 404 handler for unknown routes
```

### Intentional simplifications (current step)

- Log data is hardcoded in `mock-log-entries.ts`. No file system or S3 reads yet.
- No database — filtering runs over an in-memory array.
- No parser — entries are already structured.
- No repository interface yet — service reads mock data directly.
- No frontend yet.

These will be introduced in later steps without changing the existing API contract.
