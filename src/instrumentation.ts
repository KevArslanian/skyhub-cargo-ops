export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "development") {
    return;
  }

  try {
    const { db } = await import("./lib/prisma");
    await db.$queryRaw`SELECT 1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown database warmup error";
    console.warn(`[skyhub] database warmup skipped: ${message}`);
  }
}