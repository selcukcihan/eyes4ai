import crypto from "node:crypto";
import type { OtlpAnyValue, OtlpKeyValue, OtlpLogRecord } from "../../schema/src/index.js";

export function coerceStringPrimitive(input: string): string | number | boolean {
  if (input === "true") {
    return true;
  }
  if (input === "false") {
    return false;
  }
  if (/^-?\d+$/.test(input)) {
    return Number(input);
  }
  if (/^-?\d+\.\d+$/.test(input)) {
    return Number(input);
  }
  return input;
}

export function anyValueToPrimitive(value: OtlpAnyValue | undefined): unknown {
  if (!value) {
    return undefined;
  }
  if (value.stringValue !== undefined) {
    return coerceStringPrimitive(value.stringValue);
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

export function coerceRecordPrimitives(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, coerceStringPrimitive(value)];
      }
      return [key, value];
    })
  );
}

export function logRecordTimestamp(record: OtlpLogRecord): string {
  const raw = record.timeUnixNano ?? record.observedTimeUnixNano;
  if (raw) {
    const nanos = BigInt(raw);
    if (nanos > 0n) {
      const millis = Number(nanos / 1_000_000n);
      const iso = new Date(millis).toISOString();
      if (!iso.startsWith("1970-01-01")) {
        return iso;
      }
    }
  }

  const attributes = attributesToRecord(record.attributes);
  const eventTimestamp = attributes["event.timestamp"];
  if (typeof eventTimestamp === "string") {
    return eventTimestamp;
  }

  return new Date().toISOString();
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function makeEventId(): string {
  return crypto.randomUUID();
}
