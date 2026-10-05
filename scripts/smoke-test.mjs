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
