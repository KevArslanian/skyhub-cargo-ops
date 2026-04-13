import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getRecentAwbSearches } from "@/lib/data";

export async function GET() {
  const user = await requireUser();
  const data = await getRecentAwbSearches(user.id);
  return NextResponse.json({ searches: data });
}
