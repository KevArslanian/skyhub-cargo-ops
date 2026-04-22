import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { addShipmentDocument, assertShipmentDocumentUploadAllowed } from "@/lib/data";
import { deleteDocumentBlob, storeDocument, validateDocumentUpload } from "@/lib/storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  let stored: { url: string; key?: string } | null = null;

  try {
    const user = await requireUser();
    const { id } = await context.params;
    const formData = await request.formData();
    const uploadedFile = formData.get("file");

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: "File wajib diunggah." }, { status: 400 });
    }

    await assertShipmentDocumentUploadAllowed(user.id, id);
    const validatedFile = validateDocumentUpload(uploadedFile);
    stored = await storeDocument(uploadedFile, { contentType: validatedFile.mimeType });
    const document = await addShipmentDocument({
      shipmentId: id,
      fileName: validatedFile.fileName,
      mimeType: validatedFile.mimeType,
      fileSize: validatedFile.fileSize,
      storageUrl: stored.url,
      storageKey: stored.key,
      userId: user.id,
    });

    return NextResponse.json({ document });
  } catch (error) {
    if (stored) {
      try {
        await deleteDocumentBlob({ storageKey: stored.key, storageUrl: stored.url });
      } catch (cleanupError) {
        console.error("[document-upload-cleanup]", cleanupError);
      }
    }

    return routeErrorResponse(error, "Gagal mengunggah dokumen.");
  }
}
