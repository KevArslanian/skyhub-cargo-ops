const REQUIRED_SERVER_ENV = ["DATABASE_PROVIDER", "DATABASE_URL", "DATABASE_URL_UNPOOLED", "SESSION_SECRET"] as const;

type RequiredServerEnvKey = (typeof REQUIRED_SERVER_ENV)[number];

let hasValidatedRequiredServerEnv = false;

export function readRequiredServerEnv(key: RequiredServerEnvKey) {
  const value = process.env[key];
  if (!value || !value.trim()) {
    throw new Error(`[env] Missing required server environment variable: ${key}`);
  }

  return value;
}

export function assertRequiredServerEnv() {
  if (hasValidatedRequiredServerEnv) {
    return;
  }

  const missing = REQUIRED_SERVER_ENV.filter((key) => {
    const value = process.env[key];
    return !value || !value.trim();
  });

  if (missing.length) {
    throw new Error(`[env] Missing required server environment variables: ${missing.join(", ")}`);
  }

  if (process.env.DATABASE_PROVIDER !== "postgresql") {
    throw new Error('[env] DATABASE_PROVIDER must be "postgresql" for this deployment.');
  }

  hasValidatedRequiredServerEnv = true;
}
