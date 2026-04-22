import { NextResponse } from "next/server";
import { setIntroSeenCookie } from "@/lib/auth";

export async function POST(request: Request) {
  await setIntroSeenCookie();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
