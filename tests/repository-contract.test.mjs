import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  validateDocumentationLink,
  validateDocumentationMap,
  validateEccIntegration,
  validateSkillOwnership,
  verifyRepository,
} from "../src/repository-contract.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

test("the repository contains every canonical workflow surface", async () => {
  const report = await verifyRepository(projectRoot);

  assert.deepEqual(report.errors, []);
});

test("project-owned skills cannot shadow Matt's main flow", () => {
  const errors = validateSkillOwnership(["human-qa", "tdd", "to-spec"]);

  assert.deepEqual(errors, [
    "project-owned skill shadows Matt capability: tdd",
    "project-owned skill shadows Matt capability: to-spec",
  ]);
});

test("missing repository surfaces return precise errors instead of throwing", async () => {
  const emptyRoot = await mkdtemp(join(tmpdir(), "adw-incomplete-"));
  const report = await verifyRepository(emptyRoot);

  assert.equal(report.ok, false);
  assert.ok(report.errors.includes("missing repository surface: AGENTS.md"));
  assert.ok(report.errors.includes("missing repository surface: manifests/workflow.json"));
  assert.ok(report.errors.includes(
    "missing repository surface: docs/contexts/workflow/CONTEXT.md",
  ));
  assert.ok(report.errors.includes(
    "missing repository surface: docs/adr/workflow/0001-matt-first-optional-providers.md",
  ));
});

test("Claude and current Codex Stop adapters use the same bounded timeout", async () => {
  const paths = [
    "hooks/adapters/claude/hooks.json",
    "hooks/adapters/codex/hooks.json",
  ];
  const adapters = await Promise.all(
    paths.map(async (path) => JSON.parse(await readFile(join(projectRoot, path), "utf8"))),
  );

  for (const adapter of adapters) {
    const hook = adapter.hooks.Stop[0].hooks[0];
    assert.equal(hook.timeout, 30);
    assert.equal(hook.command, "node hooks/shared/delivery-guard.mjs");
  }
});

test("the optional ECC mapping stays pinned to its audited release", () => {
  const invalid = {
    name: "ecc",
    required: false,
    minimum_version: "2.2.0",
    source_url: "https://github.com/affaan-m/ECC",
    source_ref: "v1.0.0",
    capability_skills: [],
  };

  assert.deepEqual(validateEccIntegration(invalid), [
    "ECC source_ref must be v2.2.0",
    "ECC capability mapping must be exactly: contract-first, eval-harness, security-review, verification-loop",
  ]);
});

test("coverage thresholds run on the same supported Node runtime in CI", async () => {
  const [packageJson, githubWorkflow] = await Promise.all([
    readFile(join(projectRoot, "package.json"), "utf8"),
    readFile(join(projectRoot, ".github/workflows/verify.yml"), "utf8"),
  ]);

  assert.equal(JSON.parse(packageJson).engines.node, ">=22");
  assert.match(githubWorkflow, /node-version: 22/);
});

