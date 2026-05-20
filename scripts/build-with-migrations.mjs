import { spawn } from "node:child_process";

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpmCmd, args, {
      env,
      shell: process.platform === "win32",
      stdio: "inherit",
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

if (process.env.VERCEL === "1" && process.env.DATABASE_URL_UNPOOLED) {
  console.log("Running production database migrations before Vercel build.");
  await run(["db:migrate:unpooled"]);
}

await run(["prisma:generate"]);
await run(["exec", "next", "build"]);
