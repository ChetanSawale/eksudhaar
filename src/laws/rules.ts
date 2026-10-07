/**
 * EkSudhaar rules knowledge base — national + state correction rules.
 *
 * Honesty rules for this file:
 * - Only well-established, widely documented rules are encoded.
 * - No invented law section numbers, gazette notification numbers, or URLs.
 * - Source labels are generic ("UIDAI revised SOP, Sept 2026") — never specific
 *   citations we cannot verify.
 * - Uncertain points are "info" checks with a verify note, never hard fails.
 * - No rule promises government approval. A 100% score means the application
 *   passes every check in this knowledge base — file with confidence. Final
 *   approval always rests with the issuing authority.
 */
import type { EventType } from "../registries/catalog.js";
import type {
  DocumentDef,
  Jurisdiction,
  LawRule,
  RegistryFee,
  SimFields,
  SimInput,
} from "./types.js";

export const STATES: string[] = [
  "Maharashtra",
  "Delhi",
  "Uttar Pradesh",
  "West Bengal",
  "Tamil Nadu",
];

export const DOCUMENTS: DocumentDef[] = [
  { id: "poi", label: "Proof of Identity", hint: "Passport, voter ID, driving licence…" },
  { id: "poa", label: "Proof of Address", hint: "Rent agreement, utility bill…" },
  { id: "pob", label: "Proof of Birth", hint: "Birth certificate, school certificate…" },
  { id: "gazette", label: "Gazette notification", hint: "Published name-change notification" },
  { id: "marriage_cert", label: "Marriage certificate", hint: "Registered marriage proof" },
  { id: "affidavit", label: "Affidavit / court order", hint: "Sworn affidavit or court order" },
  { id: "aadhaar_card", label: "Current Aadhaar card", hint: "Your existing Aadhaar" },
  { id: "pan_card", label: "Current PAN card", hint: "Your existing PAN" },
  { id: "passport_old", label: "Current passport", hint: "Your existing passport" },
  { id: "epic", label: "Voter ID (EPIC)", hint: "Your existing voter ID card" },
];

export const DOCUMENT_IDS = new Set(DOCUMENTS.map((d) => d.id));

/** Official filing fees (INR) a failed attempt would waste. 0 = free. */
export const REGISTRY_FEES: RegistryFee[] = [
  { id: "aadhaar", name: "Aadhaar (UIDAI)", fee: 75, feeLabel: "₹75 (demographic update)" },
  { id: "pan", name: "PAN (Income Tax)", fee: 107, feeLabel: "₹107 (India address)" },
  { id: "voter", name: "Voter ID (ECI)", fee: 0, feeLabel: "Free" },
  { id: "bank", name: "Bank KYC", fee: 0, feeLabel: "Free" },
  { id: "epfo", name: "PF / UAN (EPFO)", fee: 0, feeLabel: "Free" },
  { id: "passport", name: "Passport (re-issue)", fee: 1500, feeLabel: "₹1,500 (normal, 36 pages)" },
];

/** Rough, typical out-of-pocket extras per failed round (agent, travel, lost day). */
export const TYPICAL_EXTRA_COST_PER_ATTEMPT = 500;

const has = (input: SimInput, docId: string): boolean => input.documents.includes(docId);
const str = (v: string | undefined): string => (v || "").trim();

