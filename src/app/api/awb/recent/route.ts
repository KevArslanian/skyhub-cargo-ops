import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { getRecentAwbSearches } from "@/lib/data";

export async function GET() {
  try {
    const user = await requireUser();
    const data = await getRecentAwbSearches(user);
    return NextResponse.json({ searches: data });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat pencarian AWB terbaru.");
  }
}
