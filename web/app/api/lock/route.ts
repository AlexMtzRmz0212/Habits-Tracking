import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

/**
 * Drop the session cookie -- "log out" of the dashboard.
 *
 * Called from a plain HTML form, so it answers with a redirect back to the
 * dashboard (which shows the PIN gate again). 303 turns the POST into a GET.
 */
export async function POST(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
