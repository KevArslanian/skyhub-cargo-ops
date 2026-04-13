import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { searchGlobal } from "@/lib/data";

export async function GET(request: Request) {
  await requireUser();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ path: null });
  }

  const result = await searchGlobal(query.trim());
  return NextResponse.json(result || { path: null });
}
