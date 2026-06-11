import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { sleep, waitForServer } from "./qa-throttle.mjs";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3100";
const root = process.cwd();
const gapMs = Number(process.env.QA_GATE_GAP_MS ?? 2000);

const STEPS = [
  { id: "lint", cmd: "pnpm", args: ["lint"], needsServer: false },
  { id: "viewport", cmd: "node", args: ["scripts/qa-viewport-lock.mjs"], needsServer: true },
  { id: "pattern", cmd: "node", args: ["scripts/qa-pattern-check.mjs"], needsServer: true },
  { id: "test-api", cmd: "pnpm", args: ["test:api"], needsServer: true },
  { id: "qa-crud", cmd: "pnpm", args: ["qa:crud"], needsServer: true },
  { id: "test-e2e", cmd: "pnpm", args: ["test:e2e"], needsServer: true },
  { id: "qa-paths", cmd: "pnpm", args: ["qa:paths"], needsServer: true },
  { id: "live-audit", cmd: "node", args: ["scripts/live-ui-audit.mjs"], needsServer: true, env: { APP_BASE_URL: baseUrl } },
];

function runStep(step) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(step.cmd, step.args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ...(step.env ?? {}) },
      shell: process.platform === "win32",
    });

    child.on("close", (code) => {
      resolve({
        id: step.id,
        status: code === 0 ? "pass" : "fail",
        exitCode: code ?? 1,
        durationMs: Date.now() - started,
      });
    });
  });
}

async function run() {
  console.log("QA Gate — sequential throttled verification\n");
  await waitForServer(baseUrl);

  const outputDir = path.join(root, "test-results", "qa-gate");
  await mkdir(outputDir, { recursive: true });

  const results = [];

  for (const step of STEPS) {
    console.log(`\n=== GATE: ${step.id} ===`);
    if (step.needsServer) {
      await waitForServer(baseUrl);
    }

    const result = await runStep(step);
    results.push(result);
    console.log(`${result.status === "pass" ? "PASS" : "FAIL"} ${step.id} (${result.durationMs}ms)`);

    if (result.status === "fail") {
      const report = {
        generatedAt: new Date().toISOString(),
        baseUrl,
        results,
        verdict: "FAIL",
        failedAt: step.id,
      };
      await writeFile(path.join(outputDir, "gate-report.json"), JSON.stringify(report, null, 2));
      console.error(`\nQA Gate FAILED at step: ${step.id}`);
      process.exit(1);
    }

    await sleep(gapMs);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    results,
    verdict: "PASS",
  };

  await writeFile(path.join(outputDir, "gate-report.json"), JSON.stringify(report, null, 2));
  console.log("\nQA Gate: ALL_PASS");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});