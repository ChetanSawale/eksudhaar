# EkSudhaar — एक सुधार · File once. Succeed 100%.

A **free pre-filing simulator** for Indian identity-document corrections. Every rejected correction burns real money — Aadhaar ₹75–125, PAN ₹107, passport ₹1,500 per attempt, plus agents, travel and lost days, all non-refundable. Citizens build their correction application on EkSudhaar's free portal; a rules engine validates every field, document, fee and sequence against national + state rules and returns a live **success score (0–100)**. At 100%, every check passes — **file with confidence**, not hope.

> **Honest framing:** 100% means the application passes every check in EkSudhaar's rules knowledge base. It is not a guarantee of government approval — final approval always rests with the issuing authority (UIDAI, Income Tax Department, etc.). The knowledge base is compiled from public sources; verify critical cases before filing.

Built for the **Code for India "Code for a Billion" Bharat Agentic-AI Hackathon 2026**.

## The problem

Aadhaar is the root identity record for ~134 crore Indians — and ~1.9 crore correction requests arrive in a single month. But:

- A name can be corrected **at most twice in a lifetime**; DOB only once, within ±3 years.
- A complete name change needs **Gazette publication** (minor spelling fixes don't, per UIDAI's Sept 2026 revised SOP).
- Every downstream document (PAN, voter ID, passport, bank KYC, PF) was made *from* Aadhaar details — so one error means **N separate queues, N separate months**.
- Every filing fee is **non-refundable on rejection** — a failed attempt costs the fee *and* the weeks.

DigiLocker is a wallet, not a correction system. Nothing answers: *"will my application survive the rules before I pay?"*

Full research: [`research/problem-space-report.md`](../research/problem-space-report.md)

## The solution

**Simulate first, pay once.** A four-step wizard (what are you correcting? which state? your details? which documents do you have?) drives a live score:

1. **Rules knowledge base** (`src/laws/`) — ~28 encoded rules across national (UIDAI/Aadhaar, PAN, Passport, Voter ID, Bank KYC/RBI norms, EPFO) and 5 states' gazette processes (Maharashtra, Delhi, UP, West Bengal, Tamil Nadu). Uncertain points are informational "verify" notes, never hard fails. No invented section numbers or URLs.
2. **Simulator engine** (`src/simulate/`) — `POST /api/simulate` runs every applicable rule, returning `{ score, checks[], moneyAtRisk, readyToFile, nextFix }`. Each failing check carries plain-language fix advice; `nextFix` surfaces the single most impactful fix.
3. **Money at stake** — the engine totals official fees across relevant registries (e.g. ₹1,682 for a full name-change journey: Aadhaar ₹75 + PAN ₹107 + passport ₹1,500) plus typical extras (~₹500/agent/travel per fee-bearing attempt), framed as *estimated charges saved by avoiding failed attempts*.
4. **At 100%** — the "Generate my filing pack" button creates the correction event and hands off to the agentic pipeline: verification → dependency-ordered plan (Aadhaar first) → per-registry consent → correction-pack PDF (checklists + filled bank/EPFO letters) → tracker with nudges.
5. **What a dishonest agent won't tell you** — the simulator names the exploitation plainly: some agents file applications they *know* will fail, just to collect form-filling charges. Every failing check is shown in plain language *before* anyone touches your application, and at 100% you can print a one-page **center-visit sheet** proving your file is rule-ready — so no agent can charge you for a doomed filing.
6. **Online-first** — each registry carries an honest online path (`online` in `src/registries/catalog.ts`): PAN, Voter ID and EPFO are fully online; Aadhaar name/DOB, passport and bank KYC each need exactly one mandatory visit (biometric / in-person verification), and the app says so. The simulator returns a **zero-visit plan** — everything doable online is done from home. `GET /api/registries` exposes the catalog for the UI badges.

## Quickstart

```bash
npm install
npm run build
npm start        # http://localhost:8080
```

Smoke test (boots the server, runs the simulator + full agent pipeline, asserts each step):

```bash
npm run smoke
```

Docker:

```bash
docker build -t eksudhaar .
docker run -p 8080:8080 -v eksudhaar-data:/app/data eksudhaar
```

## 2-minute demo script

1. Open the app → scroll to **"Watch the agent work"** → **"Try the 2-minute demo"** (seeds Priya Sharma's Gazette case).
2. **Simulator**: try a name correction with no Gazette — watch the score drop and the fix advice appear; add the Gazette and hit 100%.
3. **Verification** passes — checks on the simulated Gazette notification.
4. **Agent activity** shows intake → verify → plan reasoning.
5. **Propagation plan**: 6 registries in dependency order; toggle consent.
6. **Generate pack** → PDF with checklists + filled bank/EPFO letters.
7. **Tracker**: mark Aadhaar "filed", draft a nudge for PAN.

## API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/simulate` | Score an application: `{eventType, state, documents[], fields{}}` → `{score, checks[], moneyAtRisk, readyToFile, nextFix, disclaimer}` |
| GET | `/api/simulate/meta` | Event types, states, documents, and the rules knowledge base |
| POST | `/api/events` | Create event (multipart: fields + document) |
| POST | `/api/demo/seed` | Seed the demo event |
| GET | `/api/events/:id` | Event details |
| POST | `/api/events/:id/verify` | Run verification |
| GET | `/api/events/:id/plan` | Ordered plan + consents |
| POST | `/api/events/:id/consent` | Set per-registry consent |
| POST | `/api/events/:id/pack` | Generate correction-pack PDF |
| GET/POST | `/api/events/:id/tracker[/:registry]` | Tracking statuses |
| POST | `/api/events/:id/nudge/:registry` | Draft a follow-up reminder |
| GET | `/api/events/:id/agent-log` | Full agent activity feed |

## Knowledge-base coverage

- **National**: UIDAI revised SOP (Sept 2026) — Gazette not required for minor corrections, mandatory for complete name changes; name ≤ 2×/lifetime; DOB once within ±3 years; PoI/PoA/PoB/DOB categories. PAN Form 49A (₹107, Aadhaar e-KYC needs exact match — Aadhaar first). Passport re-issue (₹1,500, original Gazette). Voter Form 8 (free). Bank KYC under RBI CKYC norms. EPFO joint declaration.
- **State**: gazette publication process notes for Maharashtra, Delhi, Uttar Pradesh, West Bengal, Tamil Nadu; marriage registration under Hindu Marriage Act / Special Marriage Act.
- Every rule carries a generic public-source label. Nothing here is legal advice.

## Judging-criteria mapping

- **Size (25%)**: 134 cr Aadhaar holders; ~1.9 cr updates/month; every married woman, migrant, and enrolment-error victim hits this maze.
- **Severity (25%)**: blocked pensions, auto-rejected PF claims (83.1M claims/yr), inoperative PANs — plus crores wasted on rejected filings.
- **Quality (25%)**: rules-engine simulator with live scoring, visible per-rule reasoning, dependency-ordered planning, consent gating, offline-capable, open source.
- **Proven impact (25%)**: instrumented for time-to-resolution, filings-saved, and estimated charges saved per 100%-score filing; pilot path via legal-aid NGOs.

## Roadmap

- Multilingual voice-first flow (Hindi, Marathi, …) for low-literacy users
- More states' gazette processes; DigiLocker-issued document verification
- Registry API integrations where e-filing exists
- NGO / legal-aid partner pilot to measure real time-to-resolution

## License

MIT — built open-source for the Code for India hackathon.
