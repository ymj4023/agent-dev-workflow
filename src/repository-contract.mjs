import { access, readdir, readFile } from "node:fs/promises";
import { posix, resolve } from "node:path";

import { validateWorkflow } from "./workflow-contract.mjs";

const MATT_OWNED_SKILLS = new Set([
  "ask-matt",
  "grilling",
  "grill-me",
  "grill-with-docs",
  "domain-modeling",
  "to-spec",
  "to-tickets",
  "implement",
  "tdd",
  "code-review",
  "wayfinder",
  "triage",
  "diagnosing-bugs",
  "improve-codebase-architecture",
  "codebase-design",
]);

const REQUIRED_PATHS = [
  "AGENTS.md",
  "CONTEXT-MAP.md",
  "ADR-MAP.md",
  "README.md",
  "README.ZH.md",
  "docs/assets/agent-dev-workflow-architecture.png",
  "docs/assets/agent-dev-workflow-architecture.html",
  "docs/architecture.md",
  "docs/evidence/bootstrap.md",
  "docs/agents/issue-tracker.md",
  "docs/agents/domain.md",
  "docs/agents/triage-labels.md",
  "docs/contexts/CONTEXT-MAP.md",
  "docs/contexts/workflow/CONTEXT.md",
  "docs/adr/ADR-MAP.md",
  "docs/adr/workflow/ADR-MAP.md",
  "docs/adr/workflow/0001-matt-first-optional-providers.md",
  "manifests/workflow.json",
  "manifests/install.json",
  "skills/human-qa/SKILL.md",
  "skills/delivery-verification/SKILL.md",
  "skills/reasoning-evidence/SKILL.md",
  "rules/workflow.md",
  "rules/evidence.md",
  "hooks/README.md",
  "hooks/shared/delivery-guard.mjs",
  "hooks/adapters/claude/hooks.json",
  "hooks/adapters/codex/hooks.json",
  "integrations/matt/README.md",
  "integrations/ecc/README.md",
  "integrations/ecc/manifest.json",
  "src/installer.mjs",
  ".github/workflows/verify.yml",
  ".scratch/bootstrap/spec.md",
  ".scratch/bootstrap/issues/01-workflow-contract.md",
  ".scratch/bootstrap/issues/02-repository-surfaces.md",
  ".scratch/bootstrap/issues/03-local-hooks-and-ci.md",
  ".scratch/bootstrap/issues/04-safe-installer.md",
  ".scratch/bootstrap/issues/05-remote-execution-adapters.md",
];

const DOCUMENTATION_TREES = Object.freeze([
  {
    kind: "context",
    rootMap: "CONTEXT-MAP.md",
    entryMap: "docs/contexts/CONTEXT-MAP.md",
    mapName: "CONTEXT-MAP.md",
  },
  {
    kind: "ADR",
    rootMap: "ADR-MAP.md",
    entryMap: "docs/adr/ADR-MAP.md",
    mapName: "ADR-MAP.md",
  },
]);

// This audited v2.2.0 mapping is intentionally duplicated outside the adapter manifest so drift is detectable.
const ECC_CAPABILITIES = Object.freeze([
  "contract-first",
  "eval-harness",
  "security-review",
  "verification-loop",
]);

export function validateSkillOwnership(skillNames) {
  return skillNames
    .filter((skill) => MATT_OWNED_SKILLS.has(skill))
    .map((skill) => `project-owned skill shadows Matt capability: ${skill}`);
}

export function validateEccIntegration(integration) {
  const errors = [];
  if (integration?.name !== "ecc") errors.push("ECC integration name must be ecc");
  if (integration?.required !== false) errors.push("ECC integration must remain optional");
  if (integration?.minimum_version !== "2.2.0") {
    errors.push("ECC minimum_version must be 2.2.0");
  }
  if (integration?.source_url !== "https://github.com/affaan-m/ECC") {
    errors.push("ECC source_url must identify affaan-m/ECC");
  }
  if (integration?.source_ref !== "v2.2.0") {
    errors.push("ECC source_ref must be v2.2.0");
  }

  const actual = Array.isArray(integration?.capability_skills)
    ? [...integration.capability_skills].sort()
    : [];
  if (actual.length !== ECC_CAPABILITIES.length ||
      !ECC_CAPABILITIES.every((skill, index) => actual[index] === skill)) {
    errors.push(`ECC capability mapping must be exactly: ${ECC_CAPABILITIES.join(", ")}`);
  }
  return errors;
}

export function validateDocumentationMap(mapPath, content, expectedLinks) {
  const links = [...content.matchAll(/\]\(([^)]+)\)/g)]
    .map((match) => match[1]);
  const counts = new Map();
  for (const link of links) counts.set(link, (counts.get(link) ?? 0) + 1);

  const errors = [];
  for (const expected of expectedLinks) {
    if (!counts.has(expected)) {
      errors.push(`documentation map ${mapPath} is missing direct link: ${expected}`);
    }
  }
  for (const [link, count] of counts) {
    if (!expectedLinks.includes(link)) {
      errors.push(`documentation map ${mapPath} has unexpected link: ${link}`);
    } else if (count > 1) {
      errors.push(`documentation map ${mapPath} has duplicate link: ${link}`);
    }
  }
  return errors;
}

