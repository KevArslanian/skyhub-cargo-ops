import { NextResponse } from "next/server";
import { routeErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { markNotificationRead } from "@/lib/data";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    await markNotificationRead(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, "Gagal menandai notifikasi.");
  }
}