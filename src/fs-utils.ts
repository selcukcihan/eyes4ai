import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function appendJsonLine(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await appendFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

export function todayJsonlPath(rootDir: string): string {
  const isoDay = new Date().toISOString().slice(0, 10);
  return path.join(rootDir, ".ai", "private", "events", `${isoDay}.jsonl`);
}
