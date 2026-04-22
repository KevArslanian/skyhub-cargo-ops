import { readFile } from "node:fs/promises";
import path from "node:path";
import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/api";
import { getShipmentDocumentDownload } from "@/lib/data";
import { isInlineDocumentMimeType, resolveLocalUploadCandidates } from "@/lib/storage";

export const runtime = "nodejs";

const MIME_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
  txt: "text/plain; charset=utf-8",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function inferMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

function sanitizeDownloadFileName(fileName: string) {
  return fileName.replace(/[\r\n"\\]/g, "_");
}

function buildDocumentHeaders(fileName: string, mimeType: string) {
  const dispositionType = isInlineDocumentMimeType(mimeType) ? "inline" : "attachment";

  return {
    "Cache-Control": "no-store",
    "Content-Disposition": `${dispositionType}; filename="${sanitizeDownloadFileName(fileName)}"`,
    "Content-Type": mimeType,
    "X-Content-Type-Options": "nosniff",
  };
}

export async function GET(_request: Request, context: RouteContext<"/api/uploads/[file]">) {
  try {
    const user = await requireApiUser();
    const { file } = await context.params;
    const safeFileName = path.basename(file);
    const document = await getShipmentDocumentDownload(user, safeFileName);
    const mimeType = document.mimeType || inferMimeType(document.fileName);
    const headers = buildDocumentHeaders(document.fileName, mimeType);

    if (process.env.BLOB_READ_WRITE_TOKEN && (document.storageKey || /^https?:\/\//.test(document.storageUrl))) {
      const blobTargets = [
        document.storageKey ? { target: document.storageKey, access: "private" as const } : null,
        /^https?:\/\//.test(document.storageUrl)
          ? { target: document.storageUrl, access: "private" as const }
          : null,
        /^https?:\/\//.test(document.storageUrl)
          ? { target: document.storageUrl, access: "public" as const }
          : null,
      ].filter((target): target is { target: string; access: "private" | "public" } => Boolean(target));

      for (const target of blobTargets) {
        try {
          const blob = await get(target.target, {
            access: target.access,
            ...(target.access === "private" ? { useCache: false } : {}),
          });

          if (blob?.statusCode === 200 && blob.stream) {
            return new Response(blob.stream, { headers });
          }
        } catch {
          // Continue to the next blob target or local fallback.
        }
      }
    }

    for (const candidate of resolveLocalUploadCandidates(safeFileName)) {
      try {
        const content = await readFile(candidate);
        return new Response(content, { headers });
      } catch (error) {
        const nextError = error as NodeJS.ErrnoException;
        if (nextError.code === "ENOENT") {
          continue;
        }

        throw error;
      }
    }

    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  } catch (error) {
    const nextError = error as NodeJS.ErrnoException;
    if (nextError.code === "ENOENT") {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
    }

    return routeErrorResponse(error, "Gagal memuat dokumen.");
  }
}
