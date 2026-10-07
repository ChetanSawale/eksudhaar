/**
 * EkSudhaar pre-filing simulator engine.
 *
 * A citizen builds their correction application on the free portal; the engine
 * runs every applicable rule from the knowledge base and returns a live
 * SUCCESS SCORE (0–100).
 *
 * Honest framing (owner requirement): 100% means the application passes every
 * check in EkSudhaar's rules knowledge base — file with confidence. It is NOT
 * a guarantee of government approval; final approval always rests with the
 * issuing authority (UIDAI, Income Tax Department, etc.).
 */
import { EVENT_TYPE_LABELS, planFor, type EventType } from "../registries/catalog.js";
import {
  DOCUMENT_IDS,
  REGISTRY_FEES,
  TYPICAL_EXTRA_COST_PER_ATTEMPT,
  rulesFor,
  type SimInput,
  type SimResult,
} from "../laws/index.js";

export const SIM_DISCLAIMER =
  "EkSudhaar checks your application against its rules knowledge base (compiled from public sources). " +
  "A 100% score means every check passes — file with confidence. " +
  "Final approval always rests with the issuing authority (UIDAI, Income Tax Department, etc.). " +
  "Verify critical cases before filing.";

const EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS);

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((s) => String(s)) : [];
}

function asFields(v: unknown): SimInput["fields"] {
  const f = (v || {}) as Record<string, unknown>;
  const num = (k: string): number | undefined => {
    const n = Number(f[k]);
    return f[k] === undefined || f[k] === "" || isNaN(n) ? undefined : n;
  };
  const bool = (k: string): boolean | undefined =>
    f[k] === undefined || f[k] === "" ? undefined : f[k] === true || f[k] === "true";
  const scope = f.nameScope === "minor" || f.nameScope === "major" ? f.nameScope : undefined;
  return {
    oldName: String(f.oldName || "") || undefined,
    newName: String(f.newName || "") || undefined,
    nameScope: scope,
    previousNameCorrections: num("previousNameCorrections"),
    oldDob: String(f.oldDob || "") || undefined,
    newDob: String(f.newDob || "") || undefined,
    dobCorrectedBefore: bool("dobCorrectedBefore"),
    newAddress: String(f.newAddress || "") || undefined,
    gazetteNumber: String(f.gazetteNumber || "") || undefined,
    gazetteDate: String(f.gazetteDate || "") || undefined,
    epicNumber: String(f.epicNumber || "") || undefined,
  };
}

/** Validate raw JSON into a SimInput; throws on invalid input. */
export function parseSimInput(body: unknown): SimInput {
  const b = (body || {}) as Record<string, unknown>;
  const eventType = String(b.eventType || "");
  if (!EVENT_TYPES.includes(eventType)) throw new Error("invalid eventType");
  const documents = asStringArray(b.documents).filter((d) => DOCUMENT_IDS.has(d));
  const unknown = asStringArray(b.documents).filter((d) => !DOCUMENT_IDS.has(d));
  if (unknown.length > 0) throw new Error(`unknown document ids: ${unknown.join(", ")}`);
  return {
    eventType: eventType as EventType,
    state: String(b.state || ""),
    documents,
    fields: asFields(b.fields),
  };
}

export function runSimulation(input: SimInput): SimResult {
  const rules = rulesFor(input.eventType, input.state);
  const checks = rules.map((rule) => {
    let pass = true;
    let detail = "";
    try {
      const r = rule.evaluate(input);
      pass = r.pass;
      detail = r.detail;
    } catch {
      pass = false;
      detail = "This check could not be evaluated — verify it manually before filing.";
    }
    return {
      ruleId: rule.id,
      label: rule.label,
      jurisdiction: rule.jurisdiction,
      sourceLabel: rule.sourceLabel,
      severity: rule.severity,
      pass,
      detail,
      ...(pass ? {} : { advice: rule.failAdvice }),
    };
  });

  const scored = checks.filter((c) => c.severity !== "info");
  const passed = scored.filter((c) => c.pass).length;
  const score = scored.length === 0 ? 100 : Math.round((100 * passed) / scored.length);

  const failing = checks.filter((c) => !c.pass);
  const firstError = failing.find((c) => c.severity === "error");
  const firstWarning = failing.find((c) => c.severity === "warning");
  const fix = firstError || firstWarning || null;

  // Money at risk: official fees across registries relevant to this event type.
  const relevant = new Set(planFor(input.eventType).map((r) => r.id));
  const feeBreakdown = REGISTRY_FEES.filter((f) => relevant.has(f.id));
  const moneyAtRisk = feeBreakdown.reduce((s, f) => s + f.fee, 0);
  const estimatedExtras = TYPICAL_EXTRA_COST_PER_ATTEMPT * feeBreakdown.filter((f) => f.fee > 0).length;

  // Zero-visit plan: filing order with online vs visit-required per registry.
  const zeroVisitPlan = planFor(input.eventType).map((r) => ({
    registryId: r.id,
    name: r.name,
    feeLabel: r.fee,
    fullyOnline: r.online.fullyOnline,
    mustVisit: r.online.mustVisit,
    visitReason: r.online.visitReason,
    onlineSteps: r.online.onlineSteps,
  }));

  return {
    score,
    checks,
    moneyAtRisk,
    feeBreakdown,
    readyToFile: score === 100,
    nextFix: fix ? { ruleId: fix.ruleId, label: fix.label, advice: fix.advice || "" } : null,
    rulesEvaluated: checks.length,
    disclaimer: SIM_DISCLAIMER,
    estimatedExtras,
    zeroVisitPlan,
  };
}
