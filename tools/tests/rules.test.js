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

const OUT=require("path").join(__dirname,"..","out"); require("fs").mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch(); const errors=[];
  const c=await b.newContext({...devices["iPhone 13"]}); const p=await c.newPage();
  p.on("pageerror",e=>errors.push(e.message));
  await p.goto("http://127.0.0.1:4173/?v=r"); await p.waitForSelector("#whoOverlay.show");
  await p.click('.who-name[data-name="Sierrah"]'); await p.waitForFunction(()=>document.getElementById("pinTitle").textContent==="Create your PIN");
  for(const k of "7777") await p.click(`#pinPad button[data-k="${k}"]`);
  await p.waitForFunction(()=>document.getElementById("pinTitle").textContent==="Confirm your PIN");
  for(const k of "7777") await p.click(`#pinPad button[data-k="${k}"]`);
  await p.waitForSelector("#rulesOverlay.show",{timeout:10000}); await p.waitForTimeout(500);
  console.log("rules shown; agree disabled:", await p.locator("#rulesAgree").isDisabled(), "| checkbox disabled:", await p.locator("#rulesCheck").isDisabled(), "| locked:", await p.evaluate(()=>document.getElementById("rulesOverlay").dataset.lock));
  await p.screenshot({path:OUT+"/r1-rules.png"});
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  console.log("still shown after Escape:", await p.locator("#rulesOverlay.show").count());
  await p.evaluate(()=>{const b=document.getElementById("rulesBody"); b.scrollTop=b.scrollHeight;}); await p.waitForTimeout(300);
  console.log("after scroll → checkbox enabled:", !(await p.locator("#rulesCheck").isDisabled()));
  await p.fill("#rulesEmail","mariia@example.com"); await p.check("#rulesCheck"); await p.waitForTimeout(100);
  console.log("agree enabled:", !(await p.locator("#rulesAgree").isDisabled()));
  await p.screenshot({path:OUT+"/r2-rules-ready.png"});
  await p.click("#rulesAgree");
  await p.waitForFunction(()=>/Your documents/.test(document.getElementById("rulesTitle").textContent),null,{timeout:8000});
  console.log("after rules → first document popup:", await p.textContent("#rulesTitle"), "| Later:", await p.isVisible("#rulesLater"), "(expect false) | pill:", await p.textContent("#rulesVer"));
  console.log("signed policies until:", await signPolicies(p), "| Later on training:", await p.isVisible("#rulesLater"));
  await p.click("#rulesLater");
  await p.waitForFunction(()=>!document.getElementById("rulesOverlay").classList.contains("show"),null,{timeout:8000});
  await p.waitForTimeout(600);
  console.log("after agree → toast:", await p.textContent("#toast"), "| next popup:", await p.evaluate(()=>[...document.querySelectorAll(".overlay.show")].map(o=>o.id).join(",")));
  await p.reload(); await p.waitForFunction(()=>document.getElementById("meBtn").classList.contains("on"),null,{timeout:8000}); await p.waitForTimeout(800);
  console.log("after reload rules popup:", await p.locator("#rulesOverlay.show").count(), "(expect 0)");
  await p.evaluate(()=>document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show")));
  await p.click("#meOpenBtn"); await p.waitForSelector("#meOverlay.show"); console.log("rules link in My week visible:", await p.locator("#meRules").isVisible());
  await p.click("#meRules"); await p.waitForSelector("#docsOverlay.show"); await p.locator(".doc-row").first().click(); await p.waitForSelector("#rulesOverlay.show"); console.log("read-only: form hidden:", !(await p.locator("#rulesAckForm").isVisible()), "| close visible:", await p.locator("#rulesClose").isVisible(), "| lead:", await p.textContent("#rulesLead"));
  await p.click("#rulesClose");
  const forged=await p.evaluate(async()=>(await fetch("/api/me",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"ackRules",email:"x@y.com",version:"2026-09-18"})})).status);
  console.log("ack without token →",forged,"(expect 401)");
  await c.close();
  const d=await b.newContext({viewport:{width:1200,height:800}}); const q=await d.newPage();
  await q.goto("http://127.0.0.1:4173/?v=r2"); await q.waitForSelector("#whoOverlay.show"); await q.click("#whoManager"); await q.fill("#pwInput","segreta"); await q.click("#loginGo"); await q.waitForSelector("#adminBar.show");
  console.log("manager sees rules popup?", await q.locator("#rulesOverlay.show").count(), "(expect 0)");
  await q.click("#staffBtn"); await q.waitForFunction(()=>/Rules/.test(document.getElementById("rosterList").textContent),null,{timeout:8000}); await q.waitForTimeout(300);
  console.log("roster:", (await q.textContent("#rosterList")).replace(/\s+/g," ").slice(0,260));
  console.log("history:", await q.evaluate(async()=>{const r=await fetch("/api/log?limit=5",{headers:{"x-admin-password":"segreta"}});const j=await r.json();return j.entries.map(e=>e.changes.join(";")).join(" | ");}));
  const pr=await q.goto("http://127.0.0.1:4173/rules.html"); await q.waitForTimeout(300); console.log("rules.html:", pr.status(), (await q.textContent("#doc")).replace(/\s+/g," ").slice(0,80));
  await q.screenshot({path:OUT+"/r3-rules-print.png",fullPage:false});
  await d.close(); await b.close(); console.log("ERRORS:",errors.length?errors:"none");
})().catch(e=>{console.error("FAIL",e);process.exit(1);});
