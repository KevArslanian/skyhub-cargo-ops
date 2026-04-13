import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getFlightBoardData } from "@/lib/data";

export async function GET(request: Request) {
  await requireUser();
  const { searchParams } = new URL(request.url);
  const data = await getFlightBoardData({
    status: searchParams.get("status") || undefined,
    query: searchParams.get("query") || undefined,
  });
  return NextResponse.json(data);
}
