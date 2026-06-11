import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse, validationErrorResponse } from "@/lib/api";
import { getRecentAwbSearches } from "@/lib/data";
import { awbRecentQuerySchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const parsed = awbRecentQuerySchema.safeParse({
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
    });

    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Filter tanggal riwayat AWB tidak valid.");
    }

    const data = await getRecentAwbSearches(user, parsed.data);
    return NextResponse.json({ searches: data });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat pencarian AWB terbaru.");
  }
}
