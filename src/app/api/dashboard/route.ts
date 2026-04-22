import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { assertInternalApiAccess } from "@/lib/access";
import { getDashboardData } from "@/lib/data";

export async function GET() {
  try {
    const user = await requireApiUser();
    assertInternalApiAccess(user);
    const data = await getDashboardData(user);
    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat dashboard.");
  }
}
