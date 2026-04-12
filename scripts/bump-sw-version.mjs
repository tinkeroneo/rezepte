import { readFileSync, writeFileSync } from "node:fs";

const isCi =
  String(process.env.CI || "").toLowerCase() === "true" ||
  String(process.env.GITHUB_ACTIONS || "").toLowerCase() === "true";

if (!isCi) {
  console.log("[sw-version] skip: not running in CI");
  process.exit(0);
}

const swPath = new URL("../sw.js", import.meta.url);
const source = readFileSync(swPath, "utf8");
const match = source.match(/const\s+SW_VERSION\s*=\s*"([^"]+)";/);

if (!match) {
  console.error("[sw-version] SW_VERSION marker not found in sw.js");
  process.exit(1);
}

const sha = String(process.env.GITHUB_SHA || "").trim().slice(0, 7);
const runNumber = String(process.env.GITHUB_RUN_NUMBER || "").trim();
const now = new Date();
const yyyy = now.getUTCFullYear();
const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
const dd = String(now.getUTCDate()).padStart(2, "0");
const buildSuffix = runNumber || sha || String(Date.now());
const nextVersion = `${yyyy}-${mm}-${dd}-${buildSuffix}`;

if (match[1] === nextVersion) {
  console.log(`[sw-version] already current: ${nextVersion}`);
  process.exit(0);
}

const updated = source.replace(match[0], `const SW_VERSION = "${nextVersion}";`);
writeFileSync(swPath, updated, "utf8");
console.log(`[sw-version] updated ${match[1]} -> ${nextVersion}`);
