import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { Receipt } from "./types.js";

export class AuditLog {
  constructor(private readonly filePath: string) {}

  append(receipt: Receipt): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const existing = this.read();
    existing.push(receipt);
    writeFileSync(this.filePath, existing.map((row) => JSON.stringify(row)).join("\n") + "\n");
  }

  read(): Receipt[] {
    if (!existsSync(this.filePath)) return [];
    const text = readFileSync(this.filePath, "utf8").trim();
    if (!text) return [];
    return text.split("\n").map((line) => JSON.parse(line) as Receipt);
  }
}

export function receipt(
  event: Receipt["event"],
  planId: string,
  detail: string,
  amounts?: Receipt["amounts"],
): Receipt {
  return {
    at: new Date().toISOString(),
    event,
    planId,
    detail,
    amounts,
  };
}
