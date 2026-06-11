import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse, validationErrorResponse } from "@/lib/api";
import { createShipment, getShipmentByAwb, listShipments, rememberAwbSearch } from "@/lib/data";
import { buildShipmentSubmitPayload } from "@/lib/shipment-payload";
import { awbLookupSchema, shipmentCreateSchema, shipmentListQuerySchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const awb = searchParams.get("awb");

    if (awb !== null) {
      const parsedAwb = awbLookupSchema.safeParse({ awb });

      if (!parsedAwb.success) {
        return validationErrorResponse(parsedAwb.error, "Format nomor resi tidak valid.");
      }

      const shipment = await getShipmentByAwb(user, parsedAwb.data.awb);
      if (shipment) {
        await rememberAwbSearch(user.id, parsedAwb.data.awb);
      }
      return NextResponse.json({ shipment });
    }

    const parsedQuery = shipmentListQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsedQuery.success) {
      return validationErrorResponse(parsedQuery.error, "Filter pengiriman tidak valid.");
    }

    const data = await listShipments(user, parsedQuery.data);

    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat pengiriman.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = await request.json();
    const parsed = shipmentCreateSchema.safeParse(buildShipmentSubmitPayload(payload));

    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Input pengiriman tidak valid.");
    }

    const shipment = await createShipment({
      ...parsed.data,
      volumeM3: parsed.data.volumeM3 ?? null,
      flightId: parsed.data.flightId ?? null,
      customerAccountId: parsed.data.customerAccountId ?? null,
      docStatus: parsed.data.docStatus,
      userId: user.id,
      actorName: user.name,
    });

    return NextResponse.json({ shipment });
  } catch (error) {
    return routeErrorResponse(error, "Gagal membuat pengiriman.");
  }
}
