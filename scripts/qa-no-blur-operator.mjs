import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const srcDir = path.join(root, "src");

const OPERATOR_SCAN_DIRS = ["app/(app)", "components"];
const EXCLUDED_PATH_PARTS = ["/about-us/", "/login/", "about-us/page.tsx"];

const REQUIRED_CSS_BLOCKS = [
  { selector: ".ops-overlay", must: ["backdrop-filter: none", "var(--ops-overlay-scrim)"] },
  { selector: ".ops-overlay--drawer", must: ["backdrop-filter: none", "var(--ops-overlay-scrim)"] },
  { selector: ".ops-overlay--alert", must: ["backdrop-filter: none", "var(--ops-overlay-scrim-alert)"] },
  { selector: ".ops-overlay--sheet", must: ["backdrop-filter: none", "var(--ops-overlay-scrim)"] },
  { selector: ".ops-overlay-panel", must: ["backdrop-filter: none", "background: var(--panel-bg)"] },
  { selector: ".ops-select-menu", must: ["backdrop-filter: none", "background: var(--panel-bg)"] },
  { selector: ".ops-feedback-banner", must: ["backdrop-filter: none"] },
  { selector: ".ops-toast", must: ["backdrop-filter: none"] },
];

async function readAllFiles(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await readAllFiles(absolute, acc);
      continue;
    }
    if (/\.(tsx?|css)$/.test(entry.name)) {
      acc.push({ absolute, relative: path.relative(root, absolute) });
    }
  }
  return acc;
}

function blockForSelector(css, selector) {
  const pattern = new RegExp(`(^|[,{\\s])${selector.replace(".", "\\.")}(?=[,{\\s])`, "m");
  const match = pattern.exec(css);
  if (!match) return "";
  const start = match.index + match[1].length;
  const braceStart = css.indexOf("{", start);
  if (braceStart < 0) return "";
  let depth = 0;
  for (let i = braceStart; i < css.length; i += 1) {
    const char = css[i];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(braceStart, i + 1);
    }
  }
  return "";
}

function isOperatorFile(relativePath) {
  if (!relativePath.startsWith("src/")) return false;
  if (EXCLUDED_PATH_PARTS.some((part) => relativePath.includes(part))) return false;
  return OPERATOR_SCAN_DIRS.some((dir) => relativePath.includes(`src/${dir}/`));
}

async function run() {
  const failures = [];
  const globals = await readFile(path.join(root, "src/app/globals.css"), "utf8");

  for (const { selector, must } of REQUIRED_CSS_BLOCKS) {
    const block = blockForSelector(globals, selector);
    if (!block) {
      failures.push(`globals.css: missing block ${selector}`);
      continue;
    }
    for (const needle of must) {
      if (!block.includes(needle)) {
        failures.push(`globals.css: ${selector} must include ${needle}`);
      }
    }
    if (/backdrop-filter:\s*blur/.test(block)) {
      failures.push(`globals.css: ${selector} must not use backdrop-filter blur`);
    }
    if (/rgba\(/.test(block) && selector.startsWith(".ops-overlay")) {
      failures.push(`globals.css: ${selector} must use opaque token, not rgba()`);
    }
  }

  if (!/--ops-overlay-scrim:/.test(globals) || !/--ops-overlay-scrim-alert:/.test(globals)) {
    failures.push("globals.css: missing --ops-overlay-scrim tokens");
  }

  const files = await readAllFiles(srcDir);
  for (const file of files) {
    if (!isOperatorFile(file.relative) || !file.relative.endsWith(".tsx")) continue;
    const content = await readFile(file.absolute, "utf8");
    if (/\bbackdrop-blur\b/.test(content)) {
      failures.push(`${file.relative}: backdrop-blur class in operator surface`);
    }
    const allowsPremiumBranch =
      file.relative.endsWith("glass-select.tsx") || file.relative.endsWith("glass-date-picker.tsx");
    if (
      /liquid-glass-dropdown/.test(content) &&
      !allowsPremiumBranch &&
      !/theme\s*===\s*["']premium["']/.test(content)
    ) {
      failures.push(`${file.relative}: liquid-glass-dropdown without premium theme branch`);
    }
    if (
      /liquid-glass-backdrop-(select|premium)/.test(content) &&
      !allowsPremiumBranch &&
      !/theme\s*===\s*["']premium["']/.test(content)
    ) {
      failures.push(`${file.relative}: liquid-glass-backdrop premium class without premium theme branch`);
    }
  }

  if (failures.length) {
    console.error("Operator no-blur invariants FAILED:");
    for (const failure of failures) {
      console.error(`  ${failure}`);
    }
    process.exit(1);
  }

  console.log("Operator no-blur invariants: ALL_PASS");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});