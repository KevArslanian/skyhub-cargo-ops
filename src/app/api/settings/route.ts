import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { assertRoles } from "@/lib/access";
import { getSettingsData, updateSettings } from "@/lib/data";
import { settingsUpdateSchema } from "@/lib/validators";

export async function GET() {
  try {
    const user = await requireApiUser();
    assertRoles(user, ["admin", "supervisor"], "Akses settings dibatasi untuk supervisor atau admin.", "SETTINGS_ONLY");
    const data = await getSettingsData(user.id);
    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat pengaturan.");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    assertRoles(user, ["admin", "supervisor"], "Akses settings dibatasi untuk supervisor atau admin.", "SETTINGS_ONLY");
    const json = await request.json();
    const parsed = settingsUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Setting tidak valid." }, { status: 400 });
    }

    const data = await updateSettings(user.id, parsed.data);
    return NextResponse.json(data);
  } catch (error) {
    return routeErrorResponse(error, "Gagal memperbarui pengaturan.");
  }
}
