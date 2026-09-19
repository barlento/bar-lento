const { chromium, devices } = require("playwright"); const path=require("path");
const B="http://127.0.0.1:4173", OUT=path.join(__dirname,"out","guide");
const P1=process.env.GUIDE_STAFF==="1"?"Alex":"Joe", P2=process.env.GUIDE_STAFF==="1"?"Marco":"Pietro", MAIL=P1.toLowerCase()+"@example.com";
// contact emails of the owners/manager are blurred in the screenshots (the guide shows where they are, not the addresses)
const blurMails=(p)=>p.evaluate(()=>{document.querySelectorAll("a[href^='mailto:']").forEach(a=>{a.style.filter="blur(5px)";});});
(async()=>{ const b=await chromium.launch(); const c=await b.newContext({...devices["iPhone 13"]}); const p=await c.newPage();
  await p.goto(B+"/?v=g3"); await p.waitForSelector("#whoOverlay.show"); await p.click('.who-name[data-name="'+P1+'"]'); await p.waitForFunction(()=>/PIN/.test(document.getElementById("pinTitle").textContent));
  for(const k of "2222") await p.click(`#pinPad button[data-k="${k}"]`); await p.waitForTimeout(500); if((await p.textContent("#pinTitle"))==="Confirm your PIN") for(const k of "2222") await p.click(`#pinPad button[data-k="${k}"]`);
  await p.waitForTimeout(1500); for(let i=0;i<6;i++){ if(!(await p.isVisible("#rulesOverlay .sheet"))) break; const title=await p.textContent("#rulesTitle"); if(/Training/.test(title)){ await p.click("#rulesLater"); break; } await p.evaluate(()=>{const x=document.getElementById("rulesBody"); x.scrollTop=x.scrollHeight;}); await p.waitForTimeout(350); if(await p.isVisible("#rulesEmailField") && !(await p.inputValue("#rulesEmail"))) await p.fill("#rulesEmail",MAIL); await p.check("#rulesCheck"); await p.click("#rulesAgree"); await p.waitForTimeout(800); }
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show")); document.querySelectorAll(".toast").forEach(t=>t.remove());}); await p.waitForTimeout(3500);
  // confirm popup: tap one of Joe's own upcoming shifts
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show")); document.body.classList.remove("modal-open");});
  const n=await p.evaluate(()=>document.querySelectorAll(".shift.mine").length); let done=false;
  for(let i=0;i<n&&!done;i++){ await p.evaluate((i)=>{document.querySelectorAll(".shift.mine")[i].click();},i); await p.waitForTimeout(600); if(await p.isVisible("#confirmOverlay .sheet")) done=true; }
  if(done){ await p.screenshot({path:OUT+"/10-confirm.png"}); await p.click("#confirmCancel"); }
  await p.waitForTimeout(400); await p.click("#meStatsBtn"); await p.waitForSelector("#statsOverlay.show"); await p.waitForTimeout(2500);
  await p.screenshot({path:OUT+"/11-stats.png"});
  await b.close(); console.log("shots2 ok", done);
})().catch(e=>{console.log("ERR",e.message.split("\n")[0]);process.exit(1)});
