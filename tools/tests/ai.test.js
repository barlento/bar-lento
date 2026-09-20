// The in-app assistant (owner 2026-09-20): one button for signed-in people, a full screen, read-only answers (fake mode in the suites).
const { chromium } = require("playwright"); const B = "http://localhost:4173";
async function j(p, o) { const r = await fetch(B + p, o); let x = null; try { x = await r.json(); } catch (e) {} return { s: r.status, j: x }; }
(async () => {
  const errors = [];
  let r = await j("/api/data"); console.log("1 features.ai:", r.j.features.ai); if (!r.j.features.ai) errors.push("ai feature off in the dev server");
  r = await j("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) }); console.log("2 no token:", r.s); if (r.s !== 401) errors.push("ask without identity was not refused");
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage(); p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await p.goto(B + "/?v=ai"); await p.waitForTimeout(400);
  const fabLocked = await p.evaluate(() => getComputedStyle(document.getElementById("aiFab")).display); console.log("3 button before sign-in:", fabLocked); if (fabLocked !== "none") errors.push("assistant button shown before sign-in");
  const cr = await p.evaluate(async () => { const r = await fetch("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name: "Catherine", pin: "5151" }) }); return r.json(); });
  await p.evaluate((t) => { localStorage.setItem("bl_me_token", t); localStorage.setItem("bl_me_name", "Catherine"); }, cr.token); await p.reload(); await p.waitForTimeout(1500);
  await p.evaluate(() => { document.querySelectorAll(".overlay.show").forEach((x) => x.classList.remove("show")); });
  const fab = await p.evaluate(() => getComputedStyle(document.getElementById("aiFab")).display); console.log("4 button after sign-in:", fab); if (fab === "none") errors.push("assistant button hidden for a signed-in person");
  await p.click("#aiFab"); await p.waitForTimeout(300);
  const scr = await p.evaluate(() => ({ shown: document.getElementById("aiScreen").classList.contains("show"), title: document.getElementById("aiTitle").textContent, sug: [...document.querySelectorAll(".aisug button")].map((b) => b.textContent) }));
  console.log("5 screen:", scr); if (!scr.shown || scr.sug.length !== 3) errors.push("screen or suggestions wrong");
  await p.click(".aisug button"); await p.waitForFunction(() => document.querySelectorAll(".msg.bot:not(.wait)").length >= 1, null, { timeout: 8000 });
  const conv = await p.evaluate(() => ({ me: document.querySelector(".msg.me")?.textContent, bot: document.querySelector(".msg.bot")?.textContent, open: document.querySelector(".msg.bot .open")?.textContent }));
  console.log("6 conversation:", conv); if (!/\(test\)/.test(conv.bot || "")) errors.push("no answer rendered"); if (!conv.open) errors.push("no Open button for a schedule question");
  await p.click(".msg.bot .open"); await p.waitForTimeout(500);
  const after = await p.evaluate(() => ({ screen: document.getElementById("aiScreen").classList.contains("show"), me: document.getElementById("meOverlay").classList.contains("show") }));
  console.log("7 Open My week:", after); if (after.screen || !after.me) errors.push("Open button did not open My week");
  await p.evaluate(() => { document.querySelectorAll(".overlay.show").forEach((x) => x.classList.remove("show")); }); await p.click("#aiFab"); await p.fill("#aiInput", "who works tomorrow?"); await p.click("#aiSend");
  await p.waitForFunction(() => document.querySelectorAll(".msg.bot:not(.wait)").length >= 2, null, { timeout: 8000 });
  const n = await p.evaluate(() => document.querySelectorAll(".msg").length); console.log("8 messages after a typed question:", n); if (n < 4) errors.push("typed question not answered");
  await b.close(); console.log("ERRORS:", errors.length ? errors : "none"); process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.log("ERR", e.message.split("\n")[0]); process.exit(1); });
