import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { assertInternalApiAccess } from "@/lib/access";
import { createShipment, getShipmentByAwb, listShipments, rememberAwbSearch } from "@/lib/data";
import { shipmentCreateSchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const awb = searchParams.get("awb");

    if (awb) {
      const shipment = await getShipmentByAwb(user, awb);
      if (shipment) {
        await rememberAwbSearch(user.id, awb);
      }
      return NextResponse.json({ shipment });
    }

    assertInternalApiAccess(user);

    const data = await listShipments(user, {
      query: searchParams.get("query") || undefined,
      status: searchParams.get("status") || undefined,
      flight: searchParams.get("flight") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
    });

    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat shipment.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    assertInternalApiAccess(user);
    const payload = await request.json();
    const parsed = shipmentCreateSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Input shipment tidak valid." }, { status: 400 });
    }

    const shipment = await createShipment({
      ...parsed.data,
      volumeM3: parsed.data.volumeM3 ?? null,
      flightId: parsed.data.flightId ?? null,
      userId: user.id,
      actorName: user.name,
    });

    return NextResponse.json({ shipment });
  } catch (error) {
    return routeErrorResponse(error, "Gagal membuat shipment.");
  }
}
