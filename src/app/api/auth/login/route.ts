import { compareSync } from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = loginSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Input login tidak valid." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      include: {
        customerAccount: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!user || !compareSync(parsed.data.password, user.passwordHash)) {
      return NextResponse.json({ error: "Email atau password tidak cocok." }, { status: 401 });
    }

    if (user.status !== "active") {
      return NextResponse.json({ error: "Akun ini belum aktif atau sudah dinonaktifkan." }, { status: 403 });
    }

    if (user.role === "customer" && user.customerAccount?.status !== "active") {
      return NextResponse.json({ error: "Akun pelanggan ini belum aktif." }, { status: 403 });
    }

    await createSession(user.id, user.role, parsed.data.remember);

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "Login",
        targetType: "session",
        targetLabel: "Konsol Operasional",
        description: `${user.name} berhasil login ke sistem.`,
        level: "success",
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Tidak dapat memproses login saat ini." }, { status: 500 });
  }
}
