import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { listShiftPicCandidates } from "@/lib/data";

export async function GET() {
  try {
    const user = await requireApiUser();
    const candidates = await listShiftPicCandidates(user);
    return NextResponse.json({ candidates });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat daftar penanggung jawab shift.");
  }
}