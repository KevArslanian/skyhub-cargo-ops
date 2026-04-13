import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { reportAwbIssue } from "@/lib/data";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { awb } = (await request.json()) as { awb?: string };

    if (!awb) {
      return NextResponse.json({ error: "AWB wajib diisi." }, { status: 400 });
    }

    await reportAwbIssue(user.id, awb);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal melaporkan isu." },
      { status: 500 },
    );
  }
}
