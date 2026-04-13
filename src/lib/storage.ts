import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

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
