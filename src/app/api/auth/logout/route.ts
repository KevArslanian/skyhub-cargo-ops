import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

function getSafeNextPath(request: Request) {
  const nextPath = new URL(request.url).searchParams.get("next");

  if (!nextPath?.startsWith("/") || nextPath.startsWith("//")) {
    return "/about-us";
  }

  return nextPath;
}

export async function GET(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL(getSafeNextPath(request), request.url));
}

export async function POST() {
  await destroySession();
  return NextResponse.json({ success: true });
}
