import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { assertInternalApiAccess } from "@/lib/access";
import { getFlightBoardData } from "@/lib/data";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    assertInternalApiAccess(user);
    const { searchParams } = new URL(request.url);
    const data = await getFlightBoardData(user, {
      status: searchParams.get("status") || undefined,
      query: searchParams.get("query") || undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat flight board.");
  }
}
