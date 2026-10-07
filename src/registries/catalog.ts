/**
 * Registry catalog — the domain heart of EkSudhaar.
 *
 * Each registry knows: which event types it applies to, what to carry,
 * the ordered steps, fees, official URLs, ordering dependencies
 * (e.g. PAN correction needs Aadhaar updated FIRST), and whether
 * EkSudhaar generates a filled letter for it.
 */

export type EventType = "name_correction" | "marriage_name_change" | "dob_correction" | "address_change";

export interface RegistryStep {
  title: string;
  detail: string;
  where: string;
  eta: string;
}

/**
 * Online-first path for a registry. EkSudhaar's goal: everything that CAN be
 * done online is done from home; a physical visit happens only where the law
 * or process genuinely requires it — and then the citizen walks in with a
 * 100%-scored file no agent can exploit.
 */
export interface OnlinePath {
  /** true when the whole correction can be completed without any visit */
  fullyOnline: boolean;
  /** steps the citizen can complete from home */
  onlineSteps: string[];
  /** true when at least one physical visit is legally/process-required */
  mustVisit: boolean;
  /** why the visit is required (empty when fully online) */
  visitReason: string;
}

export interface Registry {
  id: string;
  name: string;
  short: string;
  appliesTo: EventType[];
  /** registries that must complete first */
  dependsOn: string[];
  fee: string;
  documents: string[];
  steps: RegistryStep[];
  /** filled letter EkSudhaar generates, if any */
  letterKind: "bank_kyc" | "epfo_joint" | null;
  officialUrl: string;
  helpline: string;
  /** online-first path: what can be done from home vs what needs a visit */
  online: OnlinePath;
}