test("both Chinese READMEs embed the repo-owned architecture diagram", async () => {
  const architectureImage = "docs/assets/agent-dev-workflow-architecture.png";
  const architectureHtml = "docs/assets/agent-dev-workflow-architecture.html";
  const [primaryReadme, chineseGuide, image, html] = await Promise.all([
    readFile(join(projectRoot, "README.md"), "utf8"),
    readFile(join(projectRoot, "README.ZH.md"), "utf8"),
    readFile(join(projectRoot, architectureImage)),
    readFile(join(projectRoot, architectureHtml), "utf8"),
  ]);
  const imageReference = /!\[[^\]]+\]\(docs\/assets\/agent-dev-workflow-architecture\.png\)/;
  const htmlReference = /\[交互式架构图\]\(docs\/assets\/agent-dev-workflow-architecture\.html\)/;

  assert.match(primaryReadme, /\[完整中文使用说明\]\(README\.ZH\.md\)/);
  assert.match(chineseGuide, /\[项目首页\]\(README\.md\)/);
  assert.match(primaryReadme, /## 5 分钟开始/);
  assert.match(chineseGuide, /## 5 分钟开始/);
  assert.match(primaryReadme, /git clone https:\/\/github\.com\/ymj4023\/agent-dev-workflow\.git/);
  assert.match(chineseGuide, /git clone https:\/\/github\.com\/ymj4023\/agent-dev-workflow\.git/);
  assert.match(primaryReadme, /Align.*Destination.*Journey/);
  assert.match(chineseGuide, /Align.*Destination.*Journey/);
  assert.match(primaryReadme, /术语对齐 → 需求盘问 → 边界澄清/);
  assert.match(chineseGuide, /术语对齐 → 需求盘问 → 边界澄清/);
  assert.match(primaryReadme, /全部术语确认前，不要调用 grill-me、grill-with-docs 或 \/grilling/);
  assert.match(chineseGuide, /全部术语确认前，不要调用 grill-me、grill-with-docs 或 \/grilling/);
  assert.match(primaryReadme, /<你的项目目录>/);
  assert.match(chineseGuide, /<你的项目目录>/);
  assert.match(primaryReadme, imageReference);
  assert.match(chineseGuide, imageReference);
  assert.match(primaryReadme, htmlReference);
  assert.match(chineseGuide, htmlReference);
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.match(html, /<svg\b/);
});

test("documentation maps expose exactly their direct descendants", () => {
  const content = [
    "# Map",
    "",
    "| Name | Path |",
    "| --- | --- |",
    "| Workflow | [workflow](workflow/CONTEXT.md) |",
  ].join("\n");

  assert.deepEqual(
    validateDocumentationMap("docs/contexts/CONTEXT-MAP.md", content, [
      "workflow/CONTEXT.md",
    ]),
    [],
  );
  assert.deepEqual(
    validateDocumentationMap(
      "docs/contexts/CONTEXT-MAP.md",
      `${content}\n| Indirect | [ADR](../adr/workflow/0001-decision.md) |`,
      ["workflow/CONTEXT.md"],
    ),
    [
      "documentation map docs/contexts/CONTEXT-MAP.md has unexpected link: ../adr/workflow/0001-decision.md",
    ],
  );
  assert.deepEqual(
    validateDocumentationMap("docs/contexts/CONTEXT-MAP.md", "# Empty Map", [
      "workflow/CONTEXT.md",
    ]),
    [
      "documentation map docs/contexts/CONTEXT-MAP.md is missing direct link: workflow/CONTEXT.md",
    ],
  );
  assert.deepEqual(
    validateDocumentationMap(
      "docs/contexts/CONTEXT-MAP.md",
      `${content}\n| Duplicate | [workflow](workflow/CONTEXT.md) |`,
      ["workflow/CONTEXT.md"],
    ),
    [
      "documentation map docs/contexts/CONTEXT-MAP.md has duplicate link: workflow/CONTEXT.md",
    ],
  );
  assert.equal(
    validateDocumentationLink(
      "context",
      "docs/contexts/CONTEXT-MAP.md",
      "workflow/CONTEXT.md",
    ),
    null,
  );
  assert.equal(
    validateDocumentationLink(
      "ADR",
      "docs/adr/workflow/ADR-MAP.md",
      "0001-decision.md",
    ),
    null,
  );
  assert.equal(
    validateDocumentationLink(
      "context",
      "docs/contexts/CONTEXT-MAP.md",
      "workflow/deep/CONTEXT.md",
    ),
    "documentation map docs/contexts/CONTEXT-MAP.md has non-direct context link: workflow/deep/CONTEXT.md",
  );
  assert.equal(
    validateDocumentationLink(
      "ADR",
      "docs/adr/ADR-MAP.md",
      "workflow/0001-decision.md",
    ),
    "documentation map docs/adr/ADR-MAP.md has non-direct ADR link: workflow/0001-decision.md",
  );
});

test("repository verification follows nested maps to a missing leaf", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "adw-map-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "docs/contexts"), { recursive: true });
  await writeFile(
    join(root, "CONTEXT-MAP.md"),
    "[上下文](docs/contexts/CONTEXT-MAP.md)\n",
  );
  await writeFile(
    join(root, "docs/contexts/CONTEXT-MAP.md"),
    "[工作流](workflow/CONTEXT.md)\n",
  );

  const report = await verifyRepository(root);

  assert.ok(report.errors.includes(
    "documentation map docs/contexts/CONTEXT-MAP.md references missing target: workflow/CONTEXT.md",
  ));
});

test("repository verification rejects documentation outside the Map tree", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "adw-orphan-map-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "docs/contexts/workflow"), { recursive: true });
  await mkdir(join(root, "docs/contexts/orphan"), { recursive: true });
  await writeFile(
    join(root, "CONTEXT-MAP.md"),
    "[上下文](docs/contexts/CONTEXT-MAP.md)\n",
  );
  await writeFile(
    join(root, "docs/contexts/CONTEXT-MAP.md"),
    "[工作流](workflow/CONTEXT.md)\n",
  );
  await writeFile(join(root, "docs/contexts/workflow/CONTEXT.md"), "# Workflow\n");
  await writeFile(join(root, "docs/contexts/orphan/CONTEXT.md"), "# Orphan\n");

  const report = await verifyRepository(root);

  assert.ok(report.errors.includes(
    "documentation tree context has orphan file: docs/contexts/orphan/CONTEXT.md",
  ));
});
