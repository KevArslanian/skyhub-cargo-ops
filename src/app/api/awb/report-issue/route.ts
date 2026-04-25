import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse, validationErrorResponse } from "@/lib/api";
import { reportAwbIssue } from "@/lib/data";
import { awbSearchSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const json = await request.json();
    const parsed = awbSearchSchema.safeParse(json);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "AWB tidak valid.");
    }

    await reportAwbIssue(user, parsed.data.awb);
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, "Gagal melaporkan isu.");
  }
}
