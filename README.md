# Bluewind Log Viewer

Log viewer for a **BlueWind Medical** home assignment: import a sample log file on the server, parse lines into structured entries, and browse them through a small Angular UI and REST API.

## Stack

| Layer    | Technology                                                                     |
| -------- | ------------------------------------------------------------------------------ |
| Backend  | Node.js, TypeScript, Express                                                   |
| Frontend | Angular 21 (standalone components), Signals, Vitest (via `ng test`), plain CSS |

Quick references: [backend/README.md](backend/README.md) · [frontend/README.md](frontend/README.md)

---

## Repository structure

```
backend/
  data/log.txt              # Default log file path (sample may be committed)
  src/
    server.ts, app.ts
    logs/                   # Types, parser, file provider, in-memory repo, service, controller
    middleware/
frontend/
  src/app/
    app.ts, app.config.ts
    logs/                   # LogsPageComponent, LogsStore, LogsApiService, types
  proxy.conf.json           # Dev: proxies /api → http://127.0.0.1:3000
package.json                # Root: run both apps, full build/test
```

---

## Running the project

### From the repository root

Install dependencies once (root helper + both apps):

```bash
npm run install:all
```

Or manually: `npm install` at root, then `npm install` in `backend/` and `frontend/`.

Start **backend** (port 3000) and **frontend** (port 4200) together:

```bash
npm install    # at root, if you have not yet (installs concurrently)
npm run dev    # same as npm start
```

Build and test **both** packages:

```bash
npm run build
npm test
```

### Backend only

```bash
cd backend
npm install
npm run dev       # dev server with reload, port 3000
npm run build     # compile to backend/dist/
npm start         # run node backend/dist/server.js
npm test          # Jest
```

### Frontend only

```bash
cd frontend
npm install
npm start         # ng serve — http://localhost:4200, proxies /api to :3000
npm run build
npm test          # Vitest via Angular CLI (watch mode)
npm run test:ci   # ng test --watch=false (used by root npm test)
```

During local development the app uses **relative `/api` URLs**; `proxy.conf.json` forwards them to the backend. For production with the API on another origin, a configurable base URL would be needed (not implemented here).

### Hosted demo (single URL)

After a full build (`npm run build` from the repo root), you can run **only the backend** with `NODE_ENV=production` so Express serves the Angular browser bundle from `frontend/dist/frontend/browser` and still handles `/api/*`. Unknown API routes return JSON 404; other GET requests receive `index.html` for client-side routing.

```bash
npm run build
# Unix / Git Bash:
NODE_ENV=production npm run start:prod
# Windows PowerShell:
#   $env:NODE_ENV = "production"; npm run start:prod
```

Then open `http://localhost:3000` (default `PORT`). This path is optional and does not replace the usual dev setup (backend :3000 + `ng serve` :4200).

---

## Demo flow

1. Start backend and frontend (root `npm run dev`, or the two folders separately as above).
2. Open `http://localhost:4200`.
3. On load (and after a browser refresh), the UI reads **`GET /api/logs/summary`** and **`GET /api/logs/errors`**. If the server still has imported data in memory, the main view appears again; if the repository was cleared (**Reset Demo Data** or a new backend process), you see the empty state until you **Import Logs**.
4. Use **Import Logs** to read **`backend/data/log.txt`**, parse, and store in memory (or re-import after a reset). When import completes, the summary updates and the full list loads from `GET /api/logs` with no filters.
5. Use **filters** (severity, search, date range) and **Apply Filters** to narrow results; **Clear** resets filters and reloads all entries. **Apply** is dimmed when the form matches the last successful load.
6. **Parse errors** from the last import appear in a separate section when present.

---

## API (summary)

| Method | Path                | Role                                                                                     |
| ------ | ------------------- | ---------------------------------------------------------------------------------------- |
| `GET`  | `/api/health`       | Liveness: `{ "status": "ok" }`                                                           |
| `POST` | `/api/logs/import`  | Read `backend/data/log.txt`, parse, replace in-memory entries + parse errors             |
| `POST` | `/api/logs/reset`   | Clear in-memory parsed entries and parse errors (does not change `backend/data/log.txt`) |
| `GET`  | `/api/logs`         | Filtered entries (query params optional; empty means no filter on that axis)             |
| `GET`  | `/api/logs/summary` | Total count and counts by severity                                                       |
| `GET`  | `/api/logs/errors`  | Parse errors from the last import                                                        |

The UI exposes **Reset Demo Data** for the same in-memory clear as `POST /api/logs/reset`; the sample log file on disk is unchanged.

If **`POST /api/logs/reset` returns 404** while other `/api/logs/*` calls work, the Node process is almost certainly an **old build** (`dist/` out of date). From `backend`, run **`npm run build`** (or use **`npm run dev`**, which runs TypeScript from `src`), stop any other server on port **3000**, then start again. **`npm start`** in `backend` now runs **`prestart`** so `dist` is rebuilt automatically before `node dist/server.js`.

