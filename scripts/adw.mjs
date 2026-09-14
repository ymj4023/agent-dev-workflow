#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  inspectCapabilities,
  validateWorkflow,
  workflowRequirements,
} from "../src/workflow-contract.mjs";
import { verifyRepository } from "../src/repository-contract.mjs";
import {
  loadInstallManifest,
  manageInstallation,
} from "../src/installer.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultManifestPath = resolve(projectRoot, "manifests/workflow.json");
const eccManifestPath = resolve(projectRoot, "integrations/ecc/manifest.json");

function usage() {
  return [
    "Usage:",
    "  node scripts/adw.mjs validate [manifest] [--json]",
    "  node scripts/adw.mjs doctor [--skills-root path] [--json]",
    "  node scripts/adw.mjs verify [--json]",
    "  node scripts/adw.mjs install <target-repo> [--dry-run] [--accept-existing] [--json]",
    "  node scripts/adw.mjs status <target-repo> [--json]",
    "  node scripts/adw.mjs repair <target-repo> [--dry-run] [--json]",
    "  node scripts/adw.mjs uninstall <target-repo> [--dry-run] [--json]",
    "",
  ].join("\n");
}

function parseArgs(args) {
  const values = [];
  let json = false;
  let dryRun = false;
  let acceptExisting = false;
  let skillsRoot;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--json") {
      json = true;
    } else if (argument === "--dry-run") {
      dryRun = true;
    } else if (argument === "--accept-existing") {
      acceptExisting = true;
    } else if (argument === "--skills-root") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--skills-root requires a path");
      }
      skillsRoot = value;
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`unknown option: ${argument}`);
    } else {
      values.push(argument);
    }
  }

  return { acceptExisting, dryRun, json, skillsRoot, values };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonIfPresent(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function writeReport(report, { json, okLabel, failLabel }) {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${report.ok ? okLabel : failLabel}\n`);
  if (report.errors?.length) {
    for (const error of report.errors) process.stdout.write(`- ${error}\n`);
  }
  if (report.required) {
    process.stdout.write(
      `Required skills: ${report.required.found.length} found, ${report.required.missing.length} missing\n`,
    );
    process.stdout.write(
      `Optional skills: ${report.optional.found.length} found, ${report.optional.missing.length} missing\n`,
    );
    for (const skill of report.required.missing) {
      process.stdout.write(`- required capability missing: ${skill}\n`);
    }
    const provenance = report.required.provenance;
    if (provenance) {
      process.stdout.write(
        `Required provenance: ${provenance.verified.length} verified, ${provenance.unverified.length} unverified, ${provenance.mismatched.length} mismatched, ${provenance.outdated.length} outdated\n`,
      );
      for (const skill of provenance.unverified) {
        process.stdout.write(`- required provenance unverified: ${skill}\n`);
      }
      for (const skill of provenance.mismatched) {
        process.stdout.write(`- required provenance source mismatch: ${skill}\n`);
      }
      for (const skill of provenance.outdated) {
        const minimum = provenance.minimum_version.startsWith("v")
          ? provenance.minimum_version
          : `v${provenance.minimum_version}`;
        process.stdout.write(`- required provenance below minimum ${minimum}: ${skill}\n`);
      }
    }
    for (const skill of report.optional.missing) {
      process.stdout.write(`- optional capability unavailable: ${skill}\n`);
    }
  }
}

async function validateCommand(options) {
  if (options.values.length > 1 || options.acceptExisting || options.dryRun ||
      options.skillsRoot) {
    throw new Error("validate accepts one manifest path and --json only");
  }
  const path = resolve(options.values[0] ?? defaultManifestPath);
  const errors = validateWorkflow(await readJson(path));
  const report = { ok: errors.length === 0, manifest: path, errors };

  writeReport(report, {
    json: options.json,
    okLabel: "PASS: workflow manifest is valid",
    failLabel: "FAIL: workflow manifest is invalid",
  });
  return report.ok ? 0 : 1;
}

async function doctorCommand(options) {
  if (options.values.length > 0 || options.acceptExisting || options.dryRun) {
    throw new Error("doctor accepts --skills-root and --json only");
  }
  const workflow = await readJson(defaultManifestPath);
  const ecc = await readJson(eccManifestPath);
  const skillsRoot = resolve(
    options.skillsRoot ??
      process.env.MATT_SKILLS_DIR ??
      resolve(homedir(), ".agents/skills"),
  );
  const lock = await readJsonIfPresent(resolve(skillsRoot, "..", ".skill-lock.json"));
  const report = await inspectCapabilities({
    skillsRoot,
    required: workflowRequirements.mattSkills,
    optional: ecc.capability_skills,
    requiredProvenance: {
      lock,
      source: "mattpocock/skills",
      minimumVersion: workflow.integrations.matt.minimum_version,
    },
  });

  writeReport(report, {
    json: options.json,
    okLabel: "PASS: required Matt capabilities are available",
    failLabel: "FAIL: required Matt capabilities are unavailable or unverified",
  });
  return report.ok ? 0 : 1;
}

async function verifyCommand(options) {
  if (options.values.length > 0 || options.acceptExisting || options.skillsRoot ||
      options.dryRun) {
    throw new Error("verify accepts --json only");
  }
  const report = await verifyRepository(projectRoot);

  writeReport(report, {
    json: options.json,
    okLabel: "PASS: repository contract is valid",
    failLabel: "FAIL: repository contract is invalid",
  });
  return report.ok ? 0 : 1;
}

function writeInstallationReport(report, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  const label = report.ok ? "PASS" : "NOT_READY";
  const dryRun = report.dry_run ? " dry-run" : "";
  process.stdout.write(`${label}: ${report.operation}${dryRun}\n`);
  for (const asset of report.assets) {
    process.stdout.write(`- ${asset.action}: ${asset.path}\n`);
  }
  for (const error of report.errors) process.stdout.write(`- ${error}\n`);
}

async function installationCommand(command, options) {
  if (options.values.length !== 1 || options.skillsRoot) {
    throw new Error(`${command} requires exactly one target repository`);
  }
  if (command === "status" && options.dryRun) {
    throw new Error("status does not accept --dry-run");
  }
  if (command !== "install" && options.acceptExisting) {
    throw new Error("--accept-existing is supported by install only");
  }
  const manifest = await loadInstallManifest(projectRoot);
  const report = await manageInstallation({
    packageRoot: projectRoot,
    targetRoot: resolve(options.values[0]),
    manifest,
    operation: command,
    dryRun: options.dryRun,
    acceptExisting: options.acceptExisting,
  });
  writeInstallationReport(report, options.json);
  return report.ok ? 0 : 1;
}

async function main() {
  const [command, ...rawArgs] = process.argv.slice(2);
  const commands = [
    "validate",
    "doctor",
    "verify",
    "install",
    "status",
    "repair",
    "uninstall",
  ];
  if (!command || !commands.includes(command)) {
    process.stderr.write(usage());
    return 2;
  }

  let options;
  try {
    options = parseArgs(rawArgs);
    if (command === "validate") return await validateCommand(options);
    if (command === "doctor") return await doctorCommand(options);
    if (command === "verify") return await verifyCommand(options);
    return await installationCommand(command, options);
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n${usage()}`);
    return 2;
  }
}

process.exitCode = await main();
