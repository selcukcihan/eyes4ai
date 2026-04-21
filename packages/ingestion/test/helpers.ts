import type { OtlpLogRecord, OtlpKeyValue } from "../../schema/src/index.js";

/**
 * Build an OTel log record from a simple key-value map.
 */
export function makeLogRecord(
  attrs: Record<string, string | number | boolean>,
  timeUnixNano?: string,
): OtlpLogRecord {
  const attributes: OtlpKeyValue[] = Object.entries(attrs).map(([key, value]) => {
    if (typeof value === "string") return { key, value: { stringValue: value } };
    if (typeof value === "number") return { key, value: { doubleValue: value } };
    if (typeof value === "boolean") return { key, value: { boolValue: value } };
    return { key, value: { stringValue: String(value) } };
  });

  return {
    timeUnixNano: timeUnixNano ?? String(Date.now() * 1_000_000),
    attributes,
  };
}
