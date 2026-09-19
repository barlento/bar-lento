// Manager sees who has the app open (live dot) and the floor/kitchen department from Toast jobs.
const { chromium, devices } = require("playwright");
const B="http://127.0.0.1:4173"; const errors=[];
const j=async(u,o)=>{const r=await fetch(B+u,o); let x=null; try{x=await r.json();}catch(e){} return {s:r.status,j:x};};
(async()=>{
  const b=await chromium.launch();
  // Joe opens the app on his phone and creates a PIN (the poll carries his token → presence)
  const c=await b.newContext({...devices["iPhone 13"]}); const p=await c.newPage(); p.on("pageerror",e=>errors.push("pageerror: "+e.message));
  await p.goto(B+"/?v=pr1"); await p.waitForSelector("#whoOverlay.show");
  const icons=await p.evaluate(()=>({n:document.querySelectorAll('.who-name .dept svg').length, mariia:document.querySelector('.who-name[data-name="Mariia"] .dept')?.getAttribute("title"), joe:document.querySelector('.who-name[data-name="Joe"] .dept')?.getAttribute("title")}));
  console.log("1 who-grid department icons:", icons); if(icons.mariia!=="Kitchen"||icons.joe!=="Floor") errors.push("department icons wrong on Who are you");
  await p.click('.who-name[data-name="Joe"]'); await p.waitForFunction(()=>/PIN/.test(document.getElementById("pinTitle").textContent));
  for(const k of "2222") await p.click(`#pinPad button[data-k="${k}"]`); await p.waitForTimeout(500); if((await p.textContent("#pinTitle"))==="Confirm your PIN") for(const k of "2222") await p.click(`#pinPad button[data-k="${k}"]`);
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
  if(r.j.data.dept.Joe!=="kitchen"||r.j.data.dept.Mariia!=="kitchen") errors.push("dept not saved as expected: "+JSON.stringify(r.j.data.dept));
  // list returns jobs from Toast
  const l=await j("/api/me?action=list",{headers:{"x-admin-password":"segreta"}}); console.log("4 jobs for Mariia:", l.j.accounts.Mariia&&l.j.accounts.Mariia.toast&&l.j.accounts.Mariia.toast.jobs, "| presence Joe online:", l.j.presence.Joe.online);
  if(!l.j.presence.Joe.online) errors.push("API presence says Joe offline");
  await b.close(); console.log("ERRORS:", errors.length?errors:"none"); process.exit(errors.length?1:0);
})().catch(e=>{console.log("ERR",e.message.split("\n")[0]);process.exit(1)});