export function validateDocumentationLink(kind, mapPath, link) {
  const segments = link.split("/");
  const safe = !link.startsWith("/") &&
    !link.includes("\\") &&
    !segments.includes("") &&
    !segments.includes(".") &&
    !segments.includes("..") &&
    !link.includes(":");
  const directContext = kind === "context" &&
    segments.length === 2 &&
    ["CONTEXT-MAP.md", "CONTEXT.md"].includes(segments[1]);
  const directAdr = kind === "ADR" && (
    (segments.length === 1 && /^\d{4}-.+\.md$/.test(segments[0])) ||
    (segments.length === 2 && segments[1] === "ADR-MAP.md")
  );

  return safe && (directContext || directAdr)
    ? null
    : `documentation map ${mapPath} has non-direct ${kind} link: ${link}`;
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function validateSkillFiles(root, skillNames) {
  const errors = [];

  for (const skill of skillNames) {
    const path = resolve(root, "skills", skill, "SKILL.md");
    let content;
    try {
      content = await readFile(path, "utf8");
    } catch (error) {
      errors.push(`cannot read skill ${skill}: ${error.code ?? error.message}`);
      continue;
    }
    if (!content.startsWith("---\n")) {
      errors.push(`skill ${skill} is missing frontmatter`);
    }
    if (!new RegExp(`^name: ${skill}$`, "m").test(content)) {
      errors.push(`skill ${skill} has a mismatched name`);
    }
    if (!/^description: .+$/m.test(content)) {
      errors.push(`skill ${skill} is missing a description`);
    }
  }

  return errors;
}

async function findDocumentationFiles(root, directory, kind) {
  const files = [];
  const pending = [directory];

  while (pending.length > 0) {
    const current = pending.pop();
    let entries;
    try {
      entries = await readdir(resolve(root, current), { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }

    for (const entry of entries) {
      const path = posix.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(path);
      } else if (
        (kind === "context" && ["CONTEXT-MAP.md", "CONTEXT.md"].includes(entry.name)) ||
        (kind === "ADR" && (entry.name === "ADR-MAP.md" || /^\d{4}-.+\.md$/.test(entry.name)))
      ) {
        files.push(path);
      }
    }
  }

  return files.sort();
}

async function validateDocumentationTrees(root) {
  const errors = [];

  for (const tree of DOCUMENTATION_TREES) {
    const rootPath = resolve(root, tree.rootMap);
    if (!(await pathExists(rootPath))) continue;

    try {
      const content = await readFile(rootPath, "utf8");
      errors.push(...validateDocumentationMap(tree.rootMap, content, [tree.entryMap]));
    } catch (error) {
      errors.push(`cannot validate documentation map ${tree.rootMap}: ${error.code ?? error.message}`);
      continue;
    }

    // Discover child maps from each parent so a new domain updates only its direct parent Map.
    const pending = [tree.entryMap];
    const visited = new Set();
    const reachable = new Set([tree.entryMap]);
    while (pending.length > 0) {
      const mapPath = pending.pop();
      if (visited.has(mapPath)) continue;
      visited.add(mapPath);

      const absolutePath = resolve(root, mapPath);
      let content;
      try {
        content = await readFile(absolutePath, "utf8");
      } catch (error) {
        errors.push(`cannot read documentation map ${mapPath}: ${error.code ?? error.message}`);
        continue;
      }

      const links = [...content.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
      const counts = new Map();
      for (const link of links) counts.set(link, (counts.get(link) ?? 0) + 1);

      for (const [link, count] of counts) {
        if (count > 1) {
          errors.push(`documentation map ${mapPath} has duplicate link: ${link}`);
          continue;
        }
        const linkError = validateDocumentationLink(tree.kind, mapPath, link);
        if (linkError) {
          errors.push(linkError);
          continue;
        }

        const targetPath = posix.join(posix.dirname(mapPath), link);
        reachable.add(targetPath);
        if (!(await pathExists(resolve(root, targetPath)))) {
          errors.push(`documentation map ${mapPath} references missing target: ${link}`);
        } else if (posix.basename(targetPath) === tree.mapName) {
          pending.push(targetPath);
        }
      }
    }

    const directory = posix.dirname(tree.entryMap);
    for (const path of await findDocumentationFiles(root, directory, tree.kind)) {
      if (!reachable.has(path)) {
        errors.push(`documentation tree ${tree.kind} has orphan file: ${path}`);
      }
    }
  }

  return errors;
}

export async function verifyRepository(root) {
  const errors = [];

  for (const relativePath of REQUIRED_PATHS) {
    if (!(await pathExists(resolve(root, relativePath)))) {
      errors.push(`missing repository surface: ${relativePath}`);
    }
  }

  errors.push(...(await validateDocumentationTrees(root)));

  const skillsRoot = resolve(root, "skills");
  let skillNames = [];
  if (await pathExists(skillsRoot)) {
    try {
      skillNames = (await readdir(skillsRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      errors.push(...validateSkillOwnership(skillNames));
      errors.push(...(await validateSkillFiles(root, skillNames)));
    } catch (error) {
      errors.push(`cannot inspect skills: ${error.code ?? error.message}`);
    }
  }

  const workflowPath = resolve(root, "manifests/workflow.json");
  if (await pathExists(workflowPath)) {
    try {
      const workflow = JSON.parse(await readFile(workflowPath, "utf8"));
      errors.push(...validateWorkflow(workflow));
    } catch (error) {
      errors.push(`cannot validate workflow manifest: ${error.message}`);
    }
  }

  const eccPath = resolve(root, "integrations/ecc/manifest.json");
  if (await pathExists(eccPath)) {
    try {
      const ecc = JSON.parse(await readFile(eccPath, "utf8"));
      errors.push(...validateEccIntegration(ecc));
    } catch (error) {
      errors.push(`cannot validate ECC integration: ${error.message}`);
    }
  }

  return { ok: errors.length === 0, root: resolve(root), skillNames, errors };
}
