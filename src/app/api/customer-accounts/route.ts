import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { AccessError, canManageCustomerAccounts } from "@/lib/access";
import { createCustomerAccount, getSettingsData } from "@/lib/data";
import { customerAccountCreateSchema } from "@/lib/validators";

export async function GET() {
  try {
    const user = await requireUser();
    if (!canManageCustomerAccounts(user)) {
      throw new AccessError("Akses API akun pelanggan hanya untuk admin.", 403, "CUSTOMER_ACCOUNT_ADMIN_ONLY");
    }

    const settings = await getSettingsData(user.id);
    return NextResponse.json({ customerAccounts: settings.customerAccounts });
  } catch (error) {
    return routeErrorResponse(error, "Gagal memuat akun pelanggan.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!canManageCustomerAccounts(user)) {
      throw new AccessError("Akses API akun pelanggan hanya untuk admin.", 403, "CUSTOMER_ACCOUNT_ADMIN_ONLY");
    }

    const json = await request.json();
    const parsed = customerAccountCreateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Input akun pelanggan tidak valid." }, { status: 400 });
    }

    const customerAccount = await createCustomerAccount({
      ...parsed.data,
      actorUserId: user.id,
    });

    return NextResponse.json({ customerAccount });
  } catch (error) {
    return routeErrorResponse(error, "Gagal membuat akun pelanggan.");
  }
}
