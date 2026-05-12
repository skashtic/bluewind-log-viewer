import { Router, Request, Response, NextFunction } from "express";
import {
  importLogs,
  getLogs,
  getLogsSummary,
  getParseErrors,
} from "./logs.service";
import { FileSystemLogSourceProvider } from "./file-system-log-source.provider";
import { LogFilters, LogSeverity } from "./logs.types";

const VALID_SEVERITIES: LogSeverity[] = ["INFO", "WARNING", "ERROR", "DEBUG"];

const router = Router();

router.post("/import", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const source = new FileSystemLogSourceProvider();
    const result = await importLogs(source);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { severity, search, from, to } = req.query;

    if (severity !== undefined && !VALID_SEVERITIES.includes(severity as LogSeverity)) {
      res.status(400).json({
        error: `Invalid severity value. Allowed values: ${VALID_SEVERITIES.join(", ")}`,
      });
      return;
    }

    if (from !== undefined && isNaN(Date.parse(from as string))) {
      res.status(400).json({ error: "Invalid 'from' date format. Use ISO 8601." });
      return;
    }

    if (to !== undefined && isNaN(Date.parse(to as string))) {
      res.status(400).json({ error: "Invalid 'to' date format. Use ISO 8601." });
      return;
    }

    const filter: LogFilters = {
      severity: severity as LogSeverity | undefined,
      search: search as string | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
    };

    res.json(getLogs(filter));
  } catch (err) {
    next(err);
  }
});

router.get("/summary", (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(getLogsSummary());
  } catch (err) {
    next(err);
  }
});

router.get("/errors", (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(getParseErrors());
  } catch (err) {
    next(err);
  }
});

export default router;
