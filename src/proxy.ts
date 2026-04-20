import { jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { INTRO_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { isInternalOnlyPath } from "@/lib/access";

const secret = new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret-ekspedisi-petir");

type ProxySessionPayload = {
  userId: string;
  role: UserRole;
};

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as ProxySessionPayload;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await getSession(request);
  const hasIntro = request.cookies.get(INTRO_COOKIE)?.value === "1";

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? "/dashboard" : "/about-us", request.url));
  }

  if (pathname === "/about-us") {
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (!hasIntro) {
      return NextResponse.redirect(new URL("/about-us", request.url));
    }

    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/about-us", request.url));
  }

  if (session.role === "customer" && isInternalOnlyPath(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/about-us",
    "/login",
    "/dashboard/:path*",
    "/shipment-ledger/:path*",
    "/awb-tracking/:path*",
    "/flight-board/:path*",
    "/activity-log/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/exports/:path*",
  ],
};
