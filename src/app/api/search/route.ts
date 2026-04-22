import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { searchGlobal } from "@/lib/data";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json({ path: null });
    }

    const result = await searchGlobal(user, query.trim());
    return NextResponse.json(result || { path: null });
  } catch (error) {
    return routeErrorResponse(error, "Gagal menjalankan pencarian.");
  }
}
