import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MIME_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv; charset=utf-8",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json; charset=utf-8",
  pdf: "application/pdf",
  png: "image/png",
  txt: "text/plain; charset=utf-8",
};

function inferMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

export async function GET(_request: Request, context: RouteContext<"/api/uploads/[file]">) {
  const { file } = await context.params;
  const safeFileName = path.basename(file);

  const candidates = [
    path.join("/tmp", "skyhub-uploads", safeFileName),
    path.join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads", safeFileName),
  ];

  for (const candidate of candidates) {
    try {
      const content = await readFile(candidate);
      return new Response(content, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `inline; filename="${safeFileName}"`,
          "Content-Type": inferMimeType(safeFileName),
        },
      });
    } catch {
      // Try the next candidate path.
    }
  }

  return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
}
