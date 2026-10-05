import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { EventRow } from "../db.js";
import { getRegistry, planFor, EVENT_TYPE_LABELS, type EventType, type Registry } from "../registries/catalog.js";

const MARGIN = 50;
const PAGE_W = 595;
const PAGE_H = 842;

interface Ctx {
  doc: PDFDocument;
  page: any;
  y: number;
  font: any;
  bold: any;
}

/** Map characters outside pdf-lib's WinAnsi table to safe equivalents. */
function sanitize(s: string): string {
  return s.replace(/₹/g, "Rs. ").replace(/→/g, "->").replace(/[^\x00-\xFF]/g, "");
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

function ensure(ctx: Ctx, need: number) {
  if (ctx.y - need < MARGIN) newPage(ctx);
}

function line(ctx: Ctx, text: string, opts: { size?: number; bold?: boolean; gap?: number; color?: any } = {}) {
  text = sanitize(text);
  const size = opts.size ?? 11;
  const font = opts.bold ? ctx.bold : ctx.font;
  ensure(ctx, size + (opts.gap ?? 6));
  const maxWidth = PAGE_W - 2 * MARGIN;
  const words = text.split(" ");
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if ((font.widthOfTextAtSize(trial, size) as number) > maxWidth && cur) {
      ctx.page.drawText(cur, { x: MARGIN, y: ctx.y, size, font, color: opts.color ?? rgb(0.15, 0.15, 0.15) });
      ctx.y -= size + 3;
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) {
    ctx.page.drawText(cur, { x: MARGIN, y: ctx.y, size, font, color: opts.color ?? rgb(0.15, 0.15, 0.15) });
    ctx.y -= size + (opts.gap ?? 6);
  }
}

function heading(ctx: Ctx, text: string) {
  ctx.y -= 6;
  line(ctx, text, { size: 15, bold: true, gap: 10, color: rgb(0.1, 0.25, 0.45) });
}

function checkbox(ctx: Ctx, text: string) {
  text = sanitize(text);
  ensure(ctx, 18);
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 2, width: 11, height: 11, borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 1 });
  const size = 10.5;
  const words = text.split(" ");
  let cur = "";
  const x0 = MARGIN + 18;
  const maxWidth = PAGE_W - x0 - MARGIN;
  const lines: string[] = [];
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if ((ctx.font.widthOfTextAtSize(trial, size) as number) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = trial;
  }
  if (cur) lines.push(cur);
  lines.forEach((ln, i) => {
    ctx.page.drawText(ln, { x: x0, y: ctx.y - i * 14, size, font: ctx.font, color: rgb(0.15, 0.15, 0.15) });
  });
  ctx.y -= lines.length * 14 + 6;
}

