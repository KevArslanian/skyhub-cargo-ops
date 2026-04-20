import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createShipment, getShipmentByAwb, listShipments, rememberAwbSearch } from "@/lib/data";
import { shipmentCreateSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const awb = searchParams.get("awb");

  if (awb) {
    const shipment = await getShipmentByAwb(awb);
    if (shipment) {
      await rememberAwbSearch(user.id, awb);
    }
    return NextResponse.json({ shipment });
  }

  if (user.role === "customer") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const data = await listShipments({
    query: searchParams.get("query") || undefined,
    status: searchParams.get("status") || undefined,
    flight: searchParams.get("flight") || undefined,
    sortBy: searchParams.get("sortBy") || undefined,
  });

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role === "customer") {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat shipment." },
      { status: 500 },
    );
  }
}
