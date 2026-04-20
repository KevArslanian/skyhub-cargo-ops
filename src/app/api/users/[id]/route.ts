import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { updateUserAccess } from "@/lib/data";
import { userRoleUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireUser();
    const { id } = await context.params;
    const json = await request.json();
    const parsed = userRoleUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Perubahan pengguna tidak valid." }, { status: 400 });
    }

    const user = await updateUserAccess(id, {
      ...parsed.data,
      actorUserId: actor.id,
    });

    return NextResponse.json({ user });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memperbarui pengguna.");
  }
}
