import { NextResponse } from "next/server";
import { routeErrorResponse } from "@/lib/api";
import { getLandingMetricsData } from "@/lib/data";

export async function GET() {
  try {
    const data = await getLandingMetricsData();
    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat metrik landing.");
  }
}
