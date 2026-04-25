import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse, validationErrorResponse } from "@/lib/api";
import { createShipment, getShipmentByAwb, listShipments, rememberAwbSearch } from "@/lib/data";
import { awbSearchSchema, shipmentCreateSchema, shipmentListQuerySchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const awb = searchParams.get("awb");

    if (awb !== null) {
      const parsedAwb = awbSearchSchema.safeParse({ awb });

      if (!parsedAwb.success) {
        return validationErrorResponse(parsedAwb.error, "AWB tidak valid.");
      }

      const shipment = await getShipmentByAwb(user, parsedAwb.data.awb);
      if (shipment) {
        await rememberAwbSearch(user.id, parsedAwb.data.awb);
      }
      return NextResponse.json({ shipment });
    }

    const parsedQuery = shipmentListQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsedQuery.success) {
      return validationErrorResponse(parsedQuery.error, "Filter shipment tidak valid.");
    }

    const data = await listShipments(user, parsedQuery.data);

    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat shipment.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = await request.json();
    const parsed = shipmentCreateSchema.safeParse(payload);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Input shipment tidak valid.");
    }

    const shipment = await createShipment({
      ...parsed.data,
      volumeM3: parsed.data.volumeM3 ?? null,
      flightId: parsed.data.flightId ?? null,
      customerAccountId: parsed.data.customerAccountId ?? null,
      userId: user.id,
      actorName: user.name,
    });

    return NextResponse.json({ shipment });
  } catch (error) {
    return routeErrorResponse(error, "Gagal membuat shipment.");
  }
}
