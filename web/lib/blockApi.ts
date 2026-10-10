import "server-only";

import { NextResponse } from "next/server";

import { LockedError } from "@/lib/db/private";
import { isUnlocked } from "@/lib/session";

/**
 * Shared front door for the dashboard's write routes.
 *
 * Checks, in order: the session, that the body really is JSON (a cross-site
 * HTML form can only send form encodings, so this closes the CSRF gap that a
 * lax cookie alone leaves open), and that it parses. Returns the parsed body,
 * or a ready-made error response.
 */
export async function readAuthorisedJson(
  request: Request
): Promise<{ body: Record<string, unknown> } | { error: NextResponse }> {
  if (!(await isUnlocked())) {
    return { error: NextResponse.json({ error: "Locked." }, { status: 401 }) };
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return {
      error: NextResponse.json({ error: "Expected JSON." }, { status: 415 }),
    };
  }
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return { body };
    }
  } catch {
    // fall through
  }
  return { error: NextResponse.json({ error: "Malformed request." }, { status: 400 }) };
}

export function lockedToResponse(error: unknown): NextResponse {
  if (error instanceof LockedError) {
    return NextResponse.json({ error: "Locked." }, { status: 401 });
  }
  throw error;
}
