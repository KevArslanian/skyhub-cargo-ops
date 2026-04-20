import { SignJWT, jwtVerify } from "jose";
import type { Prisma, UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./prisma";

export const SESSION_COOKIE = "ep_session";
export const INTRO_COOKIE = "ep_intro_seen";

const secret = new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret-ekspedisi-petir");

export type SessionPayload = {
  userId: string;
  role: UserRole;
  remember: boolean;
};

export type CurrentUser = Prisma.UserGetPayload<{
  include: {
    settings: true;
    customerAccount: {
      select: {
        id: true;
        name: true;
        status: true;
      };
    };
  };
}>;

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

export async function setIntroSeenCookie() {
  const cookieStore = await cookies();
  cookieStore.set(INTRO_COOKIE, "1", getCookieBase(60 * 60 * 24));
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    ...getCookieBase(),
    expires: new Date(0),
  });
}

export async function clearIntroSeenCookie() {
  const cookieStore = await cookies();
  cookieStore.set(INTRO_COOKIE, "", {
    ...getCookieBase(),
    expires: new Date(0),
  });
}

export async function destroySession() {
  await Promise.all([clearSessionCookie(), clearIntroSeenCookie()]);
}

export async function hasIntroSeenCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(INTRO_COOKIE)?.value === "1";
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
    include: {
      settings: true,
      customerAccount: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (!user || user.status !== "active") {
    await clearSessionCookie();
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

export async function redirectAuthenticatedUserToDashboard() {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === "customer" ? "/awb-tracking" : "/dashboard");
  }
}

export async function requireIntroForLogin() {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === "customer" ? "/awb-tracking" : "/dashboard");
  }

  const hasIntro = await hasIntroSeenCookie();
  if (!hasIntro) {
    redirect("/about-us");
  }
}
