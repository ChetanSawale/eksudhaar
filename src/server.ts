import express from "express";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db, getEvent, getAgentLog, logAgent, nowIso } from "./db.js";
import { CorrectionAgent } from "./agent/orchestrator.js";
import { ocrImage } from "./verify/ocr.js";
import { planFor, getRegistry, REGISTRIES, EVENT_TYPE_LABELS, type EventType } from "./registries/catalog.js";
import { buildPackPdf } from "./pack/pdf.js";
import { parseSimInput, runSimulation } from "./simulate/engine.js";
import { DOCUMENTS, RULES, STATES } from "./laws/index.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const upload = multer({
  dest: path.join(process.cwd(), "data", "uploads"),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS);

/** Create an identity event (JSON or multipart with a document scan). */
app.post("/api/events", upload.single("document"), async (req, res) => {
  try {
    const b = req.body as Record<string, string>;
    const type = b.type as EventType;
    if (!EVENT_TYPES.includes(type)) return res.status(400).json({ error: "invalid event type" });

    let docText = (b.doc_text || "").trim() || null;
    // If a file was uploaded, try OCR; otherwise keep any pasted text.
    if (req.file && !docText) {
      docText = await ocrImage(req.file.path);
    }

    const id = randomUUID();
    const extra = b.extra ? JSON.parse(b.extra as string) : {};
    db.prepare(
      `INSERT INTO events (id, type, old_name, new_name, old_dob, new_dob, old_address, new_address,
        extra_json, doc_filename, doc_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, type,
      b.old_name?.trim() || null, b.new_name?.trim() || null,
      b.old_dob?.trim() || null, b.new_dob?.trim() || null,
      b.old_address?.trim() || null, b.new_address?.trim() || null,
      JSON.stringify(extra),
      req.file ? req.file.originalname : null,
      docText,
      nowIso(),
    );

    const agent = new CorrectionAgent(id);
    await agent.intake();
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** Seed the demo event (simulated Gazette notification) for a 2-minute demo. */
app.post("/api/demo/seed", async (_req, res) => {
  try {
    const id = randomUUID();
    const docText = [
      "EXTRAORDINARY",
      "GOVERNMENT OF MAHARASHTRA — GAZETTE NOTIFICATION",
      "Gazette Notification No. MHA-2026/18473 dated 12/08/2026",
      "",
      "It is hereby notified for general information that I, PRIYA SHARNA,",
      "daughter of Ramesh Sharna, resident of 402, Sea View CHS, Bandra West,",
      "Mumbai 400050, have changed my name from PRIYA SHARNA to PRIYA SHARMA",
      "for all future purposes, vide affidavit dated 28/07/2026.",
      "",
      "Old Name: PRIYA SHARNA",
      "New Name: PRIYA SHARMA",
      "Reason: correction of spelling error in birth records",
    ].join("\n");
    db.prepare(
      `INSERT INTO events (id, type, old_name, new_name, old_dob, new_dob, old_address, new_address,
        extra_json, doc_filename, doc_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, "name_correction", "Priya Sharna", "Priya Sharma",
      null, null, null, null,
      JSON.stringify({ gazetteNo: "MHA-2026/18473", gazetteDate: "12/08/2026" }),
      "gazette-demo.txt", docText, nowIso(),
    );
    const agent = new CorrectionAgent(id);
    await agent.intake();
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/api/events/:id", (req, res) => {
  const e = getEvent(req.params.id);
  if (!e) return res.status(404).json({ error: "not found" });
  res.json({ ...e, type_label: EVENT_TYPE_LABELS[e.type as EventType] });
});

/** Run document verification. */
app.post("/api/events/:id/verify", async (req, res) => {
  try {
    const agent = new CorrectionAgent(req.params.id);
    const result = await agent.verify();
    const row = db
      .prepare("SELECT passed, checks_json, summary FROM verifications WHERE event_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(req.params.id) as { passed: number; checks_json: string; summary: string } | undefined;
    res.json({ passed: result.passed, checks: row ? JSON.parse(row.checks_json) : [], summary: row?.summary || "" });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** Ordered propagation plan + consent state. */
app.get("/api/events/:id/plan", (req, res) => {
  const e = getEvent(req.params.id);
  if (!e) return res.status(404).json({ error: "not found" });
  const agent = new CorrectionAgent(e.id);
  const registries = agent.plan();
  const consents = Object.fromEntries(
    (db.prepare("SELECT registry, consented FROM consents WHERE event_id = ?").all(e.id) as Array<{ registry: string; consented: number }>).map(
      (c) => [c.registry, c.consented === 1],
    ),
  );
  res.json({ plan: registries, consents });
});

/** Record consent for a registry. */
app.post("/api/events/:id/consent", (req, res) => {
  try {
    const { registry, consented } = req.body as { registry: string; consented: boolean };
    if (!getRegistry(registry)) return res.status(400).json({ error: "unknown registry" });
    new CorrectionAgent(req.params.id).setConsent(registry, !!consented);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** Generate the correction pack PDF for consented registries. */
app.post("/api/events/:id/pack", async (req, res) => {
  try {
    const e = getEvent(req.params.id);
    if (!e) return res.status(404).json({ error: "not found" });
    const consented = (
      db.prepare("SELECT registry FROM consents WHERE event_id = ? AND consented = 1").all(e.id) as Array<{ registry: string }>
    ).map((c) => c.registry);
    if (consented.length === 0) return res.status(400).json({ error: "no consented registries" });
    const bankNames = Array.isArray(req.body?.bank_names)
      ? (req.body.bank_names as string[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
      : [];
    const pdf = await buildPackPdf(e, consented, bankNames);
    logAgent(e.id, "generate", `Correction pack generated: ${consented.length} registries, ${bankNames.length} bank letter(s).`, {
      registries: consented,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="eksudhaar-pack-${e.id.slice(0, 8)}.pdf"`);
    res.send(Buffer.from(pdf));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** Tracker: per-registry statuses. */
app.get("/api/events/:id/tracker", (req, res) => {
  const e = getEvent(req.params.id);
  if (!e) return res.status(404).json({ error: "not found" });
  const plan = planFor(e.type as EventType);
  const rows = Object.fromEntries(
    (db.prepare("SELECT registry, status, note, updated_at FROM registry_status WHERE event_id = ?").all(e.id) as Array<{
      registry: string; status: string; note: string | null; updated_at: string;
    }>).map((r) => [r.registry, r]),
  );
  res.json({ plan: plan.map((r) => ({ ...r, tracking: rows[r.id] || { status: "pending", note: null } })) });
});

app.post("/api/events/:id/tracker/:registry", (req, res) => {
  try {
    if (!getRegistry(req.params.registry)) return res.status(400).json({ error: "unknown registry" });
    const { status, note } = req.body as { status: string; note?: string };
    new CorrectionAgent(req.params.id).advanceRegistry(req.params.registry, status, note);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** Nudge: draft a reminder for a stuck registry. */
app.post("/api/events/:id/nudge/:registry", async (req, res) => {
  try {
    const reg = getRegistry(req.params.registry);
    if (!reg) return res.status(400).json({ error: "unknown registry" });
    const msg = await new CorrectionAgent(req.params.id).nudge(reg.id, reg.short, reg.steps[0]?.title || "follow up");
    res.json({ message: msg });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/api/events/:id/agent-log", (req, res) => {
  res.json({ log: getAgentLog(req.params.id) });
});

app.get("/api/event-types", (_req, res) => {
  res.json({ types: EVENT_TYPE_LABELS });
});

/** Registry catalog with online-first paths (for badges + zero-visit plan). */
app.get("/api/registries", (_req, res) => {
  res.json({
    registries: REGISTRIES.map((r) => ({
      id: r.id,
      name: r.name,
      short: r.short,
      fee: r.fee,
      officialUrl: r.officialUrl,
      helpline: r.helpline,
      appliesTo: r.appliesTo,
      online: r.online,
    })),
  });
});

/** Pre-filing simulator: validate an application against the rules knowledge base. */
app.post("/api/simulate", (req, res) => {
  try {
    const input = parseSimInput(req.body);
    res.json(runSimulation(input));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/** Simulator metadata: event types, states, documents, and the knowledge base. */
app.get("/api/simulate/meta", (_req, res) => {
  const sources = [...new Set(RULES.map((r) => r.sourceLabel))];
  res.json({
    eventTypes: EVENT_TYPE_LABELS,
    states: STATES,
    documents: DOCUMENTS,
    rules: RULES.map((r) => ({
      id: r.id,
      label: r.label,
      jurisdiction: r.jurisdiction,
      sourceLabel: r.sourceLabel,
      severity: r.severity,
      documents: r.documents,
      eventTypes: r.eventTypes,
    })),
    sourceCount: sources.length,
    ruleCount: RULES.length,
  });
});

app.use(express.static(path.join(process.cwd(), "public")));

export default app;
