const { chromium, devices } = require("playwright");
// sign every blocking policy that follows the House Rules (all mandatory at first login), stop at the training (has Later)
async function signPolicies(p){
  for(let i=0;i<8;i++){
    await p.waitForFunction(()=>document.getElementById("rulesOverlay").classList.contains("show"),null,{timeout:10000});
    const title=await p.textContent("#rulesTitle");
    if(/Training/.test(title)) return title;
    await p.evaluate(()=>{const x=document.getElementById("rulesBody"); x.scrollTop=x.scrollHeight;}); await p.waitForTimeout(350);
    if(!(await p.inputValue("#rulesEmail"))) await p.fill("#rulesEmail","test@example.com");
    await p.check("#rulesCheck"); await p.click("#rulesAgree");
    await p.waitForFunction((t)=>document.getElementById("rulesTitle").textContent!==t||!document.getElementById("rulesOverlay").classList.contains("show"),title,{timeout:10000});
  }
  return null;
}

const OUT = "/tmp/claude-0/-home-user-bar-lento/82129c5c-4b7e-5fa7-b8bb-ab76bd895ca6/scratchpad/shots";
require("fs").mkdirSync(OUT, { recursive: true });
const BASE = "http://127.0.0.1:4173";
const NAME = "Astrea"; // fresh name (no PIN yet on the fake server)

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  // ---- iPhone: first visit → who → create PIN → my week ----
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(BASE + "/?v=test");
  await page.waitForSelector("#whoOverlay.show", { timeout: 8000 });
  console.log("locked at start:", await page.evaluate(() => document.body.classList.contains("locked")), "| Not now present:", await page.locator("#whoSkip").count());
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + "/1-who.png" });
  await page.click(`.who-name[data-name="${NAME}"]`);
  await page.waitForSelector("#pinOverlay.show");
  await page.waitForFunction(() => document.getElementById("pinTitle").textContent === "Create your PIN");
  await page.screenshot({ path: OUT + "/2-pin-create.png" });
  for (const k of "2580") await page.click(`#pinPad button[data-k="${k}"]`);
  await page.waitForFunction(() => document.getElementById("pinTitle").textContent === "Confirm your PIN");
  // mismatch first
  for (const k of "2581") await page.click(`#pinPad button[data-k="${k}"]`);
  await page.waitForFunction(() => /don't match/.test(document.getElementById("pinErr").textContent));
  await page.screenshot({ path: OUT + "/3-pin-mismatch.png" });
  for (const k of "2580") await page.click(`#pinPad button[data-k="${k}"]`);
  await page.waitForFunction(() => document.getElementById("pinTitle").textContent === "Confirm your PIN");
  for (const k of "2580") await page.click(`#pinPad button[data-k="${k}"]`);
  await page.waitForSelector("#rulesOverlay.show", { timeout: 10000 });
  await page.evaluate(() => { const b = document.getElementById("rulesBody"); b.scrollTop = b.scrollHeight; }); await page.waitForTimeout(300);
  await page.fill("#rulesEmail", "cat@example.com"); await page.check("#rulesCheck"); await page.click("#rulesAgree");
  await page.waitForFunction(() => /Your documents/.test(document.getElementById("rulesTitle").textContent), null, { timeout: 8000 });
  await signPolicies(page); await page.click("#rulesLater");
  // server: wrong version refused; second ack for same version keeps the first record
  const bad = await page.evaluate(async () => (await fetch("/api/me", { method: "POST", headers: { "Content-Type": "application/json", "x-staff-token": localStorage.getItem("bl_me_token") }, body: JSON.stringify({ action: "ackRules", email: "x@y.com", version: "2031-01-01" }) })).json());
  const dup = await page.evaluate(async () => (await fetch("/api/me", { method: "POST", headers: { "Content-Type": "application/json", "x-staff-token": localStorage.getItem("bl_me_token") }, body: JSON.stringify({ action: "ackRules", email: "other@y.com", version: "2026-09-18" }) })).json());
  console.log("bad version →", JSON.stringify(bad), "| duplicate ack keeps first:", JSON.stringify(dup));
  await page.waitForSelector("#recapOverlay.show", { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + "/3b-recap.png" });
  console.log("recap:", (await page.textContent("#recapSum")).replace(/\s+/g, " "), "|", (await page.textContent("#recapMsgs")).replace(/\s+/g, " "));
  await page.click("#recapClose");
  console.log("locked after login:", await page.evaluate(() => document.body.classList.contains("locked")));
  await page.click("#meOpenBtn");
  await page.waitForSelector("#meOverlay.show", { timeout: 8000 });
  await page.waitForFunction(() => /Hours from Toast|doesn't recognise|isn't answering/.test(document.getElementById("meNote").textContent), null, { timeout: 8000 });
  await page.screenshot({ path: OUT + "/4-my-week.png" });
  const sum = await page.textContent("#meSum");
  console.log("my week tiles:", sum.replace(/\s+/g, " "));
  console.log("rows:", await page.locator(".me-row").count());
  await page.click("#meClose");
  await page.screenshot({ path: OUT + "/5-home-logged.png", fullPage: true });
  // My stats from the strip (identity from PIN token)
  await page.click("#meStatsBtn");
  await page.waitForSelector("#statsOverlay.show");
  await page.waitForFunction(() => /Updated/.test(document.getElementById("statsUpdated").textContent), null, { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + "/4b-my-stats.png" });
  console.log("stats hero:", (await page.textContent("#statsHero")).replace(/\s+/g, " "), "| tiles:", (await page.textContent("#statsSum")).replace(/\s+/g, " "));
  await page.click('#statsOverlay .lb-tabs button[data-period="month"]');
  await page.waitForFunction(() => /this month/.test(document.getElementById("statsTeam").textContent), null, { timeout: 10000 });
  console.log("stats month ok");
  await page.click("#statsWeekBtn"); await page.waitForSelector("#meOverlay.show"); console.log("stats→week ok");
  await page.click("#meClose");
  // mystats API must refuse without token
  const anon = await page.evaluate(async () => (await fetch("/api/toast?action=mystats&name=Joe")).status);
  console.log("anonymous mystats by name →", anon, "(expect 401)");
  console.log("strip:", (await page.textContent("#meStrip")).replace(/\s+/g, " "));
  console.log("mine shifts highlighted:", await page.locator(".shift.mine").count());
  // one-tap confirm of own shift; others' shifts refused
  await page.locator(".shift.mine").first().click();
  await page.waitForSelector("#confirmOverlay.show");
  console.log("confirm popup:", (await page.textContent("#confirmLead")).slice(0, 60), "| input present:", await page.locator("#confirmInput").count());
  await page.click("#confirmGo");
  await page.waitForFunction(() => document.querySelectorAll(".shift.mine.confirmed").length >= 1, null, { timeout: 8000 });
  await page.waitForTimeout(300);
  console.log("own shift confirmed ✓");
  await page.locator(".shift:not(.mine)").first().click();
  await page.waitForFunction(() => /only/.test(document.getElementById("toast").textContent));
  console.log("other's shift →", await page.textContent("#toast"), "| popup:", await page.locator("#confirmOverlay.show").count());
  const forged = await page.evaluate(async () => { const b = document.querySelector(".shift:not(.mine)"); const wk = document.querySelector(".tab.active").getAttribute("data-week"); const r = await fetch("/api/confirm", { method: "POST", headers: { "Content-Type": "application/json", "x-staff-token": localStorage.getItem("bl_me_token") }, body: JSON.stringify({ week: wk, day: b.getAttribute("data-day"), id: b.getAttribute("data-id"), on: true }) }); return r.status; });
  console.log("forged confirm of other's shift →", forged, "(expect 403)");
  // reload → remembered, no popup
  await page.reload();
  await page.waitForFunction(() => document.getElementById("meBtn").classList.contains("on"), null, { timeout: 8000 });
  await page.waitForTimeout(600);
  console.log("who popup after reload:", await page.locator("#whoOverlay.show").count(), "(expect 0)");
  // switch person → existing PIN → login with wrong then right
  await page.click("#meBtn"); await page.waitForSelector("#meOverlay.show"); await page.click("#meSwitch");
  await page.waitForSelector("#whoOverlay.show");
  await page.click(`.who-name[data-name="${NAME}"]`);
  await page.waitForFunction(() => document.getElementById("pinTitle").textContent === "Enter your PIN");
  await page.keyboard.type("1111");
  await page.waitForFunction(() => /Wrong PIN/.test(document.getElementById("pinErr").textContent));
  await page.screenshot({ path: OUT + "/6-pin-wrong.png" });
  await page.keyboard.type("2580");
  await page.waitForFunction(() => !document.body.classList.contains("locked") && !document.getElementById("pinOverlay").classList.contains("show"), null, { timeout: 8000 });
  console.log("re-login ok (My week does not open by itself)");
  // logout here
  await page.click("#meBtn"); await page.waitForSelector("#meOverlay.show"); await page.click("#meLogout");
  await page.waitForFunction(() => !document.getElementById("meBtn").classList.contains("on"));
  console.log("logout ok; token:", await page.evaluate(() => localStorage.getItem("bl_me_token")));
  await ctx.close();

  // ---- desktop: manager roster shows PIN status + reset; view someone's week ----
  const d = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const dp = await d.newPage();
  dp.on("pageerror", (e) => errors.push("pageerror(desktop): " + e.message));
  await dp.goto(BASE + "/?v=test2");
  await dp.waitForSelector("#whoOverlay.show");
  await dp.click("#whoManager");
  await dp.waitForSelector("#loginOverlay.show");
  await dp.fill("#pwInput", "segreta"); await dp.click("#loginGo");
  await dp.waitForSelector("#adminBar.show");
  console.log("manager: locked?", await dp.evaluate(() => document.body.classList.contains("locked")), "| who popup:", await dp.locator("#whoOverlay.show").count());
  await dp.click("#staffBtn");
  await dp.waitForFunction(() => /PIN ✓|Hasn't signed in/.test(document.getElementById("rosterList").textContent), null, { timeout: 8000 });
  await dp.screenshot({ path: OUT + "/7-roster.png" });
  console.log("roster:", (await dp.textContent("#rosterList")).replace(/\s+/g, " ").slice(0, 400));
  await dp.click(`.person[data-name="${NAME}"]`); await dp.waitForSelector("#personOverlay.show"); await dp.waitForTimeout(300);
  await dp.screenshot({ path: OUT + "/7b-person.png" });
  console.log("person sheet:", (await dp.textContent("#personBody")).replace(/\s+/g, " ").slice(0, 300));
  const resetBtn = dp.locator("#personBody .pinbtn.reset");
  console.log("reset enabled for", NAME, ":", await resetBtn.isEnabled());
  await resetBtn.click(); await resetBtn.click();
  await dp.waitForFunction(() => /No PIN yet/.test(document.getElementById("personBody").textContent), null, { timeout: 8000 });
  console.log("after reset:", (await dp.textContent("#personBody")).replace(/\s+/g, " ").slice(0, 120));
  await dp.click("#personClose");
  console.log("manager ranking button visible:", await dp.locator("#lbBtn").isVisible());
  await dp.click(`.person[data-name="Joe"]`); await dp.waitForSelector("#personOverlay.show"); await dp.click("#personBody .pinbtn.view");
  await dp.waitForSelector("#meOverlay.show");
  await dp.waitForFunction(() => /Hours from Toast|doesn't recognise|isn't answering/.test(document.getElementById("meNote").textContent), null, { timeout: 8000 });
  await dp.screenshot({ path: OUT + "/8-manager-view-joe.png" });
  console.log("manager view title:", await dp.textContent("#meTitle"), "|", (await dp.textContent("#meSum")).replace(/\s+/g, " "));
  await dp.click("#mePrev");
  await dp.waitForTimeout(800);
  console.log("prev week:", await dp.textContent("#meWeekLbl"), await dp.textContent("#meWeekSub"));
  await d.close();
  await browser.close();
  console.log("ERRORS:", errors.length ? errors : "none");
})().catch((e) => { console.error("TEST FAILED", e); process.exit(1); });
