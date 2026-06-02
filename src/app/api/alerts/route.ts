import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse, validationErrorResponse } from "@/lib/api";
import { getAlertCenterData, updateAlertState } from "@/lib/data";
import { alertActionSchema } from "@/lib/validators";

export async function GET() {
  try {
    const user = await requireApiUser();
    const data = await getAlertCenterData(user);
    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat pusat peringatan.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = await request.json();
    const parsed = alertActionSchema.safeParse(payload);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Aksi peringatan tidak valid.");
    }

    const result = await updateAlertState({
      userId: user.id,
      actorName: user.name,
      alertKey: parsed.data.alertKey,
      action: parsed.data.action,
      assigneeId: parsed.data.assigneeId ?? null,
      snoozeMinutes: parsed.data.snoozeMinutes ?? null,
      note: parsed.data.note ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memperbarui status peringatan.");
  }
}
