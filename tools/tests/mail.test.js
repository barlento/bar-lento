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
  const c=await b.newContext({...devices["iPhone 13"]}); const p=await c.newPage(); p.on("pageerror",e=>errors.push(e.message));
  await p.goto("http://127.0.0.1:4173/?v=m"); await p.waitForSelector("#whoOverlay.show");
  await p.click('.who-name[data-name="Joe"]'); await p.waitForFunction(()=>document.getElementById("pinTitle").textContent==="Create your PIN");
  for(const k of "9090") await p.click(`#pinPad button[data-k="${k}"]`); await p.waitForFunction(()=>document.getElementById("pinTitle").textContent==="Confirm your PIN");
  for(const k of "9090") await p.click(`#pinPad button[data-k="${k}"]`); await p.waitForSelector("#rulesOverlay.show"); await p.waitForTimeout(500);
  console.log("prefilled email:", await p.inputValue("#rulesEmail"), "| signing as:", await p.textContent("#rulesSigning"), "| lead:", (await p.textContent("#rulesLead")).slice(0,120));
  await p.evaluate(()=>{const x=document.getElementById("rulesBody"); x.scrollTop=x.scrollHeight;}); await p.waitForTimeout(300);
  await p.check("#rulesCheck"); await p.click("#rulesAgree");
  await p.waitForFunction(()=>/signed copy|acknowledged/.test(document.getElementById("toast").textContent),null,{timeout:10000});
  console.log("toast:", await p.textContent("#toast"));
  await signPolicies(p); await p.click("#rulesLater");
  await p.waitForTimeout(400);
  const mails=await (await fetch("http://127.0.0.1:4173/__mail")).json();
  console.log("mails:", mails.length, "(expect 10: rules + 4 policies, ×2)"); mails.forEach(m=>console.log("  to:", m.to, "| cc:", m.cc, "| subject:", m.subject, "| lead:", m.text.split("\n")[0].slice(0,110)));
  console.log("signature in html:", /Electronically acknowledged by<\/td><td[^>]*><b>Joe Test1/.test(mails[0].html), "| version:", /version 2026-09-18/.test(mails[0].text), "| sections in text:", (mails[0].text.match(/^\d+\. /gm)||[]).length);
  await c.close();
  const d=await b.newContext({viewport:{width:1200,height:800}}); const q=await d.newPage();
  await q.goto("http://127.0.0.1:4173/?v=m2"); await q.waitForSelector("#whoOverlay.show"); await q.click("#whoManager"); await q.fill("#pwInput","segreta"); await q.click("#loginGo"); await q.waitForSelector("#adminBar.show");
  await q.click("#staffBtn"); await q.waitForSelector('.person[data-name="Joe"]',{timeout:8000}); await q.waitForFunction(()=>/PIN ✓/.test(document.getElementById("rosterList").textContent),null,{timeout:8000});
  console.log("roster Joe:", (await q.locator('.person[data-name="Joe"]').textContent()).replace(/\s+/g," ").slice(0,140));
  await q.click('.person[data-name="Joe"]'); await q.waitForSelector("#personBody .pinbtn.mail",{timeout:8000}); await q.click("#personBody .pinbtn.mail"); await q.waitForFunction(()=>/Signed cop(y|ies) sent/.test(document.getElementById("toast").textContent),null,{timeout:8000});
  console.log("resend toast:", await q.textContent("#toast"));
  const mails2=await (await fetch("http://127.0.0.1:4173/__mail")).json(); console.log("mails after resend:", mails2.length, "(expect 20)");
  console.log("history:", await q.evaluate(async()=>{const r=await fetch("/api/log?limit=5",{headers:{"x-admin-password":"segreta"}});const j=await r.json();return j.entries.map(e=>e.changes.join(";")).join(" | ");}));
  await q.screenshot({path:OUT+"/m1-roster-mail.png"});
  await d.close(); await b.close(); console.log("ERRORS:",errors.length?errors:"none");
})().catch(e=>{console.error("FAIL",e);process.exit(1);});
