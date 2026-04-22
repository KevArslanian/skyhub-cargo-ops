import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { updateCustomerAccount } from "@/lib/data";
import { customerAccountUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const json = await request.json();
    const parsed = customerAccountUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Perubahan akun pelanggan tidak valid." }, { status: 400 });
    }

    const customerAccount = await updateCustomerAccount({
      accountId: id,
      ...parsed.data,
      actorUserId: user.id,
    });

    return NextResponse.json({ customerAccount });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memperbarui akun pelanggan.");
  }
}
