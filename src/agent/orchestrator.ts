import { randomUUID } from "node:crypto";
import { db, getEvent, logAgent, nowIso, type EventRow } from "../db.js";
import { getProvider, type EventFields } from "./llm.js";
import { verifyEvent } from "../verify/checks.js";
import { planFor, type EventType } from "../registries/catalog.js";

export type AgentStage = "intake" | "verify" | "plan" | "consent" | "generate" | "track";

/**
 * The EkSudhaar correction agent. It walks an identity event through a
 * six-stage pipeline, calling the LLM at decision points and logging every
 * step so the citizen can see exactly what the agent did and why.
 */
export class CorrectionAgent {
  private llm = getProvider();

  constructor(private eventId: string) {}

  private log(stage: AgentStage, message: string, data?: unknown) {
    logAgent(this.eventId, stage, message, data);
  }

  private event(): EventRow {
    const e = getEvent(this.eventId);
    if (!e) throw new Error("event not found");
    return e;
  }

  /** Stage 1 — record the event and enrich fields from document text. */
  async intake(): Promise<Partial<EventFields>> {
    const e = this.event();
    this.log("intake", `Event recorded: ${e.type} (${e.old_name || "?"} → ${e.new_name || "?"})`, { type: e.type });
    let extracted: Partial<EventFields> = {};
    if (e.doc_text && e.doc_text.length > 20) {
      this.log("intake", `Extracting fields from document text (LLM: ${this.llm.name})…`);
      extracted = await this.llm.extractEventFields(e.doc_text, e.type);
      const updates: string[] = [];
      if (extracted.gazetteNo && !this.hasExtra(e, "gazetteNo")) updates.push(`gazetteNo=${extracted.gazetteNo}`);
      if (extracted.gazetteDate && !this.hasExtra(e, "gazetteDate")) updates.push(`gazetteDate=${extracted.gazetteDate}`);
      if (updates.length > 0) {
        const extra = { ...(JSON.parse(e.extra_json || "{}") as Record<string, unknown>), ...extracted };
        db.prepare("UPDATE events SET extra_json = ? WHERE id = ?").run(JSON.stringify(extra), e.id);
      }
      this.log("intake", `Extracted ${Object.keys(extracted).length} field(s) from the document.`, extracted);
    } else {
      this.log("intake", "No document text to extract from — using the details you entered.", {});
    }
    return extracted;
  }

  private hasExtra(e: EventRow, key: string): boolean {
    try {
      return key in (JSON.parse(e.extra_json || "{}") as Record<string, unknown>);
    } catch {
      return false;
    }
  }

  /** Stage 2 — verify the supporting document. */
  async verify(): Promise<{ passed: boolean; checkCount: number }> {
    const e = this.event();
    this.log("verify", "Running document verification checks…");
    const outcome = verifyEvent(e);
    const failures = outcome.checks.filter((c) => !c.passed).map((c) => `${c.label}: ${c.detail}`);
    const explanation = await this.llm.explainVerification(failures);
    db.prepare(
      "INSERT INTO verifications (id, event_id, passed, checks_json, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(randomUUID(), e.id, outcome.passed ? 1 : 0, JSON.stringify(outcome.checks), explanation, nowIso());
    this.log(
      "verify",
      outcome.passed
        ? `Verification PASSED (${outcome.checks.length} checks).`
        : `Verification FAILED — ${failures.length} check(s) need attention.`,
      { passed: outcome.passed, explanation },
    );
    return { passed: outcome.passed, checkCount: outcome.checks.length };
  }

  /** Stage 3 — build the ordered propagation plan. */
  plan() {
    const e = this.event();
    const registries = planFor(e.type as EventType);
    // Initialise tracker rows + default consents (all on; citizen can toggle off).
    for (const r of registries) {
      db.prepare(
        "INSERT OR IGNORE INTO registry_status (event_id, registry, status, note, updated_at) VALUES (?, ?, 'pending', NULL, ?)",
      ).run(e.id, r.id, nowIso());
      db.prepare(
        "INSERT OR IGNORE INTO consents (event_id, registry, consented, consented_at) VALUES (?, ?, 1, ?)",
      ).run(e.id, r.id, nowIso());
    }
    this.log(
      "plan",
      `Propagation plan ready: ${registries.length} registries, ordered so dependencies complete first.`,
      { order: registries.map((r) => r.id) },
    );
    return registries;
  }

  /** Stage 4 — consent is citizen-driven via the UI; the agent just records it. */
  setConsent(registry: string, consented: boolean) {
    db.prepare(
      "INSERT INTO consents (event_id, registry, consented, consented_at) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(event_id, registry) DO UPDATE SET consented = excluded.consented, consented_at = excluded.consented_at",
    ).run(this.eventId, registry, consented ? 1 : 0, nowIso());
    db.prepare("UPDATE registry_status SET status = ?, updated_at = ? WHERE event_id = ? AND registry = ?").run(
      consented ? "consented" : "pending",
      nowIso(),
      this.eventId,
      registry,
    );
    this.log("consent", `${consented ? "Consent recorded" : "Consent withdrawn"} for ${registry}.`, { registry, consented });
  }

  /** Stage 6 — advance a registry's tracking status. */
  advanceRegistry(registry: string, status: string, note?: string) {
    const allowed = ["pending", "consented", "in_progress", "filed", "acknowledged", "completed", "rejected"];
    if (!allowed.includes(status)) throw new Error(`invalid status: ${status}`);
    db.prepare("UPDATE registry_status SET status = ?, note = ?, updated_at = ? WHERE event_id = ? AND registry = ?").run(
      status,
      note || null,
      nowIso(),
      this.eventId,
      registry,
    );
    this.log("track", `${registry}: status → ${status}${note ? ` (${note})` : ""}`, { registry, status });
    if (status === "rejected") {
      this.log("track", `Rejection on ${registry} — agent will draft a retry checklist at the next nudge.`, { registry });
    }
  }

  /** Draft a nudge for registries stuck in progress. */
  async nudge(registryId: string, registryName: string, nextStep: string): Promise<string> {
    const row = db
      .prepare("SELECT updated_at FROM registry_status WHERE event_id = ? AND registry = ?")
      .get(this.eventId, registryId) as { updated_at: string } | undefined;
    const days = row ? Math.max(0, Math.floor((Date.now() - Date.parse(row.updated_at)) / 86400000)) : 0;
    const msg = await this.llm.draftReminder(registryName, days, nextStep);
    this.log("track", `Nudge drafted for ${registryName}.`, { message: msg });
    return msg;
  }
}
