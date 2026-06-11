import { NextResponse } from "next/server";
import { routeErrorResponse, validationErrorResponse } from "@/lib/api";
import { createPublicComplaint } from "@/lib/data";
import { enforcePublicRateLimit } from "@/lib/rate-limit";
import { publicComplaintCreateSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const rateLimited = enforcePublicRateLimit(request, "public-complaints");
  if (rateLimited) {
    return rateLimited;
  }

  try {
    const body = await request.json();
    const parsed = publicComplaintCreateSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Data keluhan belum lengkap.");
    }

    const complaint = await createPublicComplaint(parsed.data);
    return NextResponse.json({ complaint }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, "Gagal mengirim keluhan.");
  }
}
