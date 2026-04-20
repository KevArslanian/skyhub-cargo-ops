import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { AccessError, canManageUsers } from "@/lib/access";
import { getSettingsData, inviteUser } from "@/lib/data";
import { inviteUserSchema } from "@/lib/validators";

export async function GET() {
  try {
    const user = await requireUser();
    if (!canManageUsers(user)) {
      throw new AccessError("Akses API pengguna hanya untuk admin.", 403, "ADMIN_ONLY");
    }

    const settings = await getSettingsData(user.id);
    return NextResponse.json({ users: settings.users });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat daftar pengguna.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!canManageUsers(user)) {
      throw new AccessError("Akses API pengguna hanya untuk admin.", 403, "ADMIN_ONLY");
    }

    const json = await request.json();
    const parsed = inviteUserSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Input pengguna tidak valid." }, { status: 400 });
    }

    const invited = await inviteUser({
      ...parsed.data,
      invitedById: user.id,
    });

    return NextResponse.json({ user: invited });
  } catch (error) {
    return routeErrorResponse(error, "Gagal membuat pengguna.");
  }
}
