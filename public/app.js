const $ = (id) => document.getElementById(id);
const home = $("home"), wizard = $("wizard"), dash = $("dash");
let eventType = null, eventId = null, bankNames = [];

const TYPE_META = {
  name_correction: { t: "Name correction", d: "Gazette notification for a legal name change / typo fix." },
  marriage_name_change: { t: "Name change after marriage", d: "Marriage certificate as the supporting event." },
  dob_correction: { t: "Date-of-birth correction", d: "Fix a wrong DOB with birth certificate / school proof." },
  address_change: { t: "Address change", d: "New address with rent agreement / utility bill." },
};

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
    j.checks.map((c) => `<div class="check"><span>${c.passed ? "✅" : (c.severity === "warning" ? "⚠️" : "❌")}</span><span><strong>${c.label}</strong><br><span class="muted small">${c.detail}</span></span></div>`).join("");
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

const STATUS_LABELS = { pending: "Pending", consented: "Consented", in_progress: "In progress", filed: "Filed", acknowledged: "Acknowledged", completed: "Completed ✅", rejected: "Rejected — retry" };

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
    div.querySelector(".nudge").onclick = async (ev) => {
      const box = div.querySelector(".nudgemsg");
      box.classList.remove("hidden"); box.textContent = "Drafting…";
      const rr = await fetch(`/api/events/${eventId}/nudge/${reg.id}`, { method: "POST" });
      const j = await rr.json(); box.textContent = j.message; refreshLog();
    };
    $("trackerList").appendChild(div);
  });
}
