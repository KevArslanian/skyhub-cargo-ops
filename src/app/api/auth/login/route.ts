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

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      include: {
        customerAccount: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!user || !compareSync(parsed.data.password, user.passwordHash)) {
      return respondWithError(401, LOGIN_ERROR_CODES.INVALID_CREDENTIALS, "Email atau password tidak cocok.");
    }

    if (user.status !== "active") {
      return respondWithError(403, LOGIN_ERROR_CODES.ACCOUNT_INACTIVE, "Akun ini belum aktif atau sudah dinonaktifkan.");
    }

    if (user.role === "customer" && user.customerAccount?.status !== "active") {
      return respondWithError(403, LOGIN_ERROR_CODES.CUSTOMER_ACCOUNT_INACTIVE, "Akun pelanggan ini belum aktif.");
    }

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

    return respondWithError(500, LOGIN_ERROR_CODES.AUTH_UNAVAILABLE, "Tidak dapat memproses login saat ini.");
  }
}
