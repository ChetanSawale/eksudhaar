/* EkSudhaar frontend: landing + pre-filing simulator + classic agent flow. Vanilla JS. */
const $ = (id) => document.getElementById(id);

/* ================= reveal on scroll ================= */
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("revealed")),
  { threshold: 0.12 },
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* seamless marquee: duplicate content */
(() => {
  const m = $("marqueeInner");
  if (m) m.innerHTML += m.innerHTML;
})();

/* ================= registries + online-first ================= */
let REGISTRY_DATA = [];

async function loadRegistries() {
  try {
    const r = await fetch("/api/registries");
    const j = await r.json();
    REGISTRY_DATA = j.registries || [];
    const grid = $("regGrid");
    if (grid) {
      grid.innerHTML = REGISTRY_DATA.map((reg) => `
        <div class="regcard reveal revealed">
          <h4>${reg.short} <span>${reg.name.split("(")[1] ? reg.name.split("(")[1].replace(")", "") : ""}</span></h4>
          <p>${reg.online.fullyOnline ? "Fully online — no visit needed." : reg.online.visitReason}</p>
          <div class="cardbadges">
            <span class="badge ${reg.online.fullyOnline ? "online" : "visit"}">${reg.online.fullyOnline ? "✓ Fully online" : "1 mandatory visit"}</span>
          </div>
          <b>${reg.fee}</b>
        </div>`).join("");
    }
    const on = $("onlineList"), vi = $("visitList");
    if (on && vi) {
      on.innerHTML = REGISTRY_DATA.filter((x) => x.online.fullyOnline).map((x) =>
        `<div class="onlinerow"><strong>${x.short}</strong><span>${x.online.onlineSteps[0] || ""}</span></div>`).join("");
      vi.innerHTML = REGISTRY_DATA.filter((x) => !x.online.fullyOnline).map((x) =>
        `<div class="onlinerow"><strong>${x.short}</strong><span>${x.online.visitReason}</span></div>`).join("");
    }
  } catch (e) { /* registries section stays empty rather than breaking the page */ }
}

/* ================= simulator ================= */
const META = { eventTypes: {}, states: [], documents: [] };
const sim = { type: null, state: "", docs: new Set(), fields: {}, step: 1 };
let simTimer = null;

const TYPE_META = {
  name_correction: { t: "Name correction", d: "Spelling fix or legal name change (Gazette)." },
  marriage_name_change: { t: "Name change after marriage", d: "New surname / name via marriage certificate + Gazette." },
  dob_correction: { t: "Date-of-birth correction", d: "Fix a wrong DOB — once, within ±3 years." },
  address_change: { t: "Address change", d: "New address with rent agreement / utility bill." },
};

async function loadMeta() {
  try {
    const r = await fetch("/api/simulate/meta");
    const j = await r.json();
    META.eventTypes = j.eventTypes; META.states = j.states; META.documents = j.documents;
    buildSimTypes(); buildSimStates(); buildSimDocs();
    $("ruleCount").textContent = j.ruleCount;
    $("jurisCount").textContent = new Set(j.rules.map((x) => x.jurisdiction)).size;
    $("srcCount").textContent = j.sourceCount;
    $("srcChips").innerHTML = [...new Set(j.rules.map((x) => x.sourceLabel))].map((s) => `<span>${s}</span>`).join("");
  } catch (e) {
    $("simTypes").innerHTML = `<p class="muted">Could not load the simulator — is the server running?</p>`;
  }
}

function buildSimTypes() {
  const box = $("simTypes"); box.innerHTML = "";
  for (const [k, v] of Object.entries(TYPE_META)) {
    const b = document.createElement("button");
    b.className = "typecard" + (sim.type === k ? " sel" : "");
    b.innerHTML = `<h4>${v.t}</h4><p>${v.d}</p>`;
    b.onclick = () => {
      sim.type = k; sim.fields = {};
      buildSimTypes(); buildSimFields(); goStep(2); scheduleSimulate();
    };
    box.appendChild(b);
  }
}

