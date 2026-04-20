import { spawn } from "node:child_process";

const unpooledUrl = process.env.DATABASE_URL_UNPOOLED;

if (!unpooledUrl) {
  console.error("DATABASE_URL_UNPOOLED is required for migration.");
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_PROVIDER: process.env.DATABASE_PROVIDER ?? "postgresql",
  DATABASE_URL: unpooledUrl,
};

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpmCmd, args, {
      stdio: "inherit",
      env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: pnpm ${args.join(" ")} (exit ${code ?? "unknown"})`));
    });
  });
}

await run(["prisma:sync-schema"]);
await run(["exec", "prisma", "migrate", "deploy"]);
