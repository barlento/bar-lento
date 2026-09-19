// Past weeks follow Toast: real clock-ins replace the plan for Toast people; app-clock people untouched; automatic run.
const B = "http://127.0.0.1:4173"; const PW = "segreta";
const j = async (u, o) => { const r = await fetch(B + u, o); let x = null; try { x = await r.json(); } catch (e) {} return { s: r.status, j: x }; };
const hdr = { "Content-Type": "application/json", "x-admin-password": PW };
(async () => {
  const errors = [];
  // 1. the very first GET runs the automatic import (fake Toast has clock-ins for the seed shifts + late-August entries)
  let r = await j("/api/data");
  const weeks = Object.keys(r.j.data.weeks).sort(); console.log("1 weeks after first GET:", weeks);
  if (!weeks.includes("2026-08-24")) errors.push("late-August week not created by the automatic import");
  const w0907 = r.j.data.weeks["2026-09-07"]; const flat = (w) => ["mon","tue","wed","thu","fri","sat","sun"].flatMap((d) => (w[d] || []).map((s) => Object.assign({ day: d }, s)));
  const f = flat(w0907);
  const joe = f.filter((s) => s.name === "Joe"), pietro = f.filter((s) => s.name === "Pietro");
  console.log("2 week 09-07: Joe shifts", joe.map((s) => s.day + " " + s.start + "-" + s.end + " " + (s.src || "plan")).join(", "));
  console.log("  Pietro (not in Toast) shifts kept as planned:", pietro.length, pietro.every((s) => s.src !== "toast"));
  if (joe.some((s) => s.src !== "toast")) errors.push("Joe (Toast person) still has planned shifts in a past week");
  if (!joe.length) errors.push("Joe has no clock-in shifts in week 09-07");
  if (!pietro.length || pietro.some((s) => s.src === "toast")) errors.push("Pietro's planned shifts were touched");
  const aug = flat(r.j.data.weeks["2026-08-24"] || {}); console.log("3 week 08-24:", aug.map((s) => s.name + " " + s.day + " " + s.start + "-" + s.end).join(", "));
  if (!aug.some((s) => s.name === "Joe" && s.day === "tue" && s.start === "16:02")) errors.push("Joe's real Aug 25 clock-in missing");
  // Kayla: archived in Toast → removed from staff by the sync, but her clock-ins still land under her name (former register)
  const kayla = flat(r.j.data.weeks["2026-08-31"] || {}).filter((s) => s.name === "Kayla"); console.log("4 Kayla (former) clock-in in week 08-31:", kayla.length);
  if (!kayla.length) errors.push("former person's clock-in not imported");
  // this week untouched
  const cur = flat(r.j.data.weeks["2026-09-14"] || {}); console.log("5 current week has plan shifts:", cur.length, "toast:", cur.filter((s) => s.src === "toast").length);
  if (cur.some((s) => s.src === "toast")) errors.push("current week rewritten");
  // 2. manager button: idempotent, informative
  r = await j("/api/data", { method: "POST", headers: hdr, body: JSON.stringify({ action: "backfillToast" }) });
  console.log("6 button:", r.s, { clockIns: r.j.clockIns, replaced: r.j.replaced, changed: r.j.changed, seen: r.j.seen, from: r.j.from, to: r.j.to, firstIn: r.j.firstIn, lastIn: r.j.lastIn });
  if (r.s !== 200 || (r.j.changed || []).length) errors.push("second import changed something (not idempotent)");
  if (!r.j.clockIns) errors.push("button reports no clock-ins");
  // 3. history line
  r = await j("/api/log?limit=20", { headers: hdr }); const lines = (r.j.entries || r.j || []).flatMap((e) => e.changes || []);
  console.log("7 history:", lines.filter((l) => /Past weeks from Toast/.test(l))[0]);
  if (!lines.some((l) => /Past weeks from Toast/.test(l))) errors.push("no history line");
  console.log("ERRORS:", errors.length ? errors : "none"); process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.log("ERR", e); process.exit(1); });
