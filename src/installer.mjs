import { createHash, randomUUID } from "node:crypto";
import {
  access,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function safeRelativePath(path) {
  if (typeof path !== "string" || path.length === 0 || isAbsolute(path)) return false;
  if (path.includes("\\") || path.includes(":")) return false;
  const segments = path.split("/");
  return !segments.some((segment) => !segment || segment === "." || segment === "..");
}

function safeResolve(root, path) {
  if (!safeRelativePath(path)) throw new Error(`unsafe install manifest path: ${path}`);
  const absolute = resolve(root, path);
  const fromRoot = relative(root, absolute);
  if (fromRoot.startsWith(`..${sep}`) || fromRoot === ".." || isAbsolute(fromRoot)) {
    throw new Error(`unsafe install manifest path: ${path}`);
  }
  return absolute;
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function assertNoSymlink(root, path) {
  let current = root;
  for (const segment of path.split("/")) {
    current = resolve(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error(`install path contains a symbolic link: ${path}`);
      }
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
  }
}

function validateManifest(manifest) {
  if (manifest?.schema_version !== 1 || !Array.isArray(manifest.assets)) {
    throw new Error("install manifest schema_version must be 1 with an assets array");
  }
  if (!safeRelativePath(manifest.ledger_path)) {
    throw new Error(`unsafe install manifest path: ${manifest.ledger_path}`);
  }

  const targets = new Set();
  for (const asset of manifest.assets) {
    if (!safeRelativePath(asset?.source) || !safeRelativePath(asset?.target)) {
      throw new Error(`unsafe install manifest path: ${asset?.source ?? asset?.target}`);
    }
    if (targets.has(asset.target)) {
      throw new Error(`duplicate install target: ${asset.target}`);
    }
    if (asset.target === manifest.ledger_path) {
      throw new Error(`install target conflicts with ownership ledger: ${asset.target}`);
    }
    targets.add(asset.target);
  }
}

function validateLedger(ledger) {
  if (ledger?.schema_version !== 1 || !Array.isArray(ledger.assets)) {
    throw new Error("ownership ledger is invalid");
  }
  const paths = new Set();
  for (const asset of ledger.assets) {
    if (!safeRelativePath(asset?.path) || !safeRelativePath(asset?.source) ||
        !/^[a-f0-9]{64}$/.test(asset?.sha256 ?? "")) {
      throw new Error("ownership ledger contains an invalid asset");
    }
    if (asset.management && !["managed", "external"].includes(asset.management)) {
      throw new Error("ownership ledger contains an invalid asset");
    }
    if (paths.has(asset.path)) throw new Error("ownership ledger contains duplicate assets");
    paths.add(asset.path);
  }
}

async function readLedger(targetRoot, ledgerPath) {
  const path = safeResolve(targetRoot, ledgerPath);
  await assertNoSymlink(targetRoot, ledgerPath);
  if (!(await pathExists(path))) return null;
  const ledger = JSON.parse(await readFile(path, "utf8"));
  validateLedger(ledger);
  return ledger;
}

async function readTargetHash(targetRoot, path) {
  const absolute = safeResolve(targetRoot, path);
  await assertNoSymlink(targetRoot, path);
  try {
    return sha256(await readFile(absolute));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function atomicWrite(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.adw-${process.pid}-${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { flag: "wx" });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function writeNew(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { flag: "wx" });
}

function classifyAsset(targetHash, sourceHash, owned) {
  if (!owned) return targetHash === null ? "absent" : "unowned";
  if (owned.management === "external") {
    if (targetHash === null) return "external-missing";
    return targetHash === owned.sha256 ? "external-current" : "external-modified";
  }
  if (targetHash === null) return "missing";
  if (targetHash === sourceHash) return "current";
  if (targetHash === owned.sha256) return "outdated";
  return "modified";
}

function actionFor(operation, state, acceptExisting) {
  if (operation === "status") return state;
  if (state === "current") return "unchanged";
  if (state === "external-current") return "preserve-external";
  if (["external-missing", "external-modified"].includes(state)) {
    return "review-external";
  }
  if (state === "absent") return "create";
  if (state === "missing") return "restore";
  if (state === "outdated") return "review-update";
  if (state === "modified") return "preserve-modified";
  return acceptExisting ? "accept-existing" : "preserve-unowned";
}

async function inspectAssets({
  packageRoot,
  targetRoot,
  manifest,
  ledger,
  operation,
  acceptExisting,
}) {
  const owned = new Map((ledger?.assets ?? []).map((asset) => [asset.path, asset]));
  const assets = [];

  for (const asset of manifest.assets) {
    const sourcePath = safeResolve(packageRoot, asset.source);
    await assertNoSymlink(packageRoot, asset.source);
    const content = await readFile(sourcePath);
    const sourceHash = sha256(content);
    const targetHash = await readTargetHash(targetRoot, asset.target);
    const candidate = owned.get(asset.target);
    const trustedOwned = candidate?.source === asset.source ? candidate : null;
    const state = classifyAsset(targetHash, sourceHash, trustedOwned);
    assets.push({
      path: asset.target,
      source: asset.source,
      action: actionFor(operation, state, acceptExisting),
      state,
      sourceHash,
      targetHash,
      content,
    });
  }

  const manifestTargets = new Set(manifest.assets.map((asset) => asset.target));
  for (const asset of ledger?.assets ?? []) {
    if (!manifestTargets.has(asset.path)) {
      assets.push({
        path: asset.path,
        source: asset.source,
        action: operation === "status" ? "retired" : "preserve-retired",
        state: "retired",
        sourceHash: null,
        targetHash: await readTargetHash(targetRoot, asset.path),
        content: null,
      });
    }
  }
  return assets;
}

async function applyInstallPlan({ targetRoot, manifest, ledger, assets }) {
  // Apply only actions whose ownership and content hashes were established by the complete preflight plan.
  const entries = new Map((ledger?.assets ?? []).map((asset) => [asset.path, asset]));

  for (const asset of assets) {
    const targetPath = safeResolve(targetRoot, asset.path);
    if (["create", "restore"].includes(asset.action)) {
      await assertNoSymlink(targetRoot, asset.path);
      await writeNew(targetPath, asset.content);
      entries.set(asset.path, {
        path: asset.path,
        source: asset.source,
        sha256: asset.sourceHash,
        management: "managed",
      });
    } else if (asset.action === "unchanged") {
      entries.set(asset.path, {
        path: asset.path,
        source: asset.source,
        sha256: asset.sourceHash,
        management: "managed",
      });
    } else if (asset.action === "accept-existing") {
      entries.set(asset.path, {
        path: asset.path,
        source: asset.source,
        sha256: asset.targetHash,
        management: "external",
      });
    }
  }

  const nextLedger = {
    schema_version: 1,
    assets: [...entries.values()].sort((left, right) => left.path.localeCompare(right.path)),
  };
  const ledgerPath = safeResolve(targetRoot, manifest.ledger_path);
  await assertNoSymlink(targetRoot, manifest.ledger_path);
  const content = `${JSON.stringify(nextLedger, null, 2)}\n`;
  if (!ledger && entries.size === 0) return;
  if (ledger) {
    const current = await readFile(ledgerPath, "utf8");
    if (current !== content) await atomicWrite(ledgerPath, content);
  } else {
    await writeNew(ledgerPath, content);
  }
}

async function uninstall({ packageRoot, targetRoot, manifest, ledger, dryRun }) {
  if (!ledger) throw new Error("ownership ledger is required for uninstall");
  const assets = [];
  const retained = [];
  const currentManifest = new Map(
    manifest.assets.map((asset) => [asset.target, asset]),
  );

  for (const owned of ledger.assets) {
    const targetHash = await readTargetHash(targetRoot, owned.path);
    const manifestAsset = currentManifest.get(owned.path);
    let action;
    if (owned.management === "external") {
      action = "preserve-external";
    } else if (!manifestAsset || manifestAsset.source !== owned.source) {
      action = "preserve-retired";
    } else if (targetHash === null) {
      action = "forget-missing";
    } else {
      const sourcePath = safeResolve(packageRoot, manifestAsset.source);
      await assertNoSymlink(packageRoot, manifestAsset.source);
      const sourceHash = sha256(await readFile(sourcePath));
      action = targetHash === owned.sha256 && targetHash === sourceHash
        ? "remove"
        : targetHash === owned.sha256 ? "preserve-outdated" : "preserve-modified";
    }
    assets.push({ path: owned.path, action, owned });
    if (["preserve-modified", "preserve-outdated"].includes(action)) {
      retained.push(owned);
    }
  }

  if (!dryRun) {
    for (const asset of assets) {
      if (asset.action === "remove") {
        // Recheck at the destructive boundary so a post-plan user edit is preserved.
        const currentHash = await readTargetHash(targetRoot, asset.path);
        if (currentHash !== asset.owned.sha256) {
          asset.action = "preserve-modified";
          retained.push(asset.owned);
          continue;
        }
        await rm(safeResolve(targetRoot, asset.path));
      }
    }
    const ledgerPath = safeResolve(targetRoot, manifest.ledger_path);
    if (retained.length === 0) {
      await rm(ledgerPath, { force: true });
    } else {
      await atomicWrite(ledgerPath, `${JSON.stringify({
        schema_version: 1,
        assets: retained,
      }, null, 2)}\n`);
    }
  }

  const errors = assets
    .filter((asset) => ["preserve-modified", "preserve-outdated"].includes(
      asset.action,
    ))
    .map((asset) => `owned file could not be safely removed: ${asset.path} (${asset.action})`);
  return {
    ok: errors.length === 0,
    operation: "uninstall",
    dry_run: dryRun,
    ledger_path: manifest.ledger_path,
    assets: assets.map(({ path, action }) => ({ path, action })),
    errors,
  };
}

export async function loadInstallManifest(packageRoot) {
  return JSON.parse(
    await readFile(resolve(packageRoot, "manifests/install.json"), "utf8"),
  );
}

export async function manageInstallation({
  packageRoot,
  targetRoot,
  manifest,
  operation,
  dryRun = false,
  acceptExisting = false,
}) {
  if (!["install", "status", "repair", "uninstall"].includes(operation)) {
    throw new Error(`unsupported install operation: ${operation}`);
  }
  if (acceptExisting && operation !== "install") {
    throw new Error("--accept-existing is supported by install only");
  }
  validateManifest(manifest);
  const resolvedPackage = resolve(packageRoot);
  const resolvedTarget = resolve(targetRoot);
  if (resolvedPackage === resolvedTarget) {
    throw new Error("target repository must differ from the workflow package");
  }
  if (!(await pathExists(resolve(resolvedTarget, ".git")))) {
    throw new Error("target must be an existing Git repository");
  }

  const ledger = await readLedger(resolvedTarget, manifest.ledger_path);
  if (operation === "uninstall") {
    return uninstall({
      packageRoot: resolvedPackage,
      targetRoot: resolvedTarget,
      manifest,
      ledger,
      dryRun,
    });
  }
  if (operation === "repair" && !ledger) {
    throw new Error("ownership ledger is required for repair");
  }

  const assets = await inspectAssets({
    packageRoot: resolvedPackage,
    targetRoot: resolvedTarget,
    manifest,
    ledger,
    operation,
    acceptExisting,
  });
  const blockingActions = operation === "status"
    ? new Set([
      "absent",
      "missing",
      "outdated",
      "modified",
      "unowned",
      "external-missing",
      "external-modified",
      "retired",
    ])
    : new Set([
      "preserve-modified",
      "preserve-unowned",
      "preserve-retired",
      "review-external",
      "review-update",
    ]);
  const errors = assets
    .filter((asset) => blockingActions.has(asset.action))
    .map((asset) => `asset requires manual action: ${asset.path} (${asset.action})`);

  const installIsUnblocked = operation !== "install" || errors.length === 0;
  if (!dryRun && operation !== "status" && installIsUnblocked) {
    await applyInstallPlan({
      targetRoot: resolvedTarget,
      manifest,
      ledger,
      assets,
    });
  }

  return {
    ok: errors.length === 0,
    operation,
    dry_run: dryRun,
    ledger_path: manifest.ledger_path,
    assets: assets.map(({ path, action, state }) => ({ path, action, state })),
    errors,
  };
}
