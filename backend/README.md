# Backend — Bluewind Log Viewer

Express API that imports a log file from disk, parses it, keeps results in memory, and serves filtered views over HTTP.

**Full-project setup:** see the [root README](../README.md).

## Stack

Node.js, TypeScript, Express, Jest.

## Commands

```bash
npm install
npm run dev       # ts-node-dev, port 3000, auto-reload
npm run build     # tsc → dist/
npm start         # node dist/server.js
npm test          # Jest
```

## Request flow

1. **`POST /api/logs/import`** — Read **`backend/data/log.txt`** via the file-system provider, parse every line, write **entries** and **parse errors** into the in-memory repository.
2. **`GET /api/logs/summary`**, **`GET /api/logs/errors`**, **`GET /api/logs`** — Read only from memory (no file I/O on these paths).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | `{ "status": "ok" }` |
| `POST` | `/api/logs/import` | Import from `backend/data/log.txt` |
| `GET` | `/api/logs` | Optional query: `severity`, `search`, `from`, `to` (ISO) |
| `GET` | `/api/logs/summary` | Totals by severity |
| `GET` | `/api/logs/errors` | Parse errors from last import |

## Parser (behaviour)

- **Known-good header:** `YYYY-MM-DD HH:mm:ss [INFO|WARNING|ERROR|DEBUG]` + message, or the same with **`HHmmss`** (six digits) instead of `HH:mm:ss`.
- **Compact time:** `HHmmss` is expanded to `HH:mm:ss` **only** as part of a full header with a known severity. Other bad times → `INVALID_TIMESTAMP` (not guessed).
- **Unsupported severity** (e.g. `[TRACE]`) → `UNSUPPORTED_SEVERITY`.
- **Bad structure** → `INVALID_FORMAT`.
- **Continuation** lines attach to the previous **valid** entry; otherwise `ORPHAN_CONTINUATION_LINE`.
- Concatenated headers on one physical line can be split when a second known-severity header is detected.

## Data layer

- **`FileSystemLogSourceProvider`** — reads `backend/data/log.txt`.
- **In-memory repository** — holds parsed entries and errors until process exit. A persistent store or S3-backed source would replace these pieces later, not the public API shapes described in the root README.
