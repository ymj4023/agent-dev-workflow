import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  inspectCapabilities,
  inspectSkillProvenance,
  validateWorkflow,
} from "../src/workflow-contract.mjs";

const manifest = JSON.parse(
  await readFile(new URL("../manifests/workflow.json", import.meta.url), "utf8"),
);

test("the default workflow is a complete Matt-first delivery loop", () => {
  assert.deepEqual(validateWorkflow(manifest), []);
});

test("a horizontal implementation plan is rejected", () => {
  const invalid = structuredClone(manifest);
  invalid.invariants = invalid.invariants.filter(
    (invariant) => invariant !== "vertical-slices",
  );

  assert.match(validateWorkflow(invalid).join("\n"), /vertical-slices/);
});

test("terminology alignment must finish before requirements grilling", () => {
  const reordered = structuredClone(manifest);
  const align = reordered.phases.find((phase) => phase.id === "align");
  align.sequence = [
    "requirements-grilling",
    "terminology-alignment",
    "boundary-clarification",
  ];

  assert.match(
    validateWorkflow(reordered).join("\n"),
    /align sequence must be: terminology-alignment, requirements-grilling, boundary-clarification/,
  );

  const incomplete = structuredClone(manifest);
  const incompleteAlign = incomplete.phases.find((phase) => phase.id === "align");
  incompleteAlign.terminology_gate.per_term = ["definition", "scope"];

  assert.match(
    validateWorkflow(incomplete).join("\n"),
    /align terminology_gate per_term must include exactly: definition, scope, ambiguities/,
  );

  const unconfirmed = structuredClone(manifest);
  const unconfirmedAlign = unconfirmed.phases.find((phase) => phase.id === "align");
  unconfirmedAlign.terminology_gate.requires_explicit_confirmation = false;

  assert.match(
    validateWorkflow(unconfirmed).join("\n"),
    /align terminology_gate must require explicit confirmation/,
  );
});

test("ECC cannot become a hidden core dependency", () => {
  const invalid = structuredClone(manifest);
  invalid.integrations.ecc.required = true;

  assert.match(validateWorkflow(invalid).join("\n"), /ECC must remain optional/);
});

test("provider version floors cannot be downgraded or replaced with prose", () => {
  const downgraded = structuredClone(manifest);
  downgraded.integrations.matt.minimum_version = "1.2.2";
  const malformed = structuredClone(manifest);
  malformed.integrations.ecc.minimum_version = "latest";

  assert.match(validateWorkflow(downgraded).join("\n"), /Matt.*1\.2\.3/);
  assert.match(validateWorkflow(malformed).join("\n"), /ECC.*2\.2\.0/);
});

test("review runs after implementation in a fresh context", () => {
  const invalid = structuredClone(manifest);
  const review = invalid.phases.find((phase) => phase.id === "auto-review");
  review.fresh_context = false;

  assert.match(validateWorkflow(invalid).join("\n"), /fresh context/);
});

test("workflow dependencies must form a DAG", () => {
  const invalid = structuredClone(manifest);
  const align = invalid.phases.find((phase) => phase.id === "align");
  align.depends_on = ["merge"];

  assert.match(validateWorkflow(invalid).join("\n"), /cycle/);
});

test("implementation keeps Matt's vertical-slice TDD capability", () => {
  const invalid = structuredClone(manifest);
  const implementation = invalid.phases.find((phase) => phase.id === "implement");
  implementation.skills = ["implement"];

  assert.match(validateWorkflow(invalid).join("\n"), /implement.*tdd/);
});

test("required phase edges cannot be removed from the delivery path", () => {
  const invalid = structuredClone(manifest);
  const review = invalid.phases.find((phase) => phase.id === "auto-review");
  review.depends_on = [];

  assert.match(validateWorkflow(invalid).join("\n"), /auto-review.*implement/);
});

test("human rejection returns to the Journey instead of rewriting the Destination", () => {
  const invalid = structuredClone(manifest);
  const acceptance = invalid.phases.find(
    (phase) => phase.id === "human-acceptance",
  );
  acceptance.feedback_target = "destination";

  assert.match(validateWorkflow(invalid).join("\n"), /feedback.*journey/);
});

test("the canonical flow rejects provider-specific mandatory phases", () => {
  const invalid = structuredClone(manifest);
  invalid.phases.push({
    id: "openspec",
    mode: "afk",
    provider: "openspec",
    skills: ["openspec"],
    depends_on: ["destination"],
    gate: "A provider-specific artifact exists.",
  });

  assert.match(validateWorkflow(invalid).join("\n"), /unknown phase: openspec/);
});

test("capability inspection reports required and optional gaps separately", async () => {
  const result = await inspectCapabilities({
    skillsRoot: new URL("./fixtures/skills", import.meta.url),
    required: ["grilling", "tdd"],
    optional: ["verification-loop"],
  });

  assert.deepEqual(result.required.missing, ["tdd"]);
  assert.deepEqual(result.optional.missing, ["verification-loop"]);
  assert.equal(result.ok, false);
});

test("Matt provenance is verified from the openskills lock, not guessed from filenames", () => {
  const lock = {
    skills: {
      grilling: { source: "mattpocock/skills", ref: "v1.2.3" },
      tdd: { source: "someone/fork", ref: "v9.0.0" },
    },
  };
  const result = inspectSkillProvenance({
    lock,
    skillNames: ["grilling", "tdd"],
    source: "mattpocock/skills",
    minimumVersion: "1.2.3",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.verified, ["grilling"]);
  assert.deepEqual(result.mismatched, ["tdd"]);
});
