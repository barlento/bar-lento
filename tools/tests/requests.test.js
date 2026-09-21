// Requests (owner 2026-09-21): time off + shift cover, 24 h rule, eligible colleagues, manager decision changes the schedule.
const { chromium } = require("playwright"); const B = "http://localhost:4173"; const M = { "Content-Type": "application/json", "x-admin-password": "segreta" };
async function j(p, o) { const r = await fetch(B + p, o); let x = null; try { x = await r.json(); } catch (e) {} return { s: r.status, j: x }; }
const iso = (d) => d.toISOString().slice(0, 10); const addD = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const monday = (d) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x; };
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
(async () => {
  const errors = [];
  const ny = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()) + "T12:00:00Z");
  const far = addD(ny, 3), todayD = ny; const farWk = iso(monday(far)), farDay = DAYS[(far.getUTCDay() + 6) % 7], todWk = iso(monday(todayD)), todDay = DAYS[(todayD.getUTCDay() + 6) % 7];
  // manager: shifts for Pietro (floor): one in 3 days, one today at 23:00 (always inside the 24 h window)
  let r = await j("/api/data"); const d0 = JSON.parse(JSON.stringify(r.j.data)); d0.dept = d0.dept || {}; d0.dept.Catherine = "kitchen"; d0.deptManual = [...new Set((d0.deptManual || []).concat(["Catherine"]))]; const mk = (wk) => { if (!d0.weeks[wk]) { d0.weeks[wk] = { notes: {} }; DAYS.forEach((k) => (d0.weeks[wk][k] = [])); } };
  mk(farWk); mk(todWk); d0.weeks[farWk][farDay].push({ id: "rq-far", name: "Pietro", start: "16:00", end: "22:00", station: "S1" }); d0.weeks[farWk][farDay].push({ id: "rq-far2", name: "Pietro", start: "11:00", end: "15:00", station: "" }); d0.weeks[todWk][todDay].push({ id: "rq-today", name: "Pietro", start: "23:00", end: "23:30", station: "" });
  r = await j("/api/data", { method: "POST", headers: M, body: JSON.stringify({ version: r.j.version, data: d0 }) }); console.log("1 shifts saved:", r.s, r.s !== 200 ? JSON.stringify(r.j).slice(0, 200) : ""); if (r.s !== 200) { console.log("ERRORS:", ["could not save shifts"]); process.exit(1); }
  const tok = async (name, pin) => { let x = await j("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", name, pin }) }); if (x.s !== 200) x = await j("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name, pin }) }); return x.j.token; };
  const P = { "Content-Type": "application/json", "x-staff-token": await tok("Pietro", "3131") }, S = { "Content-Type": "application/json", "x-staff-token": await tok("Sierrah", "7777") }, C = { "Content-Type": "application/json", "x-staff-token": await tok("Catherine", "5151") };
  r = await j("/api/requests"); console.log("2 no identity:", r.s); if (r.s !== 401) errors.push("requests open without identity");
  r = await j("/api/requests", { method: "POST", headers: P, body: JSON.stringify({ action: "cover", week: todWk, day: todDay, shiftId: "rq-today" }) }); console.log("3 cover inside 24 h:", r.s, r.j && r.j.error); if (r.s !== 400 || r.j.error !== "too_late") errors.push("24 h rule not enforced");
  r = await j("/api/requests", { method: "POST", headers: P, body: JSON.stringify({ action: "cover", week: farWk, day: farDay, shiftId: "rq-far" }) }); console.log("4 cover in 3 days:", r.s, r.j && r.j.request && r.j.request.status); if (r.s !== 200) errors.push("cover request refused: " + JSON.stringify(r.j)); const cov = r.j.request;
  r = await j("/api/requests", { method: "POST", headers: P, body: JSON.stringify({ action: "cover", week: farWk, day: farDay, shiftId: "rq-far" }) }); console.log("5 duplicate:", r.s); if (r.s !== 409) errors.push("duplicate cover accepted");
  r = await j("/api/requests", { method: "POST", headers: S, body: JSON.stringify({ action: "cover", week: farWk, day: farDay, shiftId: "rq-far2" }) }); console.log("6 someone else's shift:", r.s); if (r.s !== 403) errors.push("cover for another person's shift accepted");
  r = await j("/api/requests", { headers: S }); const openS = (r.j.open || []).map((x) => x.id); console.log("7 Sierrah (floor) sees open:", openS.includes(cov.id)); if (!openS.includes(cov.id)) errors.push("eligible colleague does not see the open cover");
  r = await j("/api/requests", { headers: C }); const openC = (r.j.open || []).map((x) => x.id); console.log("8 Catherine (kitchen) sees open:", openC.includes(cov.id)); if (openC.includes(cov.id)) errors.push("kitchen person sees a floor cover");
  r = await j("/api/requests", { method: "POST", headers: C, body: JSON.stringify({ action: "offer", id: cov.id }) }); console.log("9 kitchen offers:", r.s); if (r.s !== 403) errors.push("ineligible offer accepted");
  r = await j("/api/requests", { method: "POST", headers: S, body: JSON.stringify({ action: "offer", id: cov.id }) }); console.log("10 Sierrah offers:", r.s, r.j.request && r.j.request.volunteers); if (r.s !== 200) errors.push("offer refused");
  r = await j("/api/requests", { method: "POST", headers: S, body: JSON.stringify({ action: "approve", id: cov.id, taker: "Sierrah" }) }); console.log("11 staff tries to approve:", r.s); if (r.s !== 403) errors.push("staff could approve");
  r = await j("/api/requests", { headers: M }); const pend = r.j.pending || []; console.log("12 manager pending:", pend.map((x) => x.type + ":" + x.name + ":" + (x.volunteers || []).join("/"))); if (!pend.some((x) => x.id === cov.id && (x.volunteers || []).includes("Sierrah"))) errors.push("manager does not see the cover with its volunteer");
  r = await j("/api/requests", { method: "POST", headers: M, body: JSON.stringify({ action: "approve", id: cov.id, taker: "Sierrah" }) }); console.log("13 manager assigns Sierrah:", r.s, r.j.request && r.j.request.status); if (r.s !== 200) errors.push("approve failed: " + JSON.stringify(r.j));
  r = await j("/api/data"); const sh = r.j.data.weeks[farWk][farDay].find((x) => x.id === "rq-far"); console.log("14 shift now belongs to:", sh && sh.name); if (!sh || sh.name !== "Sierrah") errors.push("schedule not updated after approval");
  r = await j("/api/log?limit=5", { headers: M }); const lines = (r.j.entries || r.j.log || r.j.items || []).flatMap((e) => e.changes || []); console.log("15 history:", lines.find((l) => /Cover approved/.test(l)) || "(none)"); if (!lines.some((l) => /Cover approved/.test(l))) errors.push("no history line for the approval");
  // time off
  const f = iso(addD(ny, 5)), tto = iso(addD(ny, 6));
  r = await j("/api/requests", { method: "POST", headers: P, body: JSON.stringify({ action: "off", from: f, to: tto, note: "family" }) }); console.log("16 time off:", r.s); if (r.s !== 200) errors.push("time off refused"); const off = r.j.request;
  r = await j("/api/requests", { method: "POST", headers: P, body: JSON.stringify({ action: "off", from: f, to: tto }) }); console.log("17 duplicate off:", r.s); if (r.s !== 409) errors.push("duplicate off accepted");
  r = await j("/api/requests", { method: "POST", headers: P, body: JSON.stringify({ action: "off", from: "2020-01-01" }) }); console.log("18 past off:", r.s); if (r.s !== 400) errors.push("past off accepted");
  r = await j("/api/requests", { headers: M }); console.log("19 manager sees off chips:", (r.j.off || []).map((o) => o.name + ":" + o.status)); if (!(r.j.off || []).some((o) => o.name === "Pietro" && o.status === "pending")) errors.push("off not listed for the day cards");
  r = await j("/api/requests", { method: "POST", headers: M, body: JSON.stringify({ action: "approve", id: off.id }) }); console.log("20 approve off:", r.s, r.j.request && r.j.request.status); if (r.s !== 200 || r.j.request.status !== "approved") errors.push("off approval failed");
  r = await j("/api/requests", { headers: P }); console.log("21 Pietro mine:", (r.j.mine || []).map((x) => x.type + ":" + x.status)); if (!(r.j.mine || []).some((x) => x.id === off.id && x.status === "approved")) errors.push("approved off not in own list");
  // UI: Pietro's My week has the time-off form and a "Can't make it?" line for the far shift; the manager sees the Requests button with a badge
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage(); p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await p.goto(B + "/?v=rq"); await p.waitForTimeout(300); await p.evaluate((t) => { localStorage.setItem("bl_me_token", t); localStorage.setItem("bl_me_name", "Pietro"); }, P["x-staff-token"]); await p.reload(); await p.waitForTimeout(1800);
  await p.evaluate(() => { document.querySelectorAll(".overlay.show").forEach((x) => x.classList.remove("show")); });
  await p.evaluate(() => document.getElementById("meOpenBtn").click()); await p.waitForSelector("#meOverlay.show"); await p.waitForTimeout(800);
  // move My week to the far week
  for (let i = 0; i < 4; i++) { const cur = await p.evaluate(() => document.getElementById("meWeekLbl").textContent); if (await p.evaluate((w) => !!document.querySelector('button[data-cover^="' + w + '|"]'), farWk)) break; await p.evaluate(() => document.getElementById("meNext").click()); await p.waitForTimeout(400); }
  const ui = await p.evaluate(() => ({ form: !!document.getElementById("offSend"), cover: document.querySelectorAll("button[data-cover]").length, mine: document.querySelectorAll("#meReq .req-row").length }));
  console.log("22 My week UI:", ui); if (!ui.form || ui.cover < 1 || ui.mine < 1) errors.push("My week requests UI incomplete: " + JSON.stringify(ui));
  await p.evaluate(() => { document.querySelectorAll(".overlay.show").forEach((x) => x.classList.remove("show")); });
  // a fresh pending cover so the manager has something waiting
  r = await j("/api/requests", { method: "POST", headers: P, body: JSON.stringify({ action: "cover", week: farWk, day: farDay, shiftId: "rq-far2" }) }); if (r.s !== 200) errors.push("second cover refused");
  const m = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage(); await m.goto(B + "/?v=rqm"); await m.waitForTimeout(300); await m.evaluate(() => { localStorage.setItem("bl_admin_pw", "segreta"); }); await m.reload(); await m.waitForTimeout(2000);
  await m.evaluate(() => { document.querySelectorAll(".overlay.show").forEach((x) => x.classList.remove("show")); });
  const mu = await m.evaluate(() => ({ btn: getComputedStyle(document.getElementById("reqBtn")).display, cnt: document.getElementById("reqCnt").textContent, card: document.getElementById("openShifts").classList.contains("show") }));
  console.log("23 manager bar:", mu); if (mu.btn === "none" || Number(mu.cnt) < 1 || !mu.card) errors.push("manager Requests button/badge/card missing: " + JSON.stringify(mu));
  await m.evaluate(() => document.getElementById("reqBtn").click()); await m.waitForSelector("#reqOverlay.show"); await m.waitForTimeout(400);
  const sheet = await m.evaluate(() => ({ rows: document.querySelectorAll("#reqList .req-row").length, decline: !!document.querySelector("#reqList button[data-decline]"), select: !!document.querySelector("#reqList select[data-sel]") }));
  console.log("24 requests sheet:", sheet); if (!sheet.rows || !sheet.decline || !sheet.select) errors.push("requests sheet incomplete");
  await m.evaluate(() => document.querySelector("#reqList button[data-decline]").click()); await m.waitForTimeout(1200);
  r = await j("/api/requests", { headers: M }); console.log("25 pending after decline:", (r.j.pending || []).length); if ((r.j.pending || []).length) errors.push("decline from the sheet did not work");
  await b.close(); console.log("ERRORS:", errors.length ? errors : "none"); process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.log("ERR", e.message.split("\n")[0]); process.exit(1); });
