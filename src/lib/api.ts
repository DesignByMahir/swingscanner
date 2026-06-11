import { NextResponse } from "next/server";

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({ ok: true, data, ...(meta ? { meta } : {}) });
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: { code, message, ...(details ? { details } : {}) } }, { status });
}
