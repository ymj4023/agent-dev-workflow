import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDeliveryGate } from "../hooks/shared/delivery-guard.mjs";

test("delivery guard allows a verified repository", () => {
  const result = evaluateDeliveryGate({ status: 0, stdout: '{"ok":true}' });

  assert.deepEqual(result, { ok: true, exitCode: 0, message: "" });
});

test("delivery guard blocks completion when verification fails", () => {
  const result = evaluateDeliveryGate({
    status: 1,
    stdout: '{"ok":false,"errors":["missing evidence"]}',
  });

  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 2);
  assert.match(result.message, /missing evidence/);
});

test("delivery guard fails loudly when verification cannot run", () => {
  const result = evaluateDeliveryGate({
    status: null,
    error: new Error("runner unavailable"),
  });

  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 2);
  assert.match(result.message, /runner unavailable/);
});

test("delivery guard preserves the verifier error when JSON output is unavailable", () => {
  const result = evaluateDeliveryGate({
    status: 2,
    stdout: "",
    stderr: "ERROR: workflow manifest is malformed",
  });

  assert.equal(result.exitCode, 2);
  assert.match(result.message, /workflow manifest is malformed/);
});
