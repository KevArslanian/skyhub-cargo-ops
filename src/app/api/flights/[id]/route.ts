import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse, validationErrorResponse } from "@/lib/api";
import { updateFlight } from "@/lib/data";
import { flightUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const json = await request.json();
    const parsed = flightUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Perubahan flight tidak valid.");
    }

    const flight = await updateFlight({
      ...parsed.data,
      flightId: id,
      actorUserId: user.id,
    });

    return NextResponse.json({ flight });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memperbarui flight.");
  }
}
