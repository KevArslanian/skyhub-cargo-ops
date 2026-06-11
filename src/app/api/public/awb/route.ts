import { NextResponse } from "next/server";
import { routeErrorResponse, validationErrorResponse } from "@/lib/api";
import { getPublicShipmentByAwb } from "@/lib/data";
import { verifyPublicTrackingChallenge } from "@/lib/public-tracking-challenge";
import { enforcePublicRateLimit } from "@/lib/rate-limit";
import { publicAwbTrackingQuerySchema } from "@/lib/validators";

export async function GET(request: Request) {
  const rateLimited = enforcePublicRateLimit(request, "public-tracking");
  if (rateLimited) {
    return rateLimited;
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = publicAwbTrackingQuerySchema.safeParse({
      awb: searchParams.get("awb"),
      challengeId: searchParams.get("challengeId"),
      challengeAnswer: searchParams.get("challengeAnswer"),
    });

    if (!parsedQuery.success) {
      return validationErrorResponse(parsedQuery.error, "Permintaan pelacakan tidak valid.");
    }

    const verified = verifyPublicTrackingChallenge(
      parsedQuery.data.challengeId,
      parsedQuery.data.challengeAnswer,
    );

    if (!verified) {
      return NextResponse.json(
        {
          error: "Verifikasi robot gagal atau sudah kedaluwarsa. Selesaikan verifikasi lalu coba lagi.",
          code: "CAPTCHA_FAILED",
        },
        { status: 403 },
      );
    }

    const shipment = await getPublicShipmentByAwb(parsedQuery.data.awb);
    return NextResponse.json({ shipment });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat pelacakan resi.");
  }
}
