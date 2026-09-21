const { chromium, devices } = require("playwright");
const B="http://127.0.0.1:4173"; const errors=[];
async function signAll(p){ // rules + packet, stop at training
  for(let i=0;i<6;i++){
    await p.waitForFunction(()=>document.getElementById("rulesOverlay").classList.contains("show"),null,{timeout:10000});
    const title=await p.textContent("#rulesTitle"); if(/Training/.test(title)){ await p.click("#rulesLater"); return; }
    await p.evaluate(()=>{const x=document.getElementById("rulesBody"); x.scrollTop=x.scrollHeight;}); await p.waitForTimeout(350);
    if(await p.isVisible("#rulesEmailField") && !(await p.inputValue("#rulesEmail"))) await p.fill("#rulesEmail","pietro@example.com");
    await p.check("#rulesCheck"); await p.click("#rulesAgree");
    await p.waitForFunction((t)=>document.getElementById("rulesTitle").textContent!==t||!document.getElementById("rulesOverlay").classList.contains("show"),title,{timeout:10000});
  }
}
(async()=>{
  const b=await chromium.launch();
  // 1. manager enables the app clock for Pietro
  const m=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(); m.on("pageerror",e=>errors.push("mgr pageerror: "+e.message));
  await m.goto(B+"/?v=p1"); await m.waitForSelector("#whoOverlay.show"); await m.click("#whoManager"); await m.fill("#pwInput","segreta"); await m.click("#loginGo"); await m.waitForTimeout(800);
  await m.click("#staffBtn"); await m.waitForSelector("#staffOverlay.show"); await m.waitForFunction(()=>/PIN|signed/.test(document.getElementById("rosterList").textContent),null,{timeout:8000});
  await m.click('.person[data-name="Pietro"]'); await m.waitForSelector("#personOverlay.show"); await m.waitForTimeout(300);
  console.log("1 clock card for Pietro (no Toast):", (await m.textContent("#personBody")).includes("Clocks in from the app"), "| for Joe should be absent later");
  await m.waitForTimeout(900); console.log("2 punches box:", (await m.textContent("#personPunches")).trim().slice(0,60));
  await m.screenshot({path:require("path").join(__dirname,"..","out","punch-mgr-empty.png")});
  // 2. Pietro on the phone
  const c=await b.newContext({...devices["iPhone 13"]}); const p=await c.newPage(); p.on("pageerror",e=>errors.push("pageerror: "+e.message));
  await p.goto(B+"/?v=p2"); await p.waitForSelector("#whoOverlay.show"); await p.click('.who-name[data-name="Pietro"]');
  await p.waitForFunction(()=>document.getElementById("pinTitle").textContent==="Create your PIN");
  for(const k of "3131") await p.click(`#pinPad button[data-k="${k}"]`); await p.waitForFunction(()=>document.getElementById("pinTitle").textContent==="Confirm your PIN");
  for(const k of "3131") await p.click(`#pinPad button[data-k="${k}"]`);
  await signAll(p); await p.waitForTimeout(800);
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))});
  await p.waitForFunction(()=>document.getElementById("mePunchBtn").style.display!=="none",null,{timeout:8000});
  console.log("3 strip button:", await p.textContent("#mePunchBtn"), "| stats hidden:", await p.evaluate(()=>document.getElementById("meStatsBtn").style.display==="none"));
  await p.click("#mePunchBtn"); await p.waitForSelector("#punchOverlay.show"); console.log("4 sheet:", await p.textContent("#punchTitle"), "|", await p.textContent("#punchWhen"));
  await p.screenshot({path:require("path").join(__dirname,"..","out","punch-sheet.png")});
  await p.click("#punchGo"); await p.waitForFunction(()=>!document.getElementById("punchOverlay").classList.contains("show")); await p.waitForTimeout(600);
  console.log("5 after in:", await p.textContent("#mePunchBtn"), "|", await p.textContent("#meNextShift"));
  await p.screenshot({path:require("path").join(__dirname,"..","out","punch-in.png")});
  // double clock-in refused by the server
  const dbl=await p.evaluate(async()=>{const r=await fetch("/api/me",{method:"POST",headers:{"Content-Type":"application/json","x-staff-token":localStorage.getItem("bl_me_token")},body:JSON.stringify({action:"punch",on:true})});return r.status;});
  console.log("6 second clock-in →", dbl, "(expect 409)");
  // break: one tap to start, one tap to come back (owner 2026-09-21); hours are net of the break
  console.log("6b break button:", await p.textContent("#meBreakBtn"), "| visible:", await p.evaluate(()=>document.getElementById("meBreakBtn").style.display!=="none"));
  await p.click("#meBreakBtn"); await p.waitForFunction(()=>document.getElementById("meBreakBtn").textContent==="Back to work",null,{timeout:8000});
  console.log("6c on break:", (await p.textContent("#meNextShift")).slice(0,60));
  const dblB=await p.evaluate(async()=>{const r=await fetch("/api/me",{method:"POST",headers:{"Content-Type":"application/json","x-staff-token":localStorage.getItem("bl_me_token")},body:JSON.stringify({action:"break",on:true})});return r.status;});
  console.log("6d second break start →", dblB, "(expect 409)");
  await p.waitForTimeout(1200);
  await p.click("#meBreakBtn"); await p.waitForFunction(()=>document.getElementById("meBreakBtn").textContent==="Break",null,{timeout:8000});
  const who=await p.evaluate(async()=>{const r=await fetch("/api/me?action=who",{headers:{"x-staff-token":localStorage.getItem("bl_me_token")}});return r.json();});
  console.log("6e back to work · open:", JSON.stringify(who.open));
  await p.screenshot({path:require("path").join(__dirname,"..","out","punch-break.png")});
  // someone else (Joe, on Toast) cannot punch
  await p.waitForTimeout(800);
  await p.click("#mePunchBtn"); await p.waitForSelector("#punchOverlay.show"); console.log("7 sheet:", await p.textContent("#punchTitle"), "|", await p.textContent("#punchLead"));
  await p.click("#punchGo"); await p.waitForFunction(()=>!document.getElementById("punchOverlay").classList.contains("show")); await p.waitForTimeout(600);
  console.log("8 after out:", await p.textContent("#mePunchBtn"));
  // time clock (everyone) shows Pietro
  await p.click("#clockBtn"); await p.waitForSelector("#clockOverlay.show"); await p.waitForFunction(()=>/Pietro/.test(document.getElementById("tcList").textContent),null,{timeout:8000});
  console.log("9 time clock has Pietro:", (await p.textContent("#tcList")).replace(/\s+/g," ").slice(0,120));
  await p.screenshot({path:require("path").join(__dirname,"..","out","punch-tc.png")});
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))});
  await p.click("#meOpenBtn"); await p.waitForSelector("#meOverlay.show"); await p.waitForTimeout(1200);
  console.log("10 my week:", (await p.textContent("#meSum")).replace(/\s+/g," ").slice(0,80), "| note:", await p.textContent("#meNote"), "| lead:", await p.textContent("#meLead"));
  // the password (Manager login) session on a shared device never shows the clock, even with Pietro signed in (owner 2026-09-21)
  const tokP=await p.evaluate(()=>localStorage.getItem("bl_me_token"));
  await m.evaluate((t)=>{localStorage.setItem("bl_me_token",t);localStorage.setItem("bl_me_name","Pietro");},tokP); await m.reload(); await m.waitForTimeout(2000);
  console.log("10b password session + Pietro PIN → clock hidden:", await m.evaluate(()=>document.getElementById("mePunchBtn").style.display==="none"&&document.getElementById("meBreakBtn").style.display==="none"), "| strip name:", (await m.textContent("#meHi")).trim());
  await m.evaluate(()=>{localStorage.removeItem("bl_me_token");localStorage.removeItem("bl_me_name");}); await m.reload(); await m.waitForTimeout(1500);
  // 3. manager sees the month
  await m.click("#personOverlay .btn.ghost, #personClose").catch(()=>{});
  await m.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))});
  await m.click("#staffBtn"); await m.waitForSelector("#staffOverlay.show"); await m.waitForTimeout(500);
  await m.click('.person[data-name="Pietro"]'); await m.waitForSelector("#personOverlay.show"); await m.waitForFunction(()=>/→/.test((document.getElementById("personPunches")||{}).textContent||""),null,{timeout:8000});
  console.log("11 manager month:", (await m.textContent("#personPunches")).replace(/\s+/g," ").slice(0,160));
  await m.screenshot({path:require("path").join(__dirname,"..","out","punch-mgr.png")});
  await m.click("#personBody .pm-prev"); await m.waitForTimeout(800); console.log("12 prev month:", (await m.textContent("#personPunches")).replace(/\s+/g," ").slice(0,60), "| lbl:", await m.textContent("#personBody .pm-lbl"));
  // Joe (linked to Toast) has no clock card
  await m.evaluate(()=>{document.getElementById("personOverlay").classList.remove("show")}); await m.click('.person[data-name="Joe"]'); await m.waitForTimeout(300);
  console.log("13 Joe has clock card:", (await m.textContent("#personBody")).includes("Clocks in from the app"), "(expect false)");
  // 4. removing Pietro archives the punches and drops appClock
  const st=await m.evaluate(async()=>{const r=await fetch("/api/data");return await r.json();});
  console.log("14 appClock list (unused now):", JSON.stringify(st.data.appClock));
  await b.close(); console.log("ERRORS:", errors.length?errors:"none");
})().catch(e=>{console.log("FAIL",e.message.split("\n")[0]);process.exit(1)});
