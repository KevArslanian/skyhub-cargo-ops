import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { getAlertCenterData } from "@/lib/data";

export async function GET() {
  try {
    const user = await requireUser();
    const data = await getAlertCenterData(user);
    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat alert center.");
  }
}
