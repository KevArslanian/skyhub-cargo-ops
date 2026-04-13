import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSettingsData, updateSettings } from "@/lib/data";
import { settingsUpdateSchema } from "@/lib/validators";

export async function GET() {
  const user = await requireUser();
  const data = await getSettingsData(user.id);
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const json = await request.json();
    const parsed = settingsUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Setting tidak valid." }, { status: 400 });
    }

    const data = await updateSettings(user.id, parsed.data);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui settings." },
      { status: 500 },
    );
  }
}