export const REGISTRIES: Registry[] = [
  {
    id: "aadhaar",
    name: "Aadhaar (UIDAI)",
    short: "Aadhaar",
    appliesTo: ["name_correction", "marriage_name_change", "dob_correction", "address_change"],
    dependsOn: [],
    fee: "₹75 (demographic), ₹125 (biometric)",
    documents: [
      "Gazette notification / marriage certificate / court order (original)",
      "Current Aadhaar card",
      "One proof of identity showing the corrected details",
    ],
    steps: [
      { title: "Visit an Aadhaar Seva Kendra", detail: "Walk in or book at appointments.uidai.gov.in. Carry originals + one photocopy set.", where: "Nearest Aadhaar Seva Kendra", eta: "Same day" },
      { title: "Fill the update / correction form", detail: "The operator enters the corrected name / DOB / address exactly as in the Gazette or certificate.", where: "At the counter", eta: "30 minutes" },
      { title: "Biometric authentication", detail: "Fingerprint / iris scan to authorise the update.", where: "At the counter", eta: "5 minutes" },
      { title: "Collect the URN and track", detail: "You get an Update Request Number. Track at myaadhaar.uidai.gov.in until the new e-Aadhaar is ready.", where: "Online", eta: "7–30 days" },
    ],
    letterKind: null,
    officialUrl: "https://myaadhaar.uidai.gov.in/",
    helpline: "1947 (toll-free)",
    online: {
      fullyOnline: false,
      onlineSteps: [
        "Address update can be done fully online on myAadhaar with an Aadhaar OTP — no visit needed.",
        "Track any update with your URN on myAadhaar — no visit needed.",
      ],
      mustVisit: true,
      visitReason:
        "Name, date-of-birth, gender and mobile-number updates legally require biometric authentication (fingerprint/iris) — they cannot be done online. Only address updates are fully online.",
    },
  },
  {
    id: "pan",
    name: "PAN (Income Tax Department)",
    short: "PAN",
    appliesTo: ["name_correction", "marriage_name_change", "dob_correction"],
    dependsOn: ["aadhaar"],
    fee: "₹107 (India address)",
    documents: [
      "Updated Aadhaar with the corrected name (do Aadhaar FIRST)",
      "Current PAN card",
      "Gazette notification / supporting proof",
    ],
    steps: [
      { title: "Finish your Aadhaar correction first", detail: "PAN correction via Aadhaar e-KYC fails if the names don't match. Aadhaar must show the new name.", where: "—", eta: "Depends on Aadhaar" },
      { title: "Apply for PAN correction (Form 49A)", detail: "Online via Protean (tin-nsdl) or UTIITSL. Choose 'Correction' and enter details exactly as on the updated Aadhaar.", where: "protean-tinpan.com / utiitsl.com", eta: "30 minutes" },
      { title: "Aadhaar OTP e-KYC", detail: "Authenticate with the Aadhaar OTP. No physical documents needed if e-KYC succeeds.", where: "Online", eta: "10 minutes" },
      { title: "Receive e-PAN, then re-link Aadhaar–PAN", detail: "e-PAN arrives by email. If your PAN was inoperative for want of linking, link it at incometax.gov.in.", where: "Online", eta: "15–45 days" },
    ],
    letterKind: null,
    officialUrl: "https://www.protean-tinpan.com/",
    helpline: "1800-180-1961",
    online: {
      fullyOnline: true,
      onlineSteps: [
        "File the correction (Form 49A) online on Protean or UTIITSL.",
        "Verify with Aadhaar OTP e-KYC — no documents to courier, no visit.",
        "e-PAN arrives by email; re-link Aadhaar–PAN online if needed.",
      ],
      mustVisit: false,
      visitReason: "",
    },
  },
  {
    id: "voter",
    name: "Voter ID / EPIC (Election Commission)",
    short: "Voter ID",
    appliesTo: ["name_correction", "marriage_name_change", "address_change"],
    dependsOn: ["aadhaar"],
    fee: "Free",
    documents: ["Updated Aadhaar", "Current EPIC number", "Gazette / marriage certificate"],
    steps: [
      { title: "File Form 8", detail: "On voters.eci.gov.in or the Voter Helpline app: 'Correction of entries in electoral roll'. Upload the Gazette / certificate.", where: "voters.eci.gov.in", eta: "30 minutes" },
      { title: "Track the application", detail: "Note the reference number. Field verification may happen.", where: "Online / helpline", eta: "15–30 days" },
      { title: "Download e-EPIC", detail: "Once approved, download the updated e-EPIC. A physical card follows by post.", where: "voters.eci.gov.in", eta: "After approval" },
    ],
    letterKind: null,
    officialUrl: "https://voters.eci.gov.in/",
    helpline: "1950 (toll-free)",
    online: {
      fullyOnline: true,
      onlineSteps: [
        "File Form 8 (correction of entries) on the voters' portal or Voter Helpline app.",
        "Upload the Gazette / certificate and updated Aadhaar.",
        "Track with the reference number; download e-EPIC on approval.",
      ],
      mustVisit: false,
      visitReason: "",
    },
  },
  {
    id: "bank",
    name: "Bank accounts (KYC update)",
    short: "Bank KYC",
    appliesTo: ["name_correction", "marriage_name_change", "address_change"],
    dependsOn: ["aadhaar"],
    fee: "Free",
    documents: [
      "EkSudhaar-generated KYC update letter (in your pack)",
      "Gazette notification (copy)",
      "Updated Aadhaar (copy)",
    ],
    steps: [
      { title: "Visit your home branch", detail: "Carry the generated letter + Gazette copy + updated Aadhaar. One visit per bank.", where: "Home branch", eta: "1 hour per bank" },
      { title: "Get an acknowledgement", detail: "Insist on a stamped receiving copy — this is your proof if it stalls.", where: "Branch counter", eta: "Same day" },
      { title: "Confirm CKYC registry update", detail: "Ask the branch to confirm the Central KYC registry reflects the new name (affects all your bank relationships).", where: "Branch / follow-up", eta: "7–15 days" },
    ],
    letterKind: "bank_kyc",
    officialUrl: "https://www.ckycindia.in/",
    helpline: "Your bank's customer care",
    online: {
      fullyOnline: false,
      onlineSteps: [
        "Some banks let you raise a CKYC update request through netbanking — check yours first.",
      ],
      mustVisit: true,
      visitReason:
        "Banks must verify you in person for KYC changes — the update is recorded at your home branch. Carry EkSudhaar's generated letter and insist on a stamped acknowledgement.",
    },
  },
  {
    id: "epfo",
    name: "PF / UAN (EPFO)",
    short: "PF (EPFO)",
    appliesTo: ["name_correction", "marriage_name_change", "dob_correction"],
    dependsOn: ["aadhaar"],
    fee: "Free",
    documents: [
      "EkSudhaar-generated joint declaration (in your pack)",
      "Gazette notification (copy)",
      "Updated Aadhaar (copy)",
    ],
    steps: [
      { title: "Fill the joint declaration with your employer", detail: "Both you and your employer sign the generated declaration stating old vs new details.", where: "With your employer", eta: "1–2 days" },
      { title: "Employer submits to EPFO", detail: "Submitted via the employer EPFO portal / regional office.", where: "Employer → EPFO", eta: "Same week" },
      { title: "Track to approval, then withdraw / transfer freely", detail: "Name/DOB mismatches auto-reject PF claims — this unblocks them.", where: "unifiedportal-mem.epfindia.gov.in", eta: "15–30 days" },
    ],
    letterKind: "epfo_joint",
    officialUrl: "https://unifiedportal-mem.epfindia.gov.in/",
    helpline: "1800-118-005",
    online: {
      fullyOnline: true,
      onlineSteps: [
        "Fill the joint declaration with your employer (EkSudhaar generates it).",
        "Your employer submits it on the EPFO employer portal — no visit by you.",
        "Track approval on the member portal; claims unblock once approved.",
      ],
      mustVisit: false,
      visitReason: "",
    },
  },
  {
    id: "passport",
    name: "Passport (re-issue)",
    short: "Passport",
    appliesTo: ["name_correction", "marriage_name_change"],
    dependsOn: ["aadhaar"],
    fee: "₹1,500 (normal, 36 pages)",
    documents: ["Gazette notification (original)", "Updated Aadhaar", "Old passport"],
    steps: [
      { title: "Apply for re-issue", detail: "On passportindia.gov.in: 'Re-issue' → 'Change in personal particulars'. Upload the Gazette.", where: "passportindia.gov.in", eta: "45 minutes" },
      { title: "Visit the Passport Seva Kendra", detail: "Carry originals. Police verification may be re-triggered.", where: "PSK appointment", eta: "Half day" },
      { title: "Receive the new passport", detail: "Dispatched after verification.", where: "By post", eta: "15–30 days" },
    ],
    letterKind: null,
    officialUrl: "https://www.passportindia.gov.in/",
    helpline: "1800-258-1800",
    online: {
      fullyOnline: false,
      onlineSteps: [
        "Fill the re-issue application and pay the fee online on passportindia.gov.in.",
        "Book your Passport Seva Kendra appointment online.",
      ],
      mustVisit: true,
      visitReason:
        "A Passport Seva Kendra visit is mandatory — originals are verified in person and police verification may be re-triggered. Everything before the visit is online.",
    },
  },
];

/** Registries relevant to an event type, topologically ordered by dependsOn. */
export function planFor(eventType: EventType): Registry[] {
  const relevant = REGISTRIES.filter((r) => r.appliesTo.includes(eventType));
  const ordered: Registry[] = [];
  const done = new Set<string>();
  const remaining = [...relevant];
  // Simple topological sort; falls back to insertion order on cycles.
  while (remaining.length > 0) {
    const idx = remaining.findIndex((r) => r.dependsOn.every((d) => done.has(d) || !relevant.some((x) => x.id === d)));
    const next = remaining.splice(idx === -1 ? 0 : idx, 1)[0];
    ordered.push(next);
    done.add(next.id);
  }
  return ordered;
}

export function getRegistry(id: string): Registry | undefined {
  return REGISTRIES.find((r) => r.id === id);
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  name_correction: "Name correction (Gazette)",
  marriage_name_change: "Name change after marriage",
  dob_correction: "Date-of-birth correction",
  address_change: "Address change",
};
