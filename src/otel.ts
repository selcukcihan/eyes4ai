import crypto from "node:crypto";
import type { OtlpAnyValue, OtlpKeyValue, OtlpLogRecord } from "./types.js";

export function anyValueToPrimitive(value: OtlpAnyValue | undefined): unknown {
  if (!value) {
    return undefined;
  }
  if (value.stringValue !== undefined) {
    return value.stringValue;
  }
  if (value.intValue !== undefined) {
    return Number(value.intValue);
  }
  if (value.doubleValue !== undefined) {
    return value.doubleValue;
  }
  if (value.boolValue !== undefined) {
    return value.boolValue;
  }
  if (value.arrayValue?.values) {
    return value.arrayValue.values.map((item) => anyValueToPrimitive(item));
  }
  if (value.kvlistValue?.values) {
    return Object.fromEntries(
      value.kvlistValue.values.map((entry) => [entry.key, anyValueToPrimitive(entry.value)])
    );
  }
  return undefined;
}

export function attributesToRecord(attributes: OtlpKeyValue[] | undefined): Record<string, unknown> {
  const entries = (attributes ?? []).map((attribute) => [attribute.key, anyValueToPrimitive(attribute.value)]);
  return Object.fromEntries(entries);
}

export function logRecordTimestamp(record: OtlpLogRecord): string {
  const raw = record.timeUnixNano ?? record.observedTimeUnixNano;
  if (!raw) {
    return new Date().toISOString();
  }

  const nanos = BigInt(raw);
  const millis = Number(nanos / 1_000_000n);
  return new Date(millis).toISOString();
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function makeEventId(): string {
  return crypto.randomUUID();
}
