import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { searchScoped, type SearchScope } from "@/lib/data";

const SEARCH_SCOPES: SearchScope[] = [
  "global",
  "dashboard",
  "ledger",
  "awb",
  "flight",
  "alerts",
  "activity-log",
  "reports",
  "settings",
];

function parseScope(value: string | null): SearchScope {
  return SEARCH_SCOPES.includes(value as SearchScope) ? (value as SearchScope) : "global";
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const scope = parseScope(searchParams.get("scope"));

    if (!query) {
      return NextResponse.json({ path: null, results: [] });
    }

    const result = await searchScoped(user, query.trim(), scope);
    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, "Gagal menjalankan pencarian.");
  }
}
