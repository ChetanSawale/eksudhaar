import { spawn } from "node:child_process";

// End-to-end smoke test: boot the server, seed the demo, run the full
// agent pipeline (verify -> plan -> consent -> pack -> track), assert each step.
const PORT = 18099;
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn("node", ["dist/index.js"], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: "/tmp/eksudhaar-smoke" },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

async function waitForBoot() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/event-types`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not boot");
}

const jpost = async (url, body) => {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`POST ${url} -> ${r.status}: ${await r.text()}`);
  return r;
};

try {
  await waitForBoot();
  console.log("boot ok");

  // 0. simulator meta + scoring
  const meta = await (await fetch(`${BASE}/api/simulate/meta`)).json();
  if (!meta.ruleCount || meta.ruleCount < 20) throw new Error(`expected 20+ rules, got ${meta.ruleCount}`);
  if (!meta.documents || meta.documents.length < 8) throw new Error("documents catalog missing");
  console.log(`simulate meta ok (${meta.ruleCount} rules, ${meta.documents.length} documents)`);

  const simBody = (over) => ({
    eventType: "name_correction",
    state: "Maharashtra",
    documents: ["poi", "gazette", "aadhaar_card", "pan_card", "passport_old", "epic"],
    fields: {
      oldName: "Priya Sharna", newName: "Priya Sharma", nameScope: "major",
      previousNameCorrections: 0, gazetteNumber: "MHA-2026/18473", epicNumber: "ABC1234567",
    },
    ...over,
  });
  const simFull = await (await jpost(`${BASE}/api/simulate`, simBody())).json();
  if (simFull.score !== 100) throw new Error(`expected score 100, got ${simFull.score}: ` + JSON.stringify(simFull.checks.filter((c) => !c.pass)));
  if (!simFull.readyToFile) throw new Error("readyToFile should be true at 100");
  if (!simFull.disclaimer || !/issuing authority/i.test(simFull.disclaimer)) throw new Error("honest disclaimer missing from simulate response");
  if (simFull.moneyAtRisk !== 1682) throw new Error(`expected moneyAtRisk 1682, got ${simFull.moneyAtRisk}`);
  console.log("simulate 100% ok (disclaimer + moneyAtRisk present)");

  const simNoGaz = await (await jpost(`${BASE}/api/simulate`, simBody({ documents: ["poi", "aadhaar_card"] }))).json();
  if (!(simNoGaz.score < 100)) throw new Error(`expected score < 100 without gazette, got ${simNoGaz.score}`);
  if (simNoGaz.readyToFile) throw new Error("readyToFile must be false below 100");
  if (!simNoGaz.nextFix || !simNoGaz.nextFix.advice) throw new Error("nextFix missing");
  console.log(`simulate partial ok (score ${simNoGaz.score}, nextFix: ${simNoGaz.nextFix.ruleId})`);

  const badType = await fetch(`${BASE}/api/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType: "nope" }) });
  if (badType.status !== 400) throw new Error("invalid eventType should be 400");
  const badDoc = await fetch(`${BASE}/api/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType: "name_correction", documents: ["ufo"] }) });
  if (badDoc.status !== 400) throw new Error("unknown document id should be 400");
  console.log("simulate validation ok");

  // 0b. registries catalog with online-first paths
  const regs = await (await fetch(`${BASE}/api/registries`)).json();
  if (!regs.registries || regs.registries.length !== 6) throw new Error("expected 6 registries");
  for (const r of regs.registries) {
    if (!r.online || !Array.isArray(r.online.onlineSteps)) throw new Error(`registry ${r.id} missing online path`);
  }
  const panReg = regs.registries.find((r) => r.id === "pan");
  if (!panReg.online.fullyOnline) throw new Error("PAN should be fully online");
  const aadhaarReg = regs.registries.find((r) => r.id === "aadhaar");
  if (!aadhaarReg.online.mustVisit || !aadhaarReg.online.visitReason) throw new Error("Aadhaar must flag the mandatory biometric visit honestly");
  console.log("registries ok (6 registries, online-first paths present)");

  // 0c. zero-visit plan in simulate response
  if (!Array.isArray(simFull.zeroVisitPlan) || simFull.zeroVisitPlan.length === 0) throw new Error("zeroVisitPlan missing");
  console.log(`zero-visit plan ok (${simFull.zeroVisitPlan.length} steps)`);

  // 1. seed demo
  const seed = await (await jpost(`${BASE}/api/demo/seed`)).json();
  const id = seed.id;
  console.log("demo event:", id);

  // 2. verify — the simulated Gazette text must PASS
  const verify = await (await jpost(`${BASE}/api/events/${id}/verify`)).json();
  if (!verify.passed) throw new Error("verification should pass for demo doc: " + JSON.stringify(verify.checks));
  console.log(`verify ok (${verify.checks.length} checks passed)`);

  // 3. plan — 6 registries for name_correction, aadhaar first
  const plan = await (await fetch(`${BASE}/api/events/${id}/plan`)).json();
  const ids = plan.plan.map((p) => p.id);
  if (ids.length !== 6) throw new Error(`expected 6 registries, got ${ids.length}`);
  if (ids[0] !== "aadhaar") throw new Error("aadhaar must be first in plan order");
  console.log("plan ok:", ids.join(", "));

  // 4. consent already default-on; toggle one off and back on
  await jpost(`${BASE}/api/events/${id}/consent`, { registry: "passport", consented: false });
  await jpost(`${BASE}/api/events/${id}/consent`, { registry: "passport", consented: true });
  console.log("consent ok");

  // 5. pack — must be a real PDF
  const packRes = await jpost(`${BASE}/api/events/${id}/pack`, { bank_names: ["SBI"] });
  const buf = Buffer.from(await packRes.arrayBuffer());
  if (buf.subarray(0, 4).toString() !== "%PDF") throw new Error("pack is not a PDF");
  if (buf.length < 8000) throw new Error(`pack suspiciously small: ${buf.length} bytes`);
  console.log(`pack ok (${(buf.length / 1024).toFixed(1)} KB PDF)`);

  // 6. tracker advance + nudge
  await jpost(`${BASE}/api/events/${id}/tracker/aadhaar`, { status: "filed", note: "URN received" });
  const tracker = await (await fetch(`${BASE}/api/events/${id}/tracker`)).json();
  const aadhaar = tracker.plan.find((p) => p.id === "aadhaar");
  if (aadhaar.tracking.status !== "filed") throw new Error("tracker status not updated");
  const nudge = await (await jpost(`${BASE}/api/events/${id}/nudge/pan`)).json();
  if (!nudge.message || nudge.message.length < 10) throw new Error("nudge message missing");
  console.log("tracker + nudge ok");

  // 7. agent log covers every stage
  const log = await (await fetch(`${BASE}/api/events/${eventId(id)}/agent-log`)).json();
  const stages = new Set(log.log.map((e) => e.stage));
  for (const s of ["intake", "verify", "plan", "consent", "generate", "track"]) {
    if (!stages.has(s)) throw new Error(`agent log missing stage: ${s}`);
  }
  console.log("agent log ok:", [...stages].join(", "));

  console.log("SMOKE TEST PASSED");
} catch (e) {
  console.error("SMOKE TEST FAILED:", e.message);
  process.exitCode = 1;
} finally {
  server.kill();
  setTimeout(() => process.exit(process.exitCode || 0), 500);
}

function eventId(id) { return id; }
