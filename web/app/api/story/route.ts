import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { lockedToResponse, readAuthorisedJson } from "@/lib/blockApi";
import { setBlockText } from "@/lib/db/private";

const MAX_TITLE = 120;
const MAX_BODY = 4000;

/** Edit a block's public title, note and retired flag. Body: { id, title, body, retired }. */
export async function POST(request: Request) {
  const parsed = await readAuthorisedJson(request);
  if ("error" in parsed) return parsed.error;

  const { id, title, body, retired } = parsed.body;
  const cleanTitle = typeof title === "string" ? title.trim() : "";
  const cleanBody = typeof body === "string" ? body.trim() : null;

  if (
    !Number.isInteger(id) ||
    !cleanTitle ||
    cleanTitle.length > MAX_TITLE ||
    cleanBody === null ||
    cleanBody.length > MAX_BODY ||
    typeof retired !== "boolean"
  ) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    if (!(await setBlockText(id as number, cleanTitle, cleanBody, retired))) {
      return NextResponse.json({ error: "No such block." }, { status: 404 });
    }
  } catch (error) {
    return lockedToResponse(error);
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
