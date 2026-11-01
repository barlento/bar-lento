// Salaried people (owner 2026-11-01: "Giordano, Luis e Marta sono a paga fissa: via mail non deve arrivare più nulla, togli le
// timbrature dall'app"): data.salaried → no Sunday email, no clock-in alerts, no Clock in button, no hours / stats / report in their
// own app; the manager still sees their hours; only the owner flips the switch. On the fake server only Marta is on staff of the three.
const { chromium } = require("playwright");
const B = "http://127.0.0.1:4173"; const errors = [];
const j = async (u, o) => { const r = await fetch(B + u, o); let x = null, txt = ""; try { txt = await r.text(); x = JSON.parse(txt); } catch (e) {} return { s: r.status, j: x, txt }; };
const M = { "Content-Type": "application/json", "x-admin-password": "segreta" };
const tok = async (name, pin) => { let x = await j("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", name, pin }) }); if (x.s !== 200) x = await j("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name, pin }) }); return x.j && x.j.token; };
const nyDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const mondayOf = (iso) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
async function signAll(p) { for (let i = 0; i < 7; i++) { const open = await p.evaluate(() => document.getElementById("rulesOverlay").classList.contains("show")); if (!open) return; const title = await p.textContent("#rulesTitle"); if (/Training/.test(title)) { await p.click("#rulesLater"); return; } await p.evaluate(() => { const x = document.getElementById("rulesBody"); x.scrollTop = x.scrollHeight; }); await p.waitForTimeout(350); if (await p.isVisible("#rulesEmailField") && !(await p.inputValue("#rulesEmail"))) await p.fill("#rulesEmail", "x@example.com"); await p.check("#rulesCheck"); await p.click("#rulesAgree"); await p.waitForTimeout(900); } }
async function pinLogin(p, name, pin) { await p.goto(B + "/?v=s" + Math.random()); await p.waitForSelector("#whoOverlay.show"); await p.click('.who-name[data-name="' + name + '"]'); await p.waitForFunction(() => /PIN/.test(document.getElementById("pinTitle").textContent)); for (const k of pin) await p.click(`#pinPad button[data-k="${k}"]`); await p.waitForTimeout(500); if ((await p.textContent("#pinTitle")) === "Confirm your PIN") for (const k of pin) await p.click(`#pinPad button[data-k="${k}"]`); await p.waitForTimeout(1200); await signAll(p).catch(() => {}); await p.evaluate(() => { document.querySelectorAll(".overlay.show").forEach((o) => o.classList.remove("show")); document.body.classList.remove("modal-open"); }); await p.waitForTimeout(600); return await p.evaluate(() => localStorage.getItem("bl_me_token")); }
const clearOverlays = (p) => p.evaluate(() => { document.querySelectorAll(".overlay.show").forEach((o) => o.classList.remove("show")); });

(async () => {
  // 1. the migration: Marta salaried, out of the app-clock list
  let r = await j("/api/data"); const d0 = r.j.data;
  console.log("1 salaried:", JSON.stringify(d0.salaried), "| appClock:", JSON.stringify(d0.appClock));
  if (!(d0.salaried || []).includes("Marta") || (d0.appClock || []).includes("Marta")) errors.push("migration did not mark Marta salaried / remove her app clock");

  // 2. Marta's own view: no hours, no recap, no stats, no own report; profile says so
  const tm = await tok("Marta", "6161"); const H = { "x-staff-token": tm }; const cur = mondayOf(nyDate());
  r = await j("/api/me?action=who", { headers: H }); console.log("2 who: salaried", r.j && r.j.salaried, "| appClock", r.j && r.j.appClock);
  if (!r.j || r.j.salaried !== true || r.j.appClock) errors.push("who payload wrong for Marta");
  r = await j("/api/me?action=hours&week=" + cur, { headers: H }); console.log("3 own hours:", r.s, "salaried", r.j && r.j.salaried, "| entries", r.j && r.j.entries && r.j.entries.length);
  if (r.s !== 200 || !r.j.salaried || (r.j.entries || []).length) errors.push("own hours not stubbed");
  r = await j("/api/me?action=hours&week=" + cur + "&name=Marta", { headers: H }); console.log("3b own hours asked with &name=Marta (no bypass):", r.s, "salaried", r.j && r.j.salaried); if (r.s !== 200 || !r.j.salaried) errors.push("&name= bypasses the hours stub");
  r = await j("/api/toast?action=mystats&name=Marta", { headers: H }); console.log("3c mystats with &name=Marta (no bypass):", r.s, r.j && r.j.error); if (r.s !== 403) errors.push("&name= bypasses the mystats refusal");
  r = await j("/api/me?action=recap&week=" + cur, { headers: H }); console.log("4 recap:", r.s, JSON.stringify(r.j)); if (r.s !== 200 || !r.j.salaried || r.j.cur) errors.push("recap not stubbed");
  r = await j("/api/toast?action=mystats", { headers: H }); console.log("5 mystats:", r.s, r.j && r.j.error); if (r.s !== 403 || !r.j || r.j.error !== "salaried") errors.push("mystats not refused");
  r = await j("/api/export?mine=1", { headers: H }); console.log("6 own report:", r.s, r.txt.slice(0, 20)); if (r.s !== 403 || !/salaried/.test(r.txt)) errors.push("own report not refused");
  r = await j("/api/me", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ action: "punch", on: true }) }); console.log("7 punch from the app:", r.s, r.j && r.j.error); if (r.s === 200) errors.push("Marta could clock in from the app");
  // the manager still sees her hours (Toast entries of the fake server)
  r = await j("/api/me?action=hours&week=" + cur + "&name=Marta", { headers: M }); console.log("8 manager sees Marta's hours:", r.s, "salaried flag", r.j && r.j.salaried, "| linked", r.j && r.j.linked, "| entries", r.j && r.j.entries && r.j.entries.length);
  if (r.s !== 200 || r.j.salaried || !r.j.linked) errors.push("manager view of Marta's hours lost");

  // 9. Sunday email: Marta skipped, listed as salaried
  const last = mondayOf(new Date(Date.parse(cur + "T12:00:00Z") - 7 * 86400000).toISOString().slice(0, 10));
  r = await j("/api/weekly?force=1&week=" + last, { headers: M }); console.log("9 weekly:", r.s, "| skipped:", JSON.stringify(r.j && r.j.skipped), "| sent:", JSON.stringify(r.j && r.j.sent));
  if (r.s !== 200 || !(r.j.skipped || []).some((s) => /^Marta \(salaried/.test(s)) || (r.j.sent || []).some((s) => /^Marta\b/.test(s))) errors.push("weekly email still reaches Marta");

  // 10. only the owner flips the switch: Marta (management) → 403 owner_only; the password (owner) → saved
  r = await j("/api/data"); let data = JSON.parse(JSON.stringify(r.j.data)); data.salaried = (data.salaried || []).concat(["Joe"]);
  let p = await j("/api/data", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ version: r.j.version, data }) });
  console.log("10 Marta makes Joe salaried:", p.s, p.j && p.j.error); if (p.s !== 403 || !p.j || p.j.error !== "owner_only") errors.push("manager could change the salaried list");
  r = await j("/api/data"); data = JSON.parse(JSON.stringify(r.j.data)); data.salaried = (data.salaried || []).filter((n) => n !== "Marta");
  p = await j("/api/data", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ version: r.j.version, data }) });
  console.log("10b Marta makes herself hourly:", p.s, p.j && p.j.error); if (p.s !== 403) errors.push("manager could drop herself from the salaried list");

  // 11. in-process: the late alert skips salaried people (Marta planned and not clocked in → nothing; Joe → alert)
  {
    const store = require("../../lib/store"), push = require("../../lib/push"), toastL = require("../../lib/toast"), punchL = require("../../lib/punch"), mail = require("../../lib/mail");
    const kv = new Map(); store.hasStorage = () => true; store.appendLog = async () => {};
    store._redis = async (...a) => { const c = a[0]; if (c === "GET") return kv.has(a[1]) ? kv.get(a[1]) : null; if (c === "SET") { if (a.includes("NX") && kv.has(a[1])) return null; kv.set(a[1], String(a[2])); return "OK"; } if (c === "DEL") return kv.delete(a[1]) ? 1 : 0; throw new Error("stub: " + c); };
    const pushes = []; push.broadcast = async (payload, names) => { pushes.push({ title: payload.title, body: payload.body, names }); return { sent: names.length }; }; push.isQuietHours = () => false;
    const mails = []; mail.enabled = () => true; mail.send = async (m) => { mails.push(m); };
    toastL.enabled = () => false; punchL.appClockNames = async () => new Set(["Joe", "Marta"]); punchL.between = async () => []; punchL.openEntry = async () => null;
    const remind = require("../../lib/remind");
    const ny = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date()); const hh = Number(ny.find((x) => x.type === "hour").value) % 24, mm = Number(ny.find((x) => x.type === "minute").value);
    const minsNow = hh * 60 + mm; const startMin = minsNow - 30; // the shift started 30 minutes ago New York time
    if (startMin < 0) console.log("11 late alert: skipped (just after midnight in New York)");
    else {
      const date = nyDate(), wk = mondayOf(date); const DK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]; const di = Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(wk + "T12:00:00Z")) / 86400000);
      const hm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); const week = { notes: {} }; DK.forEach((k) => (week[k] = []));
      week[DK[di]] = [{ id: "s1", name: "Joe", station: "Bar", start: hm(startMin), end: hm(Math.min(startMin + 300, 1439)) }, { id: "s2", name: "Marta", station: "", start: hm(startMin), end: hm(Math.min(startMin + 300, 1439)) }];
      const doc = { data: { staff: ["Joe", "Marta", "Joe B.", "Pietro"], salaried: ["Marta"], dept: { Marta: "management", "Joe B.": "owner" }, weeks: { [wk]: week } } };
      const out = await remind.late(doc, true);
      console.log("11 late alert:", JSON.stringify((out.alerts || []).map((a) => a.name)), "| pushes to:", JSON.stringify(pushes.map((x) => x.names)), "| mails to:", JSON.stringify(mails.map((m) => m.to)));
      if (!out.alerts || out.alerts.length !== 1 || out.alerts[0].name !== "Joe" || pushes.some((x) => x.names.includes("Marta") && /Did you clock in/.test(x.title))) errors.push("late alert still involves the salaried person");
      // overrun on a closed-at-10 PM day: Marta still clocked in → nothing
      toastL.enabled = () => true; toastL.employees = async () => []; toastL.autoMap = () => ({}); toastL.dayStatus = async (dd) => ({ byName: { Marta: [{ in: dd + "T20:00:00.000Z", out: null }], Joe: [{ in: dd + "T20:00:00.000Z", out: null }] } });
      punchL.appClockNames = async () => new Set();
      const over = await remind.overrun({ data: { staff: ["Joe", "Marta", "Joe B."], salaried: ["Marta"], dept: { Marta: "management", "Joe B.": "owner" }, weeks: {} } }, { force: true, dry: true, now: "2026-10-01T02:40:00.000Z" });
      console.log("12 overrun 10:40 PM Wed:", JSON.stringify((over.alerts || []).map((a) => a.name)));
      if (!over.alerts || over.alerts.length !== 1 || over.alerts[0].name !== "Joe") errors.push("overrun alert still involves the salaried person");
    }
  }

  // 12b. the owner sets Pietro (app clock) salaried while he is clocked in: his open entry is closed at once; his own month list is stubbed; then hourly again
  const tp = await tok("Pietro", "3131"); const HP = { "x-staff-token": tp }; const ym = nyDate().slice(0, 7);
  r = await j("/api/me", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, HP), body: JSON.stringify({ action: "punch", on: true }) }); console.log("12b Pietro clocks in:", r.s, r.j && r.j.error);
  r = await j("/api/data"); data = JSON.parse(JSON.stringify(r.j.data)); data.salaried = (data.salaried || []).concat(["Pietro"]);
  p = await j("/api/data", { method: "POST", headers: M, body: JSON.stringify({ version: r.j.version, data }) });
  r = await j("/api/me?action=punches&name=Pietro&month=" + ym, { headers: M });
  console.log("12c owner sets Pietro salaried:", p.s, "| open entry after:", JSON.stringify(r.j && r.j.open), "| entries this month:", r.j && r.j.entries && r.j.entries.length);
  if (p.s !== 200 || !r.j || r.j.open || !(r.j.entries || []).length || !r.j.entries[r.j.entries.length - 1].out) errors.push("open app clock-in not closed when set salaried");
  r = await j("/api/me?action=punches&month=" + ym, { headers: HP }); console.log("12d Pietro's own punches while salaried:", r.s, "salaried", r.j && r.j.salaried, "entries", r.j && r.j.entries && r.j.entries.length); if (r.s !== 200 || !r.j.salaried || (r.j.entries || []).length) errors.push("own punches not stubbed");
  r = await j("/api/data"); data = JSON.parse(JSON.stringify(r.j.data)); data.salaried = (data.salaried || []).filter((n) => n !== "Pietro");
  p = await j("/api/data", { method: "POST", headers: M, body: JSON.stringify({ version: r.j.version, data }) }); console.log("12e Pietro hourly again:", p.s); if (p.s !== 200) errors.push("could not set Pietro hourly again");

  // 13. UI
  const b = await chromium.launch();
  const phone = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); phone.on("pageerror", (e) => errors.push("phone pageerror: " + e.message));
  await pinLogin(phone, "Marta", "6161");
  const strip = await phone.evaluate(() => ({ stats: getComputedStyle(document.getElementById("meStatsBtn")).display, punch: getComputedStyle(document.getElementById("mePunchBtn")).display, brk: getComputedStyle(document.getElementById("meBreakBtn")).display, mode: document.body.classList.contains("mgr") }));
  console.log("13 Marta's strip:", JSON.stringify(strip)); if (strip.stats !== "none" || strip.punch !== "none" || strip.brk !== "none") errors.push("Marta's strip still shows stats or clock buttons");
  await phone.click("#meOpenBtn"); await phone.waitForSelector("#meOverlay.show"); await phone.waitForFunction(() => /Salaried/.test(document.getElementById("meNote").textContent), null, { timeout: 8000 });
  const mw = await phone.evaluate(() => ({ lead: document.getElementById("meLead").textContent, note: document.getElementById("meNote").textContent, report: getComputedStyle(document.getElementById("meReport")).display, stats: getComputedStyle(document.getElementById("meStatsLink")).display, tiles: document.querySelectorAll("#meSum .tile").length }));
  console.log("14 Marta's My week:", JSON.stringify(mw)); if (!/salaried/i.test(mw.lead) || !/Salaried/.test(mw.note) || mw.report !== "none" || mw.stats !== "none" || mw.tiles !== 1) errors.push("Marta's My week still shows hours tools");
  await phone.screenshot({ path: require("path").join(__dirname, "..", "out", "salaried-myweek.png") });
  // Marta (management) opens Joe's sheet: the salaried row without a switch
  await clearOverlays(phone); await phone.click("#staffBtn"); await phone.waitForSelector("#staffOverlay.show"); await phone.waitForFunction(() => /PIN|signed/.test(document.getElementById("rosterList").textContent), null, { timeout: 8000 });
  await phone.click('.person[data-name="Joe"]'); await phone.waitForSelector("#personOverlay.show"); await phone.waitForTimeout(300);
  const pm = await phone.evaluate(() => ({ row: /Hourly · hours tracked/.test(document.getElementById("personBody").textContent), btn: document.querySelectorAll("#personBody .pinbtn.salaried").length }));
  console.log("15 manager's view of Joe:", JSON.stringify(pm)); if (!pm.row || pm.btn !== 0) errors.push("manager sees a salaried switch (owner only)");
  // the owner (password): Marta's sheet shows the salaried row + "Set hourly"; Joe gets switched and switched back
  const pc = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage(); pc.on("pageerror", (e) => errors.push("pc pageerror: " + e.message));
  await pc.goto(B + "/?v=so1"); await pc.waitForSelector("#whoOverlay.show"); await pc.click("#whoManager"); await pc.fill("#pwInput", "segreta"); await pc.click("#loginGo"); await pc.waitForTimeout(800);
  await pc.click("#staffBtn"); await pc.waitForSelector("#staffOverlay.show"); await pc.waitForFunction(() => /PIN|signed/.test(document.getElementById("rosterList").textContent), null, { timeout: 8000 });
  await pc.click('.person[data-name="Marta"]'); await pc.waitForSelector("#personOverlay.show"); await pc.waitForTimeout(300);
  const ps = await pc.evaluate(() => ({ row: /Salaried · no hours emails/.test(document.getElementById("personBody").textContent), btn: (document.querySelector("#personBody .pinbtn.salaried") || {}).textContent, appclock: document.querySelectorAll("#personBody .pinbtn.appclock").length, punches: !!document.getElementById("personPunches") }));
  console.log("16 owner's view of Marta:", JSON.stringify(ps)); if (!ps.row || ps.btn !== "Set hourly" || ps.appclock !== 0 || !ps.punches) errors.push("owner's view of Marta wrong"); // the month list of past app clock-ins stays (history)
  await pc.screenshot({ path: require("path").join(__dirname, "..", "out", "salaried-person.png") });
  await pc.click("#personClose"); await pc.waitForTimeout(200); await pc.click('.person[data-name="Joe"]'); await pc.waitForSelector("#personOverlay.show"); await pc.waitForTimeout(300);
  await pc.click("#personBody .pinbtn.salaried"); await pc.waitForTimeout(1500);
  r = await j("/api/data"); console.log("17 Joe switched to salaried:", JSON.stringify(r.j.data.salaried)); if (!(r.j.data.salaried || []).includes("Joe")) errors.push("owner's switch did not save");
  await pc.click("#personBody .pinbtn.salaried"); await pc.waitForTimeout(1500);
  r = await j("/api/data"); console.log("18 Joe back to hourly:", JSON.stringify(r.j.data.salaried), "| history:", JSON.stringify(((await j("/api/log?limit=2", { headers: M })).j || {}).entries ? "ok" : "-"));
  if ((r.j.data.salaried || []).includes("Joe")) errors.push("owner's switch back did not save");
  // 19. the manager may still remove a salaried person from staff (the owner-only check is about the switch, not the removal)
  r = await j("/api/data"); data = JSON.parse(JSON.stringify(r.j.data)); data.salaried = (data.salaried || []).concat(["Catherine"]);
  p = await j("/api/data", { method: "POST", headers: M, body: JSON.stringify({ version: r.j.version, data }) }); if (p.s !== 200) errors.push("owner could not set Catherine salaried");
  r = await j("/api/data"); data = JSON.parse(JSON.stringify(r.j.data)); data.staff = data.staff.filter((n) => n !== "Catherine");
  p = await j("/api/data", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ version: r.j.version, data }) });
  console.log("19 Marta removes salaried Catherine:", p.s, p.j && p.j.error); if (p.s !== 200) errors.push("manager cannot remove a salaried person");
  await b.close(); console.log("ERRORS:", errors.length ? errors : "none");
})().catch((e) => { console.log("FAIL", e.message.split("\n")[0]); process.exit(1); });