function buildSimStates() {
  const box = $("simStates"); box.innerHTML = "";
  const mk = (label, val) => {
    const b = document.createElement("button");
    b.className = "chip" + (sim.state === val ? " sel" : "");
    b.textContent = label;
    b.onclick = () => { sim.state = val; buildSimStates(); goStep(3); scheduleSimulate(); };
    box.appendChild(b);
  };
  META.states.forEach((s) => mk(s, s));
  mk("Other / not listed", "");
}

function pillRow(label, options, current, onPick) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<label style="margin-bottom:2px">${label}</label>`;
  const pills = document.createElement("div");
  pills.className = "pills";
  options.forEach(([val, text]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (current === val ? " sel" : "");
    b.textContent = text;
    b.onclick = () => onPick(val);
    pills.appendChild(b);
  });
  wrap.appendChild(pills);
  return wrap;
}

function textField(label, key, placeholder, type) {
  const l = document.createElement("label");
  l.innerHTML = `${label}`;
  const i = document.createElement("input");
  i.type = type || "text"; i.placeholder = placeholder || ""; i.value = sim.fields[key] || "";
  i.oninput = () => { sim.fields[key] = i.value; scheduleSimulate(); };
  l.appendChild(i);
  return l;
}

function buildSimFields() {
  const box = $("simFields"); box.innerHTML = "";
  const t = sim.type;
  if (!t) return;
  if (t === "name_correction" || t === "marriage_name_change") {
    box.appendChild(textField("Current name (as on documents today)", "oldName", "e.g. Priya Sharna"));
    box.appendChild(textField("Correct name (as it should read)", "newName", "e.g. Priya Sharma"));
    if (t === "name_correction") {
      box.appendChild(pillRow("How big is the change?", [["minor", "Minor — spelling fix"], ["major", "Major — complete name change"]], sim.fields.nameScope,
        (v) => { sim.fields.nameScope = v; buildSimFields(); scheduleSimulate(); }));
      box.appendChild(textField("Aadhaar name corrections done before (lifetime)", "previousNameCorrections", "0, 1 or 2", "number"));
    } else {
      const note = document.createElement("p");
      note.className = "muted small";
      note.textContent = "A post-marriage name change is treated as a complete name change — Gazette publication applies.";
      box.appendChild(note);
    }
    box.appendChild(textField("Gazette notification number (if published)", "gazetteNumber", "e.g. MHA-2026/18473"));
    box.appendChild(textField("EPIC / voter ID number (if you know it)", "epicNumber", "e.g. ABC1234567"));
  } else if (t === "dob_correction") {
    box.appendChild(textField("Current date of birth (on Aadhaar)", "oldDob", "DD/MM/YYYY"));
    box.appendChild(textField("Correct date of birth", "newDob", "DD/MM/YYYY"));
    box.appendChild(pillRow("Have you corrected your DOB before?", [[false, "No"], [true, "Yes"]], sim.fields.dobCorrectedBefore,
      (v) => { sim.fields.dobCorrectedBefore = v; buildSimFields(); scheduleSimulate(); }));
  } else if (t === "address_change") {
    const l = document.createElement("label");
    l.innerHTML = "New address (with PIN code)";
    const ta = document.createElement("textarea");
    ta.rows = 3; ta.placeholder = "Flat, street, area, city — PIN"; ta.value = sim.fields.newAddress || "";
    ta.oninput = () => { sim.fields.newAddress = ta.value; scheduleSimulate(); };
    l.appendChild(ta); box.appendChild(l);
  }
}

function buildSimDocs() {
  const box = $("simDocs"); box.innerHTML = "";
  META.documents.forEach((d) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (sim.docs.has(d.id) ? " sel" : "");
    b.innerHTML = `${d.label}<small>${d.hint}</small>`;
    b.onclick = () => { sim.docs.has(d.id) ? sim.docs.delete(d.id) : sim.docs.add(d.id); buildSimDocs(); scheduleSimulate(); };
    box.appendChild(b);
  });
}

function goStep(n) {
  sim.step = n;
  [1, 2, 3, 4].forEach((i) => $("simStep" + i).classList.toggle("hidden", i !== n));
  document.querySelectorAll(".simsteps li").forEach((li) => {
    const s = Number(li.dataset.s);
    li.classList.toggle("active", s === n);
    li.classList.toggle("done", s < n);
    li.onclick = () => goStep(s);
  });
}
document.querySelectorAll("[data-next]").forEach((b) => (b.onclick = () => goStep(Number(b.dataset.next))));
document.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => goStep(Number(b.dataset.back))));

function scheduleSimulate() {
  clearTimeout(simTimer);
  simTimer = setTimeout(runSimulate, 350);
}

const RING_C = 527.8, HERO_C = 326.7;
function setRing(arcId, numId, circ, score) {
  const arc = $(arcId);
  arc.style.strokeDashoffset = circ * (1 - score / 100);
  arc.style.stroke = score === 100 ? "var(--green)" : score >= 80 ? "var(--saffron)" : score >= 50 ? "var(--amber)" : "var(--red)";
  $(numId).textContent = score + "%";
}

async function runSimulate() {
  if (!sim.type) return;
  const fields = { ...sim.fields };
  if (fields.previousNameCorrections !== undefined && fields.previousNameCorrections !== "") {
    fields.previousNameCorrections = Number(fields.previousNameCorrections);
  }
  let j;
  try {
    const r = await fetch("/api/simulate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: sim.type, state: sim.state, documents: [...sim.docs], fields }),
    });
    j = await r.json();
    if (j.error) throw new Error(j.error);
  } catch (e) {
    $("simChecks").innerHTML = `<p class="muted">Scoring failed: ${e.message}</p>`;
    return;
  }

  setRing("scoreArc", "scoreNum", RING_C, j.score);
  setRing("heroRing", "heroScoreNum", HERO_C, j.score);

  const total = j.moneyAtRisk + (j.estimatedExtras || 0);
  $("simMoney").innerHTML = j.readyToFile
    ? `<strong>~₹${total.toLocaleString("en-IN")}</strong> estimated charges saved by avoiding failed attempts<span>₹${j.moneyAtRisk.toLocaleString("en-IN")} official fees + ~₹${(j.estimatedExtras || 0).toLocaleString("en-IN")} typical extras (agent, travel, lost day)</span>`
    : `<strong>₹${total.toLocaleString("en-IN")}</strong> at stake per failed round<span>₹${j.moneyAtRisk.toLocaleString("en-IN")} official fees + ~₹${(j.estimatedExtras || 0).toLocaleString("en-IN")} typical extras — score 100% to file with confidence</span>`;

  const nf = $("simNextFix");
  if (j.nextFix) {
    nf.classList.remove("hidden");
    nf.innerHTML = `<b>Next fix → ${j.nextFix.label}</b><p>${j.nextFix.advice}</p>`;
  } else nf.classList.add("hidden");

  /* What a dishonest agent won't tell you: every failing check, in plain words. */
  const ap = $("simAgentPanel");
  const failing = j.checks.filter((c) => !c.pass && (c.severity === "error" || c.severity === "warning"));
  if (failing.length > 0) {
    ap.classList.remove("hidden");
    ap.innerHTML = `<b>⚠ What a dishonest agent won't tell you</b>
      <p class="muted small">Some agents file applications they <em>know</em> will fail — just to collect form-filling charges. Here is exactly what is wrong with yours, so nobody can charge you for a doomed filing:</p>
      <ul>${failing.map((c) => `<li><strong>${c.label}.</strong> ${c.advice || c.detail}</li>`).join("")}</ul>`;
  } else ap.classList.add("hidden");

  /* Zero-visit plan: online vs mandatory-visit per registry, in filing order. */
  const zv = $("simZeroVisit");
  if (j.zeroVisitPlan && j.zeroVisitPlan.length > 0) {
    zv.classList.remove("hidden");
    const onlineCount = j.zeroVisitPlan.filter((s) => s.fullyOnline).length;
    zv.innerHTML = `<b>🖥 Zero-visit plan — ${onlineCount} of ${j.zeroVisitPlan.length} registries fully online</b>
      <div class="zvlist">${j.zeroVisitPlan.map((s, i) => `
        <div class="zvrow">
          <span class="zvorder">${i + 1}</span>
          <span class="zvname"><strong>${s.name}</strong><small>${s.feeLabel}</small></span>
          <span class="badge ${s.fullyOnline ? "online" : "visit"}">${s.fullyOnline ? "✓ Online" : "1 visit"}</span>
        </div>
        ${s.fullyOnline ? "" : `<div class="zvreason">${s.visitReason}</div>`}`).join("")}</div>`;
  } else zv.classList.add("hidden");

  const rd = $("simReady");
  if (j.readyToFile) {
    rd.classList.remove("hidden");
    rd.innerHTML = `<b>✓ 100% — every check passes. File with confidence.</b>
      <p>Your application clears all ${j.rulesEvaluated} rules in the knowledge base. Generate your filing pack — ordered checklists, fees and filled letters for every registry. If a visit is unavoidable, carry the one-page center-visit sheet: it proves your file is rule-ready, so no agent can mislead you.</p>
      <div class="cta-row" style="justify-content:flex-start">
        <button class="btn primary" id="packFromSim">Generate my filing pack →</button>
        <button class="btn ghost" id="sheetBtn">🖨 Print center-visit sheet</button>
      </div>`;
    $("packFromSim").onclick = createEventFromSim;
    $("sheetBtn").onclick = () => printVisitSheet(j);
  } else rd.classList.add("hidden");

  const icon = (c) => c.pass ? "✓" : c.severity === "error" ? "✕" : c.severity === "warning" ? "!" : "i";
  const color = (c) => c.pass ? "var(--green)" : c.severity === "error" ? "var(--red)" : c.severity === "warning" ? "var(--amber)" : "var(--blue)";
  $("simChecks").innerHTML = j.checks.map((c) => `
    <div class="check ${c.severity}">
      <div class="chead"><span class="icon" style="color:${color(c)}">${icon(c)}</span>
      <span><strong>${c.label}</strong><span class="src">${c.sourceLabel}</span></span></div>
      <div class="detail">${c.detail}</div>
      ${c.pass ? "" : `<div class="advice"><b>Fix:</b> ${c.advice}</div>`}
    </div>`).join("");
  $("simDisclaimer").textContent = j.disclaimer || "";
}

/** One-page center-visit sheet: proves the file is 100% rule-ready at the counter. */
function printVisitSheet(j) {
  const f = sim.fields;
  const typeLabel = (TYPE_META[sim.type] || {}).t || sim.type;
  const nameLine = f.oldName || f.newName
    ? `<p><strong>Correction:</strong> ${esc(f.oldName || "—")} → ${esc(f.newName || "—")}</p>` : "";
  const dobLine = f.oldDob || f.newDob
    ? `<p><strong>DOB:</strong> ${esc(f.oldDob || "—")} → ${esc(f.newDob || "—")}</p>` : "";
  const addrLine = f.newAddress ? `<p><strong>New address:</strong> ${esc(f.newAddress)}</p>` : "";
  const docLine = [...sim.docs].length
    ? `<p><strong>Documents carried:</strong> ${[...sim.docs].map(esc).join(", ")}</p>` : "";
  $("visitSheet").innerHTML = `
    <h1>एकसुधार EkSudhaar — Center-visit sheet</h1>
    <p class="vs-score">Verified success score: <strong>100%</strong> (${j.rulesEvaluated} rules checked)</p>
    <p><strong>What:</strong> ${esc(typeLabel)}${sim.state ? ` · <strong>State:</strong> ${esc(sim.state)}` : ""}</p>
    ${nameLine}${dobLine}${addrLine}${docLine}
    <h2>Filing order</h2>
    <ol>${(j.zeroVisitPlan || []).map((s) =>
      `<li><strong>${esc(s.name)}</strong> — ${esc(s.feeLabel)} — ${s.fullyOnline ? "do online from home" : "ONE mandatory visit: " + esc(s.visitReason)}</li>`).join("")}</ol>
    <p class="vs-note">This sheet certifies the application passed every check in EkSudhaar's rules knowledge base (compiled from public sources). Final approval rests with the issuing authority. Generated free at EkSudhaar.</p>`;
  window.print();
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** At 100%: create a real correction event from the simulator data and open the agent dashboard. */
async function createEventFromSim() {
  const btn = $("packFromSim");
  btn.disabled = true; btn.textContent = "Building your plan…";
  try {
    const f = sim.fields;
    const fd = new FormData();
    fd.append("type", sim.type);
    fd.append("old_name", f.oldName || "");
    fd.append("new_name", f.newName || "");
    fd.append("old_dob", f.oldDob || "");
    fd.append("new_dob", f.newDob || "");
    fd.append("new_address", f.newAddress || "");
    fd.append("extra", JSON.stringify({
      gazetteNo: f.gazetteNumber || "", epicNumber: f.epicNumber || "",
      state: sim.state, nameScope: f.nameScope || "",
      simulatedScore: 100, documents: [...sim.docs],
    }));
    const r = await fetch("/api/events", { method: "POST", body: fd });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    bankNames = [];
    openDash(j.id);
  } catch (e) {
    btn.disabled = false; btn.textContent = "Generate my filing pack →";
    alert("Could not build the plan: " + e.message);
  }
}

