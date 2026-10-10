import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { lockedToResponse, readAuthorisedJson } from "@/lib/blockApi";
import { setBlockVisibility } from "@/lib/db/private";

/** Show or hide one block on the public site. Body: { id, isPublic }. */
export async function POST(request: Request) {
  const parsed = await readAuthorisedJson(request);
  if ("error" in parsed) return parsed.error;

  const { id, isPublic } = parsed.body;
  if (!Number.isInteger(id) || typeof isPublic !== "boolean") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    if (!(await setBlockVisibility(id as number, isPublic))) {
      return NextResponse.json({ error: "No such block." }, { status: 404 });
    }
  } catch (error) {
    return lockedToResponse(error);
  }

  // The landing page is cached for an hour; make the change show immediately.
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
