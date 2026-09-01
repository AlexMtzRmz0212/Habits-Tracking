/**
 * The PIN gate for the private dashboard.
 *
 * One shared secret, one signed cookie. There is exactly one user, so a full
 * auth system (user table, password hashes, reset flow) would be more moving
 * parts and more attack surface for no benefit.
 *
 * The cookie is a signed JWT rather than a flag like `unlocked=true`, because
 * a plain flag is trivially forged by anyone who opens devtools.
 */

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "habits_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // Failing loudly beats falling back to a default secret, which would make
    // every deployment forgeable by anyone who has read this file.
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters. " +
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
    );
  }
  return new TextEncoder().encode(secret);
}

/** Compare in constant time, so response timing cannot reveal the PIN. */
export function pinMatches(candidate: string): boolean {
  const expected = process.env.PRIVATE_ACCESS_PIN;
  if (!expected) {
    throw new Error("PRIVATE_ACCESS_PIN is not set; the dashboard cannot be unlocked.");
  }

  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");

  // timingSafeEqual throws on length mismatch, which would itself leak the
  // expected length. Hash both to a fixed width first by padding to the max.
  const width = Math.max(a.length, b.length);
  const paddedA = Buffer.alloc(width);
  const paddedB = Buffer.alloc(width);
  a.copy(paddedA);
  b.copy(paddedB);

  // The length check is folded into the result rather than short-circuiting.
  return timingSafeEqual(paddedA, paddedB) && a.length === b.length;
}

export async function createSession(): Promise<void> {
  const token = await new SignJWT({ scope: "private" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true, // not readable from JavaScript
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/**
 * Whether this request may see private data.
 *
 * Any failure -- missing cookie, bad signature, expired token -- returns
 * false. There is no path through this function that returns true by accident.
 */
export async function isUnlocked(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.scope === "private";
  } catch {
    return false;
  }
}
