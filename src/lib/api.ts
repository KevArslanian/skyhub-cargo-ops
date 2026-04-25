import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { AccessError } from "./access";

type ValidationErrorLike = {
  issues: Array<{ message?: string }>;
};

const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  User_email_key: "Email sudah terdaftar.",
  CustomerAccount_code_key: "Kode akun pelanggan sudah terdaftar.",
  Flight_flightNumber_key: "Nomor flight sudah terdaftar.",
  Shipment_awb_key: "AWB sudah terdaftar.",
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

  console.error("[route-error]", error);

  return NextResponse.json(
    {
      error: fallbackMessage,
    },
    { status: 500 },
  );
}
