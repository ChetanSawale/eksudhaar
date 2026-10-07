/**
 * Types for the EkSudhaar legal/rules knowledge base.
 *
 * IMPORTANT: this knowledge base is compiled from well-established public
 * guidance (UIDAI SOPs, registry help pages, widely documented procedures).
 * It is a citizen aid, not legal advice. Rules are encoded conservatively:
 * anything uncertain is an "info" check with a verify note, never a hard fail.
 */
import type { EventType } from "../registries/catalog.js";

export type Jurisdiction =
  | "national"
  | "Maharashtra"
  | "Delhi"
  | "Uttar Pradesh"
  | "West Bengal"
  | "Tamil Nadu";

export type Severity = "error" | "warning" | "info";

export interface SimFields {
  oldName?: string;
  newName?: string;
  /** minor = spelling-level fix; major = complete name change */
  nameScope?: "minor" | "major";
  /** how many Aadhaar name corrections the citizen has already done (lifetime) */
  previousNameCorrections?: number;
  oldDob?: string;
  newDob?: string;
  dobCorrectedBefore?: boolean;
  newAddress?: string;
  gazetteNumber?: string;
  gazetteDate?: string;
  epicNumber?: string;
}

export interface SimInput {
  eventType: EventType;
  /** state name, e.g. "Maharashtra"; "" or "Other" = national rules only */
  state: string;
  /** document ids the citizen already has (see DOCUMENTS in rules.ts) */
  documents: string[];
  fields: SimFields;
}

export interface RuleEvaluation {
  pass: boolean;
  detail: string;
}

export interface LawRule {
  id: string;
  jurisdiction: Jurisdiction;
  /** human-readable registry/document names this rule touches */
  documents: string[];
  eventTypes: EventType[];
  label: string;
  /** generic public-source label — never an invented section number or URL */
  sourceLabel: string;
  severity: Severity;
  /** plain-language fix shown when the check fails */
  failAdvice: string;
  evaluate: (input: SimInput) => RuleEvaluation;
}

export interface DocumentDef {
  id: string;
  label: string;
  hint: string;
}

export interface SimCheck {
  ruleId: string;
  label: string;
  jurisdiction: Jurisdiction;
  sourceLabel: string;
  severity: Severity;
  pass: boolean;
  detail: string;
  /** present only when the check failed */
  advice?: string;
}

export interface RegistryFee {
  id: string;
  name: string;
  /** official filing fee in INR that a failed attempt wastes (0 = free) */
  fee: number;
  feeLabel: string;
}

/** One step of the "zero-visit plan": what can be done online vs what needs a visit. */
export interface ZeroVisitStep {
  registryId: string;
  name: string;
  feeLabel: string;
  fullyOnline: boolean;
  mustVisit: boolean;
  visitReason: string;
  onlineSteps: string[];
}

export interface SimResult {
  score: number;
  checks: SimCheck[];
  /** sum of official fees across relevant registries — what one failed round wastes */
  moneyAtRisk: number;
  feeBreakdown: RegistryFee[];
  /** rough typical extras (agent, travel, lost day) per failed fee-bearing attempt */
  estimatedExtras: number;
  /** true only when score === 100: every knowledge-base check passes */
  readyToFile: boolean;
  nextFix: { ruleId: string; label: string; advice: string } | null;
  rulesEvaluated: number;
  /** honest-framing disclaimer, echoed so every client can display it */
  disclaimer: string;
  /**
   * Zero-visit plan: registries in filing order, each marked online vs
   * visit-required. Everything doable online is done from home; a visit
   * happens only where legally required.
   */
  zeroVisitPlan: ZeroVisitStep[];
}