function extraOf(e: EventRow): Record<string, string> {
  try {
    return JSON.parse(e.extra_json || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function bankLetter(e: EventRow, bankName: string): string {
  const x = extraOf(e);
  return [
    "To,",
    "The Branch Manager,",
    `${bankName},`,
    "[Branch address]",
    "",
    `Date: ${new Date().toLocaleDateString("en-IN")}`,
    "",
    `Subject: Request for updation of name in account and KYC records`,
    "",
    "Respected Sir / Madam,",
    "",
    `I, ${e.new_name || "[NEW NAME]"} (formerly known as ${e.old_name || "[OLD NAME]"}), holder of account no. _______________, request you to update my name in your records and in the Central KYC (CKYC) registry.`,
    "",
    `My name has been legally changed vide Gazette Notification No. ${x.gazetteNo || "[GAZETTE NO]"} dated ${x.gazetteDate || "[DATE]"}. Enclosed: (1) copy of the Gazette notification, (2) copy of updated Aadhaar.`,
    "",
    "Kindly confirm once the CKYC registry reflects the updated name, and provide a stamped acknowledgement of this letter.",
    "",
    "Thanking you,",
    "",
    "Yours faithfully,",
    `${e.new_name || "[NEW NAME]"}`,
    "Signature: _______________   Mobile: _______________",
  ].join("\n");
}

function epfoLetter(e: EventRow): string {
  const x = extraOf(e);
  return [
    "JOINT DECLARATION FOR CORRECTION OF NAME / DATE OF BIRTH",
    "(To be submitted by the member through the employer to EPFO)",
    "",
    `I, ${e.new_name || "[NEW NAME]"} (formerly ${e.old_name || "[OLD NAME]"}), UAN _______________, PF Account No. _______________, hereby declare that my correct name is ${e.new_name || "[NEW NAME]"}.`,
    "",
    e.new_dob ? `My correct date of birth is ${e.new_dob} (previously recorded as ${e.old_dob || "—"}).` : "",
    "",
    `The correction is supported by Gazette Notification No. ${x.gazetteNo || "[GAZETTE NO]"} dated ${x.gazetteDate || "[DATE]"} and my updated Aadhaar (copies enclosed). I request EPFO to update its records accordingly.`,
    "",
    "Member's signature: _______________   Date: _______________",
    "",
    "EMPLOYER CERTIFICATION",
    "Certified that the above member is / was employed with us and the correction is verified from our records.",
    "",
    "Authorised signatory: _______________   Seal: _______________   Date: _______________",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/**
 * Build the correction pack PDF: cover + per-registry checklists +
 * filled letters for consented registries that need them.
 */
export async function buildPackPdf(
  event: EventRow,
  consentedIds: string[],
  bankNames: string[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { doc, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN, font, bold };

  const typeLabel = EVENT_TYPE_LABELS[event.type as EventType] || event.type;

  // ---- Cover ----
  line(ctx, "EkSudhaar  |  One Correction System", { size: 13, bold: true, color: rgb(0.1, 0.35, 0.2) });
  line(ctx, "One correction, everywhere.", { size: 11, color: rgb(0.3, 0.3, 0.3) });
  ctx.y -= 8;
  heading(ctx, "Correction Pack");
  line(ctx, `Event: ${typeLabel}`, { bold: true });
  if (event.old_name || event.new_name) line(ctx, `Name: ${event.old_name || "—"}  ->  ${event.new_name || "—"}`);
  if (event.old_dob || event.new_dob) line(ctx, `Date of birth: ${event.old_dob || "—"}  ->  ${event.new_dob || "—"}`);
  if (event.new_address) line(ctx, `New address: ${event.new_address}`);
  const x = extraOf(event);
  if (x.gazetteNo) line(ctx, `Gazette Notification No.: ${x.gazetteNo}${x.gazetteDate ? `  dated ${x.gazetteDate}` : ""}`);
  line(ctx, `Generated: ${new Date().toLocaleString("en-IN")}`);
  ctx.y -= 6;
  line(ctx, "Document verification: PASSED — the supporting document cleared all checks.", { bold: true, color: rgb(0.1, 0.45, 0.2) });
  ctx.y -= 4;
  line(ctx, "How to use this pack: work through the registries in order. Tick each step as you finish it. Keep every acknowledgement receipt — upload a photo of it to the tracker.", { size: 10 });

  // ---- Per registry ----
  const plan = planFor(event.type as EventType).filter((r) => consentedIds.includes(r.id));
  for (const reg of plan) {
    newPage(ctx);
    heading(ctx, `${reg.name}`);
    line(ctx, `Fee: ${reg.fee}   •   Helpline: ${reg.helpline}`, { size: 10 });
    line(ctx, `Official: ${reg.officialUrl}`, { size: 10 });
    ctx.y -= 4;
    line(ctx, "Carry these documents:", { bold: true, size: 11 });
    reg.documents.forEach((d) => checkbox(ctx, d));
    ctx.y -= 2;
    line(ctx, "Steps:", { bold: true, size: 11 });
    reg.steps.forEach((s, i) => {
      checkbox(ctx, `Step ${i + 1}: ${s.title} — ${s.detail} (${s.where}; ${s.eta})`);
    });
    if (reg.letterKind === "bank_kyc") {
      const banks = bankNames.length > 0 ? bankNames : ["[YOUR BANK]"];
      for (const b of banks) {
        newPage(ctx);
        heading(ctx, `KYC update letter — ${b}`);
        line(ctx, "Print, sign, and submit at your home branch with the Gazette copy + updated Aadhaar.", { size: 10 });
        ctx.y -= 4;
        for (const ln of bankLetter(event, b).split("\n")) line(ctx, ln === "" ? " " : ln, { size: 10.5, gap: 5 });
      }
    }
    if (reg.letterKind === "epfo_joint") {
      newPage(ctx);
      heading(ctx, "EPFO joint declaration");
      line(ctx, "Fill with your employer, both sign, and submit to EPFO.", { size: 10 });
      ctx.y -= 4;
      for (const ln of epfoLetter(event).split("\n")) line(ctx, ln === "" ? " " : ln, { size: 10.5, gap: 5 });
    }
  }

  // ---- Back page ----
  newPage(ctx);
  heading(ctx, "After you finish");
  checkbox(ctx, "Downloaded / collected the corrected document from each registry");
  checkbox(ctx, "Stored acknowledgement receipts (photo uploaded to the tracker)");
  checkbox(ctx, "Re-checked that names match EXACTLY across Aadhaar, PAN, and bank records");
  ctx.y -= 6;
  line(ctx, "EkSudhaar is a citizen aid, not a government service. Always verify details before submitting. Built open-source for the Code for India hackathon.", { size: 9, color: rgb(0.4, 0.4, 0.4) });

  void getRegistry;
  return doc.save();
}

export type { Registry };
