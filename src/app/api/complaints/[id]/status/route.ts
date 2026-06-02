import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse, validationErrorResponse } from "@/lib/api";
import { updatePublicComplaintStatus } from "@/lib/data";
import { complaintStatusUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = complaintStatusUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Status keluhan tidak valid.");
    }

    const result = await updatePublicComplaintStatus(user, id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memperbarui status keluhan.");
  }
}
