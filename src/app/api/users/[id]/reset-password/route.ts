import { NextResponse } from "next/server";
import { routeErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { resetUserPassword } from "@/lib/data";
import { adminResetPasswordSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireApiUser();
    const { id } = await context.params;
    const json = await request.json();
    const parsed = adminResetPasswordSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Kata sandi baru tidak valid." },
        { status: 400 },
      );
    }

    const result = await resetUserPassword(id, {
      password: parsed.data.password,
      actorUserId: actor.id,
    });

    return NextResponse.json({ user: result });
  } catch (error) {
    return routeErrorResponse(error, "Gagal mengatur ulang kata sandi.");
  }
}