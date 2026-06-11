import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { AccessError, canManageUsers } from "@/lib/access";
import { getSettingsData, inviteUser } from "@/lib/data";
import { inviteUserSchema } from "@/lib/validators";

export async function GET() {
  try {
    const user = await requireApiUser();
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
    const user = await requireApiUser();
    if (!canManageUsers(user)) {
      throw new AccessError("Akses API pengguna hanya untuk admin.", 403, "ADMIN_ONLY");
    }

    const json = await request.json();
    const parsed = inviteUserSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Input pengguna tidak valid." }, { status: 400 });
    }

    const invited = await inviteUser({
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      station: parsed.data.station,
      phone: parsed.data.phone,
      password: parsed.data.password,
      customerAccountId: parsed.data.customerAccountId,
      invitedById: user.id,
    });

    return NextResponse.json({ user: invited, initialPassword: parsed.data.password });
  } catch (error) {
    return routeErrorResponse(error, "Gagal membuat pengguna.");
  }
}
