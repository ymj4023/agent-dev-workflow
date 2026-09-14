import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { manageInstallation } from "../src/installer.mjs";

const manifest = {
  schema_version: 1,
  ledger_path: ".agent-dev-workflow/ownership.json",
  assets: [
    { source: "templates/AGENTS.md", target: "AGENTS.md" },
    { source: "templates/workflow.md", target: "rules/workflow.md" },
  ],
};

function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "adw-installer-"));
  const packageRoot = join(root, "package");
  const targetRoot = join(root, "target");
  await mkdir(join(packageRoot, "templates"), { recursive: true });
  await mkdir(join(targetRoot, ".git"), { recursive: true });
  await writeFile(join(packageRoot, "templates/AGENTS.md"), "# Agent rules\n");
  await writeFile(join(packageRoot, "templates/workflow.md"), "# Workflow\n");
  t.after(() => rm(root, { recursive: true, force: true }));
  return { packageRoot, targetRoot };
}

test("dry-run lists every asset without writing target files", async (t) => {
  const paths = await fixture(t);

  const report = await manageInstallation({
    ...paths,
    manifest,
    operation: "install",
    dryRun: true,
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.assets.map(({ path, action }) => [path, action]), [
    ["AGENTS.md", "create"],
    ["rules/workflow.md", "create"],
  ]);
  await assert.rejects(readFile(join(paths.targetRoot, "AGENTS.md")), /ENOENT/);
  await assert.rejects(
    readFile(join(paths.targetRoot, manifest.ledger_path)),
    /ENOENT/,
  );
});

test("install is idempotent and records only files it creates", async (t) => {
  const paths = await fixture(t);

  const first = await manageInstallation({
    ...paths,
    manifest,
    operation: "install",
  });
  const ledgerPath = join(paths.targetRoot, manifest.ledger_path);
  const firstLedgerStat = await stat(ledgerPath);
  const second = await manageInstallation({
    ...paths,
    manifest,
    operation: "install",
  });
  const ledger = JSON.parse(
    await readFile(ledgerPath, "utf8"),
  );

  assert.equal(first.ok, true);
  assert.deepEqual(second.assets.map(({ action }) => action), [
    "unchanged",
    "unchanged",
  ]);
  assert.deepEqual(ledger.assets.map(({ path }) => path), [
    "AGENTS.md",
    "rules/workflow.md",
  ]);
  assert.equal((await stat(ledgerPath)).ino, firstLedgerStat.ino);
});

test("status distinguishes modified and outdated owned assets", async (t) => {
  const paths = await fixture(t);
  await manageInstallation({ ...paths, manifest, operation: "install" });
  await writeFile(join(paths.targetRoot, "AGENTS.md"), "# User changed this\n");
  await writeFile(join(paths.packageRoot, "templates/workflow.md"), "# Workflow v2\n");

  const report = await manageInstallation({
    ...paths,
    manifest,
    operation: "status",
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.assets.map(({ action }) => action), [
    "modified",
    "outdated",
  ]);
});

test("install preserves unowned files and reports the conflict", async (t) => {
  const paths = await fixture(t);
  await writeFile(join(paths.targetRoot, "AGENTS.md"), "# Existing project rules\n");

  const report = await manageInstallation({
    ...paths,
    manifest,
    operation: "install",
  });

  assert.equal(report.ok, false);
  assert.equal(report.assets[0].action, "preserve-unowned");
  assert.equal(
    await readFile(join(paths.targetRoot, "AGENTS.md"), "utf8"),
    "# Existing project rules\n",
  );
  await assert.rejects(
    readFile(join(paths.targetRoot, "rules/workflow.md")),
    /ENOENT/,
  );
  await assert.rejects(
    readFile(join(paths.targetRoot, manifest.ledger_path)),
    /ENOENT/,
  );
});

test("explicitly accepted existing files stay project-managed", async (t) => {
  const paths = await fixture(t);
  await writeFile(join(paths.targetRoot, "AGENTS.md"), "# Merged project rules\n");

  const install = await manageInstallation({
    ...paths,
    manifest,
    operation: "install",
    acceptExisting: true,
  });
  const status = await manageInstallation({
    ...paths,
    manifest,
    operation: "status",
  });
  const removed = await manageInstallation({
    ...paths,
    manifest,
    operation: "uninstall",
  });

  assert.equal(install.ok, true);
  assert.equal(install.assets[0].action, "accept-existing");
  assert.equal(status.ok, true);
  assert.equal(status.assets[0].action, "external-current");
  assert.equal(removed.assets[0].action, "preserve-external");
  assert.equal(
    await readFile(join(paths.targetRoot, "AGENTS.md"), "utf8"),
    "# Merged project rules\n",
  );
  await assert.rejects(
    readFile(join(paths.targetRoot, manifest.ledger_path)),
    /ENOENT/,
  );
});

test("repair restores missing owned files but preserves modified ones", async (t) => {
  const paths = await fixture(t);
  await manageInstallation({ ...paths, manifest, operation: "install" });
  await rm(join(paths.targetRoot, "rules/workflow.md"));
  await writeFile(join(paths.targetRoot, "AGENTS.md"), "# User changed this\n");

  const report = await manageInstallation({
    ...paths,
    manifest,
    operation: "repair",
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.assets.map(({ action }) => action), [
    "preserve-modified",
    "restore",
  ]);
  assert.equal(
    await readFile(join(paths.targetRoot, "AGENTS.md"), "utf8"),
    "# User changed this\n",
  );
  assert.equal(
    await readFile(join(paths.targetRoot, "rules/workflow.md"), "utf8"),
    "# Workflow\n",
  );
});

test("repair requires manual review before updating an outdated file", async (t) => {
  const paths = await fixture(t);
  await manageInstallation({ ...paths, manifest, operation: "install" });
  await writeFile(join(paths.packageRoot, "templates/workflow.md"), "# Workflow v2\n");

  const report = await manageInstallation({
    ...paths,
    manifest,
    operation: "repair",
  });

  assert.equal(report.ok, false);
  assert.equal(report.assets[1].action, "review-update");
  assert.equal(
    await readFile(join(paths.targetRoot, "rules/workflow.md"), "utf8"),
    "# Workflow\n",
  );
});

test("uninstall removes only unchanged owned files", async (t) => {
  const paths = await fixture(t);
  await manageInstallation({ ...paths, manifest, operation: "install" });
  await writeFile(join(paths.targetRoot, "AGENTS.md"), "# User changed this\n");

  const report = await manageInstallation({
    ...paths,
    manifest,
    operation: "uninstall",
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.assets.map(({ action }) => action), [
    "preserve-modified",
    "remove",
  ]);
  assert.equal(
    await readFile(join(paths.targetRoot, "AGENTS.md"), "utf8"),
    "# User changed this\n",
  );
  await assert.rejects(
    readFile(join(paths.targetRoot, "rules/workflow.md")),
    /ENOENT/,
  );
  const ledger = JSON.parse(
    await readFile(join(paths.targetRoot, manifest.ledger_path), "utf8"),
  );
  assert.deepEqual(ledger.assets.map(({ path }) => path), ["AGENTS.md"]);
});

test("manifest paths cannot escape the package or target roots", async (t) => {
  const paths = await fixture(t);
  const unsafe = {
    ...manifest,
    assets: [{ source: "../secret", target: "../outside" }],
  };

  await assert.rejects(
    manageInstallation({ ...paths, manifest: unsafe, operation: "install" }),
    /unsafe install manifest path/,
  );
});

test("installer rejects target paths that traverse symbolic links", async (t) => {
  const paths = await fixture(t);
  const outside = join(paths.targetRoot, "outside");
  await mkdir(outside);
  await symlink(outside, join(paths.targetRoot, "rules"));

  await assert.rejects(
    manageInstallation({ ...paths, manifest, operation: "install" }),
    /install path contains a symbolic link: rules\/workflow\.md/,
  );
});

test("installer rejects a symbolic-link ledger directory before writing assets", async (t) => {
  const paths = await fixture(t);
  const outside = join(paths.targetRoot, "outside-ledger");
  await mkdir(outside);
  await symlink(outside, join(paths.targetRoot, ".agent-dev-workflow"));

  await assert.rejects(
    manageInstallation({ ...paths, manifest, operation: "install" }),
    /install path contains a symbolic link: \.agent-dev-workflow\/ownership\.json/,
  );
  await assert.rejects(readFile(join(paths.targetRoot, "AGENTS.md")), /ENOENT/);
});

test("forged managed ledger entries cannot overwrite manifest targets", async (t) => {
  const paths = await fixture(t);
  const existing = "# Existing project rules\n";
  await writeFile(join(paths.targetRoot, "AGENTS.md"), existing);
  await mkdir(join(paths.targetRoot, ".agent-dev-workflow"));
  await writeFile(
    join(paths.targetRoot, manifest.ledger_path),
    `${JSON.stringify({
      schema_version: 1,
      assets: [{
        path: "AGENTS.md",
        source: "templates/AGENTS.md",
        sha256: hash(existing),
        management: "managed",
      }],
    })}\n`,
  );

  const report = await manageInstallation({
    ...paths,
    manifest,
    operation: "repair",
  });

  assert.equal(report.ok, false);
  assert.equal(report.assets[0].action, "review-update");
  assert.equal(await readFile(join(paths.targetRoot, "AGENTS.md"), "utf8"), existing);
});

test("forged or retired ledger entries cannot delete unrelated files", async (t) => {
  const paths = await fixture(t);
  const existing = "# Project README\n";
  await writeFile(join(paths.targetRoot, "README.md"), existing);
  await mkdir(join(paths.targetRoot, ".agent-dev-workflow"));
  await writeFile(
    join(paths.targetRoot, manifest.ledger_path),
    `${JSON.stringify({
      schema_version: 1,
      assets: [{
        path: "README.md",
        source: "templates/AGENTS.md",
        sha256: hash(existing),
        management: "managed",
      }],
    })}\n`,
  );

  const report = await manageInstallation({
    ...paths,
    manifest,
    operation: "uninstall",
  });

  assert.equal(report.ok, true);
  assert.equal(report.assets[0].action, "preserve-retired");
  assert.equal(await readFile(join(paths.targetRoot, "README.md"), "utf8"), existing);
});
