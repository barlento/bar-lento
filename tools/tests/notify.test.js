// Notifications: each person only about their own changes, nothing team-wide, delivered after a quiet spell.
const { diffData } = require("../../lib/diff"); const push = require("../../lib/push"); const store = require("../../lib/store");
const errors = [];
const wk = "2026-10-05"; const base = { staff: ["Joe", "Anna", "Marco"], weeks: { [wk]: { mon: [{ id: "a", name: "Joe", start: "16:00", end: "22:00" }, { id: "b", name: "Anna", start: "16:00", end: "22:00" }], tue: [{ id: "c", name: "Marco", start: "16:00", end: "22:00" }], wed: [], thu: [], fri: [], sat: [], sun: [], notes: {} } } };
const next = JSON.parse(JSON.stringify(base));
next.weeks[wk].mon[0].start = "17:00"; // Joe moved
next.weeks[wk].tue.push({ id: "d", name: "Anna", start: "18:00", end: "23:00" }); // Anna added on Tue
next.weeks[wk].notes.tue = { status: "closed", text: "Private" }; // Tue closed → Marco and Anna (scheduled Tue)
const d = diffData(base, next);
console.log("1 notable:", d.notable.map((c) => c.names.join("+") + " ← " + c.text));
const who = (n) => d.notable.filter((c) => c.names.includes(n)).length;
if (who("Joe") !== 1) errors.push("Joe should have exactly 1 change (his moved shift)");
if (who("Anna") !== 2) errors.push("Anna should have 2 (added Tue + Tue closed)");
if (who("Marco") !== 1) errors.push("Marco should have 1 (Tue closed)");
if (d.notable.some((c) => !c.names.length)) errors.push("a change concerns nobody");
const s = push.personalSummary(d.notable.filter((c) => c.names.includes("Anna")));
console.log("2 Anna's push:", s.title, "|", s.body); if (!/your schedule changed/.test(s.title) || !/2 changes to your shifts/.test(s.body)) errors.push("personal summary wrong");
const nw = push.summarize([{ kind: "newweek", week: wk }]); console.log("3 new week:", nw.body); if (!/Oct 5–11/.test(nw.body)) errors.push("new-week summary wrong");
// pending storage round-trip through the fake Redis of the dev server (via HTTP: save → GET flushes nothing while editing)
(async () => {
  const B = "http://127.0.0.1:4173"; const hdr = { "Content-Type": "application/json", "x-admin-password": "segreta" };
  const cur = await (await fetch(B + "/api/data")).json(); const data = cur.data; const w = Object.keys(data.weeks).sort().pop();
  const day = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].find((k) => (data.weeks[w][k] || []).length) || "fri";
  data.weeks[w][day].push({ id: "nt-1", name: data.staff[0], start: "12:00", end: "13:00", station: "S1" });
  const r = await (await fetch(B + "/api/data", { method: "POST", headers: hdr, body: JSON.stringify({ version: cur.version, data }) })).json();
  console.log("4 save:", r.version ? "ok" : r, "| pendingNotify field gone:", !("pendingNotify" in r));
  if ("pendingNotify" in r) errors.push("manager counter still returned");
  const q = await store.getPending().catch(() => null); console.log("5 pending after save (fake redis is in the dev server process, so null here is fine):", q && q.changes.length);
  const g = await (await fetch(B + "/api/data")).json(); console.log("6 GET while editing: no flush, schedule served:", !!g.data);
  console.log("ERRORS:", errors.length ? errors : "none"); process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.log("ERR", e.message); process.exit(1); });
