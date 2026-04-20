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

  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : fallbackMessage,
    },
    { status: 500 },
  );
}
