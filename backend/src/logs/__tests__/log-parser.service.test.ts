import { parseLines } from "../log-parser.service";

describe("parseLines", () => {
  // ─── Valid lines ──────────────────────────────────────────────────────────

  describe("valid log lines", () => {
    it("parses a valid INFO line into the correct fields", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:15:23 [INFO] User logged in.",
      ]);

      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(1);
      expect(entries[0].severity).toBe("INFO");
      expect(entries[0].message).toBe("User logged in.");
      expect(entries[0].timestamp).toBe(new Date("2023-07-04 10:15:23").toISOString());
      expect(entries[0].lineNumber).toBe(1);
      expect(entries[0].id).toBe("1");
    });

    it("parses a valid ERROR line into the correct fields", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:18:02 [ERROR] Database connection failed.",
      ]);

      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(1);
      expect(entries[0].severity).toBe("ERROR");
      expect(entries[0].message).toBe("Database connection failed.");
    });

    it("assigns incrementing ids across multiple valid lines", () => {
      const { entries } = parseLines([
        "2023-07-04 10:00:00 [INFO] App started.",
        "2023-07-04 10:01:00 [WARNING] High memory.",
        "2023-07-04 10:02:00 [DEBUG] Cache miss.",
      ]);

      expect(entries.map((e) => e.id)).toEqual(["1", "2", "3"]);
    });

    it("parses all four supported severities without errors", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:00:00 [INFO] info",
        "2023-07-04 10:01:00 [WARNING] warning",
        "2023-07-04 10:02:00 [ERROR] error",
        "2023-07-04 10:03:00 [DEBUG] debug",
      ]);

      expect(errors).toHaveLength(0);
      expect(entries.map((e) => e.severity)).toEqual([
        "INFO",
        "WARNING",
        "ERROR",
        "DEBUG",
      ]);
    });

    it("handles duplicate valid log lines without crashing or deduplicating them", () => {
      const line = "2023-07-04 10:00:00 [INFO] Duplicate event.";
      const { entries, errors } = parseLines([line, line, line]);

      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(3);
      expect(entries.every((e) => e.message === "Duplicate event.")).toBe(true);
    });
  });

  // ─── Empty and blank lines ────────────────────────────────────────────────

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

  // ─── Line endings ─────────────────────────────────────────────────────────

  describe("line endings", () => {
    it("handles Windows CRLF by stripping the trailing \\r from each line", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:18:02 [ERROR] Message.\r",
      ]);

      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe("Message.");
    });

    it("handles mixed CRLF and LF lines in the same input", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:00:00 [INFO] First.\r",
        "2023-07-04 10:01:00 [ERROR] Second.",
      ]);

      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(2);
      expect(entries[0].message).toBe("First.");
      expect(entries[1].message).toBe("Second.");
    });
  });

  // ─── Whitespace ───────────────────────────────────────────────────────────

  describe("whitespace handling", () => {
    it("treats a line with leading whitespace as a continuation when a valid entry precedes it", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:00:00 [INFO] First line.",
        "  indented continuation",
      ]);

      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe("First line.\n  indented continuation");
    });

    it("treats a line with leading whitespace as ORPHAN when no valid entry precedes it", () => {
      const { entries, errors } = parseLines(["  orphan indented text"]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toBe("ORPHAN_CONTINUATION_LINE");
    });
  });

  // ─── Parse error reasons ──────────────────────────────────────────────────

  describe("UNSUPPORTED_SEVERITY", () => {
    it("reports UNSUPPORTED_SEVERITY for a correctly-structured line with an unknown severity", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:18:02 [CRITICAL] Something bad.",
      ]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].lineNumber).toBe(1);
      expect(errors[0].rawLine).toBe("2023-07-04 10:18:02 [CRITICAL] Something bad.");
      expect(errors[0].reason).toBe("UNSUPPORTED_SEVERITY");
    });

    it("reports UNSUPPORTED_SEVERITY and not a continuation even after a valid entry", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:00:00 [INFO] First.",
        "2023-07-04 10:01:00 [TRACE] Second.",
      ]);

      expect(entries).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toBe("UNSUPPORTED_SEVERITY");
    });
  });

  describe("INVALID_TIMESTAMP", () => {
    it("reports INVALID_TIMESTAMP for a log line with digit values out of calendar range", () => {
      const { entries, errors } = parseLines([
        "2023-13-45 25:99:99 [ERROR] Bad date values.",
      ]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toBe("INVALID_TIMESTAMP");
    });

    it("reports INVALID_TIMESTAMP for a structurally valid but impossible date such as Feb 30", () => {
      const { entries, errors } = parseLines([
        "2023-02-30 10:15:23 [INFO] Impossible date.",
      ]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toBe("INVALID_TIMESTAMP");
    });

    it("normalizes a compact 6-digit time in a full known-severity header to HH:mm:ss", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 101645 [WARNING] Invalid input received.",
      ]);

      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(1);
      expect(entries[0].severity).toBe("WARNING");
      expect(entries[0].message).toBe("Invalid input received.");
      expect(entries[0].timestamp).toBe(
        new Date("2023-07-04 10:16:45").toISOString()
      );
    });
  });

  describe("INVALID_FORMAT", () => {
    it("reports INVALID_FORMAT for a line that starts with a date but lacks valid structure", () => {
      const { entries, errors } = parseLines(["2023-99-99 broken header line"]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toBe("INVALID_FORMAT");
      expect(errors[0].lineNumber).toBe(1);
    });

    it("reports INVALID_FORMAT for a date-like line missing severity brackets", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:00:00 ERROR message without brackets",
      ]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toBe("INVALID_FORMAT");
    });
  });

  describe("ORPHAN_CONTINUATION_LINE", () => {
    it("reports ORPHAN_CONTINUATION_LINE for plain text with no preceding entry", () => {
      const { entries, errors } = parseLines([
        "this line has no prior entry to attach to",
      ]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toBe("ORPHAN_CONTINUATION_LINE");
      expect(errors[0].rawLine).toBe("this line has no prior entry to attach to");
    });

    it("reports ORPHAN_CONTINUATION_LINE for text that does not match the log header shape", () => {
      const { entries, errors } = parseLines(["not-a-date [ERROR] Some message."]);

      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toBe("ORPHAN_CONTINUATION_LINE");
    });
  });

  // ─── Continuation lines ───────────────────────────────────────────────────

  describe("continuation lines", () => {
    it("does not attach a continuation line to a valid entry when a malformed line appeared in between", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:00:00 [INFO] Valid entry.",
        "2023-13-45 25:99:99 [ERROR] Invalid timestamp.",
        "  this should not attach to the valid entry",
      ]);

      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe("Valid entry.");
      expect(errors).toHaveLength(2);
      expect(errors[0].reason).toBe("INVALID_TIMESTAMP");
      expect(errors[1].reason).toBe("ORPHAN_CONTINUATION_LINE");
      expect(errors[1].rawLine).toBe("  this should not attach to the valid entry");
    });

    it("appends a plain continuation line to the previous entry's message", () => {
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

    it("does not treat an UNSUPPORTED_SEVERITY line as a continuation even after a valid entry", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:00:00 [INFO] First entry.",
        "2023-07-04 10:01:00 [TRACE] Not a continuation.",
      ]);

      expect(entries).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toBe("UNSUPPORTED_SEVERITY");
    });

    it("does not treat an INVALID_FORMAT line as a continuation even after a valid entry", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:00:00 [INFO] First entry.",
        "2023-99-99 broken header line",
      ]);

      expect(entries).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toBe("INVALID_FORMAT");
      expect(errors[0].lineNumber).toBe(2);
    });
  });

  // ─── Embedded header normalization ───────────────────────────────────────

  describe("embedded header normalization", () => {
    it("splits concatenated INFO and compact-time WARNING and appends continuation to WARNING", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:15:23 [INFO] User logged in john.doe@example.com2023-07-04 101645 [WARNING] Invalid input received from client Request payload is missing",
        "required field.",
      ]);

      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(2);
      expect(entries[0].severity).toBe("INFO");
      expect(entries[0].message).toBe("User logged in john.doe@example.com");
      expect(entries[0].message).not.toContain("WARNING");
      expect(entries[1].severity).toBe("WARNING");
      expect(entries[1].timestamp).toBe(
        new Date("2023-07-04 10:16:45").toISOString()
      );
      expect(entries[1].message).toBe(
        "Invalid input received from client Request payload is missing\nrequired field."
      );
    });

    it("splits two concatenated valid log entries into two separate entries", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:15:23 [INFO] User logged in2023-07-04 10:18:02 [ERROR] Database failed.",
      ]);

      // Both halves are valid headers → two entries, no errors
      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(2);
      expect(entries[0].severity).toBe("INFO");
      expect(entries[0].message).toBe("User logged in");
      expect(entries[1].severity).toBe("ERROR");
      expect(entries[1].message).toBe("Database failed.");
    });

    it("attaches the prefix part as a continuation when a valid entry already exists", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 09:00:00 [INFO] First entry.",
        "continuation prefix 2023-07-04 10:00:00 [ERROR] Second entry.",
      ]);

      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(2);
      expect(entries[0].message).toBe("First entry.\ncontinuation prefix");
      expect(entries[1].message).toBe("Second entry.");
    });

    it("does not split on a date that appears inside the message without a full log header", () => {
      const { entries, errors } = parseLines([
        "2023-07-04 10:15:23 [INFO] User mentioned date 2023-07-04 in the message.",
      ]);

      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe(
        "User mentioned date 2023-07-04 in the message."
      );
    });
  });

  // ─── Message text preservation ────────────────────────────────────────────

  describe("message text preservation", () => {
    it("preserves email addresses in the message unchanged", () => {
      const { entries } = parseLines([
        "2023-07-04 10:15:23 [INFO] User logged in john.doe@example.com",
      ]);

      expect(entries[0].message).toBe("User logged in john.doe@example.com");
    });

    it("preserves URLs in the message unchanged", () => {
      const { entries } = parseLines([
        "2023-07-04 10:15:23 [INFO] Request to https://api.example.com/v1/users",
      ]);

      expect(entries[0].message).toBe(
        "Request to https://api.example.com/v1/users"
      );
    });

    it("preserves dollar amounts and punctuation in the message unchanged", () => {
      const { entries } = parseLines([
        "2023-07-04 10:20:14 [INFO] Order ID - 12345, Amount - $99.99",
      ]);

      expect(entries[0].message).toBe("Order ID - 12345, Amount - $99.99");
    });

    it("preserves colons inside the message unchanged", () => {
      const { entries } = parseLines([
        "2023-07-04 10:18:02 [ERROR] Database connec&on failed: timeout.",
      ]);

      expect(entries[0].message).toBe("Database connec&on failed: timeout.");
    });
  });

  // ─── Mixed / integration ──────────────────────────────────────────────────

  describe("mixed valid and invalid content", () => {
    it("returns valid entries and parse errors for a mixed input without throwing", () => {
      const lines = [
        "2023-07-04 10:00:00 [INFO] App started.",
        "2023-07-04 101645 [WARNING] Corrupted timestamp.",
        "2023-07-04 10:01:00 [CRITICAL] Unknown severity.",
        "orphan line with no header",
        "2023-07-04 10:02:00 [ERROR] Database failed.",
        "  caused by network error",
        "2023-02-30 10:00:00 [DEBUG] Impossible date.",
      ];

      const { entries, errors } = parseLines(lines);

      expect(entries).toHaveLength(3);
      expect(entries[0].severity).toBe("INFO");
      expect(entries[1].severity).toBe("WARNING");
      expect(entries[1].message).toBe("Corrupted timestamp.");
      expect(entries[1].timestamp).toBe(
        new Date("2023-07-04 10:16:45").toISOString()
      );
      expect(entries[2].severity).toBe("ERROR");
      expect(entries[2].message).toBe("Database failed.\n  caused by network error");

      expect(errors).toHaveLength(3);
      expect(errors.map((e) => e.reason)).toEqual([
        "UNSUPPORTED_SEVERITY",
        "ORPHAN_CONTINUATION_LINE",
        "INVALID_TIMESTAMP",
      ]);
    });
  });

  // ─── Reliability ─────────────────────────────────────────────────────────

  describe("reliability", () => {
    it("handles ~1000 valid lines and a few malformed lines correctly", () => {
      const validLines: string[] = [];
      for (let i = 0; i < 995; i++) {
        const hh = String(10 + (i % 13)).padStart(2, "0");
        const mm = String(i % 60).padStart(2, "0");
        const ss = String(i % 60).padStart(2, "0");
        validLines.push(`2023-07-04 ${hh}:${mm}:${ss} [INFO] Event number ${i}`);
      }

      const malformedLines = [
        "2023-07-04 101645 [WARNING] Bad timestamp format.",       // now valid (compact time)
        "2023-02-30 10:00:00 [ERROR] Impossible date.",            // INVALID_TIMESTAMP
        "orphan continuation with no header",                       // ORPHAN_CONTINUATION_LINE
        "2023-07-04 not-a-time no-brackets here",                  // INVALID_FORMAT
        "2023-07-04 10:00:00 [CRITICAL] Unsupported severity.",    // UNSUPPORTED_SEVERITY
      ];

      const allLines = [...validLines, ...malformedLines];
      const { entries, errors } = parseLines(allLines);

      expect(entries).toHaveLength(996);
      expect(errors).toHaveLength(4);
      expect(errors.map((e) => e.reason)).toEqual([
        "INVALID_TIMESTAMP",
        "ORPHAN_CONTINUATION_LINE",
        "INVALID_FORMAT",
        "UNSUPPORTED_SEVERITY",
      ]);
    });
  });
});
