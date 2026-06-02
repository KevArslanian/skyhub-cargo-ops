import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { AccessError } from "./access";

type ValidationErrorLike = {
  issues: Array<{ message?: string }>;
};

const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  User_email_key: "Surel sudah terdaftar.",
  CustomerAccount_code_key: "Kode akun pelanggan sudah terdaftar.",
  Flight_flightNumber_key: "Nomor penerbangan sudah terdaftar.",
  Shipment_awb_key: "AWB sudah terdaftar.",
};

const PRISMA_ERROR_MESSAGES: Record<string, { status: number; code: string; message: string }> = {
  P1001: {
    status: 503,
    code: "DATABASE_UNAVAILABLE",
    message: "Koneksi basis data belum tersedia. Coba beberapa saat lagi.",
  },
  P2000: {
    status: 400,
    code: "VALUE_TOO_LONG",
    message: "Masukan terlalu panjang untuk kolom basis data.",
  },
  P2003: {
    status: 400,
    code: "RELATION_CONSTRAINT",
    message: "Data terkait tidak valid atau sudah tidak tersedia.",
  },
  P2025: {
    status: 404,
    code: "RECORD_NOT_FOUND",
    message: "Data tidak ditemukan atau sudah dihapus.",
  },
  P2028: {
    status: 503,
    code: "DATABASE_TRANSACTION_TIMEOUT",
    message: "Transaksi basis data terlalu lama diproses. Coba ulangi setelah beberapa saat.",
  },
};

function getUniqueConstraintMessage(error: Prisma.PrismaClientKnownRequestError) {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    if (target.includes("email")) return UNIQUE_CONSTRAINT_MESSAGES.User_email_key;
    if (target.includes("code")) return UNIQUE_CONSTRAINT_MESSAGES.CustomerAccount_code_key;
    if (target.includes("flightNumber")) return UNIQUE_CONSTRAINT_MESSAGES.Flight_flightNumber_key;
    if (target.includes("awb")) return UNIQUE_CONSTRAINT_MESSAGES.Shipment_awb_key;
  }

  if (typeof target === "string" && UNIQUE_CONSTRAINT_MESSAGES[target]) {
    return UNIQUE_CONSTRAINT_MESSAGES[target];
  }

  return "Data unik sudah dipakai oleh record lain.";
}

export function validationErrorResponse(error: ValidationErrorLike, fallbackMessage: string) {
  return NextResponse.json(
    {
      error: error.issues[0]?.message || fallbackMessage,
      code: "VALIDATION_ERROR",
    },
    { status: 400 },
  );
}

export function routeErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof AccessError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.status },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      {
        error: getUniqueConstraintMessage(error),
        code: "UNIQUE_CONSTRAINT",
      },
      { status: 409 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && PRISMA_ERROR_MESSAGES[error.code]) {
    const mapped = PRISMA_ERROR_MESSAGES[error.code];
    return NextResponse.json(
      {
        error: mapped.message,
        code: mapped.code,
      },
      { status: mapped.status },
    );
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json(
      {
        error: "Koneksi basis data belum tersedia. Coba beberapa saat lagi.",
        code: "DATABASE_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  console.error("[route-error]", error);

  return NextResponse.json(
    {
      error: fallbackMessage,
    },
    { status: 500 },
  );
}
