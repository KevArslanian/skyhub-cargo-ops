import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listActivityLogs } from "@/lib/data";

function toCsv(rows: Array<Array<string | number | null>>) {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
}

export async function GET(request: Request) {
  await requireUser();
  const { searchParams } = new URL(request.url);
  const data = await listActivityLogs({
    query: searchParams.get("query") || undefined,
    action: searchParams.get("action") || undefined,
    userId: searchParams.get("userId") || undefined,
  });

  const csv = toCsv([
    ["Timestamp", "User", "Action", "Target", "Description", "Level"],
    ...data.logs.map((log) => [log.createdAt, log.userName, log.action, log.targetLabel, log.description, log.level]),
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="activity-log.csv"',
    },
  });
}
