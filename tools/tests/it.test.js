const { chromium, devices } = require("playwright");
const OUT=require("path").join(__dirname,"..","out"); require("fs").mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch(); const errors=[];
  const c=await b.newContext({...devices["iPhone 13"]}); const p=await c.newPage();
  p.on("pageerror",e=>errors.push(e.message));
  await p.goto("http://127.0.0.1:4173/?v=it"); await p.waitForSelector("#whoOverlay.show");
  await p.click("#whoManager"); await p.fill("#pwInput","segreta"); await p.click("#loginGo"); await p.waitForSelector("#adminBar.show");
  await p.click("#langBtn"); await p.waitForTimeout(400);
  const txt=async(sel)=>(await p.textContent(sel)).replace(/\s+/g," ").trim();
  console.log("hero:",await txt("#heroStatus")); console.log("tabs:",await txt("#weekTabs"),"| archive:",await txt("#archiveToggle"));
  console.log("header:",await txt("header.top"), "| foot:", await txt("#footHint"));
  console.log("first day card:", (await txt(".day-card")).slice(0,120));
  await p.screenshot({path:OUT+"/it1-home.png"});
  await p.click("#clockBtn"); await p.waitForFunction(()=>/Aggiornato|Nessuno/.test(document.getElementById("tcUpdated").textContent+document.getElementById("tcList").textContent),null,{timeout:10000});
  await p.waitForTimeout(400); console.log("tc:",await txt("#clockTitle"),"|",await txt("#tcDate"),await txt("#tcDateSub"),"|",await txt("#tcSum"),"|",(await txt("#tcList")).slice(0,90));
  await p.screenshot({path:OUT+"/it2-clock.png"}); await p.click("#clockClose");
  await p.click("#lbBtn"); await p.waitForFunction(()=>/aggiornato/.test(document.getElementById("lbUpdated").textContent),null,{timeout:10000}); await p.waitForTimeout(400);
  console.log("lb:",await txt("#lbTitle"),"|",(await txt("#lbList")).slice(0,140),"|",await txt("#lbUpdated"));
  await p.screenshot({path:OUT+"/it3-lb.png"}); await p.click("#lbClose");
  await p.click("#staffBtn"); await p.waitForTimeout(600); await p.click('.person[data-name="Joe"]'); await p.waitForSelector("#personOverlay.show"); await p.click("#personBody .pinbtn.view"); await p.waitForSelector("#meOverlay.show");
  await p.waitForFunction(()=>/Ore da Toast|non riconosce|non risponde/.test(document.getElementById("meNote").textContent),null,{timeout:10000});
  console.log("me:",await txt("#meTitle"),"|",await txt("#meLead"),"|",await txt("#meWeekLbl"),await txt("#meWeekSub"),"|",await txt("#meSum"),"|",(await txt("#meList")).slice(0,100),"|",await txt("#meNote"));
  await p.screenshot({path:OUT+"/it4-week.png"});
  await p.click("#meStatsLink"); await p.waitForFunction(()=>/Aggiornato/.test(document.getElementById("statsUpdated").textContent),null,{timeout:10000});
  console.log("stats:",await txt("#statsTitle"),"|",await txt("#statsSum"),"|",(await txt("#statsTeam")).slice(0,80),"|",await txt("#statsMsg"));
  await p.click("#statsClose");
  // persists after reload while logged in
  await p.reload(); await p.waitForSelector("#adminBar.show"); await p.waitForTimeout(500);
  console.log("after reload lang IT?", /Aperto|Chiuso/.test(await txt("#heroStatus")), "| tabs:", await txt("#weekTabs"));
  // logout → English
  await p.click("#managerLink"); await p.waitForTimeout(500);
  console.log("after logout: hero", /Open|Closed/.test(await txt("#heroStatus")), "| who popup:", await p.locator("#whoOverlay.show").count(), "| lead:", (await txt("#whoLead")).slice(0,30));
  // re-login → Italian again
  await p.click("#whoManager"); await p.fill("#pwInput","segreta"); await p.click("#loginGo"); await p.waitForSelector("#adminBar.show"); await p.waitForTimeout(400);
  console.log("re-login IT?", /Aperto|Chiuso/.test(await txt("#heroStatus")), "| copy text starts:", (await p.evaluate(()=>{ return document.querySelector("#copyBtn").textContent; })));
  await c.close();
  // second device stays English
  const d=await b.newContext({viewport:{width:1200,height:800}}); const q=await d.newPage();
  await q.goto("http://127.0.0.1:4173/?v=it2"); await q.waitForSelector("#whoOverlay.show"); await q.click("#whoManager"); await q.fill("#pwInput","segreta"); await q.click("#loginGo"); await q.waitForSelector("#adminBar.show"); await q.waitForTimeout(400);
  console.log("other device EN?", /Open|Closed/.test((await q.textContent("#heroStatus"))));
  await d.close(); await b.close(); console.log("ERRORS:",errors.length?errors:"none");
})().catch(e=>{console.error("FAIL",e);process.exit(1);});
