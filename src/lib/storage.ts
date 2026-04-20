import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.\-_]/g, "-").toLowerCase();
}

export async function storeDocument(file: File) {
  const safeName = `${Date.now()}-${sanitizeFileName(file.name)}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const uploaded = await put(`ekspedisi-petir/${safeName}`, file, {
      access: "public",
      addRandomSuffix: false,
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

function resolveLocalUploadCandidates(fileName: string) {
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

  const trimmed = storageUrl.split("?")[0];
  return path.basename(trimmed);
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

  const candidates = resolveLocalUploadCandidates(fileName);
  let lastError: Error | null = null;

  for (const candidate of candidates) {
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
