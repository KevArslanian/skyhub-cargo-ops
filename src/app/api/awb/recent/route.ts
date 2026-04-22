import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { getRecentAwbSearches } from "@/lib/data";

export async function GET() {
  try {
    const user = await requireApiUser();
    const data = await getRecentAwbSearches(user.id);
    return NextResponse.json({ searches: data });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat riwayat AWB.");
  }
}
