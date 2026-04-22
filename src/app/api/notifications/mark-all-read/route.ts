import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { markNotificationsRead } from "@/lib/data";

export async function POST() {
  try {
    const user = await requireApiUser();
    await markNotificationsRead(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, "Gagal menandai semua notifikasi.");
  }
}
