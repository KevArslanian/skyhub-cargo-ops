import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { getRecentAwbSearches } from "@/lib/data";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const data = await getRecentAwbSearches(user, {
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
    });
    return NextResponse.json({ searches: data });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat pencarian AWB terbaru.");
  }
}
