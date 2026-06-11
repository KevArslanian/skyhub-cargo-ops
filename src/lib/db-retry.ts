const TRANSIENT_PRISMA_CODES = new Set(["P1001", "P1002", "P1017"]);

export function isTransientPrismaError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  const code = (error as { code?: string }).code;
  return typeof code === "string" && TRANSIENT_PRISMA_CODES.has(code);
}

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options?: {
    attempts?: number;
    baseDelayMs?: number;
  },
) {
  const attempts = options?.attempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1200;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientPrismaError(error) || attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, baseDelayMs * attempt);
      });
    }
  }

  throw lastError;
}