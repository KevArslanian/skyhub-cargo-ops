import { NextResponse } from "next/server";
import { routeErrorResponse, validationErrorResponse } from "@/lib/api";
import { getPublicShipmentByAwb } from "@/lib/data";
import { awbSearchSchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedAwb = awbSearchSchema.safeParse({ awb: searchParams.get("awb") });

    if (!parsedAwb.success) {
      return validationErrorResponse(parsedAwb.error, "AWB tidak valid.");
    }

    const shipment = await getPublicShipmentByAwb(parsedAwb.data.awb);
    return NextResponse.json({ shipment });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat pelacakan resi.");
  }
}
