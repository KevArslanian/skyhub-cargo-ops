import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listActivityLogs } from "@/lib/data";

export async function GET(request: Request) {
  await requireUser();
  const { searchParams } = new URL(request.url);
  const data = await listActivityLogs({
    query: searchParams.get("query") || undefined,
    action: searchParams.get("action") || undefined,
    userId: searchParams.get("userId") || undefined,
  });
  return NextResponse.json(data);
}
