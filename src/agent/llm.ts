/**
 * Pluggable LLM layer for the EkSudhaar agent.
 *
 * The agent calls the provider at decision points (field extraction from OCR
 * text, explaining verification results, drafting reminders). Two providers:
 *  - HeuristicLLM: offline regex/template fallback — the demo works with no keys.
 *  - OpenAICompatibleLLM: any OpenAI-compatible chat API when LLM_API_KEY is set.
 */

export interface EventFields {
  oldName?: string;
  newName?: string;
  oldDob?: string;
  newDob?: string;
  oldAddress?: string;
  newAddress?: string;
  gazetteNo?: string;
  gazetteDate?: string;
  certNo?: string;
}

export interface LLMProvider {
  readonly name: string;
  extractEventFields(ocrText: string, eventType: string): Promise<Partial<EventFields>>;
  explainVerification(failures: string[]): Promise<string>;
  draftReminder(registryName: string, daysStuck: number, nextStep: string): Promise<string>;
}

/** Offline fallback: regexes + templates. No network, no keys. */
export class HeuristicLLM implements LLMProvider {
  readonly name = "heuristic (offline)";

  async extractEventFields(ocrText: string, _eventType: string): Promise<Partial<EventFields>> {
    const out: Partial<EventFields> = {};
    const t = ocrText || "";

    const gaz = t.match(/gazette\s+(?:notification\s+)?(?:no\.?|number)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/\.]{2,40})/i);
    if (gaz) out.gazetteNo = gaz[1].trim();

    const dates = [...t.matchAll(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g)].map((m) => m[1]);
    if (dates.length > 0) out.gazetteDate = dates[0];

    // "from OLD NAME to NEW NAME" / "changed from X to Y" / "S/O, W/O" patterns
    const nameChange =
      t.match(/(?:changed\s+)?from\s+([A-Z][A-Za-z .]{2,40}?)\s+to\s+([A-Z][A-Za-z .]{2,40}?)(?:\.|,|\n|$)/) ||
      t.match(/old\s+name\s*[:\-]\s*([A-Z][A-Za-z .]{2,40}?)\s*\n?.*?new\s+name\s*[:\-]\s*([A-Z][A-Za-z .]{2,40}?)(?:\.|,|\n|$)/i);
    if (nameChange) {
      out.oldName = nameChange[1].trim();
      out.newName = nameChange[2].trim();
    }

    const dob = t.match(/(?:date\s+of\s+birth|dob)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*(?:to|changed\s+to|corrected\s+to)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (dob) {
      out.oldDob = dob[1];
      out.newDob = dob[2];
    }

    const cert = t.match(/(?:certificate|cert\.?|registration)\s*(?:no\.?|number)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/\.]{2,30})/i);
    if (cert) out.certNo = cert[1].trim();

    return out;
  }

  async explainVerification(failures: string[]): Promise<string> {
    if (failures.length === 0) return "All verification checks passed. The document looks authentic and complete.";
    return (
      "Verification needs attention:\n" +
      failures.map((f) => `• ${f}`).join("\n") +
      "\nFix the document or enter the details manually — the agent will re-verify."
    );
  }

  async draftReminder(registryName: string, daysStuck: number, nextStep: string): Promise<string> {
    return (
      `Your ${registryName} correction has been waiting ${daysStuck} day(s). ` +
      `Next step: ${nextStep} Carry your correction pack and the acknowledgement receipt, and ask for the current status.`
    );
  }
}

/** Any OpenAI-compatible chat completions API (OpenAI, or a local server). */
export class OpenAICompatibleLLM implements LLMProvider {
  readonly name: string;
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor() {
    this.baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    this.apiKey = process.env.LLM_API_KEY || "";
    this.model = process.env.LLM_MODEL || "gpt-4o-mini";
    this.name = `openai-compatible (${this.model})`;
  }

  private async chat(system: string, user: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`LLM API error ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() || "";
  }

  async extractEventFields(ocrText: string, eventType: string): Promise<Partial<EventFields>> {
    const fallback = new HeuristicLLM();
    try {
      const raw = await this.chat(
        "You extract identity-event fields from Indian government document OCR text. Reply with ONLY a JSON object using keys: oldName, newName, oldDob, newDob, oldAddress, newAddress, gazetteNo, gazetteDate, certNo. Omit unknown keys.",
        `Event type: ${eventType}\nOCR text:\n${ocrText.slice(0, 4000)}`,
      );
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("no JSON in reply");
      return JSON.parse(raw.slice(start, end + 1)) as Partial<EventFields>;
    } catch {
      return fallback.extractEventFields(ocrText, eventType);
    }
  }

  async explainVerification(failures: string[]): Promise<string> {
    if (failures.length === 0) return "All verification checks passed. The document looks authentic and complete.";
    try {
      return await this.chat(
        "You help Indian citizens fix identity documents. Explain verification failures in simple, reassuring language (2-4 sentences).",
        `These checks failed:\n${failures.join("\n")}`,
      );
    } catch {
      return new HeuristicLLM().explainVerification(failures);
    }
  }

  async draftReminder(registryName: string, daysStuck: number, nextStep: string): Promise<string> {
    try {
      return await this.chat(
        "You write short, polite SMS-style reminders (under 40 words) for Indian citizens tracking a government document correction.",
        `Registry: ${registryName}. Waiting ${daysStuck} days. Next step: ${nextStep}`,
      );
    } catch {
      return new HeuristicLLM().draftReminder(registryName, daysStuck, nextStep);
    }
  }
}

/** Returns the OpenAI-compatible provider when a key is configured, else heuristics. */
export function getProvider(): LLMProvider {
  if (process.env.LLM_API_KEY) return new OpenAICompatibleLLM();
  return new HeuristicLLM();
}
