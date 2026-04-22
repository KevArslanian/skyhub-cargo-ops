import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { AccessError } from "./access";

const DOCUMENT_UPLOAD_SPECS = {
  pdf: { mimeType: "application/pdf", inline: true },
  png: { mimeType: "image/png", inline: true },
  jpg: { mimeType: "image/jpeg", inline: true },
  jpeg: { mimeType: "image/jpeg", inline: true },
  webp: { mimeType: "image/webp", inline: true },
  gif: { mimeType: "image/gif", inline: true },
  txt: { mimeType: "text/plain", inline: false },
  csv: { mimeType: "text/csv", inline: false },
  doc: { mimeType: "application/msword", inline: false },
  docx: {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    inline: false,
  },
  xls: { mimeType: "application/vnd.ms-excel", inline: false },
  xlsx: {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    inline: false,
  },
} as const;

export const MAX_DOCUMENT_UPLOAD_BYTES = 15 * 1024 * 1024;

function getDocumentExtension(fileName: string) {
  return path.extname(fileName).slice(1).toLowerCase();
}

export function validateDocumentUpload(file: File) {
  if (!file.size) {
    throw new AccessError("File wajib diunggah.", 400, "DOCUMENT_REQUIRED");
  }

  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw new AccessError("Ukuran file melebihi batas 15 MB.", 400, "DOCUMENT_TOO_LARGE");
  }

  const extension = getDocumentExtension(file.name);
  const spec = DOCUMENT_UPLOAD_SPECS[extension as keyof typeof DOCUMENT_UPLOAD_SPECS];

  if (!spec) {
    throw new AccessError(
      "Format dokumen tidak diizinkan. Gunakan PDF, gambar, TXT, CSV, DOC, DOCX, XLS, atau XLSX.",
      400,
      "DOCUMENT_TYPE_NOT_ALLOWED",
    );
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    mimeType: spec.mimeType,
    inline: spec.inline,
  };
}

export function isInlineDocumentMimeType(mimeType: string) {
  return Object.values(DOCUMENT_UPLOAD_SPECS).some((spec) => spec.inline && spec.mimeType === mimeType);
}

export function getDocumentRouteFileName(storageKey?: string | null, storageUrl?: string | null) {
  const raw = storageKey || storageUrl;
  if (!raw) {
    return null;
  }

  const normalized = raw.split("?")[0].split("#")[0];
  const segments = normalized.split(/[\\/]/);
  return segments[segments.length - 1] || null;
}

export function getDocumentAccessUrl(storageKey?: string | null, storageUrl?: string | null) {
  const fileName = getDocumentRouteFileName(storageKey, storageUrl);
  return fileName ? `/api/uploads/${encodeURIComponent(fileName)}` : null;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.\-_]/g, "-").toLowerCase();
}

export async function storeDocument(file: File, options?: { contentType?: string }) {
  const safeName = `${Date.now()}-${sanitizeFileName(file.name)}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const uploaded = await put(`ekspedisi-petir/${safeName}`, file, {
      access: "private",
      addRandomSuffix: false,
      ...(options?.contentType ? { contentType: options.contentType } : {}),
    });

    return {
      url: uploaded.url,
      key: uploaded.pathname,
    };
  }

  const uploadDir =
    process.env.NODE_ENV === "production"
      ? path.join("/tmp", "skyhub-uploads")
      : path.join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, safeName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, bytes);

  return {
    url: process.env.NODE_ENV === "production" ? `/api/uploads/${encodeURIComponent(safeName)}` : `/uploads/${safeName}`,
    key: safeName,
  };
}

export function resolveLocalUploadCandidates(fileName: string) {
  return [
    path.join("/tmp", "skyhub-uploads", fileName),
    path.join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads", fileName),
  ];
}

function getLocalUploadFileName(storageKey?: string | null, storageUrl?: string | null) {
  if (storageKey) {
    return path.basename(storageKey);
  }

  if (!storageUrl) {
    return null;
  }

  return path.basename(storageUrl.split("?")[0]);
}

export async function deleteDocumentBlob(input: { storageKey?: string | null; storageUrl?: string | null }) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const target = input.storageKey || input.storageUrl;

    if (!target) {
      return;
    }

    await del(target);
    return;
  }

  const fileName = getLocalUploadFileName(input.storageKey, input.storageUrl);
  if (!fileName) {
    return;
  }

  let lastError: Error | null = null;

  for (const candidate of resolveLocalUploadCandidates(fileName)) {
    try {
      await unlink(candidate);
      return;
    } catch (error) {
      const nextError = error as NodeJS.ErrnoException;
      if (nextError.code === "ENOENT") {
        continue;
      }

      lastError = nextError;
    }
  }

  if (lastError) {
    throw lastError;
  }
}
