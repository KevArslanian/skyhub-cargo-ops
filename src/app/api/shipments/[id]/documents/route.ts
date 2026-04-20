import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { addShipmentDocument } from "@/lib/data";
import { storeDocument } from "@/lib/storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    if (user.role === "customer") {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }
    const { id } = await context.params;
    const formData = await request.formData();
    const uploadedFile = formData.get("file");

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: "File wajib diunggah." }, { status: 400 });
    }

    const stored = await storeDocument(uploadedFile);
    const document = await addShipmentDocument({
      shipmentId: id,
      fileName: uploadedFile.name,
      mimeType: uploadedFile.type || "application/octet-stream",
      fileSize: uploadedFile.size,
      storageUrl: stored.url,
      storageKey: stored.key,
      userId: user.id,
    });

    return NextResponse.json({ document });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengunggah dokumen." },
      { status: 500 },
    );
  }
}
