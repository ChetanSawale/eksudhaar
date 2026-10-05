# Problem-Space Report — "Code for a Billion" Bharat Agentic-AI Hackathon 2026

**Prepared:** 5 October 2026 · Research-only brief for Chetan Sawale's hackathon entry
**Theme:** India's identity-document correction maze — "one broken record poisons everything downstream"

---

## 1. Hackathon rules & rubric (what matters for problem choice)

**Event:** "Code for a Billion — Bharat Agentic-AI Hackathon 2026" · https://codeforindia.org/hackathon
**Timeline:** 15 Aug → 15 Nov 2026 (90 days) · Winners announced 5 Dec 2026
**Prize pool:** ₹18 lakh (per-track: ₹1.5L / ₹1L / ₹50K for 1st/2nd/3rd)
**Eligibility/submission:** Build in the AgentFoundry IDE · public GitHub repo + README · demo link (2–3 min video or live) · deployed to any cloud · open source (Apache-2.0/MIT) · submit via GitHub issue.
**Entry:** Multiple entries allowed; one per team. (Parent note: registration is handled separately by the parent agent.)

**10 impact areas (one per track):** Education · Sanitation · Waste Management · Clean Air · Clean Water · **Health** · **Timely Justice — Legal Backlog** · Transportation Safety · **Livelihood for the Uneducated** · Tech Employment for Youth.

**Judging:** 4 criteria × 25% each —
1. **Size of problem** — population scale the problem affects
2. **Severity of the problem** — consequences, human cost
3. **Quality of solution** — technical quality, UX, innovation
4. **Proven impact** — demonstrated results (ties broken by Proven impact, then Size)

Full rubric: https://github.com/karlmehta/code-for-a-billion/blob/main/JUDGING.md
⚠️ Note: the hackathon page's "See the full judging rubric" link resolves to trustmodel.ai (broken/mislabeled); the GitHub JUDGING.md above is the real rubric found via search.

**Strategic takeaway:** there is no explicit "Governance/DPI/digital identity" track. Identity-document problems score on *Size* (134-crore scale is unbeatable) and *Severity* (blocked benefits, frozen wages, months of manual labour), and fit best under **Timely Justice — Legal Backlog** (access to legal aid/document processes) and **Livelihood for the Uneducated** (benefit/KYC access for informal workers). No other problem family plausibly touches as large a population.

---

## 2. Primary problem deep-dive: India's identity-document correction maze

### 2.1 The dependency chain (why one error is catastrophic)

Aadhaar is the **root identity record** for India's document system. Errors made at enrolment (often by the operator, transliteration, or typos) propagate to every document created *from* Aadhaar details — PAN, voter ID (EPIC), passport, driving licence, ration card, bank KYC, PF/UAN, and more — because each downstream system's onboarding accepts Aadhaar as proof of name/DOB/address. The user then has to fix each document **separately**, in its own silo, with no cross-system propagation. This is the "one broken record poisons everything downstream" dynamic.

### 2.2 UIDAI Aadhaar demographic update rules (verified)

**What can be changed, and how often:**

| Field | Limit | Documents / flow |
|---|---|---|
| Name | **max 2× per lifetime** | Minor correction online (with proof); major change needs in-person ASK visit |
| Date of birth | **max 1× per lifetime**, only within **±3 years** of recorded date; larger gaps need a regional UIDAI office hearing | Birth certificate, passport, or PSE certificate (for under-18s, birth certificate now mandatory) |
| Gender | **max 1× per lifetime** | In-person ASK with supporting document |
| Address, mobile, photo | **unlimited** | Address online or ASK; mobile/biometric in person only |

