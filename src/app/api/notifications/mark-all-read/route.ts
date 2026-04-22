import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/data";

export async function POST() {
  const user = await requireUser();
  await markNotificationsRead(user.id);
  return NextResponse.json({ success: true });
}
