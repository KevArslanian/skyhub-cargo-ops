import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { getDashboardAlerts, getDashboardData, getDashboardKpis, type DashboardDateFilter } from "@/lib/data";

function parseDashboardDateFilter(searchParams: URLSearchParams): DashboardDateFilter {
  return {
    date: searchParams.get("date") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const dateFilter = parseDashboardDateFilter(searchParams);
    const kpisOnly = searchParams.get("kpisOnly") === "1";
    const alertsOnly = searchParams.get("alertsOnly") === "1";

    if (alertsOnly) {
      const data = await getDashboardAlerts(user);
      return NextResponse.json(data);
    }

    if (kpisOnly) {
      const data = await getDashboardKpis(user, dateFilter);
      return NextResponse.json(data, {
        headers: {
          "Cache-Control": "private, s-maxage=30, stale-while-revalidate=60",
        },
      });
    }

    const data = await getDashboardData(user, dateFilter);
    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat dasbor.");
  }
}