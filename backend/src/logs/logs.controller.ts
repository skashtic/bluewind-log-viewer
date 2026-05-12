import { Router, Request, Response, NextFunction } from "express";
import { getLogs, getLogsSummary } from "./logs.service";
import { LogsFilter, Severity } from "./logs.types";

const VALID_SEVERITIES: Severity[] = ["INFO", "WARNING", "ERROR", "DEBUG"];

const router = Router();

router.get("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { severity, search, from, to } = req.query;

    if (severity !== undefined && !VALID_SEVERITIES.includes(severity as Severity)) {
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

    const filter: LogsFilter = {
      severity: severity as Severity | undefined,
      search: search as string | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
    };

    const result = getLogs(filter);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/summary", (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = getLogsSummary();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;
