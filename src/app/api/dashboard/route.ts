import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";

export async function GET() {
  await requireUser();
  const data = await getDashboardData();
  return NextResponse.json(data);
}
