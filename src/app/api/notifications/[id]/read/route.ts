import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { markNotificationRead } from "@/lib/data";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, context: RouteContext) {
  const user = await requireUser();
  const { id } = await context.params;
  await markNotificationRead(user.id, id);
  return NextResponse.json({ success: true });
}
