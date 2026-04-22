import { NextResponse } from "next/server";
import { assertSameOriginRequest, routeErrorResponse } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, "Gagal mengakhiri sesi.");
  }
}