### `POST /api/logs/import`

Response shape (example numbers):

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

### `GET /api/logs` (optional query parameters)

| Param        | Description                               |
| ------------ | ----------------------------------------- |
| `severity`   | `INFO` \| `WARNING` \| `ERROR` \| `DEBUG` |
| `search`     | Case-insensitive substring on `message`   |
| `from`, `to` | ISO 8601 — filter by entry timestamp      |

Response: `{ "items": [ … ], "total": <number> }` with `id`, `lineNumber`, `timestamp` (ISO), `severity`, `message`.

### `GET /api/logs/errors`

Each item: `lineNumber`, `rawLine`, `reason` with one of: `INVALID_FORMAT`, `INVALID_TIMESTAMP`, `UNSUPPORTED_SEVERITY`, `ORPHAN_CONTINUATION_LINE`.

---

## Parser and import behavior

- **Valid header** (known severity): `YYYY-MM-DD HH:mm:ss [SEVERITY]` message, or the same date with **compact** time `HHmmss` (exactly six digits) before `[SEVERITY]`.
- **Supported severities:** `INFO`, `WARNING`, `ERROR`, `DEBUG`.
- **Compact timestamps:** in the exact `HHmmss` form, values are normalized to `HH:mm:ss` **only inside a complete log header** with a known severity. **Other corrupted timestamps are not guessed or auto-corrected** (`INVALID_TIMESTAMP` where applicable).
- **Malformed lines** do not fail the whole import; they are recorded and returned via `GET /api/logs/errors`.
- **Continuation lines** (non-header text after a valid entry, with no intervening malformed line) are appended to that entry’s message. Otherwise orphan continuations get `ORPHAN_CONTINUATION_LINE`.
- A physical line may contain **two concatenated headers**; the parser splits on a second recognised header (`… HH:mm:ss [SEVERITY]` or `… HHmmss [SEVERITY]`) so two entries can be produced from one line when appropriate.

Parsing runs **only on import**, not on every `GET`.

---

## Architecture decisions

- **Log source:** `ILogSourceProvider` with a file-system implementation reading `backend/data/log.txt`. Replacing it (e.g. with S3) is a new provider class, not a rewrite of the HTTP layer.
- **Storage:** Parsed entries and parse errors live in an **in-memory** module; swapping for a database means changing the repository implementation, not the route contracts shown here.
- **Filtering:** Done in the backend over already-parsed data.
- **Frontend:** `LogsApiService` performs HTTP calls; `LogsStore` coordinates import, summary, errors, and log loads using **Signals**.

---

## Testing

| Where    | Command                                            |
| -------- | -------------------------------------------------- |
| Backend  | `cd backend && npm test`                           |
| Frontend | `cd frontend && npm test` or `npm run test:ci`     |
| Root     | `npm test` (backend Jest, then frontend `test:ci`) |

---

## Review notes

The implementation is focused on the requested scope: a local, fully runnable Angular + Node.js/Express application with clear client/server separation.

As discussed, the solution uses the local file system as the log source instead of S3. The backend keeps the log source behind an `ILogSourceProvider` interface, so a future S3 provider can be added without changing the API or parser flow.

The `main` branch keeps the frontend and backend logically separated and fully runnable locally. A separate `chore/hosted-demo-setup` branch was prepared for the hosted demo, where Express serves the Angular production build as static files. This was done only to simplify hosting under a single URL without CORS or separate API configuration.

Most of the backend focus was on predictable parser behavior and graceful handling of malformed input. The parser handles valid log headers, compact `HHmmss` timestamps inside complete headers, concatenated log entries, continuation lines, unsupported severities, malformed timestamps, malformed structures, CRLF line endings, duplicate lines, and mixed valid/corrupted inputs. Malformed lines are reported as parse errors instead of failing the whole import.

The backend unit tests focus mainly on parser reliability and filtering behavior, including edge cases rather than only the happy path.

I also performed basic manual UI sanity checks on Chrome, Firefox, Opera, Chrome DevTools responsive mode, and three Android devices. The goal was to verify that the main import/filter/reset flow remains usable on desktop and mobile widths.

I intentionally did not implement heavier production concerns such as authentication, persistent storage, queues, caching, rate limiting, virtual scrolling, or server-side pagination. For a larger production version, I would add these according to scale and product requirements rather than upfront.

## Intentionally not implemented

- No authentication, pagination, server-side sort options, queues, caching layer, or offline mode.
- No cloud deployment, IAM, or AWS wiring in this repo.
- No persistent database or S3 in the runtime path.

---

## Future production considerations _(not in this codebase)_

- Point `ILogSourceProvider` at S3 (or similar) with appropriate credentials and SDK.
- Persist parsed data in PostgreSQL/SQLite and add **pagination and sorting** for large result sets.
- Configure the frontend **API base URL** via environment for API and UI on different hosts.
- Add authentication and a CI pipeline as product requirements dictate.
