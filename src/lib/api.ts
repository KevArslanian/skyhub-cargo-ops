import { NextResponse } from "next/server";
import { AccessError } from "./access";

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

  console.error("[route-error]", error);

  return NextResponse.json(
    {
      error: fallbackMessage,
    },
    { status: 500 },
  );
}
