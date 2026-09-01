import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

/** Drop the session cookie -- "lock" the dashboard again. */
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
