import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "eksudhaar.sqlite"));

db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  old_name TEXT, new_name TEXT,
  old_dob TEXT, new_dob TEXT,
  old_address TEXT, new_address TEXT,
  extra_json TEXT,
  doc_filename TEXT,
  doc_text TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  passed INTEGER NOT NULL,
  checks_json TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS consents (
  event_id TEXT NOT NULL,
  registry TEXT NOT NULL,
  consented INTEGER NOT NULL,
  consented_at TEXT NOT NULL,
  PRIMARY KEY (event_id, registry)
);
CREATE TABLE IF NOT EXISTS registry_status (
  event_id TEXT NOT NULL,
  registry TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (event_id, registry)
);
CREATE TABLE IF NOT EXISTS agent_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT,
  created_at TEXT NOT NULL
);
`);

export function nowIso(): string {
  return new Date().toISOString();
}

export interface EventRow {
  id: string;
  type: string;
  old_name: string | null;
  new_name: string | null;
  old_dob: string | null;
  new_dob: string | null;
  old_address: string | null;
  new_address: string | null;
  extra_json: string | null;
  doc_filename: string | null;
  doc_text: string | null;
  created_at: string;
}

export function getEvent(id: string): EventRow | undefined {
  return db.prepare("SELECT * FROM events WHERE id = ?").get(id) as EventRow | undefined;
}

export function logAgent(eventId: string, stage: string, message: string, data?: unknown): void {
  db.prepare(
    "INSERT INTO agent_log (event_id, stage, message, data_json, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(eventId, stage, message, data ? JSON.stringify(data) : null, nowIso());
}

export function getAgentLog(eventId: string): Array<Record<string, unknown>> {
  return db
    .prepare("SELECT stage, message, data_json, created_at FROM agent_log WHERE event_id = ? ORDER BY id ASC")
    .all(eventId) as Array<Record<string, unknown>>;
}
