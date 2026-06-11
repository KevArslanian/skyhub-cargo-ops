import { Prisma } from "@prisma/client";
import { compareSync } from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { LOGIN_ERROR_CODES, type LoginErrorCode, type LoginResponse } from "@/lib/auth-login";
import { db } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";

function respondWithError(status: number, code: LoginErrorCode, error: string) {
  return NextResponse.json<LoginResponse>({ error, code }, { status });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientDatabaseError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P1001" || error.code === "P2028"))
  );
}

async function retryTransientDatabase<T>(operation: () => Promise<T>) {
  const delays = [450, 900, 1400];
  let lastError: unknown;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDatabaseError(error) || attempt === delays.length) {
        throw error;
      }
      await wait(delays[attempt]);
    }
  }

  throw lastError;
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = loginSchema.safeParse(json);

    if (!parsed.success) {
      return respondWithError(
        400,
        LOGIN_ERROR_CODES.INVALID_INPUT,
        parsed.error.issues[0]?.message || "Input login tidak valid.",
      );
    }

    const user = await retryTransientDatabase(() =>
      db.user.findUnique({
        where: { email: parsed.data.email },
      }),
    );

    if (!user || !compareSync(parsed.data.password, user.passwordHash)) {
      return respondWithError(401, LOGIN_ERROR_CODES.INVALID_CREDENTIALS, "Surel atau kata sandi tidak cocok.");
    }

    if (user.status !== "active") {
      return respondWithError(403, LOGIN_ERROR_CODES.ACCOUNT_INACTIVE, "Akun ini belum aktif atau sudah dinonaktifkan.");
    }

    if (user.role === "customer") {
      return respondWithError(
        403,
        LOGIN_ERROR_CODES.CUSTOMER_LOGIN_DISABLED,
        "Pelanggan tidak memiliki akun masuk. Gunakan pelacakan AWB publik di halaman Tentang Kami.",
      );
    }

    await createSession(user.id, user.role, parsed.data.remember);

    return NextResponse.json<LoginResponse>({ success: true, role: user.role });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      return respondWithError(
        503,
        LOGIN_ERROR_CODES.DATABASE_NOT_READY,
        "Basis data akses masuk belum siap dipakai saat ini.",
      );
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return respondWithError(
        503,
        LOGIN_ERROR_CODES.AUTH_UNAVAILABLE,
        "Koneksi basis data autentikasi belum tersedia.",
      );
    }

    return respondWithError(500, LOGIN_ERROR_CODES.AUTH_UNAVAILABLE, "Tidak dapat memproses akses masuk saat ini.");
  }
}
