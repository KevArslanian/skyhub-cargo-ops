import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { archiveShipment, updateShipment } from "@/lib/data";
import { shipmentUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const json = await request.json();
    const parsed = shipmentUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Perubahan shipment tidak valid." }, { status: 400 });
    }

    const shipment = await updateShipment(id, {
      ...parsed.data,
      userId: user.id,
      actorName: user.name,
    });

    return NextResponse.json({ shipment });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memperbarui shipment.");
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    await archiveShipment(id, true, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, "Gagal mengarsipkan shipment.");
  }
}
