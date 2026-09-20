// Manager sees who has the app open (live dot) and the floor/kitchen department from Toast jobs.
const { chromium, devices } = require("playwright");
const B="http://127.0.0.1:4173"; const errors=[];
const j=async(u,o)=>{const r=await fetch(B+u,o); let x=null; try{x=await r.json();}catch(e){} return {s:r.status,j:x};};
(async()=>{
  const b=await chromium.launch();
  // Joe opens the app on his phone and creates a PIN (the poll carries his token → presence)
  const c=await b.newContext({...devices["iPhone 13"]}); const p=await c.newPage(); p.on("pageerror",e=>errors.push("pageerror: "+e.message));
  await p.goto(B+"/?v=pr1"); await p.waitForSelector("#whoOverlay.show");
  const icons=await p.evaluate(()=>({n:document.querySelectorAll('.who-name .dept svg').length, mariia:document.querySelector('.who-name[data-name="Mariia"] .dept')?.getAttribute("title"), joe:document.querySelector('.who-name[data-name="Joe"] .dept')?.getAttribute("title"), marta:document.querySelector('.who-name[data-name="Marta"] .dept')?.getAttribute("title")}));
  console.log("1 who-grid department icons:", icons); if(icons.mariia!=="Chef"||icons.joe!=="Floor"||icons.marta!=="Management") errors.push("department icons wrong on Who are you");
  await p.click('.who-name[data-name="Joe"]'); await p.waitForFunction(()=>/PIN/.test(document.getElementById("pinTitle").textContent));
  for(const k of "9090") await p.click(`#pinPad button[data-k="${k}"]`); await p.waitForTimeout(500); if((await p.textContent("#pinTitle"))==="Confirm your PIN") for(const k of "9090") await p.click(`#pinPad button[data-k="${k}"]`);
  await p.waitForTimeout(1500);
  // manager opens Staff
  const m=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(); m.on("pageerror",e=>errors.push("mgr pageerror: "+e.message));
  await m.goto(B+"/?v=pr2"); await m.waitForSelector("#whoOverlay.show"); await m.click("#whoManager"); await m.fill("#pwInput","segreta"); await m.click("#loginGo"); await m.waitForTimeout(800);
  await m.click("#staffBtn"); await m.waitForSelector("#staffOverlay.show"); await m.waitForFunction(()=>document.querySelector(".roster-online"),null,{timeout:8000});
  const st=await m.evaluate(()=>({count:document.querySelector(".roster-online").textContent.trim(), joe:document.querySelector('.person[data-name="Joe"] .pres')?.className, joeTxt:document.querySelector('.person[data-name="Joe"] small')?.textContent, cat:document.querySelector('.person[data-name="Catherine"] .pres')?.className, catTxt:document.querySelector('.person[data-name="Catherine"] small')?.textContent}));
  console.log("2 Staff:", st);
  if(!/pres on/.test(st.joe||"")) errors.push("Joe not shown online"); if(!/pres off/.test(st.cat||"")) errors.push("Catherine (never signed in) not shown offline"); if(!/^[1-9]\d* of \d+ online/.test(st.count)) errors.push("online count wrong: "+st.count);
  await m.screenshot({path:require("path").join(__dirname,"..","out","presence-staff.png")});
  // department toggle in the person sheet: Joe → Kitchen, then the API confirms and the who-grid follows
  await m.click('.person[data-name="Joe"]'); await m.waitForSelector("#personOverlay.show"); await m.waitForTimeout(300);
  const before=await m.evaluate(()=>document.querySelector('.dept-pick.sel')?.getAttribute("data-d")); await m.click('.dept-pick[data-d="kitchen"]'); await m.waitForTimeout(1500);
  const r=await j("/api/data"); console.log("3 dept toggle: before", before, "| saved:", r.j.data.dept);
  if(r.j.data.dept.Joe!=="kitchen"||r.j.data.dept.Mariia!=="chef"||r.j.data.dept.Marta!=="management") errors.push("dept not saved as expected: "+JSON.stringify(r.j.data.dept));
  if((r.j.data.deptManual||[]).indexOf("Joe")===-1) errors.push("manual choice not recorded");
  // a forced sync (opening Staff) must NOT undo the manager's choice
  await j("/api/me?action=list",{headers:{"x-admin-password":"segreta"}}); const r2=await j("/api/data"); console.log("3b after a forced Toast sync Joe is still:", r2.j.data.dept.Joe); if(r2.j.data.dept.Joe!=="kitchen") errors.push("Toast sync overrode the manager's choice");
  // list returns jobs from Toast
  const l=await j("/api/me?action=list",{headers:{"x-admin-password":"segreta"}}); console.log("4 jobs for Mariia:", l.j.accounts.Mariia&&l.j.accounts.Mariia.toast&&l.j.accounts.Mariia.toast.jobs, "| presence Joe online:", l.j.presence.Joe.online);
  if(!l.j.presence.Joe.online) errors.push("API presence says Joe offline");
  // Joe sets his own birthday from My week
  let opened=false; for(let i=0;i<4&&!opened;i++){ await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show")); document.body.classList.remove("modal-open");}); await p.waitForTimeout(400); await p.evaluate(()=>document.getElementById("meOpenBtn").click()); opened=await p.waitForSelector("#meOverlay.show",{timeout:4000}).then(()=>true).catch(()=>false); if(!opened) console.log("   My week did not open, state:", await p.evaluate(()=>({open:[...document.querySelectorAll(".overlay.show")].map(o=>o.id), me:localStorage.getItem("bl_me_name"), strip:document.getElementById("meStrip").className}))); }
  if(!opened) throw new Error("My week never opened"); await p.waitForTimeout(500);
  const bd0=await p.textContent("#meBdayLbl"); await p.fill("#meBdayInput","1994-03-12"); await p.click("#meBdaySave"); await p.waitForTimeout(900);
  const bd=await j("/api/data"); console.log("5 my birthday:", bd0.slice(0,20), "→ saved:", bd.j.data.birthdays.Joe, "| label:", await p.textContent("#meBdayLbl"));
  if(bd.j.data.birthdays.Joe!=="1994-03-12") errors.push("birthday not saved by the person");
  const bad=await j("/api/me",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"birthday",date:"1994-03-12"})}); if(bad.s!==401) errors.push("birthday without token accepted");
  await b.close(); console.log("ERRORS:", errors.length?errors:"none"); process.exit(errors.length?1:0);
})().catch(e=>{console.log("ERR",e.message.split("\n")[0]);process.exit(1)});
