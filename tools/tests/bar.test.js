// Bar notes (owner 2026-09-27): what is NOT available behind the bar + how to make things, EN/IT per device, NEW badge + to-do task
// until each person opens it, one push to everyone scheduled today or tomorrow when the "not available" list changes, manager/owner
// edit from the sheet, chef read-only. Runs LAST on the shared devserver: PINs already exist (login-or-create), rev may be > 1.
const { chromium, devices } = require("playwright"); const fs = require("fs"), path = require("path");
const B = "http://127.0.0.1:4173"; const errors = []; const M = { "Content-Type": "application/json", "x-admin-password": "segreta" };
const OUT = path.join(__dirname, "..", "out"); fs.mkdirSync(OUT, { recursive: true }); const shot = (n) => path.join(OUT, n);
async function j(p, o) { const r = await fetch(B + p, o); let x = null; try { x = await r.json(); } catch (e) {} return { s: r.status, j: x }; }
const iso = (d) => d.toISOString().slice(0, 10); const addD = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const monday = (d) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x; };
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]; const dayOf = (d) => DAYS[(d.getUTCDay() + 6) % 7];
const isTest = (n) => /^test\b/i.test(String(n || "")); const sortU = (a) => [...new Set(a)].sort(); const key = (l) => (l || []).map((s) => String(s).trim().toLowerCase()).sort().join("|");
const SRC = { unavailable: ["Birre", "Feral"], note: "", recipes: [{ title: "Spritz", text: "2 oz" }] }; // the contract's save
const dismiss = (p) => p.evaluate(() => { document.querySelectorAll(".overlay.show").forEach((o) => o.classList.remove("show")); document.body.classList.remove("modal-open"); });
(async () => {
  const ny = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()) + "T12:00:00Z"); const tom = addD(ny, 1);
  const todWk = iso(monday(ny)), todDay = dayOf(ny), tomWk = iso(monday(tom)), tomDay = dayOf(tom); // tomorrow may be in the next week (Sunday)
  // ---- 1. the manager posts today + tomorrow (NY): Astrea today (+ a test account when one is on staff), Joe tomorrow, Sierrah nowhere; the days are re-opened
  let r = await j("/api/data"); const testName = (r.j.data.staff || []).find(isTest) || null;
  const build = (data) => { const d = JSON.parse(JSON.stringify(data)); [todWk, tomWk].forEach((wk) => { if (!d.weeks[wk]) { d.weeks[wk] = { notes: {} }; DAYS.forEach((k) => (d.weeks[wk][k] = [])); } d.weeks[wk].notes = d.weeks[wk].notes || {}; });
    d.weeks[todWk][todDay] = [{ id: "bar-a", name: "Astrea", start: "16:00", end: "22:00", station: "S1" }].concat(testName ? [{ id: "bar-t", name: testName, start: "16:00", end: "22:00", station: "S2" }] : []); delete d.weeks[todWk].notes[todDay];
    d.weeks[tomWk][tomDay] = [{ id: "bar-j", name: "Joe", start: "16:00", end: "22:00", station: "S1" }]; delete d.weeks[tomWk].notes[tomDay]; return d; };
  r = await j("/api/data", { method: "POST", headers: M, body: JSON.stringify({ version: r.j.version, data: build(r.j.data) }) });
  if (r.s === 409) { const g = await j("/api/data"); r = await j("/api/data", { method: "POST", headers: M, body: JSON.stringify({ version: g.j.version, data: build(g.j.data) }) }); }
  console.log("1 week posted:", r.s, todWk + "/" + todDay + " Astrea", "·", tomWk + "/" + tomDay + " Joe", testName ? "| test account today: " + testName : "| no test account on staff (exclusion not asserted)");
  if (r.s !== 200) { console.log("ERRORS:", JSON.stringify(["could not post the week: " + JSON.stringify(r.j).slice(0, 200)])); process.exit(1); }
  const tok = async (name, pin) => { let x = await j("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", name, pin }) }); if (x.s !== 200) x = await j("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name, pin }) }); return x.j.token; };
  const hdr = (t) => ({ "Content-Type": "application/json", "x-staff-token": t });
  const tA = await tok("Astrea", "1111"); const A = hdr(tA), C = hdr(await tok("Mariia", "4321")), MT = hdr(await tok("Marta", "6161"));
  // ---- 2. API: identity and roles
  r = await j("/api/bar"); console.log("2 no identity:", r.s); if (r.s !== 401) errors.push("bar readable without identity");
  r = await j("/api/bar", { headers: A }); const b0 = r.j && r.j.bar;
  console.log("3 Astrea reads:", r.s, "| rev:", b0 && b0.rev, "| en:", b0 && JSON.stringify(b0.en.unavailable), "| src hidden:", !(b0 && b0.src), "| canEdit:", r.j && r.j.canEdit, "| seenRev:", r.j && r.j.seenRev);
  if (r.s !== 200 || !b0 || !(b0.rev >= 1) || !b0.en || !b0.it || !b0.updatedAt || b0.src || r.j.canEdit) errors.push("staff GET wrong: " + JSON.stringify(r.j).slice(0, 200));
  if (b0 && b0.rev === 1 && !(b0.en.unavailable || []).includes("Beers (all)")) errors.push("seed EN list missing Beers (all)");
  r = await j("/api/bar", { method: "POST", headers: A, body: JSON.stringify({ action: "save", src: SRC }) }); console.log("4 staff saves:", r.s, r.j && r.j.error); if (r.s !== 403) errors.push("staff could save the bar");
  r = await j("/api/bar", { method: "POST", headers: C, body: JSON.stringify({ action: "save", src: SRC }) }); console.log("5 chef saves:", r.s, r.j && r.j.error); if (r.s !== 403 || r.j.error !== "manager_only") errors.push("chef could save the bar");
  r = await j("/api/bar", { headers: C }); console.log("5b chef reads:", r.s, "| canEdit:", r.j && r.j.canEdit, "| src hidden:", !(r.j && r.j.bar && r.j.bar.src)); if (r.s !== 200 || r.j.canEdit || (r.j.bar && r.j.bar.src)) errors.push("chef GET not read-only");
  r = await j("/api/bar", { headers: MT }); console.log("5c Marta (management PIN) reads:", r.s, "| canEdit:", r.j && r.j.canEdit, "| src:", !!(r.j && r.j.bar && r.j.bar.src)); if (r.s !== 200 || !r.j.canEdit || !r.j.bar.src) errors.push("management PIN cannot edit");
  // ---- 3. recipients = everyone scheduled today or tomorrow, computed here from the schedule too
  r = await j("/api/bar?action=recipients", { headers: A }); console.log("6 staff asks recipients:", r.s); if (r.s !== 403) errors.push("recipients open to staff");
  r = await j("/api/bar?action=recipients", { headers: M }); const rec = r.j || {}; const names = rec.names || []; const sched = (await j("/api/data")).j.data;
  const expect = (() => { const out = []; [ny, tom].forEach((d) => { const w = sched.weeks[iso(monday(d))]; if (!w) return; const k = dayOf(d), n = (w.notes || {})[k]; if (n && (n.status === "closed" || n.status === "holiday")) return; (w[k] || []).forEach((s) => { if (s && s.name && !s.src && !isTest(s.name) && (sched.staff || []).includes(s.name)) out.push(s.name); }); }); return sortU(out); })();
  console.log("7 recipients:", r.s, JSON.stringify(rec.dates), JSON.stringify(names), "| expected from the schedule:", JSON.stringify(expect));
  if (r.s !== 200 || JSON.stringify(rec.dates) !== JSON.stringify([iso(ny), iso(tom)])) errors.push("recipients dates wrong: " + JSON.stringify(rec.dates));
  if (JSON.stringify(sortU(names)) !== JSON.stringify(expect) || names.length !== new Set(names).size) errors.push("recipients differ from the schedule");
  if (!names.includes("Astrea") || !names.includes("Joe") || names.includes("Sierrah")) errors.push("recipients wrong: Astrea today, Joe tomorrow, Sierrah neither");
  if (testName && names.includes(testName)) errors.push("test account among the recipients");
  // ---- 4. the manager saves: AI_FAKE prefixes the IT side, EN = src, rev+1, pushed = the recipients; the same list again → nobody pushed
  let cur = (await j("/api/bar", { headers: M })).j.bar;
  if (key(cur.en.unavailable) === key(SRC.unavailable)) { const rs = await j("/api/bar", { method: "POST", headers: M, body: JSON.stringify({ action: "save", src: { unavailable: ["Reset " + Date.now()], note: "", recipes: SRC.recipes } }) }); cur = (rs.j && rs.j.bar) || cur; console.log("7b list already equal (re-run): reset save", rs.s, "rev", cur.rev); }
  r = await j("/api/bar", { method: "POST", headers: M, body: JSON.stringify({ action: "save", src: SRC }) }); const b1 = r.j && r.j.bar;
  console.log("8 manager saves:", r.s, "| rev:", cur.rev, "→", b1 && b1.rev, "| it:", b1 && JSON.stringify(b1.it.unavailable), b1 && b1.it.recipes[0] && b1.it.recipes[0].title, "| en:", b1 && JSON.stringify(b1.en.unavailable), "| by:", b1 && b1.updatedBy, "| pushed:", JSON.stringify(r.j && r.j.pushed), "| queued:", r.j && r.j.queued, "(true only in NY quiet hours)");
  if (r.s !== 200 || !b1) errors.push("manager save failed: " + JSON.stringify(r.j).slice(0, 200));
  else {
    if (b1.rev !== cur.rev + 1) errors.push("rev not +1");
    if (!b1.it.unavailable.length || !b1.it.unavailable.every((s) => s.startsWith("(it) ")) || b1.it.recipes[0].title !== "(it) Spritz" || b1.it.recipes[0].text !== "(it) 2 oz") errors.push("IT side not translated (AI_FAKE prefix)");
    if (JSON.stringify(b1.en) !== JSON.stringify(SRC) || JSON.stringify(b1.src) !== JSON.stringify(SRC)) errors.push("EN side / src changed by the save");
    if (b1.updatedBy !== "manager") errors.push("updatedBy for the password session should be manager");
    if (JSON.stringify(sortU(r.j.pushed || [])) !== JSON.stringify(sortU(names))) errors.push("pushed differs from the recipients");
    if (typeof r.j.queued !== "boolean") errors.push("queued flag missing");
  }
  r = await j("/api/bar", { method: "POST", headers: MT, body: JSON.stringify({ action: "save", src: Object.assign({}, SRC, { note: "Nota" }) }) }); const b2 = r.j && r.j.bar;
  console.log("9 Marta saves the same list (note only):", r.s, "| rev:", b2 && b2.rev, "| by:", b2 && b2.updatedBy, "| pushed:", JSON.stringify(r.j && r.j.pushed), "| it note:", b2 && b2.it.note);
  if (r.s !== 200 || !b2 || !b1 || b2.rev !== b1.rev + 1 || (r.j.pushed || []).length || b2.updatedBy !== "Marta" || b2.it.note !== "(it) Nota") errors.push("same-list save wrong: " + JSON.stringify(r.j).slice(0, 200));
  r = await j("/api/bar", { method: "POST", headers: M, body: JSON.stringify({ action: "save", src: { unavailable: "x" } }) }); console.log("9b bad content:", r.s, r.j && r.j.error); if (r.s !== 400) errors.push("bad content accepted");
  r = await j("/api/log?limit=10", { headers: M }); const lines = (r.j.entries || r.j.log || r.j.items || []).flatMap((e) => e.changes || []); const hl = lines.filter((l) => /^Bar notes updated by/.test(l));
  console.log("10 history:", JSON.stringify(hl.slice(0, 2))); if (!hl.some((l) => /^Bar notes updated by manager: 2 not available, 1 recipe\b/.test(l) && /Birre, Feral/.test(l))) errors.push("history line missing");
  // ---- 5. seen (per person, per rev)
  r = await j("/api/bar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "seen" }) }); console.log("11 seen without token:", r.s); if (r.s !== 401) errors.push("seen without identity");
  r = await j("/api/bar", { method: "POST", headers: A, body: JSON.stringify({ action: "seen" }) }); const g = await j("/api/bar", { headers: A });
  console.log("12 Astrea marks seen:", r.s, "seenRev", r.j && r.j.seenRev, "| GET seenRev:", g.j && g.j.seenRev, "rev:", g.j && g.j.bar.rev); if (r.s !== 200 || !b2 || r.j.seenRev !== b2.rev || g.j.seenRev !== b2.rev) errors.push("seen not recorded");
  // ---- 6. UI, the manager on a computer (password session): card → Open → Edit → Save → the sheet shows the new list
  const br = await chromium.launch();
  const m = await (await br.newContext({ viewport: { width: 1200, height: 900 } })).newPage(); m.on("pageerror", (e) => errors.push("mgr pageerror: " + e.message));
  await m.goto(B + "/?v=bar1"); await m.waitForTimeout(300); await m.evaluate(() => { localStorage.setItem("bl_admin_pw", "segreta"); }); await m.reload(); await m.waitForTimeout(2500); await dismiss(m);
  await m.waitForSelector("#barCard.show", { timeout: 8000 });
  const mc = await m.evaluate(() => ({ card: document.getElementById("barCard").classList.contains("show"), open: !!document.getElementById("barOpen"), txt: document.getElementById("barCard").textContent.replace(/\s+/g, " ").trim().slice(0, 140) }));
  console.log("13 manager card:", JSON.stringify(mc)); if (!mc.card || !mc.open) errors.push("manager bar card missing");
  await m.evaluate(() => document.getElementById("barOpen").click()); await m.waitForSelector("#barOverlay.show"); await m.waitForTimeout(600);
  const ms = await m.evaluate(() => ({ edit: getComputedStyle(document.getElementById("barEdit")).display, unav: [...document.querySelectorAll("#barUnav li")].map((x) => x.textContent), note: document.getElementById("barNote").textContent, upd: document.getElementById("barUpdated").textContent }));
  console.log("14 manager sheet:", JSON.stringify(ms)); if (ms.edit === "none") errors.push("manager sees no Edit"); if (JSON.stringify(ms.unav) !== JSON.stringify(SRC.unavailable) || !/Marta/.test(ms.upd)) errors.push("sheet content differs from the last save: " + JSON.stringify(ms));
  await m.click("#barEdit"); await m.waitForTimeout(300);
  const ed = await m.evaluate(() => ({ form: getComputedStyle(document.getElementById("barForm")).display, unav: document.getElementById("barEdUnav").value, note: document.getElementById("barEdNote").value, recipes: document.querySelectorAll("#barEdRecipes .bar-ed-recipe").length, add: !!document.getElementById("barAddRecipe"), cancel: !!document.getElementById("barCancel") }));
  console.log("15 edit mode:", JSON.stringify(ed)); if (ed.form === "none" || ed.unav !== SRC.unavailable.join("\n") || ed.note !== "Nota" || ed.recipes !== 1 || !ed.add || !ed.cancel) errors.push("edit form not prefilled from src: " + JSON.stringify(ed));
  await m.screenshot({ path: shot("bar-edit.png") });
  await m.fill("#barEdUnav", "Birre\nFeral\nProsecco"); await m.click("#barSave");
  await m.waitForFunction(() => getComputedStyle(document.getElementById("barForm")).display === "none" && document.querySelectorAll("#barUnav li").length === 3, null, { timeout: 8000 }); await m.waitForTimeout(400);
  const sv = await m.evaluate(() => ({ unav: [...document.querySelectorAll("#barUnav li")].map((x) => x.textContent), toast: document.getElementById("toast").textContent, upd: document.getElementById("barUpdated").textContent, card: [...document.querySelectorAll("#barCard .bar-list li")].map((x) => x.textContent) }));
  console.log("16 after Save:", JSON.stringify(sv)); if (!sv.unav.includes("Prosecco") || !/Bar notes saved/.test(sv.toast) || !sv.card.includes("Prosecco")) errors.push("save from the sheet failed: " + JSON.stringify(sv));
  await m.screenshot({ path: shot("bar-mgr.png") });
  r = await j("/api/bar", { headers: M }); const b3 = r.j.bar; console.log("17 server after the UI save:", "rev", b3.rev, JSON.stringify(b3.src.unavailable)); if (!b2 || b3.rev !== b2.rev + 1 || JSON.stringify(b3.src.unavailable) !== JSON.stringify(["Birre", "Feral", "Prosecco"])) errors.push("UI save not on the server");
  await m.click("#barClose"); await m.waitForTimeout(200);
  // ---- 7. UI, Astrea's phone: after the PIN the card is there (unread → the sheet opens by itself when nothing else does); a new revision while
  //         the app is open → NEW pill + to-do task on the next poll (forced through visibilitychange, no popup); Open → NEW gone, count −1; EN/IT; seen persists
  const p = await (await br.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 } })).newPage(); p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await p.goto(B + "/?v=bar2"); await p.waitForTimeout(300); await p.evaluate((t) => { localStorage.setItem("bl_me_token", t); localStorage.setItem("bl_me_name", "Astrea"); }, tA); await p.reload(); await p.waitForTimeout(2500);
  const boot = await p.evaluate(() => ({ card: document.getElementById("barCard").classList.contains("show"), bar: document.getElementById("barOverlay").classList.contains("show"), others: [...document.querySelectorAll(".overlay.show")].map((o) => o.id).filter((id) => id !== "barOverlay") }));
  console.log("18 after sign-in:", JSON.stringify(boot)); if (!boot.card) errors.push("bar card not shown after sign-in"); if (!boot.bar && !boot.others.length) errors.push("unread bar did not open by itself after the PIN (nothing else was open)");
  await dismiss(p);
  r = await j("/api/bar", { method: "POST", headers: M, body: JSON.stringify({ action: "save", src: Object.assign({}, SRC, { unavailable: ["Birre", "Feral", "Feral analcolico"] }) }) }); const b4 = r.j && r.j.bar; if (r.s !== 200) errors.push("owner save for the phone failed");
  await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await p.waitForFunction(() => !!document.getElementById("barCardNew") && [...document.querySelectorAll("#barCard .bar-list li")].some((x) => /Feral analcolico/.test(x.textContent)), null, { timeout: 8000 });
  const bell = await p.evaluate(() => ({ shown: document.getElementById("todoBtn").style.display !== "none", n: document.getElementById("todoCnt").textContent, popup: document.getElementById("barOverlay").classList.contains("show"), pill: document.getElementById("barCardNew").textContent, card: [...document.querySelectorAll("#barCard .bar-list li")].map((x) => x.textContent) }));
  const cnt = (b) => (b.shown ? Number(b.n) : 0);
  console.log("19 NEW on the card, bell:", JSON.stringify(bell)); if (!bell.shown || cnt(bell) < 1 || bell.popup || !bell.card.includes("Feral analcolico")) errors.push("NEW/bell wrong after the poll: " + JSON.stringify(bell));
  await p.click("#todoBtn"); await p.waitForSelector("#todoOverlay.show"); await p.waitForTimeout(300);
  const rows = await p.evaluate(() => { const b = document.querySelector('#todoList [data-todo="bar"]'); return { titles: [...document.querySelectorAll("#todoList .todo-row b")].map((x) => x.textContent), bar: !!b, sub: b ? b.closest(".todo-row").querySelector("small").textContent : "" }; });
  console.log("20 to-do rows:", JSON.stringify(rows)); if (!rows.bar || !rows.titles.some((t) => /bar update/i.test(t)) || !/Birre/.test(rows.sub)) errors.push("bar task missing in the to-do list: " + JSON.stringify(rows));
  await p.screenshot({ path: shot("bar-todo.png") }); await p.click("#todoClose"); await p.waitForTimeout(200); await p.screenshot({ path: shot("bar-card.png") });
  await p.evaluate(() => document.getElementById("barOpen").click()); await p.waitForSelector("#barOverlay.show"); await p.waitForFunction(() => !document.getElementById("barCardNew"), null, { timeout: 8000 }); await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ shown: document.getElementById("todoBtn").style.display !== "none", n: document.getElementById("todoCnt").textContent, edit: getComputedStyle(document.getElementById("barEdit")).display, lang: (document.querySelector("#barLang button.on") || { getAttribute: () => "" }).getAttribute("data-l"), unav: [...document.querySelectorAll("#barUnav li")].map((x) => x.textContent), title: (document.querySelector("#barRecipes .bar-recipe b") || {}).textContent || "", upd: document.getElementById("barUpdated").textContent }));
  console.log("21 sheet open:", JSON.stringify(after)); if (cnt(after) !== cnt(bell) - 1) errors.push("to-do count did not drop by one (" + cnt(bell) + " → " + cnt(after) + ")"); if (after.edit !== "none") errors.push("staff sees Edit");
  if (after.lang !== "en" || after.title !== "Spritz" || after.unav.length !== 3 || !after.upd) errors.push("sheet content wrong: " + JSON.stringify(after));
  await p.screenshot({ path: shot("bar-sheet-en.png") });
  await p.click('#barLang button[data-l="it"]'); await p.waitForTimeout(250);
  const it = await p.evaluate(() => ({ on: document.querySelector("#barLang button.on").getAttribute("data-l"), title: document.querySelector("#barRecipes .bar-recipe b").textContent, unav: [...document.querySelectorAll("#barUnav li")].map((x) => x.textContent), card: (document.querySelector("#barCard .bar-list li") || {}).textContent || "", saved: localStorage.getItem("bl_bar_lang") }));
  console.log("22 IT:", JSON.stringify(it)); if (it.on !== "it" || it.title !== "(it) Spritz" || !it.unav.every((s) => s.startsWith("(it) ")) || !it.card.startsWith("(it) ") || it.saved !== "it") errors.push("IT switch wrong: " + JSON.stringify(it));
  await p.screenshot({ path: shot("bar-sheet-it.png") });
  await p.click('#barLang button[data-l="en"]'); await p.waitForTimeout(250); const en = await p.evaluate(() => document.querySelector("#barRecipes .bar-recipe b").textContent); console.log("23 back to EN:", en); if (en !== "Spritz") errors.push("EN switch wrong");
  await p.click("#barClose"); await p.waitForTimeout(200);
  r = await j("/api/bar", { headers: A }); console.log("24 seen on the server:", r.j.seenRev, "rev", r.j.bar.rev); if (!b4 || r.j.seenRev !== b4.rev) errors.push("seen not written when the sheet opened");
  await p.reload(); await p.waitForTimeout(2500);
  const again = await p.evaluate(() => ({ card: document.getElementById("barCard").classList.contains("show"), pill: !!document.getElementById("barCardNew"), bar: document.getElementById("barOverlay").classList.contains("show"), bell: document.getElementById("todoBtn").style.display !== "none", lang: localStorage.getItem("bl_bar_lang") }));
  await dismiss(p); console.log("25 after reload:", JSON.stringify(again)); if (!again.card || again.pill || again.bar) errors.push("seen did not persist after reload: " + JSON.stringify(again));
  if (again.bell) { await p.click("#todoBtn"); await p.waitForSelector("#todoOverlay.show"); await p.waitForTimeout(200); const hasBar = await p.evaluate(() => !!document.querySelector('#todoList [data-todo="bar"]')); console.log("25b bar task after reload:", hasBar); if (hasBar) errors.push("bar task back after reload"); await p.click("#todoClose"); } else console.log("25b bell hidden after reload (nothing to do)");
  // ---- 8. UI, the chef with her own PIN: reads, never edits
  const c = await (await br.newContext({ viewport: { width: 1200, height: 900 } })).newPage(); c.on("pageerror", (e) => errors.push("chef pageerror: " + e.message));
  await c.goto(B + "/?v=bar3"); await c.waitForTimeout(300); await c.evaluate((t) => { localStorage.setItem("bl_me_token", t); localStorage.setItem("bl_me_name", "Mariia"); }, C["x-staff-token"]); await c.reload(); await c.waitForTimeout(2500); await dismiss(c);
  await c.waitForSelector("#barCard.show", { timeout: 8000 }); await c.evaluate(() => document.getElementById("barOpen").click()); await c.waitForSelector("#barOverlay.show"); await c.waitForTimeout(600);
  const ch = await c.evaluate(() => ({ chef: document.body.classList.contains("chef"), edit: getComputedStyle(document.getElementById("barEdit")).display, unav: document.querySelectorAll("#barUnav li").length, recipes: document.querySelectorAll("#barRecipes .bar-recipe").length }));
  console.log("26 chef sheet:", JSON.stringify(ch)); if (!ch.chef || ch.edit !== "none" || !ch.unav || !ch.recipes) errors.push("chef sheet wrong (Edit must be hidden): " + JSON.stringify(ch));
  await c.screenshot({ path: shot("bar-chef.png") });
  await br.close(); console.log("ERRORS:", errors.length ? JSON.stringify(errors) : "none"); process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); console.log("ERRORS:", JSON.stringify([String((e && e.message) || e)])); process.exit(1); });
