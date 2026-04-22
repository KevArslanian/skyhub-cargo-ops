import { Prisma } from "@prisma/client";
import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { assertSameOriginRequest, routeErrorResponse } from "@/lib/api";
import { LOGIN_ERROR_CODES, type LoginErrorCode, type LoginResponse } from "@/lib/auth-login";
import { db } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";

const DUMMY_PASSWORD_HASH = "$2b$10$2nDaRkI6SQ7qN4uA.7Z0m.9pO5X2FdtYYG6iwSeNBY0d5hDOGOZaC";
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttemptStore = new Map<string, { count: number; resetAt: number }>();

function respondWithError(status: number, code: LoginErrorCode, error: string) {
  return NextResponse.json<LoginResponse>({ error, code }, { status });
}

function getRateLimitKey(request: Request, email: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `${forwardedFor}:${email}`;
}

function registerFailedAttempt(key: string) {
  const now = Date.now();
  const current = loginAttemptStore.get(key);

  if (!current || current.resetAt <= now) {
    loginAttemptStore.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }

  loginAttemptStore.set(key, { count: current.count + 1, resetAt: current.resetAt });
}

function clearFailedAttempts(key: string) {
  loginAttemptStore.delete(key);
}

function isLoginRateLimited(key: string) {
  const current = loginAttemptStore.get(key);
  if (!current) {
    return false;
  }

  if (current.resetAt <= Date.now()) {
    loginAttemptStore.delete(key);
    return false;
  }

  return current.count >= LOGIN_MAX_ATTEMPTS;
}

function isProductionTestAccountEmail(email: string) {
  return process.env.NODE_ENV === "production" && email.trim().toLowerCase().endsWith("@skyhub.test");
}

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
    const json = await request.json();
    const parsed = loginSchema.safeParse(json);

    if (!parsed.success) {
      return respondWithError(
        400,
        LOGIN_ERROR_CODES.INVALID_INPUT,
        parsed.error.issues[0]?.message || "Input login tidak valid.",
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const rateLimitKey = getRateLimitKey(request, email);
    if (isLoginRateLimited(rateLimitKey)) {
      return respondWithError(429, LOGIN_ERROR_CODES.AUTH_UNAVAILABLE, "Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.");
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        customerAccount: {
          select: {
            status: true,
          },
        },
      },
    });

    const passwordMatches = await compare(parsed.data.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!user || !passwordMatches || isProductionTestAccountEmail(user.email)) {
      registerFailedAttempt(rateLimitKey);
      return respondWithError(401, LOGIN_ERROR_CODES.INVALID_CREDENTIALS, "Email atau password tidak cocok.");
    }

    if (user.status !== "active") {
      registerFailedAttempt(rateLimitKey);
      return respondWithError(403, LOGIN_ERROR_CODES.ACCOUNT_INACTIVE, "Akun ini belum aktif atau sudah dinonaktifkan.");
    }

    if (user.role === "customer" && user.customerAccount?.status !== "active") {
      registerFailedAttempt(rateLimitKey);
      return respondWithError(403, LOGIN_ERROR_CODES.CUSTOMER_ACCOUNT_INACTIVE, "Akun pelanggan ini belum aktif.");
    }

    clearFailedAttempts(rateLimitKey);
    await createSession(user.id, user.role, parsed.data.remember);

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "Login",
        targetType: "session",
        targetLabel: "Konsol Operasional",
        description: `${user.name} berhasil login ke sistem.`,
        level: "success",
      },
    });

    return NextResponse.json<LoginResponse>({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      console.error("[auth-login]", error);
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      return respondWithError(
        503,
        LOGIN_ERROR_CODES.DATABASE_NOT_READY,
        "Database login belum siap dipakai saat ini.",
      );
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return respondWithError(
        503,
        LOGIN_ERROR_CODES.AUTH_UNAVAILABLE,
        "Koneksi database autentikasi belum tersedia.",
      );
    }

    return routeErrorResponse(error, "Tidak dapat memproses login saat ini.");
  }
}
