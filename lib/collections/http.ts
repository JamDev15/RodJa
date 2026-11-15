import { NextResponse } from "next/server";
import { currentActor, type Actor } from "./actor";
import { BillingError } from "./errors";

/** Run a collections service for the signed-in user and map failures to HTTP. */
export async function handle<T>(fn: (actor: Actor) => Promise<T>, status = 200): Promise<NextResponse> {
  try {
    const actor = await currentActor();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const result = await fn(actor);
    return NextResponse.json(result ?? { ok: true }, { status });
  } catch (err) {
    if (err instanceof BillingError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Collections request failed:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new BillingError("Invalid request body", 400);
  }
}

export const str = (v: unknown): string => (typeof v === "string" ? v : "");
export const optStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
export const num = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