**Fees:** ₹75 demographic update, ₹125 biometric update; document update free on myAadhaar till 14 June 2026.
**Sources:** [taxscan — UIDAI update rules](https://www.taxscan.in/uidai-limits-aadhaar-name-change-to-two-times-a-year-increases-cost-for-demographic-updates-to-rs-75/685387/), [ET "Do not change address until…"](https://economictimes.indiatimes.com/wealth/tax/do-not-change-aadhaar-card-address-until-it-is-really-necessary-here-is-how-you-can-avoid-common-mistakes/articleshow/121978606.cms?from=mdr), [timesnow — name rules](https://www.timesnownews.com/india/aadhaar-card-name-change-limit-check-how-many-times-you-can-change-name-on-aadhaar-card-article-151993959)

**The new strictness (2026):** A recent Gazette notification makes **official Gazette publication mandatory even for *minor* Aadhaar name corrections**, and requires applicants to attach an ID document bearing the old name. Effectively, even a typo fix now requires the full legal name-change process.
**Source:** [taxscan, "Mandatory Gazette Publication for even minor Aadhaar name corrections"](https://www.taxscan.in/mandatory-gazette-publication-for-even-minor-aadhaar-name-corrections-new-uidai-rules/693047/) ⚠️ *single recent secondary source — confirm against the UIDAI circular before citing in the submission.*

**What the limits mean for a 22-year-old with a wrong name (the user's scenario):**
1. A name can be corrected at most twice — and if it's a "major" change (or under the new rule, any change), it needs Gazette publication first.
2. A wrong DOB gets **one** shot within ±3 years; anything beyond needs a regional hearing.
3. Biometric mismatch can block *any* update — e.g. Gujarat HC (Feb 2025) heard a case where 22-year-old Mohammed Mansuri couldn't update his photo/DOB because his biometrics no longer matched, with UIDAI/MeitY asked to explain. **Source:** [MediaNama](https://www.medianama.com/2025/02/223-gujarat-hc-asks-uidai-meity-to-explain-biometric-auth-failures/)
4. **Aadhaar is NOT proof of date of birth** — UIDAI Circular 08/2023 (22 Dec 2023), reiterated by the Supreme Court (Oct 2024) and an EPFO circular (Jan 2024) — so a DOB on Aadhaar doesn't automatically fix DOB elsewhere. **Source:** [taxscan](https://www.taxscan.in/aadhaar-not-proof-of-date-of-birth-uidai-supreme-court-ruling-and-epfo-directives/684955/)

### 2.3 The legal name-change path in India (verified)

To legally change a name — which is now effectively required before Aadhaar can reflect it:

1. **Notarized affidavit** — on ₹10 stamp paper, stating old name, new name, reason, with 2 witnesses; joint affidavit (husband + wife) for marriage cases.
2. **Newspaper publication** — declaration in 2 newspapers (1 English + 1 regional language).
3. **Gazette notification** — apply to the Controller of Publications (central) or state gazette office; cost ~₹700–1,400; publication takes **15–45 days** (up to 1–3 months).
4. **Then update every document separately** — Aadhaar, PAN, passport, voter ID, bank accounts, loans, insurance, municipal records… each with its own form, queue, and waiting period.

**Sources:** [Legalsuvidha](https://www.legalsuvidha.com/change-name-legally-in-india-step-by-step-guide/), [Taxaj](https://www.taxaj.com/name-change-process-india-aadhaar/), [VakilSearch](https://vakilsearch.com/blog/legally-change-name-in-india/)

### 2.4 The downstream correction processes (each silo)

- **PAN:** name/DOB mismatch is the #1 PAN-Aadhaar linking failure. PAN-Aadhaar linking is mandatory (Sec 139AA); unlinked PAN becomes **inoperative**; late linking costs ₹1,000 (Sec 234H). Correction via Protean/NSDL (Form 49A correction request): **15–45 days**. **Source:** [protean](https://www.protean-tinpan.com/aadhaar-pan-link), [docupro](https://docupro.in/pan-card-correction/).
- **EPFO / PF- UAN:** a single misspelled name or wrong DOB → **instant auto-rejection** of claims/withdrawals. Fix requires a joint declaration with employer + supporting docs. **Source:** [finshots](https://finshots.in/archive/how-your-pf-claims-get-auto-rejected/), [finshots — EPFO joint declaration](https://finshots.in/archive/epfo-updates-aadhaar-related-queries-and-the-joint-declaration-process/)
- **Voter ID (EPIC):** correction via Form 8 on NVSP/voter portal; typically **15–30 days**, then re-download e-EPIC. **Source:** [eazypro](https://www.eazypro.in/post/how-to-correct-update-voter-id-card-online/)
- **Passport:** name change = apply for re-issue + marriage/gazette proof. **Source:** [wedmegood](https://www.wedmegood.com/blog/to-change-or-not-to-change-your-surname-after-marriage-know-it-all-before-you-do)
- **Bank KYC:** each bank separately, with marriage certificate / affidavit / Gazette as applicable.

### 2.5 Scale (verified anchors)

| Metric | Figure | Source |
|---|---|---|
| Live Aadhaar holders | **~134 crore** | [PIB, 18 Mar 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2112510) |
| Aadhaar numbers ever issued | **144.66 crore** | UIDAI/PIB |
| Authentication transactions FY2024-25 | **2,707 crore** | PIB |
| Cumulative e-KYC transactions | **2,356 crore** | [PIB, 28 Apr 2025](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2125580) |
| Aadhaar update requests (single month) | **~1.91 crore in March 2025 alone** (~23-crore/year pace) | PIB |
| Registered voters (electoral roll) | **99.1 crore** (Jan 2025; 97.98 crore at 2024 LS polls) | ECI via [madhyamam](https://madhyamamonline.com/india/india-now-has-991-crore-voters-gender-ratio-improves-to-954-1372667), [powercorridors](https://powercorridors.in/from-us-to-italy-voter-counts-rise-indias-sir-stands-out-as-a-stark-global-anomaly/) |
| EPFO claims per year (auto-reject exposure) | **83.1M claims** last fiscal | finshots |

⚠️ *UIDAI/CPGRAMS grievance volumes and rejection-rate aggregates: searched but found no citable figure — flag as a gap, not a claim. Annual update total is an annualisation of the verified March 2025 figure.*

---

## 3. Related problems in the same family ("one broken record poisons everything downstream")

### 3.1 Name-change after marriage (women)
- **Who:** Crores of women who adopt a new surname post-marriage — and anyone divorcing/separated who wants the maiden name back. The legal path is the full one: joint affidavit + 2 newspaper ads + Gazette (15–30 working days) + per-document updates (PAN, bank, passport re-issue, Aadhaar, etc.). The Delhi High Court recently had to deal with a notification requiring women to submit an **NOC from their husband** (or divorce decree) to revert to their maiden surname. **Sources:** [wedmegood](https://www.wedmegood.com/blog/from-miss-to-mrs-things-no-one-tells-you-about-changing-your-name/amp), [vakilsearch](https://vakilsearch.com/blog/legally-change-name-in-india/), [jagranjosh](https://www.jagranjosh.com/general-knowledge/does-a-married-woman-hold-a-right-to-her-maiden-surname-heres-the-matter-explained-1710001857-1?ex_cid=GOOGLENEWSSTAND-RSS)
- **Scale:** No verified single official count of annual surname changes; it recurs at every marriage (~crores of marriages/year). **Flag as unverified magnitude** — but the affected population is unambiguously in the crores.
- **Severity:** Months of paperwork repeated at 8–10 different institutions; a mismatched name across documents blocks KYC, loans, visas, and benefit transfers.

### 3.2 Transliteration / spelling mismatches across Indian languages
- **Who:** Anyone whose name was entered in English at enrolment from a regional-language original — "Mohammed" vs "Muhammad", "R. Kumar" vs "Rahul Kumar", swapped surname order, dropped middle names. These mismatches are the **leading cause of PAN-Aadhaar linking failures and KYC rejections**. **Source:** [docupro](https://docupro.in/pan-card-correction/)
- **Scale:** Implied subset of the ~23 crore/year update requests; no verified exact count (flag).
- **Severity:** Hard blockers — cannot link PAN, cannot pass bank e-KYC, visa applications bounce.

### 3.3 Migrant workers' address/portability
- **Who:** India's ~45.6 crore internal migrants (Census 2011). Ration, DBT, and many benefits are address-linked; the One Nation One Ration Card (ONORC) scheme needs Aadhaar seeding + biometric auth at the destination, but exclusion errors at enrolment and de-duplication failures persist. UP ran a dedicated special campaign to seed migrants' Aadhaar into ration cards. **Sources:** [PRS India](https://prsindia.org/policy/vital-stats/ration-card-portability-for-migrants), [UP seeding campaign](https://up.gov.in/en/pressrelease/mgnREhF9GRLFzNkQ1LkP09K2JhL2I2NkN)
- **Severity:** Benefits not received at the destination state = food/subsidy denied; this is the "Livelihood for the Uneducated" angle.

### 3.4 Date-of-birth errors blocking pensions, scholarships, retirement
- **Who:** Workers and students whose recorded DOB differs from their birth certificate/school records. DOB correction is allowed **once** and only within ±3 years; beyond that, a regional UIDAI hearing. And since **Aadhaar is not valid DOB proof**, the "corrected" Aadhaar still doesn't fix school/pension records. **Source:** [taxscan DOB rules](https://www.taxscan.in/aadhaar-not-proof-of-date-of-birth-uidai-supreme-court-ruling-and-epfo-directives/684955/)
- **Severity:** Pension disbursal blocked, scholarship applications rejected, retirement age disputes, EPFO withdrawals frozen.

### 3.5 Deceased persons' records staying live (ghost records)
- **Who:** Families of the deceased; the state. MediaNama's analysis: **~2 crore Aadhaar numbers deactivated** vs **~16 crore deaths** in the same period — a gap of roughly **13.5 crore un-deactivated records**, enabling identity fraud, continued benefit siphoning, and duplicate/ghost beneficiaries. A family self-report service launched 9 Jun 2025, but only covers states/UTs on the Civil Registration System (24–25 of them); UIDAI's own auto-deactivation needs a 90% name + 100% gender match with death-registry data. **Source:** [MediaNama](https://www.medianama.com/2026/02/223-medianama-explainer-aadhaar-numbers-of-deceased-persons/)
- **Severity:** Fraud surface for a decade-plus; families face their own mini-maze (bank account closure, ration card deletion, voter-roll deletion — each separate).

### 3.6 Biometric lockout
- **Who:** Elderly, manual labourers, people with fading fingerprints. If biometrics don't match, *even the correction process itself* can't be started — the Gujarat HC case (§2.2) is the sharp example. No verified aggregate count (flag).

### 3.7 DigiLocker and the missing propagation layer
- DigiLocker (52–67 crore users, 900–990+ crore documents issued, 2025–26 figures) is a **document wallet**, not a correction system: it stores and fetches issued documents but has **no mechanism for a verified correction to propagate** across registries. MeriPehchaan (~196M users) is single sign-on/authentication only; e-Pramaan is an auth framework. None of them answers: "my name changed legally — now update everything."
**Sources:** [MediaNama — DigiLocker FY26](https://www.medianama.com/2025/12/223-digilocker-crosses-57-crore-users/); [MeriPehchaan LinkedIn explainer](https://www.linkedin.com/pulse/one-india-one-login-understanding-meripehchaan-national-sso-singh-7i8zf/)

---

## 4. What already exists — and the specific gaps

| System | What it does | What it does NOT do |
|---|---|---|
| **UIDAI myAadhaar portal** | Per-field update requests for one person's Aadhaar; fee ₹75/₹125; ASK in-person for biometrics | No propagation to any downstream registry; hard lifetime limits (name 2×, DOB 1×); biometric lockout; now Gazette-mandatory even for minor corrections |
| **DigiLocker** | Wallet for issued documents (52–67 cr users) | No correction workflow; no cross-registry propagation; documents in it can *become stale* after a correction elsewhere |
| **MeriPehchaan** | National SSO — one login across services (~196M users) | Auth only; no identity-event/correction layer |
| **e-Pramaan** | Auth framework | Same as above |
| **State service portals** (edistrict etc.) | Per-service applications | Per-department silos, no shared identity-event bus |
| **EPFO joint-declaration** | Employer-attested correction for PF records | Manual, paper-heavy, employer-dependent; no link to the originating Aadhaar correction |

**The gap (the opening for an agentic build):** No system exists where a citizen records a **verified legal identity event once** (Gazette notification, marriage certificate, death certificate, court order) and an agent **propagates it to every linked registry with consent**, tracking per-registry status, generating correctly-filled forms, and chasing rejections. Everything today is manual fan-out: one legal event → N separate queues.

---

## 5. Ranked recommended problem statements

### Rank 1 — "One correction, everywhere": the identity-event propagation agent
**Problem:** A verified identity event (name change via Gazette, marriage, DOB court order, death certificate) currently has to be re-proved at 8–10 institutions separately. Citizens do months of manual fan-out; the uneducated and rural pay touts or give up and lose benefits.
**Solution shape:** An agentic system where the user uploads the single verified event + supporting docs once; the agent (a) verifies authenticity (DigiLocker-issued Gazette/death/marriage certificates, OCR + cross-check), (b) generates correctly-filled per-registry correction requests (Aadhaar, PAN, EPIC, bank KYC letters, PF joint declaration), (c) files what can be filed via available APIs/portals and queues the rest with reminders, (d) tracks per-registry status with a single dashboard, and (e) retries/escalates rejections. Consent-gated at every step (DPDP Act compliance story).
**Hackathon fit:**
- **Timely Justice — Legal Backlog:** legal-aid/document-access angle — name changes, DOB disputes, and deceased-record cleanup are all currently lawyer/tout-mediated legal processes.
- **Livelihood for the Uneducated:** the primary victims of the fan-out are informal workers — blocked DBT, frozen PF, denied rations.
- **Size:** 134 crore Aadhaar holders; ~1.9 crore update requests/month (March 2025 pace); 99.1 crore electors in the downstream voter roll.
- **Severity:** real money and rights — pensions, PF withdrawals (83.1M claims/yr), scholarships, rations; months of labour per event.
- **Proven impact path:** instrument time-to-resolution and documents-fixed-per-event; even a pilot showing "one event → 6 registries in days not months" is measurable.

### Rank 2 — PF/UAN mismatch rescue agent (Livelihood for the Uneducated)
**Problem:** EPFO auto-rejects claims on any name/DOB mismatch (83.1M claims/year exposure). Informal workers discover the mismatch only at withdrawal — when they need the money most — and the joint-declaration fix is employer-dependent and paper-heavy.
**Solution shape:** Diagnose the exact mismatch across Aadhaar/PAN/UAN, generate the correct joint-declaration pack, walk the worker (voice-first, multilingual) through the EPFO employer loop, and track the claim to disbursal.
**Fit:** purest **Livelihood for the Uneducated** entry; narrower but extremely sharp severity (wages locked). Weaker on "size" than Rank 1 but unbeatable on a severity story.

### Rank 3 — Death-event cascade agent (Timely Justice / Livelihood)
**Problem:** ~13.5 crore gap between deaths and Aadhaar deactivations enables fraud; grieving families must separately close Aadhaar, voter roll, ration card, bank accounts.
**Solution shape:** One family death-certificate report → consent-gated cascade to Aadhaar (deactivation request), electoral roll (Form 8 deletion), ration card, bank account-closure letters — with fraud-signal reporting on the un-deactivated-record gap.
**Fit:** Timely Justice (estate/legal closure) + fraud reduction. Smaller immediate user base than Rank 1, but a distinctive, news-cycle-backed severity story.

**Recommendation:** Lead with **Rank 1** — it is the only one that scores maximally on both 25%-weight criteria (Size: 134-crore base; Severity: money/rights blocked) while remaining a clean agentic-AI build (multi-step orchestration, document verification, status tracking, retry logic — exactly what the AgentFoundry IDE is for). Ranks 2 and 3 are strong fallbacks or modules *inside* Rank 1 (the propagation engine's "PF module" and "death-event module").

---

## 6. Flags — what could not be verified (do not claim these)

1. **Gazette-mandatory for minor Aadhaar corrections** — single recent secondary source (taxscan); confirm against the UIDAI circular before using in the submission.
2. **Annual Aadhaar update total** — only the March 2025 figure (1.91 crore) is verified; the ~23-crore/year figure is an annualisation, not an official stat.
3. **UIDAI/CPGRAMS grievance volumes and rejection rates** — searched; no citable aggregate found.
4. **PAN-Aadhaar "inoperative PAN" counts** — not verified.
5. **Annual surname-change-after-marriage count** — no single official figure found; population is "crores" but unquantified.
6. **Biometric-failure aggregate counts** — not verified; only the Gujarat HC case as an exemplar.
7. **Transliteration-mismatch counts** — characterised as the leading PAN-linking failure cause (docupro) but without a verified number.

---

## Sources (inline URLs)

- Hackathon: https://codeforindia.org/hackathon
- Judging rubric: https://github.com/karlmehta/code-for-a-billion/blob/main/JUDGING.md
- UIDAI limits: https://www.taxscan.in/uidai-limits-aadhaar-name-change-to-two-times-a-year-increases-cost-for-demographic-updates-to-rs-75/685387/
- Gazette-mandatory rule: https://www.taxscan.in/mandatory-gazette-publication-for-even-minor-aadhaar-name-corrections-new-uidai-rules/693047/
- Address-update caution: https://economictimes.indiatimes.com/wealth/tax/do-not-change-aadhaar-card-address-until-it-is-really-necessary-here-is-how-you-can-avoid-common-mistakes/articleshow/121978606.cms?from=mdr
- Name-change rules: https://www.timesnownews.com/india/aadhaar-card-name-change-limit-check-how-many-times-you-can-change-name-on-aadhaar-card-article-151993959
- Biometric lockout (Gujarat HC): https://www.medianama.com/2025/02/223-gujarat-hc-asks-uidai-meity-to-explain-biometric-auth-failures/
- Aadhaar not DOB proof: https://www.taxscan.in/aadhaar-not-proof-of-date-of-birth-uidai-supreme-court-ruling-and-epfo-directives/684955/
- Legal name-change process: https://www.legalsuvidha.com/change-name-legally-in-india-step-by-step-guide/ · https://www.taxaj.com/name-change-process-india-aadhaar/ · https://vakilsearch.com/blog/legally-change-name-in-india/
- PIB (134 cr holders): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2112510
- PIB (e-KYC 2,356 cr): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2125580
- PAN-Aadhaar: https://www.protean-tinpan.com/aadhaar-pan-link · https://docupro.in/pan-card-correction/
- EPFO rejection: https://finshots.in/archive/how-your-pf-claims-get-auto-rejected/ · https://finshots.in/archive/epfo-updates-aadhaar-related-queries-and-the-joint-declaration-process/
- Voter ID correction: https://www.eazypro.in/post/how-to-correct-update-voter-id-card-online/
- Electoral roll scale: https://madhyamamonline.com/india/india-now-has-991-crore-voters-gender-ratio-improves-to-954-1372667
- Migrants/ONORC: https://prsindia.org/policy/vital-stats/ration-card-portability-for-migrants · https://up.gov.in/en/pressrelease/mgnREhF9GRLFzNkQ1LkP09K2JhL2I2NkN
- Deceased records: https://www.medianama.com/2026/02/223-medianama-explainer-aadhaar-numbers-of-deceased-persons/
- DigiLocker scale: https://www.medianama.com/2025/12/223-digilocker-crosses-57-crore-users/
- MeriPehchaan: https://www.linkedin.com/pulse/one-india-one-login-understanding-meripehchaan-national-sso-singh-7i8zf/
- Marriage name change: https://www.wedmegood.com/blog/from-miss-to-mrs-things-no-one-tells-you-about-changing-your-name/amp · https://www.jagranjosh.com/general-knowledge/does-a-married-woman-hold-a-right-to-her-maiden-surname-heres-the-matter-explained-1710001857-1?ex_cid=GOOGLENEWSSTAND-RSS
