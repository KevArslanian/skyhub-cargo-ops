import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { createFlight, getFlightBoardData } from "@/lib/data";
import { flightCreateSchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const data = await getFlightBoardData(user, {
      status: searchParams.get("status") || undefined,
      query: searchParams.get("query") || undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat papan flight.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const json = await request.json();
    const parsed = flightCreateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Input flight tidak valid." }, { status: 400 });
    }

    const flight = await createFlight({
      ...parsed.data,
      actorUserId: user.id,
    });

    return NextResponse.json({ flight });
  } catch (error) {
    return routeErrorResponse(error, "Gagal membuat flight.");
  }
}
