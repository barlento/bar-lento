// Private event kinds (manager's request 2026-10-27): Day settings → Private event → pick Happy hour / Engagement party / …;
// the kind is stored in notes[day].kind, the day card shows a coloured badge with the kind, a tap on a chip saves at once.
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const B = "http://127.0.0.1:4173"; const errors = []; const M = { "x-admin-password": "segreta", "Content-Type": "application/json" };
const OUT = path.join(__dirname, "..", "out"); fs.mkdirSync(OUT, { recursive: true });
async function j(p, o) { const r = await fetch(B + p, o); let x = null; try { x = await r.json(); } catch (e) {} return { s: r.status, j: x }; }
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
(async () => {
  const ny = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()) + "T12:00:00Z");
  const mon = new Date(ny); mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7) + 21); const wk = mon.toISOString().slice(0, 10); // three weeks ahead: nobody else's seed
  // 1. the manager posts a week with a Happy hour on Tuesday
  let r = await j("/api/data"); const build = (data) => { const d = JSON.parse(JSON.stringify(data)); d.weeks[wk] = d.weeks[wk] || { notes: {} }; DAYS.forEach((k) => (d.weeks[wk][k] = d.weeks[wk][k] || [])); d.weeks[wk].notes = { tue: { status: "event", kind: "happy", text: "DJ from 8 PM" }, wed: { status: "event", kind: "nonsense", text: "" } }; return d; };
  r = await j("/api/data", { method: "POST", headers: M, body: JSON.stringify({ version: r.j.version, data: build(r.j.data) }) });
  if (r.s === 409) { const g = await j("/api/data"); r = await j("/api/data", { method: "POST", headers: M, body: JSON.stringify({ version: g.j.version, data: build(g.j.data) }) }); }
  const g = await j("/api/data"); const notes = (g.j.data.weeks[wk] || {}).notes || {};
  console.log("1 posted:", r.s, "| tue:", JSON.stringify(notes.tue), "| wed (unknown kind dropped):", JSON.stringify(notes.wed));
  if (r.s !== 200 || !notes.tue || notes.tue.kind !== "happy" || !notes.wed || notes.wed.kind) errors.push("kind not stored / unknown kind kept");
  // 2. the day card shows the coloured badge; Day settings shows the chips; a tap on another chip saves at once
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 })).newPage(); p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await p.goto(B + "/?v=ev1"); await p.waitForTimeout(300); await p.evaluate(() => { localStorage.setItem("bl_admin_pw", "segreta"); }); await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => { document.querySelectorAll(".overlay.show").forEach((o) => o.classList.remove("show")); document.body.classList.remove("modal-open"); });
  await p.click(`.tab[data-week="${wk}"]`); await p.waitForTimeout(600);
  const card = await p.evaluate(() => { const c = [...document.querySelectorAll(".day-card")][1]; const bd = c && c.querySelector(".badge"); return { badge: bd && bd.textContent, cls: bd && bd.className, note: c && (c.querySelector(".daynote") || {}).textContent }; });
  console.log("2 Tuesday card:", JSON.stringify(card)); if (!card.badge || !/Happy hour/i.test(card.badge) || !/k-happy/.test(card.cls || "") || !/DJ from 8 PM/.test(card.note || "")) errors.push("day card badge wrong");
  await p.click('.day-card:nth-child(2) .daybtn'); await p.waitForSelector("#dayOverlay.show"); await p.waitForTimeout(400);
  const ed = await p.evaluate(() => ({ chips: getComputedStyle(document.getElementById("eventKinds")).display !== "none", sel: (document.querySelector(".kindchip.sel") || {}).textContent, n: document.querySelectorAll(".kindchip").length, note: document.getElementById("dayNote").value }));
  console.log("3 editor:", JSON.stringify(ed)); if (!ed.chips || !/Happy hour/.test(ed.sel || "") || ed.n !== 6 || ed.note !== "DJ from 8 PM") errors.push("editor chips wrong");
  await p.click(".kindchip.k-engagement"); await p.waitForTimeout(1500);
  const after = await j("/api/data"); const t2 = ((after.j.data.weeks[wk] || {}).notes || {}).tue || {};
  const card2 = await p.evaluate(() => { const bd = [...document.querySelectorAll(".day-card")][1].querySelector(".badge"); return bd && bd.textContent; });
  console.log("4 after tapping Engagement party: stored kind:", t2.kind, "| text kept:", t2.text, "| card badge:", card2); if (t2.kind !== "engagement" || t2.text !== "DJ from 8 PM" || !/Engagement party/i.test(card2 || "")) errors.push("chip tap not saved");
  await p.screenshot({ path: path.join(OUT, "events-editor.png") }); await b.close();
  console.log("ERRORS:", errors.length ? JSON.stringify(errors) : "none"); process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
