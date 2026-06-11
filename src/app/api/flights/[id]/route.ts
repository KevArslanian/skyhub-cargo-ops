import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse, validationErrorResponse } from "@/lib/api";
import { deleteFlight, updateFlight } from "@/lib/data";
import { flightUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const json = await request.json();
    const parsed = flightUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Perubahan penerbangan tidak valid.");
    }

    const flight = await updateFlight({
      ...parsed.data,
      flightId: id,
      actorUserId: user.id,
    });

    return NextResponse.json({ flight });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memperbarui penerbangan.");
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;

    await deleteFlight(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, "Gagal mengarsipkan penerbangan.");
  }
}