/* ================= classic flows (wizard + dashboard) ================= */
const home = $("home"), wizard = $("wizard"), dash = $("dash");
let eventType = null, eventId = null, bankNames = [];

function show(el) { [home, wizard, dash].forEach((m) => m.classList.add("hidden")); el.classList.remove("hidden"); window.scrollTo(0, 0); }

$("startBtn").onclick = () => { buildTypeCards(); show(wizard); $("wstep1").classList.remove("hidden"); $("wstep2").classList.add("hidden"); };
$("wizCancel").onclick = () => show(home);
$("dashHome").onclick = () => show(home);

$("demoBtn").onclick = async () => {
  $("demoBtn").disabled = true; $("demoBtn").textContent = "Setting up demo…";
  try {
    const r = await fetch("/api/demo/seed", { method: "POST" });
    const { id } = await r.json();
    bankNames = ["State Bank of India", "HDFC Bank"];
    openDash(id);
  } finally { $("demoBtn").disabled = false; $("demoBtn").textContent = "Try the 2-minute demo"; }
};

function buildTypeCards() {
  $("typeCards").innerHTML = "";
  for (const [k, v] of Object.entries(TYPE_META)) {
    const b = document.createElement("button");
    b.className = "typecard";
    b.innerHTML = `<h4>${v.t}</h4><p>${v.d}</p>`;
    b.onclick = () => {
      eventType = k;
      $("wstep1").classList.add("hidden"); $("wstep2").classList.remove("hidden");
      $("wstep2title").textContent = v.t + " — your details";
      $("dobRow").classList.toggle("hidden", k !== "dob_correction");
      $("addrRow").classList.toggle("hidden", k !== "address_change");
    };
    $("typeCards").appendChild(b);
  }
}
$("wback1").onclick = () => { $("wstep2").classList.add("hidden"); $("wstep1").classList.remove("hidden"); };

