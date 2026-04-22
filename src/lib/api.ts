import { NextResponse } from "next/server";
import { AccessError } from "./access";

function getExpectedRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const host = request.headers.get("host")?.trim();
  const resolvedHost = forwardedHost || host;

  if (resolvedHost) {
    return `${forwardedProto || requestUrl.protocol.replace(":", "")}://${resolvedHost}`;
  }

  return requestUrl.origin;
}

export function assertSameOriginRequest(request: Request) {
  const requestOrigin = getExpectedRequestOrigin(request);
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin) {
    if (origin !== requestOrigin) {
      throw new AccessError("Origin request tidak valid.", 403, "INVALID_ORIGIN");
    }
    return;
  }

  if (referer) {
    try {
      if (new URL(referer).origin !== requestOrigin) {
        throw new AccessError("Origin request tidak valid.", 403, "INVALID_ORIGIN");
      }
      return;
    } catch {
      throw new AccessError("Origin request tidak valid.", 403, "INVALID_ORIGIN");
    }
  }

  throw new AccessError("Origin request tidak valid.", 403, "INVALID_ORIGIN");
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

  console.error("[route-error]", error);

  return NextResponse.json(
    {
      error: fallbackMessage,
    },
    { status: 500 },
  );
}
