import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { deleteShipmentDocument, verifyShipmentPaymentDocument } from "@/lib/data";

type RouteContext = {
  params: Promise<{ id: string; documentId: string }>;
};

export async function PATCH(_: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, documentId } = await context.params;

    const shipment = await verifyShipmentPaymentDocument({
      shipmentId: id,
      documentId,
      userId: user.id,
      actorName: user.name,
    });

    return NextResponse.json({ shipment });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memverifikasi pembayaran.");
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, documentId } = await context.params;

    const result = await deleteShipmentDocument({
      shipmentId: id,
      documentId,
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, "Gagal menghapus dokumen.");
  }
}
