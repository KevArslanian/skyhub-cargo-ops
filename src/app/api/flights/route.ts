import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse, validationErrorResponse } from "@/lib/api";
import { createFlight, getFlightBoardData } from "@/lib/data";
import { flightCreateSchema, flightListQuerySchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const parsedQuery = flightListQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsedQuery.success) {
      return validationErrorResponse(parsedQuery.error, "Filter flight tidak valid.");
    }

    const data = await getFlightBoardData(user, parsedQuery.data);
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
      return validationErrorResponse(parsed.error, "Input flight tidak valid.");
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