$("wsubmit").onclick = async () => {
  const btn = $("wsubmit"); btn.disabled = true;
  $("wstatus").textContent = "Uploading and verifying your document…";
  try {
    const fd = new FormData();
    fd.append("type", eventType);
    fd.append("old_name", $("f_old_name").value);
    fd.append("new_name", $("f_new_name").value);
    fd.append("old_dob", $("f_old_dob").value);
    fd.append("new_dob", $("f_new_dob").value);
    fd.append("new_address", $("f_new_address").value);
    fd.append("doc_text", $("f_doc_text").value);
    const f = $("f_doc").files[0];
    if (f) fd.append("document", f);
    bankNames = $("f_banks").value.split(",").map((s) => s.trim()).filter(Boolean);
    const r = await fetch("/api/events", { method: "POST", body: fd });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    openDash(j.id);
  } catch (e) { $("wstatus").textContent = "Error: " + e.message; btn.disabled = false; }
};

async function openDash(id) {
  eventId = id; show(dash);
  $("dashTitle").childNodes[0].textContent = "Your correction ";
  await refreshVerify(); await refreshLog(); await refreshPlan(); await refreshTracker();
}

async function refreshVerify() {
  const r = await fetch(`/api/events/${eventId}/verify`, { method: "POST" });
  const j = await r.json();
  const badge = j.passed ? `<span class="badge ok">PASSED</span>` : `<span class="badge bad">NEEDS ATTENTION</span>`;
  $("verifyBody").innerHTML = `<p>${badge}</p><p>${j.summary || ""}</p>` +
    j.checks.map((c) => `<div class="check"><span class="icon" style="color:${c.passed ? "var(--green)" : (c.severity === "warning" ? "var(--amber)" : "var(--red)")};font-size:1.05rem">${c.passed ? "✓" : (c.severity === "warning" ? "!" : "✕")}</span><span><strong>${c.label}</strong><br><span class="muted small">${c.detail}</span></span></div>`).join("");
  refreshLog();
}

