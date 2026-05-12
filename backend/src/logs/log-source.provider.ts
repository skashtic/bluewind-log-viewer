export interface ILogSourceProvider {
  readRawLines(): Promise<string[]>;
}
