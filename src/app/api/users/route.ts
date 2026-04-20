import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSettingsData, inviteUser } from "@/lib/data";
import { inviteUserSchema } from "@/lib/validators";

export async function GET() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "supervisor") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }
  const settings = await getSettingsData(user.id);
  return NextResponse.json({ users: settings.users });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "supervisor") {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }
    const json = await request.json();
    const parsed = inviteUserSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Input user tidak valid." }, { status: 400 });
    }

    const invited = await inviteUser({
      ...parsed.data,
      invitedById: user.id,
    });

    return NextResponse.json({ user: invited });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengundang user." },
      { status: 500 },
    );
  }
}
