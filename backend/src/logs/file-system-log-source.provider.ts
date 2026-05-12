import { readFile } from "fs/promises";
import path from "path";
import { ILogSourceProvider } from "./log-source.provider";

const LOG_FILE_PATH = path.resolve(__dirname, "../../data/log.txt");

export class FileSystemLogSourceProvider implements ILogSourceProvider {
  async readRawLines(): Promise<string[]> {
    const content = await readFile(LOG_FILE_PATH, "utf-8");
    return content.split(/\r?\n/);
  }
}
