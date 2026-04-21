import http from "node:http";
import path from "node:path";
import { appendJsonLine, todayJsonlPath } from "./fs-utils.js";
import { attributesToRecord } from "./otel.js";
import { normalizeCodexLogRecord } from "./normalize.js";
import type { OtlpLogsRequest } from "./types.js";

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function handleOtlpLogs(rootDir: string, payload: OtlpLogsRequest): Promise<number> {
  let written = 0;
  const outputPath = todayJsonlPath(rootDir);

  for (const resourceLog of payload.resourceLogs ?? []) {
    const resourceAttributes = attributesToRecord(resourceLog.resource?.attributes);
    for (const scopeLog of resourceLog.scopeLogs ?? []) {
      for (const logRecord of scopeLog.logRecords ?? []) {
        const normalized = normalizeCodexLogRecord(logRecord, resourceAttributes);
        if (!normalized) {
          continue;
        }
        await appendJsonLine(outputPath, normalized);
        written += 1;
      }
    }
  }

  return written;
}

export function startServer(rootDir: string, port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "POST" && req.url === "/v1/logs") {
        const payload = await readJsonBody(req) as OtlpLogsRequest;
        const written = await handleOtlpLogs(rootDir, payload);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, written }));
        return;
      }

      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, eventsPath: path.join(rootDir, ".ai", "private", "events") }));
        return;
      }

      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "not_found" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: message }));
    }
  });

  server.listen(port);
  return server;
}
