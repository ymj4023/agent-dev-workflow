import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { workflowRequirements } from "../src/workflow-contract.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function runCli(...args) {
  return spawnSync(process.execPath, ["scripts/adw.mjs", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

test("validate accepts the canonical workflow manifest", () => {
  const result = runCli("validate", "--json");

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).ok, true);
});

test("doctor fails loudly when required Matt skills are missing", () => {
  const result = runCli(
    "doctor",
    "--skills-root",
    "tests/fixtures/skills",
    "--json",
  );
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(report.ok, false);
  assert.ok(report.required.missing.includes("tdd"));
  assert.ok(report.optional.missing.includes("verification-loop"));
});

test("doctor plain output explains every required provenance failure", (t) => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "adw-cli-"));
  const skillsRoot = join(fixtureRoot, "skills");
  const requiredSkills = workflowRequirements.mattSkills;
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));

  for (const skill of requiredSkills) {
    mkdirSync(join(skillsRoot, skill), { recursive: true });
    writeFileSync(join(skillsRoot, skill, "SKILL.md"), `# ${skill}\n`);
  }
  const verified = Object.fromEntries(
    ["grill-with-docs", "implement", "tdd", "code-review"].map((skill) => [
      skill,
      { source: "mattpocock/skills", ref: "v1.2.3" },
    ]),
  );
  writeFileSync(
    join(fixtureRoot, ".skill-lock.json"),
    JSON.stringify({
      skills: {
        ...verified,
        "to-spec": { source: "another/provider", ref: "v1.2.3" },
        "to-tickets": { source: "mattpocock/skills", ref: "v1.2.2" },
      },
    }),
  );

  const result = runCli("doctor", "--skills-root", skillsRoot);

  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /FAIL: required Matt capabilities are unavailable or unverified/);
  assert.match(result.stdout, /Required skills: 7 found, 0 missing/);
  assert.match(result.stdout, /required provenance unverified: domain-modeling/);
  assert.match(result.stdout, /required provenance source mismatch: to-spec/);
  assert.match(result.stdout, /required provenance below minimum v1\.2\.3: to-tickets/);
});

test("skills-root rejects a following flag instead of treating it as a path", () => {
  const result = runCli("doctor", "--skills-root", "--json");

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--skills-root requires a path/);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.stdout, "");
});

test("unknown commands fail with usage instead of silently succeeding", () => {
  const result = runCli("ship-everything");

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test("verify checks the complete repository surface", () => {
  const result = runCli("verify", "--json");

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).ok, true);
});

test("install dry-run reports target actions without mutating it", (t) => {
  const target = mkdtempSync(join(tmpdir(), "adw-cli-install-"));
  mkdirSync(join(target, ".git"));
  t.after(() => rmSync(target, { recursive: true, force: true }));

  const result = runCli("install", target, "--dry-run", "--json");
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(report.ok, true);
  assert.equal(report.dry_run, true);
  assert.ok(report.assets.some((asset) => asset.path === "AGENTS.md"));
  assert.throws(() => readFileSync(join(target, "AGENTS.md")), /ENOENT/);
});

test("install status and uninstall complete a real manifest lifecycle", (t) => {
  const target = mkdtempSync(join(tmpdir(), "adw-cli-lifecycle-"));
  mkdirSync(join(target, ".git"));
  t.after(() => rmSync(target, { recursive: true, force: true }));

  const installed = runCli("install", target, "--json");
  const status = runCli("status", target, "--json");
  const removed = runCli("uninstall", target, "--json");

  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(status.status, 0, status.stderr);
  assert.ok(JSON.parse(status.stdout).assets.every(
    (asset) => asset.action === "current",
  ));
  assert.equal(removed.status, 0, removed.stderr);
  assert.throws(
    () => readFileSync(join(target, ".agent-dev-workflow/ownership.json")),
    /ENOENT/,
  );
});

test("accept-existing keeps project files outside uninstall ownership", (t) => {
  const target = mkdtempSync(join(tmpdir(), "adw-cli-existing-"));
  mkdirSync(join(target, ".git"));
  writeFileSync(join(target, "AGENTS.md"), "# Existing project rules\n");
  t.after(() => rmSync(target, { recursive: true, force: true }));

  const installed = runCli(
    "install",
    target,
    "--accept-existing",
    "--json",
  );
  const removed = runCli("uninstall", target, "--json");

  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(
    JSON.parse(installed.stdout).assets.find(
      (asset) => asset.path === "AGENTS.md",
    ).action,
    "accept-existing",
  );
  assert.equal(removed.status, 0, removed.stderr);
  assert.equal(
    readFileSync(join(target, "AGENTS.md"), "utf8"),
    "# Existing project rules\n",
  );
});
