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
const BASE="http://127.0.0.1:4173"; const NAME="Mariia";
(async()=>{
  const b=await chromium.launch(); const errors=[];
  const c=await b.newContext({...devices["iPhone 13"]}); const p=await c.newPage();
  p.on("pageerror",e=>errors.push("pageerror: "+e.message)); p.on("console",m=>{ if(m.type()==="error") errors.push("console: "+m.text()); });
  await p.goto(BASE+"/?v=d1"); await p.waitForSelector("#whoOverlay.show");
  await p.click(`.who-name[data-name="${NAME}"]`); await p.waitForFunction(()=>document.getElementById("pinTitle").textContent==="Create your PIN");
  for(const k of "4321") await p.click(`#pinPad button[data-k="${k}"]`); await p.waitForFunction(()=>document.getElementById("pinTitle").textContent==="Confirm your PIN");
  for(const k of "4321") await p.click(`#pinPad button[data-k="${k}"]`);
  await p.waitForSelector("#rulesOverlay.show"); await p.waitForTimeout(300);
  console.log("1 rules title:", await p.textContent("#rulesTitle"), "| Later visible:", await p.isVisible("#rulesLater"), "(expect false)");
  await p.evaluate(()=>{const x=document.getElementById("rulesBody"); x.scrollTop=x.scrollHeight;}); await p.waitForTimeout(300);
  await p.check("#rulesCheck"); await p.click("#rulesAgree");
  // → first document popup: blocking, no Later; chain through the 4 policies; training has Later
  await p.waitForFunction(()=>document.getElementById("rulesOverlay").classList.contains("show")&&/Your documents/.test(document.getElementById("rulesTitle").textContent),null,{timeout:10000});
  await p.waitForTimeout(400); await p.screenshot({path:OUT+"/d1-doc-popup.png"});
  console.log("2 doc popup:", await p.textContent("#rulesTitle"), "| Later visible:", await p.isVisible("#rulesLater"), "(expect false) | Close visible:", await p.isVisible("#rulesClose"), "| pill:", await p.textContent("#rulesVer"));
  console.log("  print link:", await p.getAttribute("#rulesPrint","href"), "| docs in packet:", await p.locator("#rulesBody h2.pk").count(), "| sections:", await p.locator("#rulesBody h3").count(), "| ack:", (await p.textContent("#rulesAckText")).slice(0,120));
  const stop=await signPolicies(p);
  console.log("2b chained until:", stop, "| Later on training:", await p.isVisible("#rulesLater"), "| pill:", await p.textContent("#rulesVer"));
  await p.click("#rulesLater");
  await p.waitForFunction(()=>!document.getElementById("rulesOverlay").classList.contains("show"));
  await p.waitForTimeout(600);
  console.log("3 after Later → open overlays:", await p.evaluate(()=>[...document.querySelectorAll(".overlay.show")].map(o=>o.id).join(",")));
  await p.evaluate(()=>document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show")));
  // My week → Documents button with badge
  await p.click("#meBtn"); await p.waitForSelector("#meOverlay.show");
  console.log("4 docs button:", (await p.textContent("#meRules")).replace(/\s+/g," "), "| visible:", await p.isVisible("#meRules"));
  await p.click("#meRules"); await p.waitForSelector("#docsOverlay.show"); await p.waitForTimeout(400); await p.screenshot({path:OUT+"/d2-docs-list.png"});
  const rows=await p.$$eval(".doc-row",els=>els.map(e=>e.querySelector(".tt").textContent+" → "+e.querySelector(".st").textContent));
  console.log("5 docs list:", rows.length, "rows"); rows.forEach(r=>console.log("   ", r));
  // training from the list
  await p.locator(".doc-row").nth(2).click(); await p.waitForSelector("#rulesOverlay.show");
  console.log("9 training reader:", await p.textContent("#rulesTitle"), "| agree label:", await p.textContent("#rulesAgree"), "| lead:", (await p.textContent("#rulesLead")).slice(0,70));
  await p.evaluate(()=>{const x=document.getElementById("rulesBody"); x.scrollTop=x.scrollHeight;}); await p.waitForTimeout(300);
  await p.screenshot({path:OUT+"/d3-training.png"});
  await p.check("#rulesCheck"); await p.click("#rulesAgree");
  await p.waitForFunction(()=>/Training recorded/.test(document.getElementById("toast").textContent),null,{timeout:10000});
  console.log("10 toast:", await p.textContent("#toast"));
  await p.waitForSelector("#docsOverlay.show"); await p.waitForTimeout(300);
  const rows3=await p.$$eval(".doc-row",els=>els.map(e=>e.querySelector(".st").textContent)); console.log("11 statuses:", rows3.join(" | "));
  console.log("11b mail-me button visible:", await p.isVisible("#docsMail"));
  await p.click("#docsMail"); await p.waitForFunction(()=>/have been sent/.test(document.getElementById("toast").textContent),null,{timeout:10000}); console.log("11c self-service copies:", await p.textContent("#toast"));
  // duplicate + wrong version refused server-side
  const dup=await p.evaluate(async()=>(await fetch("/api/me",{method:"POST",headers:{"Content-Type":"application/json","x-staff-token":localStorage.getItem("bl_me_token")},body:JSON.stringify({action:"ackDoc",id:"harassment",email:"other@y.com",version:"2026-09-18"})})).json());
  const bad=await p.evaluate(async()=>(await fetch("/api/me",{method:"POST",headers:{"Content-Type":"application/json","x-staff-token":localStorage.getItem("bl_me_token")},body:JSON.stringify({action:"ackDoc",id:"pto",email:"o@y.com",version:"1999-01-01"})})).json());
  const unk=await p.evaluate(async()=>(await fetch("/api/me",{method:"POST",headers:{"Content-Type":"application/json","x-staff-token":localStorage.getItem("bl_me_token")},body:JSON.stringify({action:"ackDoc",id:"nope",email:"o@y.com",version:"x"})})).status);
  console.log("12 duplicate keeps first:", JSON.stringify(dup), "| bad version:", JSON.stringify(bad), "| unknown doc:", unk);
  const mails=await (await fetch(BASE+"/__mail")).json();
  console.log("13 mails:", mails.length, "(expect: rules 2 + packet 2 + training 2 + resend 2 = 8)"); mails.slice(0,12).forEach(m=>console.log("   →", m.to.join(","), "|", m.subject));
  const ownerTrain=mails.find(m=>/completed the Sexual/.test(m.subject)); console.log("  training owner copy text head:", ownerTrain&&ownerTrain.text.split("\n")[0].slice(0,120));
  const pk=mails.find(m=>/your signed documents/.test(m.subject)); console.log("  packet email to:", pk&&pk.to, "| 4 docs inside:", pk&&(pk.text.match(/^==========$/gm)||[]).length, "| sig block:", pk&&/Electronically acknowledged by: Mariia Test/.test(pk.text), "| owner proof:", !!mails.find(m=>/acknowledged 4 documents/.test(m.subject)&&m.to[0]==="simoneviola@barlentony.com"));
  // reload: rules done, docs snoozed today → no popup
  await p.evaluate(()=>document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show")));
  await p.reload(); await p.waitForFunction(()=>document.getElementById("meBtn").classList.contains("on"),null,{timeout:8000}); await p.waitForTimeout(800);
  console.log("14 popups after reload:", await p.evaluate(()=>[...document.querySelectorAll(".overlay.show")].map(o=>o.id).join(",")||"none"));
  console.log("15 all signed → no popup even with snooze cleared:", await p.evaluate(()=>{localStorage.removeItem("bl_docs_snooze"); return "ok";}));
  await c.close();
  // ---- manager: roster shows document status, ✉ re-sends everything ----
  const d=await b.newContext({viewport:{width:1280,height:900}}); const q=await d.newPage(); q.on("pageerror",e=>errors.push("pageerror(desktop): "+e.message));
  await q.goto(BASE+"/?v=d2"); await q.waitForSelector("#whoOverlay.show"); await q.click("#whoManager"); await q.fill("#pwInput","segreta"); await q.click("#loginGo"); await q.waitForSelector("#adminBar.show");
  await q.click("#staffBtn"); await q.waitForSelector(`.person[data-name="${NAME}"]`,{timeout:8000}); await q.waitForFunction(()=>/PIN ✓/.test(document.getElementById("rosterList").textContent),null,{timeout:8000});
  console.log("16 roster row:", (await q.locator(`.person[data-name="${NAME}"]`).textContent()).replace(/\s+/g," ").slice(0,200));
  await q.screenshot({path:OUT+"/d4-roster.png"});
  await q.click(`.person[data-name="${NAME}"]`); await q.waitForSelector("#personBody .pinbtn.mail",{timeout:8000});
  console.log("   doc icons ok:", await q.locator("#personBody .doc-ic.ok").count(), "(expect 5)", "| person docs:", (await q.textContent("#personBody")).replace(/\s+/g," ").slice(0,260));
  await q.screenshot({path:OUT+"/d4b-person.png"});
  await q.click("#personBody .pinbtn.mail"); await q.waitForFunction(()=>/Signed copies sent/.test(document.getElementById("toast").textContent),null,{timeout:10000});
  console.log("17 resend toast:", await q.textContent("#toast"));
  const mails2=await (await fetch(BASE+"/__mail")).json(); console.log("   mails after resend:", mails2.length, "(expect 10)");
  // IT toggle
  await q.click("#langBtn").catch(()=>{}); await q.waitForTimeout(300);
  console.log("18 person IT:", (await q.textContent("#personBody")).replace(/\s+/g," ").slice(0,120));
  // printable page
  await q.goto(BASE+"/docs.html?id=harassment"); await q.waitForSelector("h1");
  console.log("19 docs.html:", await q.textContent("h1"), "| h2:", await q.locator("h2").count(), "| form:", await q.locator(".form").count(), "| title:", await q.title());
  await q.goto(BASE+"/docs.html"); await q.waitForSelector(".index"); console.log("20 index links:", await q.locator(".index a").count(), "(expect 6)");
  await q.goto(BASE+"/docs.html?id=pto"); await q.waitForSelector("h1"); await q.screenshot({path:OUT+"/d5-print-pto.png",fullPage:true});
  await d.close(); await b.close(); console.log("ERRORS:", errors.length?errors:"none");
})().catch(e=>{console.error("FAIL",e);process.exit(1);});
