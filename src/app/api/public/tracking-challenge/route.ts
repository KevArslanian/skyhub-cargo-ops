import { NextResponse } from "next/server";
import { enforcePublicRateLimit } from "@/lib/rate-limit";
import { createPublicTrackingChallenge } from "@/lib/public-tracking-challenge";

export async function GET(request: Request) {
  const rateLimited = enforcePublicRateLimit(request, "public-tracking-challenge");
  if (rateLimited) {
    return rateLimited;
  }

  const challenge = createPublicTrackingChallenge();
  return NextResponse.json(challenge);
}