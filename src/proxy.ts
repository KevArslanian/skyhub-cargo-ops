import { jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { INTRO_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { isCustomerAllowedPath } from "@/lib/access";
import { AUTH_BYPASS_ENABLED } from "@/lib/runtime-flags";

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("[env] Missing SESSION_SECRET for proxy session verification.");
}

const secret = new TextEncoder().encode(sessionSecret);
const CAPTURE_ROLE_HEADER = "x-skyhub-capture-role";

type ProxySessionPayload = {
  userId: string;
  role: UserRole;
};

const PUBLIC_API_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/intro",
  "/api/auth/logout",
  "/api/public/landing-metrics",
]);

function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isPublicApiPath(pathname: string) {
  return PUBLIC_API_PATHS.has(pathname);
}

function isMutatingMethod(method: string) {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function parseCaptureRole(request: NextRequest): UserRole | null {
  const role = request.nextUrl.searchParams.get("capture")?.trim().toLowerCase();

  if (role === "admin" || role === "staff" || role === "customer") {
    return role;
  }

  return null;
}

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
  const captureRole = parseCaptureRole(request);

  if (isApiPath(pathname) && isMutatingMethod(request.method) && !isSameOriginRequest(request)) {
    return NextResponse.json(
      {
        error: "Permintaan ditolak karena origin tidak sesuai.",
        code: "CSRF_ORIGIN_MISMATCH",
      },
      { status: 403 },
    );
  }

  if (AUTH_BYPASS_ENABLED) {
    const requestHeaders = new Headers(request.headers);

    if (captureRole) {
      requestHeaders.set(CAPTURE_ROLE_HEADER, captureRole);
    }

    if (pathname === "/") {
      const bypassHome = captureRole === "customer" ? "/awb-tracking" : "/dashboard";
      return NextResponse.redirect(new URL(bypassHome, request.url));
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const session = await getSession(request);
  const hasIntro = request.cookies.get(INTRO_COOKIE)?.value === "1";
  const authenticatedHome = session?.role === "customer" ? "/awb-tracking" : "/dashboard";

  if (isApiPath(pathname)) {
    if (isPublicApiPath(pathname)) {
      return NextResponse.next();
    }

    if (!session) {
      return NextResponse.json(
        {
          error: "Autentikasi diperlukan. Silakan login terlebih dahulu.",
          code: "UNAUTHENTICATED",
        },
        { status: 401 },
      );
    }

    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? authenticatedHome : "/about-us", request.url));
  }

  if (pathname === "/about-us") {
    if (session) {
      return NextResponse.redirect(new URL(authenticatedHome, request.url));
    }

    return NextResponse.next();
  }

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL(authenticatedHome, request.url));
    }

    if (!hasIntro) {
      return NextResponse.redirect(new URL("/about-us", request.url));
    }

    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/about-us", request.url));
  }

  if (session.role === "customer" && !isCustomerAllowedPath(pathname)) {
    return NextResponse.redirect(new URL("/awb-tracking", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/about-us",
    "/login",
    "/api/:path*",
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
