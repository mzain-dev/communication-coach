import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

export const SESSION_COOKIE = "session";
const SESSION_DURATION = "7d";

export type SessionPayload = {
  sub: string;
  name: string;
  email: string;
  role: "admin" | "user";
};

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set.");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** A readable one-time password for admin-initiated resets — e.g. "correct-horse-83f2". */
export function generateTemporaryPassword(): string {
  const words = ["orbit", "cedar", "flame", "quartz", "meadow", "raven", "delta", "prism", "cobalt", "ember"];
  const pick = () => words[crypto.randomInt(words.length)];
  const digits = crypto.randomInt(1000, 9999);
  return `${pick()}-${pick()}-${digits}`;
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Reads and verifies the current session from the request cookie jar (Server Components, Route Handlers). */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("FORBIDDEN");
  return session;
}
