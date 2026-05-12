import { parseLines } from "../log-parser.service";

describe("parseLines", () => {
  describe("valid log lines", () => {
    it("parses a valid line into the correct timestamp, severity and message", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:18:02 [ERROR] Database connection failed.",
      ]);

      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(1);

      const entry = entries[0];
      expect(entry.timestamp).toBe(new Date("2023-07-04 10:18:02").toISOString());
      expect(entry.severity).toBe("ERROR");
      expect(entry.message).toBe("Database connection failed.");
      expect(entry.lineNumber).toBe(1);
      expect(entry.id).toBe("1");
    });

    it("assigns incrementing ids across multiple valid lines", () => {
      const { entries } = parseLines([
        "2023-07-04 10:00:00 [INFO] App started.",
        "2023-07-04 10:01:00 [WARNING] High memory.",
        "2023-07-04 10:02:00 [DEBUG] Cache miss.",
      ]);

      expect(entries.map((e) => e.id)).toEqual(["1", "2", "3"]);
    });

    it("parses all four supported severities", () => {
      const lines = [
        "2023-07-04 10:00:00 [INFO] info message",
        "2023-07-04 10:01:00 [WARNING] warning message",
        "2023-07-04 10:02:00 [ERROR] error message",
        "2023-07-04 10:03:00 [DEBUG] debug message",
      ];
      const { entries, errors } = parseLines(lines);

      expect(errors).toHaveLength(0);
      expect(entries.map((e) => e.severity)).toEqual([
        "INFO",
        "WARNING",
        "ERROR",
        "DEBUG",
      ]);
    });
  });

  describe("empty and blank lines", () => {
    it("ignores empty lines without producing entries or errors", () => {
      const { entries, errors } = parseLines(["", "   ", "\t"]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it("ignores blank lines interspersed between valid lines", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:00:00 [INFO] First.",
        "",
        "2023-07-04 10:01:00 [INFO] Second.",
      ]);

      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(2);
    });
  });

  describe("malformed lines", () => {
    it("records a parse error for a line with an unsupported severity", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:18:02 [CRITICAL] Something bad.",
      ]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].lineNumber).toBe(1);
      expect(errors[0].rawLine).toBe("2023-07-04 10:18:02 [CRITICAL] Something bad.");
      expect(errors[0].reason).toBe("Line does not match expected log format");
    });

    it("records a parse error for a line with a malformed timestamp", () => {
      const { entries, errors } = parseLines([
        "not-a-date [ERROR] Some message.",
      ]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(1);
    });

    it("records a parse error for a fully unrecognisable line when there is no previous entry", () => {
      const { entries, errors } = parseLines(["this is just random text"]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].rawLine).toBe("this is just random text");
    });
  });

  describe("continuation lines", () => {
    it("appends a non-header continuation line to the previous entry's message", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:00:00 [ERROR] Connection failed.",
        "  caused by: timeout after 30s",
      ]);

      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe(
        "Connection failed.\n  caused by: timeout after 30s"
      );
    });

    it("records a parse error for a broken-header-like line even after a valid entry", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:00:00 [INFO] First entry.",
        "2023-99-99 broken header line",
      ]);

      expect(entries).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect(errors[0].lineNumber).toBe(2);
    });

    it("records a parse error for a non-matching line when there is no previous entry to continue", () => {
      const { entries, errors } = parseLines([
        "this line has no prior entry to attach to",
      ]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(1);
    });
  });
});
