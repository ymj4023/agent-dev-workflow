import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Keep the trusted baseline outside the editable manifest so a bad manifest cannot weaken its own validator or doctor checks.
const REQUIRED_PHASE_CONTRACTS = Object.freeze({
  align: Object.freeze({
    mode: "hitl",
    provider: "matt",
    skills: Object.freeze(["grill-with-docs", "domain-modeling"]),
    depends_on: Object.freeze([]),
    sequence: Object.freeze([
      "terminology-alignment",
      "requirements-grilling",
      "boundary-clarification",
    ]),
    terminologyGate: Object.freeze({
      perTerm: Object.freeze(["definition", "scope", "ambiguities"]),
      requiresExplicitConfirmation: true,
    }),
  }),
  destination: Object.freeze({
    mode: "hitl",
    provider: "matt",
    skills: Object.freeze(["to-spec"]),
    depends_on: Object.freeze(["align"]),
  }),
  journey: Object.freeze({
    mode: "hitl",
    provider: "matt",
    skills: Object.freeze(["to-tickets"]),
    depends_on: Object.freeze(["destination"]),
  }),
  implement: Object.freeze({
    mode: "afk",
    provider: "matt",
    skills: Object.freeze(["implement", "tdd"]),
    depends_on: Object.freeze(["journey"]),
  }),
  "auto-review": Object.freeze({
    mode: "afk",
    provider: "matt",
    skills: Object.freeze(["code-review"]),
    depends_on: Object.freeze(["implement"]),
  }),
  "human-acceptance": Object.freeze({
    mode: "hitl",
    provider: "core",
    skills: Object.freeze(["human-qa"]),
    depends_on: Object.freeze(["auto-review"]),
  }),
  merge: Object.freeze({
    mode: "hitl",
    provider: "core",
    skills: Object.freeze(["delivery-verification"]),
    depends_on: Object.freeze(["human-acceptance"]),
  }),
});

const REQUIRED_PHASES = Object.freeze(Object.keys(REQUIRED_PHASE_CONTRACTS));

const REQUIRED_INVARIANTS = [
  "matt-first",
  "terminology-before-grilling",
  "repo-first-assets",
  "vertical-slices",
  "one-ticket-per-fresh-context",
  "fresh-context-review",
  "human-acceptance",
  "fail-loudly",
];

function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value ?? "");
  return match ? match.slice(1).map(Number) : null;
}

function versionAtLeast(actual, minimum) {
  const left = parseVersion(actual);
  const right = parseVersion(minimum);
  if (!left || !right) return false;

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}

