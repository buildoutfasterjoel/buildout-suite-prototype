import { describe, it, expect } from "vitest";
import { convertSchemaToJsonSchema } from "@tanstack/ai";
import type { ZodType } from "zod";
import {
  FilterSpec,
  EmailDraftSpec,
  CallListSpec,
  DocSpec,
  ProspectSpec,
  ContactBriefSpec,
  StrategySpec,
  CallTurnSpec,
  CallRecapSpec,
  CallBriefSpec,
  DraftReplySpec,
} from "./schemas";

/**
 * Anthropic's strict structured output (`output_config.format.schema`) rejects
 * two things the zod→JSON-schema conversion can emit: array size bounds
 * (`maxItems`/`minItems`, from `.max()`/`.min()` on an array) and any `object`
 * node without an explicit `additionalProperties: false` — notably the object
 * inside a NULLABLE object's `anyOf`, which the adapter's compatibility pass
 * skips (it only annotates props whose top-level `type` is `"object"`).
 *
 * This walks the EXACT schema the adapter sends (via `convertSchemaToJsonSchema(
 * schema, { forStructuredOutput: true })`, the same transform the runtime uses)
 * and asserts every generator's output schema is Anthropic-compatible, so a
 * future `.max()` on an array or a nullable object is caught here instead of as
 * a runtime 400 that silently degrades to the deterministic fallback.
 */
function anthropicCompatViolations(node: unknown, path = "$", out: string[] = []): string[] {
  if (!node || typeof node !== "object") return out;
  const n = node as Record<string, unknown>;
  if ("maxItems" in n) out.push(`${path}: unsupported maxItems`);
  if ("minItems" in n) out.push(`${path}: unsupported minItems`);
  if (n.type === "object" && n.additionalProperties !== false) {
    out.push(`${path}: object without additionalProperties:false`);
  }
  if (n.properties && typeof n.properties === "object") {
    for (const [k, v] of Object.entries(n.properties as Record<string, unknown>)) {
      anthropicCompatViolations(v, `${path}.properties.${k}`, out);
    }
  }
  if (n.items) {
    const items = Array.isArray(n.items) ? n.items : [n.items];
    items.forEach((it, i) => anthropicCompatViolations(it, `${path}.items[${i}]`, out));
  }
  for (const key of ["anyOf", "oneOf", "allOf"]) {
    if (Array.isArray(n[key])) {
      (n[key] as unknown[]).forEach((sub, i) =>
        anthropicCompatViolations(sub, `${path}.${key}[${i}]`, out),
      );
    }
  }
  return out;
}

const LLM_SCHEMAS: Array<[string, ZodType]> = [
  ["FilterSpec", FilterSpec],
  ["EmailDraftSpec", EmailDraftSpec],
  ["CallListSpec", CallListSpec],
  ["DocSpec", DocSpec],
  ["ProspectSpec", ProspectSpec],
  ["ContactBriefSpec", ContactBriefSpec],
  ["StrategySpec", StrategySpec],
  ["CallTurnSpec", CallTurnSpec],
  ["CallRecapSpec", CallRecapSpec],
  ["CallBriefSpec", CallBriefSpec],
  ["DraftReplySpec", DraftReplySpec],
];

describe("Anthropic structured-output schema compatibility", () => {
  it.each(LLM_SCHEMAS)("%s converts to an Anthropic-compatible schema", (_name, schema) => {
    const json = convertSchemaToJsonSchema(schema, { forStructuredOutput: true });
    expect(anthropicCompatViolations(json)).toEqual([]);
  });
});
