import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { listPublicComplaints } from "@/lib/data";
import { complaintListQuerySchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const parsed = complaintListQuerySchema.safeParse({
      query: searchParams.get("query") || undefined,
      status: searchParams.get("status") || undefined,
      topic: searchParams.get("topic") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Filter keluhan tidak valid." }, { status: 400 });
    }

    const data = await listPublicComplaints(user, parsed.data);
    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat kotak keluhan.");
  }
}
