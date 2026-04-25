import { SignJWT, jwtVerify } from "jose";
import type { Prisma, UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccessError } from "./access";
import { db } from "./prisma";
import { AUTH_BYPASS_ENABLED } from "./runtime-flags";
import { assertRequiredServerEnv, readRequiredServerEnv } from "./server-env";

export const SESSION_COOKIE = "ep_session";
export const INTRO_COOKIE = "ep_intro_seen";

assertRequiredServerEnv();

const secret = new TextEncoder().encode(readRequiredServerEnv("SESSION_SECRET"));
const CAPTURE_ROLE_HEADER = "x-skyhub-capture-role";

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

async function resolveCaptureRoleOverride(): Promise<UserRole | null> {
  if (!AUTH_BYPASS_ENABLED) {
    return null;
  }

  const headerStore = await headers();
  const role = headerStore.get(CAPTURE_ROLE_HEADER)?.trim().toLowerCase();

  if (role === "admin" || role === "staff" || role === "customer") {
    return role;
  }

  return null;
}

async function getBypassUser(preferredRole?: UserRole | null): Promise<CurrentUser | null> {
  if (preferredRole) {
    const scopedPreferred = await db.user.findFirst({
      where: {
        status: "active",
        role: preferredRole,
        ...(preferredRole === "customer"
          ? {
              customerAccount: {
                is: {
                  status: "active",
                },
              },
            }
          : {}),
      },
      orderBy: { createdAt: "asc" },
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

    if (scopedPreferred) {
      return scopedPreferred;
    }
  }

  const preferredInternal = await db.user.findFirst({
    where: {
      status: "active",
      role: { in: ["admin", "staff"] },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
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

  if (preferredInternal) {
    return preferredInternal;
  }

  return db.user.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
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
}

function shouldUseSecureCookies() {
  if (process.env.NODE_ENV === "production") {
    return true;
  }

  const override = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();

  if (override === "true" || override === "1") {
    return true;
  }

  if (override === "false" || override === "0") {
    return false;
  }

  return false;
}

function getCookieBase(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies(),
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
  const captureRoleOverride = await resolveCaptureRoleOverride();

  if (AUTH_BYPASS_ENABLED && captureRoleOverride) {
    return getBypassUser(captureRoleOverride);
  }

  const session = await getSessionPayload();

  if (!session?.userId) {
    if (AUTH_BYPASS_ENABLED) {
      return getBypassUser(captureRoleOverride);
    }

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
    if (AUTH_BYPASS_ENABLED) {
      return getBypassUser(captureRoleOverride);
    }

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