async function refreshLog() {
  const r = await fetch(`/api/events/${eventId}/agent-log`);
  const { log } = await r.json();
  $("agentLog").innerHTML = log.map((e) =>
    `<div class="entry"><span class="stage">${e.stage}</span>${e.message}<time>${new Date(e.created_at).toLocaleTimeString("en-IN")}</time></div>`
  ).join("") || `<p class="muted">No activity yet.</p>`;
}

async function refreshPlan() {
  const r = await fetch(`/api/events/${eventId}/plan`);
  const { plan, consents } = await r.json();
  $("planList").innerHTML = "";
  plan.forEach((reg, i) => {
    const div = document.createElement("div");
    div.className = "reg";
    div.innerHTML = `
      <div class="head">
        <span><span class="orderbadge">Step ${i + 1}</span> <strong>${reg.name}</strong></span>
        <label class="switch" title="Your consent for this registry"><input type="checkbox" ${consents[reg.id] ? "checked" : ""}><span class="slider"></span></label>
      </div>
      <div class="meta">Fee: ${reg.fee} · Helpline: ${reg.helpline} · <a href="${reg.officialUrl}" target="_blank" rel="noopener">official site</a></div>
      <ol>${reg.steps.map((s) => `<li><strong>${s.title}</strong> — ${s.detail} <span class="muted">(${s.where}; ${s.eta})</span></li>`).join("")}</ol>
      <div class="docs"><strong>Carry:</strong> ${reg.documents.join(" · ")}</div>`;
    div.querySelector("input").onchange = async (ev) => {
      await fetch(`/api/events/${eventId}/consent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registry: reg.id, consented: ev.target.checked }) });
      refreshLog();
    };
    $("planList").appendChild(div);
  });
}

$("packBtn").onclick = async () => {
  const btn = $("packBtn"); btn.disabled = true; btn.textContent = "Generating…";
  try {
    const r = await fetch(`/api/events/${eventId}/pack`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bank_names: bankNames }) });
    if (!r.ok) { const j = await r.json(); throw new Error(j.error || "failed"); }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "eksudhaar-correction-pack.pdf"; a.click();
    refreshLog();
  } catch (e) { alert("Could not generate pack: " + e.message); }
  btn.disabled = false; btn.textContent = "Generate my correction pack (PDF)";
};

const STATUS_LABELS = { pending: "Pending", consented: "Consented", in_progress: "In progress", filed: "Filed", acknowledged: "Acknowledged", completed: "Completed ✓", rejected: "Rejected — retry" };

async function refreshTracker() {
  const r = await fetch(`/api/events/${eventId}/tracker`);
  const { plan } = await r.json();
  $("trackerList").innerHTML = "";
  plan.forEach((reg) => {
    const st = reg.tracking.status || "pending";
    const div = document.createElement("div");
    div.className = "trackrow";
    div.innerHTML = `<strong style="min-width:140px">${reg.short}</strong>
      <span class="badge ${st === "completed" ? "ok" : (st === "rejected" ? "bad" : "warn")}">${STATUS_LABELS[st] || st}</span>
      <select>${Object.keys(STATUS_LABELS).map((k) => `<option value="${k}" ${k === st ? "selected" : ""}>${STATUS_LABELS[k]}</option>`).join("")}</select>
      <button class="linkbtn nudge">nudge me</button>
      <div class="nudgemsg hidden"></div>`;
    div.querySelector("select").onchange = async (ev) => {
      await fetch(`/api/events/${eventId}/tracker/${reg.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: ev.target.value }) });
      refreshTracker(); refreshLog();
    };
    div.querySelector(".nudge").onclick = async () => {
      const box = div.querySelector(".nudgemsg");
      box.classList.remove("hidden"); box.textContent = "Drafting…";
      const rr = await fetch(`/api/events/${eventId}/nudge/${reg.id}`, { method: "POST" });
      const j = await rr.json(); box.textContent = j.message; refreshLog();
    };
    $("trackerList").appendChild(div);
  });
}

loadMeta();
loadRegistries();
