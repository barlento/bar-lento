// Forgotten clock-outs (owner 2026-09-29): Toast closes them by itself at 4:00 AM (autoClockedOut). The app must flag the entry,
// count NO hours for it anywhere (Time clock, My week, ranking, reports) and tell the managers once. Devserver: Luca yesterday.
// Also (owner 2026-10-03): times are New York's whatever time zone the phone is on, and an entry in-and-out within seconds (a tap by
// mistake at the terminal, devserver: Joe yesterday) is flagged `ghost`, shown as such and never counted as a clock-in.
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
  const gh = ((r.j && r.j.entries) || []).find((e) => e.name === "Joe" && e.ghost); const nyDay = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(iso));
  console.log("1b ghost entry:", gh && { in: gh.in, out: gh.out, ghost: gh.ghost }, "| every entry on the page belongs to that bar day:", ((r.j && r.j.entries) || []).every((e) => nyDay(e.in) === yd));
  if (!gh) errors.push("ghost flag missing in the time clock"); if (!((r.j && r.j.entries) || []).every((e) => nyDay(e.in) === yd)) errors.push("time clock page mixes days");
  // 2. My week hours (manager view): 0 minutes, the entry says auto
  r = await j("/api/me?action=hours&name=Luca&week=" + wk, { headers: M }); const ent = ((r.j && r.j.entries) || []).find((e) => e.date === yd);
  console.log("2 hours:", r.s, "| worked:", r.j && r.j.workedMinutes, "| entry auto:", ent && ent.auto); if (r.s !== 200 || (r.j.workedMinutes || 0) !== 0 || !ent || ent.auto !== true) errors.push("hours count the auto entry");
  r = await j("/api/me?action=hours&name=Joe&week=" + wk, { headers: M }); console.log("2b Joe's hours: ghosts skipped:", r.j && r.j.ghosts, "| clocked shifts:", r.j && r.j.clockedShifts); if (r.s !== 200 || !(r.j.ghosts >= 1)) errors.push("ghost entry not skipped in hours");
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
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2, timezoneId: "Europe/Rome" })).newPage(); // the owner's phone in Italy: times must still read New York p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await p.goto(B + "/?v=ao1"); await p.waitForTimeout(300); await p.evaluate(() => { localStorage.setItem("bl_admin_pw", "segreta"); }); await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => { document.querySelectorAll(".overlay.show").forEach((o) => o.classList.remove("show")); document.body.classList.remove("modal-open"); });
  await p.click("#clockBtn"); await p.waitForSelector("#clockOverlay.show"); await p.waitForTimeout(1200); await p.click("#tcPrev"); await p.waitForTimeout(1500);
  const ui = await p.evaluate(() => { const row = [...document.querySelectorAll(".tc-row")].find((x) => /Luca/.test(x.textContent)); const g = document.querySelector(".tc-row.ghost"); return { row: row && row.className, txt: row && row.textContent.replace(/\s+/g, " ").slice(0, 160), inTxt: row && row.querySelector(".in") && row.querySelector(".in").textContent, total: document.querySelector("#tcSum .tile:last-child b") && document.querySelector("#tcSum .tile:last-child b").textContent, ghost: g && g.textContent.replace(/\s+/g, " ").slice(0, 160), sub: document.querySelector("#tcDateSub").textContent }; });
  const nyIn = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(luca.in));
  console.log("6 UI:", JSON.stringify(ui), "| Luca's clock-in in New York time:", nyIn); if (!ui.row || !/autoout/.test(ui.row) || !/Clock-out missing/.test(ui.txt || "") || !/not counted/.test(ui.txt || "")) errors.push("time clock row not flagged");
  if (ui.inTxt !== nyIn) errors.push("time shown in the phone's time zone, not New York's: " + ui.inTxt); if (!ui.ghost || !/tap by mistake/.test(ui.ghost) || !/Joe/.test(ui.ghost)) errors.push("ghost row not flagged"); if (!/New York time/.test(ui.sub || "")) errors.push("no New York time note on a phone elsewhere");
  await p.screenshot({ path: path.join(OUT, "autoout-timeclock.png") }); await b.close();
  // 7. still clocked in after closing (in-process, stubs): 10:35 PM on a 10 PM day → one alert to every manager/owner, once; 10:10 PM → nothing
  {
    const store = require("../../lib/store"), push = require("../../lib/push"), toastL = require("../../lib/toast"), punchL = require("../../lib/punch"), mail = require("../../lib/mail"), wa = require("../../lib/whatsapp");
    const kv = new Map(); store.hasStorage = () => true; store.appendLog = async (e) => { kv.set("log", (kv.get("log") || []).concat(e.changes)); };
    store._redis = async (...a) => { const c = a[0]; if (c === "GET") return kv.has(a[1]) ? kv.get(a[1]) : null; if (c === "SET") { if (a.includes("NX") && kv.has(a[1])) return null; kv.set(a[1], String(a[2])); return "OK"; } if (c === "DEL") return kv.delete(a[1]) ? 1 : 0; throw new Error("stub: " + c); };
    const pushes = []; push.broadcast = async (payload, names) => { pushes.push({ body: payload.body, names }); return { sent: names.length }; };
    const mails = []; mail.enabled = () => true; mail.send = async (m) => { mails.push(m); }; const was = []; wa.send = async (t) => { was.push(t); return { sent: 0, skipped: "not configured" }; };
    toastL.enabled = () => true; toastL.employees = async () => []; toastL.autoMap = () => ({}); toastL.dayStatus = async (date) => ({ byName: { Joe: [{ in: date + "T20:00:00.000Z", out: null }], Sierrah: [{ in: date + "T20:00:00.000Z", out: date + "T23:30:00.000Z" }] } });
    punchL.appClockNames = async () => new Set(["Pietro"]); punchL.openEntry = async (n) => (n === "Pietro" ? { in: "2026-09-29T20:05:00.000Z" } : null);
    const wn = require("../../lib/whatsnew"); wn.recipients = async () => [{ name: "Marta", email: "marta@example.com" }, { name: "Joe B.", email: "joe.b@example.com" }];
    const remind = require("../../lib/remind"); const doc = { data: { staff: ["Joe", "Sierrah", "Pietro", "Marta", "Joe B."], dept: { Marta: "management", "Joe B.": "owner" }, weeks: {} } };
    const wed = "2026-09-30"; // a Wednesday: closing 10 PM New York = 02:00Z next day
    const early = await remind.overrun(doc, { force: true, now: "2026-10-01T02:10:00.000Z" }); const late = await remind.overrun(doc, { force: true, now: "2026-10-01T02:40:00.000Z" }); const again = await remind.overrun(doc, { force: true, now: "2026-10-01T03:00:00.000Z" });
    console.log("7 overrun 10:10 PM:", early.skipped, "| 10:40 PM:", JSON.stringify(late.alerts.map((a) => [a.name, a.src, a.minutesPast, a.to])), "| pushes:", pushes.length, "| mails:", mails.length, mails[0] && mails[0].to, "| whatsapp calls:", was.length, "| again:", again.alerts.length, "pushes still", pushes.length);
    if (early.skipped !== "not yet" || late.date !== wed || late.alerts.length !== 2 || !late.alerts.some((a) => a.name === "Joe" && a.src === "Toast" && a.minutesPast === 40) || !late.alerts.some((a) => a.name === "Pietro" && a.src === "app")) errors.push("overrun detection wrong");
    if (pushes.length !== 2 || !pushes.every((x) => x.names.includes("Marta") && x.names.includes("Joe B.")) || mails.length !== 2 || !mails[0].to.includes("marta@example.com") || !mails[0].to.includes("simoneviola@barlentony.com") || was.length !== 2) errors.push("overrun delivery wrong");
    if (again.alerts.length !== 2 || pushes.length !== 2) errors.push("overrun alerted twice");
    if (!(kv.get("log") || []).some((l) => /Still clocked in after closing: Joe/.test(l))) errors.push("overrun history line missing");
  }
  console.log("ERRORS:", errors.length ? JSON.stringify(errors) : "none"); process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
