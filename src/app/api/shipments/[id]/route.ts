import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse, validationErrorResponse } from "@/lib/api";
import { deleteShipment, getShipmentById, updateShipment } from "@/lib/data";
import { shipmentUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const shipment = await getShipmentById(user, id);

    if (!shipment) {
      return NextResponse.json({ error: "Pengiriman tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ shipment });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat pengiriman.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const json = await request.json();
    const parsed = shipmentUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Perubahan pengiriman tidak valid.");
    }

    const shipment = await updateShipment(id, {
      ...parsed.data,
      userId: user.id,
      actorName: user.name,
    });

    return NextResponse.json({ shipment });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memperbarui pengiriman.");
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;

    await deleteShipment(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, "Gagal menghapus pengiriman.");
  }
}
