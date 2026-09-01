import { NextResponse } from "next/server";
import { createSession, pinMatches } from "@/lib/session";

/**
 * Exchange the PIN for a session cookie.
 *
 * Rate limiting is in-memory and per-instance, so it resets on a cold start
 * and does not coordinate across serverless instances. That is a real
 * limitation and worth naming: it raises the cost of guessing, it does not
 * make guessing impossible. The actual protection is a long PIN. A short one
 * is brute-forceable regardless of what this file does.
 */

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  const key =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (rateLimited(key)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute and try again." },
      { status: 429 }
    );
  }

  let pin = "";
  try {
    const body = await request.json();
    pin = typeof body?.pin === "string" ? body.pin : "";
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!pin || !pinMatches(pin)) {
    // A uniform delay on failure, so a wrong PIN cannot be distinguished from
    // a slow one by timing.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  await createSession();
  return NextResponse.json({ ok: true });
}
