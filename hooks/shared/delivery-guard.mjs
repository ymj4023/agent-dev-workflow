#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function evaluateDeliveryGate(result) {
  // Completion gates fail closed: an unavailable or malformed verifier is evidence of uncertainty, not success.
  if (result.error) {
    return {
      ok: false,
      exitCode: 2,
      message: `NOT_READY: verification could not run: ${result.error.message}`,
    };
  }

  let report;
  try {
    report = JSON.parse(result.stdout || "");
  } catch {
    const verifierError = result.stderr?.trim();
    return {
      ok: false,
      exitCode: 2,
      message: `NOT_READY: ${verifierError || "verification returned invalid JSON"}`,
    };
  }

  if (result.status === 0 && report.ok === true) {
    return { ok: true, exitCode: 0, message: "" };
  }

  const reasons = Array.isArray(report.errors) && report.errors.length > 0
    ? report.errors.join("; ")
    : `verification exited with status ${result.status}`;
  return { ok: false, exitCode: 2, message: `NOT_READY: ${reasons}` };
}

function runGuard(cwd) {
  const result = spawnSync(
    process.execPath,
    ["scripts/adw.mjs", "verify", "--json"],
    { cwd, encoding: "utf8", timeout: 30_000 },
  );
  const gate = evaluateDeliveryGate(result);

  if (gate.message) {
    process.stderr.write(`[delivery-guard] stage=verify status=blocked reason=${gate.message}\n`);
  }
  return gate.exitCode;
}

const isMain = process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  process.exitCode = runGuard(process.cwd());
}
