# EkSudhaar — एक सुधार · One correction, everywhere.

An agentic system for India's identity-document correction maze. A citizen records a **verified legal identity event once** (Gazette name change, marriage certificate, DOB/address correction) and the agent **propagates it across every registry** — Aadhaar, PAN, Voter ID, Bank KYC, PF/UAN, Passport — with the citizen's consent at each step, generating a correction pack and tracking every registry to completion.

Built for the **Code for India "Code for a Billion" Bharat Agentic-AI Hackathon 2026**.

## The problem

Aadhaar is the root identity record for ~134 crore Indians — and ~1.9 crore correction requests arrive in a single month. But:

- A name can be corrected **at most twice in a lifetime**; DOB only once, within ±3 years.
- A 2026 rule requires **Gazette publication even for a typo fix**.
- Every downstream document (PAN, voter ID, passport, bank KYC, PF) was made *from* Aadhaar details — so one error means **N separate queues, N separate months**, with no system propagating a verified correction anywhere.

DigiLocker is a wallet, not a correction system. Nothing answers: *"my name changed legally — now update everything."*

Full research: [`research/problem-space-report.md`](../research/problem-space-report.md)

## The solution

EkSudhaar's correction agent runs a six-stage pipeline, logging every decision to a visible activity feed:

1. **Intake** — record the event; the agent extracts fields from the uploaded document (OCR + LLM, offline heuristics when no key is set).
2. **Verify** — rule-based checks per event type (Gazette number, dates, old/new names, UIDAI ±3-year DOB window…), explained in plain language.
3. **Plan** — builds the registry list **topologically ordered** (Aadhaar first — PAN correction fails otherwise).
4. **Consent** — the citizen toggles each registry. Nothing proceeds without consent (DPDP Act-aligned).
5. **Generate** — a correction-pack PDF: per-registry checklists, documents to carry, fees, helplines, plus **filled letters** (bank KYC, EPFO joint declaration).
6. **Track** — one dashboard from *pending → completed*, with LLM-drafted nudges when a registry stalls and retry guidance on rejection.

## Quickstart

```bash
npm install
npm run build
npm start        # http://localhost:8080
```

Optional LLM (otherwise offline heuristics are used):

```bash
LLM_API_KEY=sk-... LLM_MODEL=gpt-4o-mini npm start
# Any OpenAI-compatible endpoint works via LLM_BASE_URL
```

Smoke test (boots the server, runs the full pipeline, asserts each stage):

```bash
npm run smoke
```

Docker:

```bash
docker build -t eksudhaar .
docker run -p 8080:8080 -v eksudhaar-data:/app/data eksudhaar
```

## 2-minute demo script

1. Open the app → **"Try the 2-minute demo"** (seeds Priya Sharma's Gazette case).
2. **Verification** passes — 6 checks on the simulated Gazette notification.
3. **Agent activity** shows intake → verify → plan reasoning.
4. **Propagation plan**: 6 registries in dependency order; toggle consent.
5. **Generate pack** → PDF with checklists + filled bank/EPFO letters.
6. **Tracker**: mark Aadhaar "filed", draft a nudge for PAN.

## API

| Method | Route | Purpose |
|---|---|---|
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

## Judging-criteria mapping

- **Size (25%)**: 134 cr Aadhaar holders; ~1.9 cr updates/month; every married woman, migrant, and enrolment-error victim hits this maze.
- **Severity (25%)**: blocked pensions, auto-rejected PF claims (83.1M claims/yr), inoperative PANs, months of manual labour per event.
- **Quality (25%)**: agentic pipeline with visible reasoning, dependency-ordered planning, consent gating, offline-capable, open source.
- **Proven impact (25%)**: instrumented for time-to-resolution and documents-fixed-per-event; pilot path via legal-aid NGOs.

## Roadmap

- Multilingual voice-first flow (Hindi, Marathi, …) for low-literacy users
- DigiLocker-issued document verification
- Registry API integrations where e-filing exists
- NGO / legal-aid partner pilot to measure real time-to-resolution

## License

MIT — built open-source for the Code for India hackathon.
