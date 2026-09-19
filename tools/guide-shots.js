// Screenshots for the welcome guide, taken on the local dev server with an iPhone viewport.
const { chromium, devices } = require("playwright"); const path=require("path");
const B="http://127.0.0.1:4173", OUT=path.join(__dirname,"out","guide");
const P1=process.env.GUIDE_STAFF==="1"?"Alex":"Joe", P2=process.env.GUIDE_STAFF==="1"?"Marco":"Pietro", MAIL=P1.toLowerCase()+"@example.com";
// contact emails of the owners/manager are blurred in the screenshots (the guide shows where they are, not the addresses)
const blurMails=(p)=>p.evaluate(()=>{document.querySelectorAll("a[href^='mailto:']").forEach(a=>{a.style.filter="blur(5px)";});});
async function signAll(p){ for(let i=0;i<6;i++){ await p.waitForFunction(()=>document.getElementById("rulesOverlay").classList.contains("show"),null,{timeout:10000}); const title=await p.textContent("#rulesTitle"); if(/Training/.test(title)){ await p.click("#rulesLater"); return; } await p.evaluate(()=>{const x=document.getElementById("rulesBody"); x.scrollTop=x.scrollHeight;}); await p.waitForTimeout(350); if(await p.isVisible("#rulesEmailField") && !(await p.inputValue("#rulesEmail"))) await p.fill("#rulesEmail",MAIL); await p.check("#rulesCheck"); await p.click("#rulesAgree"); await p.waitForFunction((t)=>document.getElementById("rulesTitle").textContent!==t||!document.getElementById("rulesOverlay").classList.contains("show"),title,{timeout:10000}); } }
(async()=>{
  const b=await chromium.launch(); const c=await b.newContext({...devices["iPhone 13"]}); const p=await c.newPage();
  await p.goto(B+"/?v=g1"); await p.waitForSelector("#whoOverlay.show"); await p.waitForTimeout(3800);
  await p.screenshot({path:OUT+"/01-who.png"});
  await p.click('.who-name[data-name="'+P1+'"]'); await p.waitForFunction(()=>/PIN/.test(document.getElementById("pinTitle").textContent)); await p.waitForTimeout(400);
  await p.screenshot({path:OUT+"/02-pin.png"});
  for(const k of "2222") await p.click(`#pinPad button[data-k="${k}"]`); await p.waitForTimeout(500); if((await p.textContent("#pinTitle"))==="Confirm your PIN") for(const k of "2222") await p.click(`#pinPad button[data-k="${k}"]`);
  await p.waitForSelector("#rulesOverlay.show"); await p.waitForTimeout(500); await blurMails(p);
  await p.screenshot({path:OUT+"/03-rules.png"});
  await p.evaluate(()=>{const x=document.getElementById("rulesBody"); x.scrollTop=x.scrollHeight;}); await p.waitForTimeout(400); await p.fill("#rulesEmail",MAIL); await p.check("#rulesCheck"); await p.click("#rulesAgree");
  await p.waitForFunction(()=>/Your documents/.test(document.getElementById("rulesTitle").textContent)); await p.waitForTimeout(400);
  await p.evaluate(()=>{const x=document.getElementById("rulesBody"); x.scrollTop=x.scrollHeight;}); await p.waitForTimeout(500); await blurMails(p); await p.evaluate(()=>{document.querySelectorAll(".toast").forEach(t=>t.remove())});
  await p.screenshot({path:OUT+"/04-packet.png"});
  await p.check("#rulesCheck"); await p.click("#rulesAgree"); await p.waitForTimeout(1200);
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))}); await p.waitForTimeout(600);
  await p.evaluate(()=>{document.querySelectorAll(".toast").forEach(t=>t.remove())}); await p.waitForTimeout(3500);
  await p.screenshot({path:OUT+"/05-home.png"});
  await p.click("#meOpenBtn"); await p.waitForSelector("#meOverlay.show"); await p.waitForTimeout(1500);
  await p.screenshot({path:OUT+"/06-myweek.png"});
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))});
  await p.click("#clockBtn"); await p.waitForSelector("#clockOverlay.show"); await p.waitForTimeout(1500);
  await p.screenshot({path:OUT+"/07-timeclock.png"});
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))});
  await p.click("#meOpenBtn"); await p.waitForSelector("#meOverlay.show"); await p.waitForTimeout(600); await p.click("#meRules"); await p.waitForSelector("#docsOverlay.show"); await p.waitForTimeout(600);
  await p.screenshot({path:OUT+"/08-documents.png"});
  await c.close();
  // a person who clocks in from the app (Pietro)
  const c2=await b.newContext({...devices["iPhone 13"]}); const q=await c2.newPage();
  await q.goto(B+"/?v=g2"); await q.waitForSelector("#whoOverlay.show"); await q.click('.who-name[data-name="'+P2+'"]'); await q.waitForFunction(()=>/PIN/.test(document.getElementById("pinTitle").textContent));
  for(const k of "3131") await q.click(`#pinPad button[data-k="${k}"]`); await q.waitForTimeout(500); if((await q.textContent("#pinTitle"))==="Confirm your PIN") for(const k of "3131") await q.click(`#pinPad button[data-k="${k}"]`);
  await signAll(q).catch(()=>{}); await q.waitForTimeout(800); await q.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))});
  await q.waitForFunction(()=>document.getElementById("mePunchBtn").style.display!=="none",null,{timeout:8000}); await q.evaluate(()=>{document.querySelectorAll(".toast").forEach(t=>t.remove())}); await q.waitForTimeout(3500);
  const strip=await q.$("#meStrip"); await strip.screenshot({path:OUT+"/09-clockin.png"});
  await b.close(); console.log("shots ok");
})().catch(e=>{console.log("ERR",e.message.split("\n")[0]);process.exit(1)});
