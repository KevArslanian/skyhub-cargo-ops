import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { listActivityLogs } from "@/lib/data";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const data = await listActivityLogs(user, {
      query: searchParams.get("query") || undefined,
      action: searchParams.get("action") || undefined,
      userId: searchParams.get("userId") || undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat log aktivitas.");
  }
}
