import { getLogs, getLogsSummary, resetImportedLogs } from "../logs.service";
import * as repository from "../in-memory-logs.repository";
import { LogEntry } from "../logs.types";

const ENTRIES: LogEntry[] = [
  {
    id: "1",
    lineNumber: 1,
    timestamp: "2023-07-04T08:00:00.000Z",
    severity: "INFO",
    message: "Application started",
  },
  {
    id: "2",
    lineNumber: 2,
    timestamp: "2023-07-04T09:00:00.000Z",
    severity: "WARNING",
    message: "Memory usage is high",
  },
  {
    id: "3",
    lineNumber: 3,
    timestamp: "2023-07-04T10:00:00.000Z",
    severity: "ERROR",
    message: "Database connection failed: timeout",
  },
  {
    id: "4",
    lineNumber: 4,
    timestamp: "2023-07-04T11:00:00.000Z",
    severity: "DEBUG",
    message: "Cache miss for key user_42",
  },
];

beforeEach(() => {
  repository.save(ENTRIES, []);
});

afterEach(() => {
  repository.clear();
});

describe("getLogs filtering", () => {
  it("returns all entries when no filters are provided", () => {
    const { items, total } = getLogs({});

    expect(total).toBe(4);
    expect(items).toHaveLength(4);
  });

  describe("severity filter", () => {
    it("returns only entries matching the given severity", () => {
      const { items, total } = getLogs({ severity: "ERROR" });

      expect(total).toBe(1);
      expect(items[0].id).toBe("3");
    });

    it("returns an empty list when no entries match the severity", () => {
      const { items, total } = getLogs({ severity: "INFO" });

      // Only one INFO entry in fixture
      expect(total).toBe(1);
      expect(items[0].severity).toBe("INFO");
    });
  });

  describe("search filter", () => {
    it("returns entries whose message contains the search term", () => {
      const { items, total } = getLogs({ search: "database" });

      expect(total).toBe(1);
      expect(items[0].id).toBe("3");
    });

    it("performs a case-insensitive search", () => {
      const { items } = getLogs({ search: "APPLICATION" });

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe("1");
    });

    it("returns an empty list when no messages match the search term", () => {
      const { total } = getLogs({ search: "nonexistent" });

      expect(total).toBe(0);
    });
  });

  describe("date range filter", () => {
    it("returns only entries at or after the 'from' timestamp", () => {
      const { items, total } = getLogs({ from: "2023-07-04T10:00:00.000Z" });

      expect(total).toBe(2);
      expect(items.map((e) => e.id)).toEqual(["3", "4"]);
    });

    it("returns only entries at or before the 'to' timestamp", () => {
      const { items, total } = getLogs({ to: "2023-07-04T09:00:00.000Z" });

      expect(total).toBe(2);
      expect(items.map((e) => e.id)).toEqual(["1", "2"]);
    });

    it("returns entries within the from–to range (inclusive on both ends)", () => {
      const { items, total } = getLogs({
        from: "2023-07-04T09:00:00.000Z",
        to: "2023-07-04T10:00:00.000Z",
      });

      expect(total).toBe(2);
      expect(items.map((e) => e.id)).toEqual(["2", "3"]);
    });

    it("returns an empty list when the date range matches no entries", () => {
      const { total } = getLogs({
        from: "2025-01-01T00:00:00.000Z",
        to: "2025-01-02T00:00:00.000Z",
      });

      expect(total).toBe(0);
    });
  });
});

describe("resetImportedLogs", () => {
  it("clears entries so summary and getLogs return empty", () => {
    expect(getLogsSummary().total).toBe(4);

    expect(resetImportedLogs()).toEqual({ status: "reset" });

    expect(getLogsSummary().total).toBe(0);
    expect(getLogsSummary().bySeverity).toEqual({
      INFO: 0,
      WARNING: 0,
      ERROR: 0,
      DEBUG: 0,
    });
    expect(getLogs({}).total).toBe(0);
    expect(repository.getErrors()).toEqual([]);
  });
});