function hasCycle(phases) {
  const dependencies = new Map(
    phases.map((phase) => [phase.id, phase.depends_on ?? []]),
  );
  const visiting = new Set();
  const visited = new Set();

  function visit(id) {
    // `visiting` is the active DFS stack; seeing an ID twice here proves a back edge.
    if (visiting.has(id)) return true;
    if (visited.has(id) || !dependencies.has(id)) return false;

    visiting.add(id);
    for (const dependency of dependencies.get(id)) {
      if (visit(dependency)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  return [...dependencies.keys()].some(visit);
}

function sameMembers(actual = [], expected = []) {
  return actual.length === expected.length &&
    expected.every((value) => actual.includes(value));
}

function sameSequence(actual = [], expected = []) {
  return actual.length === expected.length &&
    expected.every((value, index) => actual[index] === value);
}

export function validateWorkflow(workflow) {
  const errors = [];
  const phases = Array.isArray(workflow?.phases) ? workflow.phases : [];
  const phaseIds = phases.map((phase) => phase.id);
  const phaseIdSet = new Set(phaseIds);
  const invariants = new Set(workflow?.invariants ?? []);

  if (workflow?.schema_version !== 1) {
    errors.push("schema_version must be 1");
  }
  if (workflow?.integrations?.matt?.required !== true) {
    errors.push("Matt must be the required workflow provider");
  }
  if (workflow?.integrations?.ecc?.required !== false) {
    errors.push("ECC must remain optional");
  }
  if (!versionAtLeast(workflow?.integrations?.matt?.minimum_version, "1.2.3")) {
    errors.push("Matt minimum_version must be valid semver at or above 1.2.3");
  }
  if (!versionAtLeast(workflow?.integrations?.ecc?.minimum_version, "2.2.0")) {
    errors.push("ECC minimum_version must be valid semver at or above 2.2.0");
  }

  for (const invariant of REQUIRED_INVARIANTS) {
    if (!invariants.has(invariant)) {
      errors.push(`missing required invariant: ${invariant}`);
    }
  }
  for (const phaseId of REQUIRED_PHASES) {
    if (!phaseIdSet.has(phaseId)) {
      errors.push(`missing required phase: ${phaseId}`);
    }
  }
  for (const phaseId of phaseIds) {
    if (!REQUIRED_PHASES.includes(phaseId)) {
      errors.push(`unknown phase: ${phaseId}`);
    }
  }
  if (phaseIdSet.size !== phaseIds.length) {
    errors.push("phase ids must be unique");
  }

  for (const phase of phases) {
    if (!phase.id || !phase.mode || !phase.provider || !phase.gate) {
      errors.push(`phase ${phase.id ?? "<unknown>"} is missing required fields`);
    }
    for (const dependency of phase.depends_on ?? []) {
      if (!phaseIdSet.has(dependency)) {
        errors.push(`phase ${phase.id} references missing dependency: ${dependency}`);
      }
    }
  }


  for (const [phaseId, contract] of Object.entries(REQUIRED_PHASE_CONTRACTS)) {
    const phase = phases.find((candidate) => candidate.id === phaseId);
    if (!phase) continue;
    if (phase.mode !== contract.mode) {
      errors.push(`phase ${phaseId} mode must be ${contract.mode}`);
    }
    if (phase.provider !== contract.provider) {
      errors.push(`phase ${phaseId} provider must be ${contract.provider}`);
    }
    if (!sameMembers(phase.skills, contract.skills)) {
      errors.push(`phase ${phaseId} skills must include exactly: ${contract.skills.join(", ")}`);
    }
    if (!sameMembers(phase.depends_on, contract.depends_on)) {
      errors.push(`phase ${phaseId} dependencies must include exactly: ${contract.depends_on.join(", ") || "none"}`);
    }
    if (contract.sequence && !sameSequence(phase.sequence, contract.sequence)) {
      errors.push(`phase ${phaseId} sequence must be: ${contract.sequence.join(", ")}`);
    }
    if (contract.terminologyGate) {
      if (!sameMembers(
        phase.terminology_gate?.per_term,
        contract.terminologyGate.perTerm,
      )) {
        errors.push(
          `phase ${phaseId} terminology_gate per_term must include exactly: ${contract.terminologyGate.perTerm.join(", ")}`,
        );
      }
      if (phase.terminology_gate?.requires_explicit_confirmation !==
          contract.terminologyGate.requiresExplicitConfirmation) {
        errors.push(`phase ${phaseId} terminology_gate must require explicit confirmation`);
      }
    }
  }

  const review = phases.find((phase) => phase.id === "auto-review");
  if (review && review.fresh_context !== true) {
    errors.push("auto-review must run in a fresh context");
  }
  const acceptance = phases.find((phase) => phase.id === "human-acceptance");
  if (acceptance && acceptance.feedback_target !== "journey") {
    errors.push("human-acceptance feedback must return to journey");
  }
  if (hasCycle(phases)) {
    errors.push("phase dependencies contain a cycle");
  }

  return errors;
}

function toPath(root) {
  return root instanceof URL ? fileURLToPath(root) : resolve(root);
}

async function findSkills(skillsRoot, skillNames) {
  const root = toPath(skillsRoot);
  const checks = await Promise.all(
    skillNames.map(async (skill) => {
      try {
        await access(resolve(root, skill, "SKILL.md"));
        return [skill, true];
      } catch {
        return [skill, false];
      }
    }),
  );

  return {
    found: checks.filter(([, found]) => found).map(([skill]) => skill),
    missing: checks.filter(([, found]) => !found).map(([skill]) => skill),
  };
}

export function inspectSkillProvenance({
  lock,
  skillNames,
  source,
  minimumVersion,
}) {
  const verified = [];
  const unverified = [];
  const mismatched = [];
  const outdated = [];

  for (const skill of skillNames) {
    const entry = lock?.skills?.[skill];
    if (!entry) {
      unverified.push(skill);
    } else if (entry.source !== source) {
      mismatched.push(skill);
    } else if (!versionAtLeast(entry.ref, minimumVersion)) {
      outdated.push(skill);
    } else {
      verified.push(skill);
    }
  }

  return {
    ok: verified.length === skillNames.length,
    source,
    minimum_version: minimumVersion,
    verified,
    unverified,
    mismatched,
    outdated,
  };
}

export async function inspectCapabilities({
  skillsRoot,
  required,
  optional,
  requiredProvenance,
}) {
  const [requiredResult, optionalResult] = await Promise.all([
    findSkills(skillsRoot, required),
    findSkills(skillsRoot, optional),
  ]);
  const provenance = requiredProvenance
    ? inspectSkillProvenance({
        ...requiredProvenance,
        skillNames: required,
      })
    : null;

  return {
    ok: requiredResult.missing.length === 0 && (provenance?.ok ?? true),
    skills_root: toPath(skillsRoot),
    required: { ...requiredResult, provenance },
    optional: optionalResult,
  };
}

export const workflowRequirements = Object.freeze({
  phases: Object.freeze([...REQUIRED_PHASES]),
  invariants: Object.freeze([...REQUIRED_INVARIANTS]),
  mattSkills: Object.freeze([
    ...new Set(
      Object.values(REQUIRED_PHASE_CONTRACTS)
        .filter((phase) => phase.provider === "matt")
        .flatMap((phase) => phase.skills),
    ),
  ]),
});
