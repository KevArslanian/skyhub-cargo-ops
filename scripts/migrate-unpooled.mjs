import { spawn, execSync } from "node:child_process";

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

let pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
let baseArgs = [];

try {
  execSync(process.platform === "win32" ? "where pnpm" : "which pnpm", { stdio: "ignore" });
} catch {
  pnpmCmd = "npx";
  baseArgs = ["pnpm"];
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpmCmd, [...baseArgs, ...args], {
      stdio: "inherit",
      env,
      shell: true,
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
try {
  await run(["exec", "prisma", "migrate", "deploy"]);
} catch (error) {
  console.log("[migrate] migrate deploy failed; falling back to prisma db push for an existing production database.");
  console.log(`[migrate] ${error instanceof Error ? error.message : String(error)}`);
  await run(["exec", "prisma", "db", "push", "--skip-generate"]);
}
