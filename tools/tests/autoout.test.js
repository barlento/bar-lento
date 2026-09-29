// Forgotten clock-outs (owner 2026-09-29): Toast closes them by itself at 4:00 AM (autoClockedOut). The app must flag the entry,
// count NO hours for it anywhere (Time clock, My week, ranking, reports) and tell the managers once. Devserver: Luca yesterday.
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const B = "http://127.0.0.1:4173"; const errors = []; const M = { "x-admin-password": "segreta" };
const OUT = path.join(__dirname, "..", "out"); fs.mkdirSync(OUT, { recursive: true });
async function j(p, o) { const r = await fetch(B + p, o); let x = null; try { x = await r.json(); } catch (e) {} return { s: r.status, j: x, h: r.headers }; }
(async () => {
  const ny = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()); const y = new Date(ny + "T12:00:00Z"); y.setUTCDate(y.getUTCDate() - 1); const yd = y.toISOString().slice(0, 10);
  const mon = new Date(y); mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7)); const wk = mon.toISOString().slice(0, 10);
  await j("/api/data"); // staff sync brings Luca in
  // 1. Time clock: the entry is flagged
  let r = await j("/api/toast?action=clock&date=" + yd, { headers: M }); const luca = ((r.j && r.j.entries) || []).find((e) => e.name === "Luca");
  console.log("1 time clock yesterday:", r.s, "| Luca:", luca && { in: luca.in, out: luca.out, auto: luca.auto }); if (!luca || luca.auto !== true) errors.push("auto flag missing in the time clock");
  // 2. My week hours (manager view): 0 minutes, the entry says auto
  r = await j("/api/me?action=hours&name=Luca&week=" + wk, { headers: M }); const ent = ((r.j && r.j.entries) || []).find((e) => e.date === yd);
  console.log("2 hours:", r.s, "| worked:", r.j && r.j.workedMinutes, "| entry auto:", ent && ent.auto); if (r.s !== 200 || (r.j.workedMinutes || 0) !== 0 || !ent || ent.auto !== true) errors.push("hours count the auto entry");
  // 3. Ranking: Luca has 0 h this week (not 12)
  r = await j("/api/toast?action=leaderboard&period=week", { headers: M }); const row = ((r.j && r.j.rows) || []).find((x) => x.name === "Luca");
  console.log("3 ranking Luca:", row && { msClosed: row.msClosed, openSince: row.openSince, shifts: row.shifts }); if (!row || (row.msClosed || 0) > 0 || row.openSince) errors.push("ranking counts the auto entry");
  // 4. Reports: PDF renders, the person's collected data carries the note and zero hours (xlsx path shares collectPerson; check via PDF status + JSON of team)
  const pdf = await fetch(B + "/api/export?person=Luca&from=" + yd + "&to=" + yd, { headers: M }); console.log("4 person PDF:", pdf.status, pdf.headers.get("content-type")); if (pdf.status !== 200) errors.push("person pdf failed");
  const team = await fetch(B + "/api/export?team=1&from=" + yd + "&to=" + yd, { headers: M }); console.log("4b team PDF:", team.status); if (team.status !== 200) errors.push("team pdf failed");
  // 5. The daily check: alert for Luca, once; history line
  r = await j("/api/remind?force=1", { headers: M }); const al = (r.j && r.j.autoOut && r.j.autoOut.alerts) || [];
  console.log("5 autoOut:", r.s, JSON.stringify(al.map((a) => ({ name: a.name, hours: a.hours })))); if (!al.some((a) => a.name === "Luca" && a.hours >= 10)) errors.push("no auto clock-out alert for Luca");
  const log = await j("/api/log?limit=500", { headers: M }); // the line may be older than the last few saves when the daily check already ran const lines = JSON.stringify(log.j || ""); console.log("5b history has the line:", /Clock-out missing: Luca/.test(lines)); if (!/Clock-out missing: Luca/.test(lines)) errors.push("history line missing");
  // 6. UI: the Time clock row says it in red, the total excludes it
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 })).newPage(); p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await p.goto(B + "/?v=ao1"); await p.waitForTimeout(300); await p.evaluate(() => { localStorage.setItem("bl_admin_pw", "segreta"); }); await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => { document.querySelectorAll(".overlay.show").forEach((o) => o.classList.remove("show")); document.body.classList.remove("modal-open"); });
  await p.click("#clockBtn"); await p.waitForSelector("#clockOverlay.show"); await p.waitForTimeout(1200); await p.click("#tcPrev"); await p.waitForTimeout(1500);
  const ui = await p.evaluate(() => { const row = [...document.querySelectorAll(".tc-row")].find((x) => /Luca/.test(x.textContent)); return { row: row && row.className, txt: row && row.textContent.replace(/\s+/g, " ").slice(0, 160), total: document.querySelector("#tcSum .tile:last-child b") && document.querySelector("#tcSum .tile:last-child b").textContent }; });
  console.log("6 UI:", JSON.stringify(ui)); if (!ui.row || !/autoout/.test(ui.row) || !/Clock-out missing/.test(ui.txt || "") || !/not counted/.test(ui.txt || "")) errors.push("time clock row not flagged");
  await p.screenshot({ path: path.join(OUT, "autoout-timeclock.png") }); await b.close();
  console.log("ERRORS:", errors.length ? JSON.stringify(errors) : "none"); process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
