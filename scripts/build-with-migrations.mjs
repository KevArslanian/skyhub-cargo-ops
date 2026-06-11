import { spawn, execSync } from "node:child_process";

let pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
let baseArgs = [];

try {
  execSync(process.platform === "win32" ? "where pnpm" : "which pnpm", { stdio: "ignore" });
} catch {
  pnpmCmd = "npx";
  baseArgs = ["pnpm"];
}

function run(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpmCmd, [...baseArgs, ...args], {
      env,
      shell: true,
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

try {
  await run(["compact:auto"]);
} catch {
  console.log("[compact] skipped (non-blocking).");
}

if (process.env.VERCEL === "1" && process.env.DATABASE_URL_UNPOOLED) {
  console.log("Running production database migrations before Vercel build.");
  try {
    await run(["db:migrate:unpooled"]);
  } catch (error) {
    console.log(`[build] Migration step failed (non-blocking): ${error instanceof Error ? error.message : String(error)}`);
  }
}

await run(["prisma:generate"]);
await run(["exec", "next", "build"]);