/** Parse DD/MM/YYYY or ISO dates; returns null when unparseable. */
function parseDate(v: string | undefined): Date | null {
  const s = str(v);
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  const iso = dmy ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` : s;
  const t = Date.parse(iso);
  return isNaN(t) ? null : new Date(t);
}

const yearsBetween = (a: Date, b: Date): number =>
  Math.abs(b.getTime() - a.getTime()) / (365.25 * 24 * 3600 * 1000);

const NAME_EVENTS: EventType[] = ["name_correction", "marriage_name_change"];
const ALL_EVENTS: EventType[] = ["name_correction", "marriage_name_change", "dob_correction", "address_change"];

function isMajorNameChange(input: SimInput): boolean {
  return input.fields.nameScope === "major" || input.eventType === "marriage_name_change";
}

export const RULES: LawRule[] = [
  // ---------------------------------------------------------------- names
  {
    id: "names-present-and-differ",
    jurisdiction: "national",
    documents: ["Aadhaar"],
    eventTypes: NAME_EVENTS,
    label: "Old and new names are both given and differ",
    sourceLabel: "Standard application requirement",
    severity: "error",
    failAdvice: "Enter the name as it appears today (wrong) and the name as it should read (correct) — they must be different.",
    evaluate: (input: SimInput) => {
      const o = str(input.fields.oldName);
      const n = str(input.fields.newName);
      if (!o || !n) return { pass: false, detail: "Both the current name and the corrected name are needed to file." };
      if (o.length < 2 || n.length < 2) return { pass: false, detail: "Names look incomplete — check for typos." };
      if (o.toLowerCase() === n.toLowerCase())
        return { pass: false, detail: "Old and new names are identical — a correction needs a before and an after." };
      return { pass: true, detail: `Correcting "${o}" → "${n}".` };
    },
  },
  {
    id: "name-exact-spelling",
    jurisdiction: "national",
    documents: ["Aadhaar", "PAN", "Passport"],
    eventTypes: NAME_EVENTS,
    label: "New name matches the supporting document exactly",
    sourceLabel: "Registry filing guidance",
    severity: "info",
    failAdvice: "Copy the new name character-for-character from the Gazette or certificate.",
    evaluate: () => ({
      pass: true,
      detail:
        "Type the new name EXACTLY as printed on the Gazette notification or certificate — even a single spelling mismatch between the form and the proof is a common reason applications get sent back. Double-check before filing.",
    }),
  },
  {
    id: "aadhaar-gazette-major",
    jurisdiction: "national",
    documents: ["Aadhaar"],
    eventTypes: NAME_EVENTS,
    label: "Gazette notification present for a complete name change",
    sourceLabel: "UIDAI revised SOP, Sept 2026",
    severity: "error",
    failAdvice:
      "A complete name change needs Gazette publication first. Apply at your state's gazette office (affidavit + prescribed form + fee), wait for publication, then file the correction.",
    evaluate: (input: SimInput) => {
      if (!isMajorNameChange(input))
        return {
          pass: true,
          detail:
            "Marked as a minor spelling-level correction: under UIDAI's revised SOP (Sept 2026), a Gazette is not required — a valid Proof of Identity is enough.",
        };
      if (has(input, "gazette"))
        return { pass: true, detail: "Gazette notification available — this is the legal anchor for a complete name change." };
      return {
        pass: false,
        detail:
          "This looks like a complete name change, but no Gazette notification is listed. UIDAI's revised SOP (Sept 2026) keeps Gazette publication mandatory for complete/major name changes.",
      };
    },
  },
  {
    id: "aadhaar-minor-poi-note",
    jurisdiction: "national",
    documents: ["Aadhaar"],
    eventTypes: ["name_correction"],
    label: "Minor corrections need only Proof of Identity",
    sourceLabel: "UIDAI revised SOP, Sept 2026",
    severity: "info",
    failAdvice: "Carry a valid Proof of Identity showing the corrected spelling.",
    evaluate: (input: SimInput) => ({
      pass: true,
      detail:
        input.fields.nameScope === "minor"
          ? "For minor corrections (spelling fixes), UIDAI's revised SOP (Sept 2026) does not require Gazette publication — a Proof of Identity with the correct spelling suffices."
          : "If your change is only a spelling-level fix, you may not need a Gazette at all — a Proof of Identity suffices under UIDAI's revised SOP (Sept 2026). Mark the scope as 'minor' to re-check.",
    }),
  },
  {
    id: "aadhaar-name-lifetime-limit",
    jurisdiction: "national",
    documents: ["Aadhaar"],
    eventTypes: NAME_EVENTS,
    label: "Within the lifetime name-correction limit",
    sourceLabel: "UIDAI update policy",
    severity: "error",
    failAdvice:
      "UIDAI allows at most 2 name corrections in a lifetime. If you have already used both, a standard update will be rejected — you would need to approach UIDAI through an exceptional process. Verify your update history at an Aadhaar Seva Kendra before paying any fee.",
    evaluate: (input: SimInput) => {
      const n = input.fields.previousNameCorrections;
      if (n === undefined || n === null)
        return {
          pass: true,
          detail:
            "Lifetime count not specified — counted as within limit. If you have corrected your Aadhaar name twice before, this filing will be rejected: confirm your history first.",
        };
      if (n >= 2)
        return {
          pass: false,
          detail: `You reported ${n} previous name correction(s) — the lifetime limit is 2. A standard filing is almost certain to be rejected.`,
        };
      return { pass: true, detail: `${n} previous correction(s) reported — within the lifetime limit of 2.` };
    },
  },
  {
    id: "aadhaar-poi-required",
    jurisdiction: "national",
    documents: ["Aadhaar"],
    eventTypes: ALL_EVENTS,
    label: "Valid Proof of Identity available",
    sourceLabel: "UIDAI document categories (PoI / PoA / PoB / DOB)",
    severity: "error",
    failAdvice:
      "Arrange one valid Proof of Identity first (passport, voter ID, driving licence, or another UIDAI-accepted PoI). No demographic update is accepted without it.",
    evaluate: (input: SimInput) =>
      has(input, "poi")
        ? { pass: true, detail: "Proof of Identity available — the base document for any demographic update." }
        : { pass: false, detail: "No Proof of Identity listed. UIDAI accepts updates only against its PoI / PoA / PoB / DOB document categories." },
  },
  // ---------------------------------------------------------------- DOB
  {
    id: "aadhaar-dob-window",
    jurisdiction: "national",
    documents: ["Aadhaar"],
    eventTypes: ["dob_correction"],
    label: "DOB change within UIDAI's ±3-year window",
    sourceLabel: "UIDAI DOB update policy",
    severity: "error",
    failAdvice:
      "If the gap is genuinely larger than 3 years, a standard update will be rejected — this needs a hearing at the regional UIDAI office instead. Do not pay the standard update fee for it.",
    evaluate: (input: SimInput) => {
      const a = parseDate(input.fields.oldDob);
      const b = parseDate(input.fields.newDob);
      if (!a || !b)
        return { pass: false, detail: "Enter both the current and the correct date of birth (DD/MM/YYYY) so the window can be checked." };
      const yrs = yearsBetween(a, b);
      if (yrs <= 3) return { pass: true, detail: `Difference is ${yrs.toFixed(1)} year(s) — within the ±3-year window for a standard correction.` };
      return {
        pass: false,
        detail: `Difference is ${yrs.toFixed(1)} years — beyond the ±3-year window. A standard update will be rejected; this needs a regional UIDAI office hearing.`,
      };
    },
  },
  {
    id: "aadhaar-dob-once",
    jurisdiction: "national",
    documents: ["Aadhaar"],
    eventTypes: ["dob_correction"],
    label: "Date of birth not corrected before",
    sourceLabel: "UIDAI DOB update policy",
    severity: "error",
    failAdvice:
      "UIDAI allows a DOB correction only once. If it was already corrected, a second filing will be rejected — verify your update history at an Aadhaar Seva Kendra before spending on another attempt.",
    evaluate: (input: SimInput) =>
      input.fields.dobCorrectedBefore
        ? { pass: false, detail: "You indicated the DOB was already corrected once — UIDAI permits only one DOB correction." }
        : { pass: true, detail: "No previous DOB correction reported — eligible for the one permitted correction." },
  },
  {
    id: "aadhaar-dob-proof",
    jurisdiction: "national",
    documents: ["Aadhaar"],
    eventTypes: ["dob_correction"],
    label: "Date-of-birth proof available",
    sourceLabel: "UIDAI document categories (DOB)",
    severity: "error",
    failAdvice: "Arrange a birth certificate, passport, or school/education certificate showing the correct DOB before filing.",
    evaluate: (input: SimInput) =>
      has(input, "pob")
        ? { pass: true, detail: "Proof of date of birth available." }
        : { pass: false, detail: "No DOB proof listed. A birth certificate, passport, or school certificate is required." },
  },
  // ---------------------------------------------------------------- address
  {
    id: "aadhaar-address-present",
    jurisdiction: "national",
    documents: ["Aadhaar"],
    eventTypes: ["address_change"],
    label: "Complete new address provided",
    sourceLabel: "Standard application requirement",
    severity: "error",
    failAdvice: "Enter the full new address including PIN code — incomplete addresses are sent back.",
    evaluate: (input: SimInput) => {
      const a = str(input.fields.newAddress);
      if (a.length < 10) return { pass: false, detail: "The new address looks incomplete." };
      if (!/\d{6}/.test(a))
        return { pass: false, detail: "No 6-digit PIN code found in the address — include it exactly as on your proof." };
      return { pass: true, detail: "New address looks complete with PIN code." };
    },
  },
  {
    id: "aadhaar-address-proof",
    jurisdiction: "national",
    documents: ["Aadhaar"],
    eventTypes: ["address_change"],
    label: "Address proof available",
    sourceLabel: "UIDAI document categories (PoA)",
    severity: "error",
    failAdvice: "Arrange a rent/lease agreement or a recent utility bill (electricity, gas, water) in your name before filing.",
    evaluate: (input: SimInput) =>
      has(input, "poa")
        ? { pass: true, detail: "Proof of Address available." }
        : { pass: false, detail: "No address proof listed. A rent agreement or utility bill is required." },
  },
  // ---------------------------------------------------------------- PAN
  {
    id: "pan-aadhaar-first",
    jurisdiction: "national",
    documents: ["PAN", "Aadhaar"],
    eventTypes: ["name_correction", "marriage_name_change", "dob_correction"],
    label: "Aadhaar corrected before PAN (sequence)",
    sourceLabel: "PAN correction via Aadhaar e-KYC — widely documented",
    severity: "info",
    failAdvice: "Finish the Aadhaar correction first, then file PAN.",
    evaluate: () => ({
      pass: true,
      detail:
        "PAN correction through Aadhaar e-KYC fails on any name mismatch — so the Aadhaar correction must be completed FIRST. EkSudhaar's propagation plan orders this automatically.",
    }),
  },
  {
    id: "pan-fee-note",
    jurisdiction: "national",
    documents: ["PAN"],
    eventTypes: ["name_correction", "marriage_name_change", "dob_correction"],
    label: "PAN correction fee accounted for",
    sourceLabel: "Protean / UTIITSL fee schedule (verify current)",
    severity: "info",
    failAdvice: "Budget ₹107 for the PAN correction (India address).",
    evaluate: () => ({
      pass: true,
      detail:
        "PAN correction (Form 49A) costs about ₹107 for an India address — and the fee is non-refundable even if the application is rejected. Another reason to file only when every check passes.",
    }),
  },
  // ---------------------------------------------------------------- passport
  {
    id: "passport-gazette-original",
    jurisdiction: "national",
    documents: ["Passport"],
    eventTypes: NAME_EVENTS,
    label: "Original Gazette notification available for passport re-issue",
    sourceLabel: "Passport Seva guidance for personal-particulars change",
    severity: "error",
    failAdvice:
      "For a passport re-issue with a name change, the Passport Seva Kendra asks for the original Gazette notification. Get the Gazette published first, then apply for re-issue.",
    evaluate: (input: SimInput) =>
      has(input, "gazette")
        ? { pass: true, detail: "Gazette notification available — carry the original to the PSK appointment." }
        : { pass: false, detail: "No Gazette notification listed. Passport re-issue for a name change needs the original Gazette." },
  },
  {
    id: "passport-fee-note",
    jurisdiction: "national",
    documents: ["Passport"],
    eventTypes: NAME_EVENTS,
    label: "Passport re-issue fee accounted for",
    sourceLabel: "Passport Seva fee schedule (verify current)",
    severity: "info",
    failAdvice: "Budget about ₹1,500 for a normal 36-page re-issue.",
    evaluate: () => ({
      pass: true,
      detail:
        "Passport re-issue costs about ₹1,500 (normal, 36 pages) — the single biggest fee in this journey, and non-refundable on rejection.",
    }),
  },
  // ---------------------------------------------------------------- voter
  {
    id: "voter-epic-ready",
    jurisdiction: "national",
    documents: ["Voter ID"],
    eventTypes: ["name_correction", "marriage_name_change", "address_change"],
    label: "EPIC number at hand for Form 8",
    sourceLabel: "Election Commission Form 8 guidance",
    severity: "warning",
    failAdvice: "Look up your EPIC number on the voters' portal or tick 'Voter ID' if you have the card — Form 8 needs it.",
    evaluate: (input: SimInput) =>
      has(input, "epic") || str(input.fields.epicNumber).length >= 3
        ? { pass: true, detail: "EPIC identified — Form 8 can reference it." }
        : { pass: false, detail: "No EPIC number or voter ID card listed. Form 8 (correction of entries) needs your EPIC number." },
  },
  {
    id: "voter-form8-free",
    jurisdiction: "national",
    documents: ["Voter ID"],
    eventTypes: ["name_correction", "marriage_name_change", "address_change"],
    label: "Voter correction is free",
    sourceLabel: "Election Commission guidance",
    severity: "info",
    failAdvice: "File Form 8 on the voters' portal — no fee.",
    evaluate: () => ({
      pass: true,
      detail: "Correction of entries via Form 8 is free — but a rejection still costs you weeks. File it with the updated Aadhaar attached.",
    }),
  },
  // ---------------------------------------------------------------- bank / EPFO
  {
    id: "bank-kyc-letter",
    jurisdiction: "national",
    documents: ["Bank KYC"],
    eventTypes: ["name_correction", "marriage_name_change", "address_change"],
    label: "Bank KYC update approach known",
    sourceLabel: "RBI CKYC norms — widely documented practice",
    severity: "info",
    failAdvice: "Visit your home branch with the letter + Gazette copy + updated Aadhaar.",
    evaluate: () => ({
      pass: true,
      detail:
        "Banks update KYC at your home branch: carry a written request, the Gazette copy, and the updated Aadhaar — and insist on a stamped acknowledgement. EkSudhaar generates the letter for you.",
    }),
  },
  {
    id: "epfo-joint-declaration",
    jurisdiction: "national",
    documents: ["PF / UAN"],
    eventTypes: ["name_correction", "marriage_name_change", "dob_correction"],
    label: "EPFO joint-declaration route known",
    sourceLabel: "EPFO member guidance — widely documented",
    severity: "info",
    failAdvice: "Get the joint declaration signed by you and your employer, with proofs attached.",
    evaluate: () => ({
      pass: true,
      detail:
        "EPFO corrects name/DOB through a joint declaration signed by you AND your employer, with the Gazette and updated Aadhaar attached. Name/DOB mismatches auto-reject PF claims — this unblocks them.",
    }),
  },
  // ---------------------------------------------------------------- marriage
  {
    id: "marriage-cert-required",
    jurisdiction: "national",
    documents: ["Aadhaar", "PAN", "Passport"],
    eventTypes: ["marriage_name_change"],
    label: "Registered marriage certificate available",
    sourceLabel: "Standard proof requirement — verify locally",
    severity: "error",
    failAdvice: "Get your marriage registered and obtain the certificate first — it is the anchor document for every downstream correction.",
    evaluate: (input: SimInput) =>
      has(input, "marriage_cert")
        ? { pass: true, detail: "Registered marriage certificate available — the anchor for a post-marriage name change." }
        : { pass: false, detail: "No marriage certificate listed. A registered certificate is required; a religious ceremony alone is not enough." },
  },
  {
    id: "marriage-acts-note",
    jurisdiction: "national",
    documents: ["Aadhaar"],
    eventTypes: ["marriage_name_change"],
    label: "Marriage registration act understood",
    sourceLabel: "Hindu Marriage Act / Special Marriage Act — general",
    severity: "info",
    failAdvice: "Register the marriage under the applicable Act and keep the certificate safe.",
    evaluate: () => ({
      pass: true,
      detail:
        "A certificate under either the Hindu Marriage Act or the Special Marriage Act works as proof — what matters is that the marriage is registered. If only a religious ceremony happened, register it first (rules vary by state — verify locally).",
    }),
  },
  // ---------------------------------------------------------------- helpers
  {
    id: "gazette-number-handy",
    jurisdiction: "national",
    documents: ["Aadhaar", "PAN", "Passport"],
    eventTypes: NAME_EVENTS,
    label: "Gazette notification number noted",
    sourceLabel: "Standard application requirement",
    severity: "warning",
    failAdvice: "Copy the Gazette notification number and date from the published notification — every correction form asks for it.",
    evaluate: (input: SimInput) => {
      if (!has(input, "gazette")) return { pass: true, detail: "No Gazette involved — nothing to note." };
      return str(input.fields.gazetteNumber).length >= 3
        ? { pass: true, detail: `Gazette number "${str(input.fields.gazetteNumber)}" noted.` }
        : { pass: false, detail: "You have the Gazette but no notification number entered. Forms ask for it — keep it handy." };
    },
  },
  {
    id: "filing-sequence",
    jurisdiction: "national",
    documents: ["Aadhaar", "PAN", "Voter ID", "Bank KYC", "PF / UAN", "Passport"],
    eventTypes: ALL_EVENTS,
    label: "Correct filing sequence planned",
    sourceLabel: "Registry dependency practice — widely documented",
    severity: "info",
    failAdvice: "Always correct Aadhaar first.",
    evaluate: () => ({
      pass: true,
      detail:
        "File in dependency order: Aadhaar first, then PAN, voter ID, bank KYC, PF, and passport. Downstream filings verify against Aadhaar — wrong order is one of the most common reasons applications bounce.",
    }),
  },
  // ---------------------------------------------------------------- state gazette processes
  ...STATES.map(
    (state): LawRule => ({
      id: `gazette-process-${state.toLowerCase().replace(/[^a-z]+/g, "-")}`,
      jurisdiction: state as Jurisdiction,
      documents: ["Gazette notification"],
      eventTypes: NAME_EVENTS,
      label: `${state} gazette publication process`,
      sourceLabel: "State gazette norms — verify locally",
      severity: "info",
      failAdvice: "Check your state's gazette office or e-gazette portal for the exact form, fee and timeline.",
      evaluate: () => ({
        pass: true,
        detail:
          `Name-change publication in ${state} goes through the state government's official gazette. The application form, fee, affidavit format and publication timeline differ by state — confirm the current process with the ${state} gazette office (or its e-gazette portal) before you apply, so the notification isn't rejected on a technicality.`,
      }),
    }),
  ),
];

/** Rules that apply to an event type + state (national always; state when matched). */
export function rulesFor(eventType: EventType, state: string): LawRule[] {
  return RULES.filter(
    (r) =>
      r.eventTypes.includes(eventType) &&
      (r.jurisdiction === "national" || r.jurisdiction === state),
  );
}
