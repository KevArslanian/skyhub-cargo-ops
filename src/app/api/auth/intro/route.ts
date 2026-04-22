import { NextResponse } from "next/server";
import { assertSameOriginRequest, routeErrorResponse } from "@/lib/api";
import { setIntroSeenCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
    await setIntroSeenCookie();
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  } catch (error) {
    return routeErrorResponse(error, "Gagal membuka akses login.");
  }
}
