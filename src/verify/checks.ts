import type { EventRow } from "../db.js";

export interface CheckResult {
  id: string;
  label: string;
  passed: boolean;
  severity: "error" | "warning";
  detail: string;
}

export interface VerificationOutcome {
  passed: boolean;
  checks: CheckResult[];
}

const hasGazetteNo = (t: string) => /gazette\s+(?:notification\s+)?(?:no\.?|number)\s*[:\-]?\s*[A-Z0-9][A-Z0-9\-\/\.]{2,40}/i.test(t);
const hasDate = (t: string) => /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(t);
const contains = (t: string, s: string | null) =>
  !!s && s.trim().length > 1 && t.toLowerCase().includes(s.trim().toLowerCase());

function docCheck(text: string | null): CheckResult {
  const ok = !!text && text.trim().length >= 20;
  return {
    id: "doc_readable",
    label: "Document text available",
    passed: ok,
    severity: "error",
    detail: ok
      ? "Document text was extracted and is readable."
      : "Could not read the document automatically — enter the details manually and the agent will verify them.",
  };
}

export function verifyEvent(event: EventRow): VerificationOutcome {
  const text = event.doc_text || "";
  const checks: CheckResult[] = [docCheck(text)];

  if (event.type === "name_correction" || event.type === "marriage_name_change") {
    checks.push({
      id: "gazette_no",
      label: "Gazette / certificate number found",
      passed: hasGazetteNo(text) || /certificate\s*(?:no\.?|number)/i.test(text),
      severity: "error",
      detail: "The notification or certificate number is the legal anchor of the correction.",
    });
    checks.push({
      id: "pub_date",
      label: "Publication / issue date found",
      passed: hasDate(text),
      severity: "warning",
      detail: "A dated document proves the correction is official and current.",
    });
    checks.push({
      id: "old_name",
      label: "Old name appears in the document",
      passed: contains(text, event.old_name),
      severity: "error",
      detail: "The document must reference the name being corrected away from.",
    });
    checks.push({
      id: "new_name",
      label: "New name appears in the document",
      passed: contains(text, event.new_name),
      severity: "error",
      detail: "The document must state the corrected name.",
    });
    checks.push({
      id: "names_differ",
      label: "Old and new names differ",
      passed: !!event.old_name && !!event.new_name && event.old_name.trim().toLowerCase() !== event.new_name.trim().toLowerCase(),
      severity: "error",
      detail: "A correction needs a before and an after.",
    });
  }

  if (event.type === "dob_correction") {
    const bothPresent = !!event.old_dob && !!event.new_dob;
    checks.push({
      id: "dob_both",
      label: "Old and new date of birth provided",
      passed: bothPresent,
      severity: "error",
      detail: "Both dates are needed to file the correction.",
    });
    let withinRange = false;
    let detail = "Could not compare the dates.";
    if (bothPresent) {
      const a = Date.parse(event.old_dob as string);
      const b = Date.parse(event.new_dob as string);
      if (!isNaN(a) && !isNaN(b)) {
        const yrs = Math.abs(b - a) / (365.25 * 24 * 3600 * 1000);
        withinRange = yrs <= 3;
        detail = withinRange
          ? `Difference is ${yrs.toFixed(1)} years — within UIDAI's ±3-year window for a standard correction.`
          : `Difference is ${yrs.toFixed(1)} years — beyond UIDAI's ±3-year window. This needs a regional UIDAI office hearing, not a standard update.`;
      }
    }
    checks.push({ id: "dob_range", label: "Within UIDAI ±3-year correction window", passed: withinRange, severity: "error", detail });
    checks.push({
      id: "dob_proof",
      label: "Supporting proof mentioned",
      passed: /birth certificate|passport|school|marksheet|certificate/i.test(text) || (event.extra_json || "").length > 2,
      severity: "warning",
      detail: "DOB correction needs a birth certificate, passport, or school certificate as proof.",
    });
  }

  if (event.type === "address_change") {
    checks.push({
      id: "addr_new",
      label: "New address provided",
      passed: !!event.new_address && event.new_address.trim().length >= 10,
      severity: "error",
      detail: "The full new address with PIN code is required.",
    });
    checks.push({
      id: "addr_proof",
      label: "Address proof indicated",
      passed: /rent|lease|electricity|gas|water|bill|agreement|ration/i.test(text) || (event.extra_json || "").length > 2,
      severity: "warning",
      detail: "Carry a rent agreement or utility bill as address proof.",
    });
  }

  const failedErrors = checks.filter((c) => !c.passed && c.severity === "error");
  return { passed: failedErrors.length === 0, checks };
}
