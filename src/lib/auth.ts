import type { Prisma, UserRole } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccessError } from "./access";
import { DEFAULT_ROUTE_BY_ROLE } from "./constants";
import { db } from "./prisma";

export const SESSION_COOKIE = "ep_session";

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret && process.env.NODE_ENV === "production") {
  throw new Error("[env] Missing SESSION_SECRET.");
}

const secret = new TextEncoder().encode(sessionSecret || "dev-secret-ekspedisi-petir");

type SessionPayload = {
  userId: string;
  role: UserRole;
  remember: boolean;
};

type CurrentUser = Prisma.UserGetPayload<{
  include: {
    settings: true;
  };
}>;

function isProductionTestAccountEmail(email: string) {
  return process.env.NODE_ENV === "production" && email.trim().toLowerCase().endsWith("@skyhub.test");
}

function getCookieBase(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(typeof maxAge === "number" ? { maxAge } : {}),
  };
}

async function signToken(payload: SessionPayload, maxAgeSeconds: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secret);
}

export async function createSession(userId: string, role: UserRole, remember: boolean) {
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
  const token = await signToken({ userId, role, remember }, maxAge);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, getCookieBase(maxAge));
}

export async function destroySession() {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, "", {
    ...getCookieBase(),
    expires: new Date(0),
  });
}

export async function getSessionPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSessionPayload();
  if (!session?.userId) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { settings: true },
  });

  if (!user || user.status !== "active" || isProductionTestAccountEmail(user.email)) {
    return null;
  }

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/about-us");
  }
  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new AccessError("Autentikasi diperlukan. Silakan login terlebih dahulu.", 401, "UNAUTHENTICATED");
  }

  return user;
}

export function getDefaultRouteByRole(role: UserRole) {
  return DEFAULT_ROUTE_BY_ROLE[role] ?? "/dashboard";
}
