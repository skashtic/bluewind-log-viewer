import { LogEntry, ParseError } from "./logs.types";

let entries: LogEntry[] = [];
let errors: ParseError[] = [];

export function save(newEntries: LogEntry[], newErrors: ParseError[]): void {
  entries = newEntries;
  errors = newErrors;
}

export function getEntries(): LogEntry[] {
  return entries;
}

export function getErrors(): ParseError[] {
  return errors;
}

export function clear(): void {
  entries = [];
  errors = [];
}
