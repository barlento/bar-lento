// Roles follow the department (owner's decision 2026-09-20): the chef (Executive Chef) gets the kitchen tools after
// their own PIN, management/owner get the manager tools, nobody has a second password. Kitchen-only is server-enforced.
const { chromium, devices } = require("playwright");
const B="http://127.0.0.1:4173"; const errors=[]; const M={ "Content-Type":"application/json","x-admin-password":"segreta" };
const j=async(u,o)=>{const r=await fetch(B+u,o); let x=null; try{x=await r.json();}catch(e){} return {s:r.status,j:x};};
async function signAll(p){ for(let i=0;i<7;i++){ const open=await p.evaluate(()=>document.getElementById("rulesOverlay").classList.contains("show")); if(!open) return; const title=await p.textContent("#rulesTitle"); if(/Training/.test(title)){ await p.click("#rulesLater"); return; } await p.evaluate(()=>{const x=document.getElementById("rulesBody"); x.scrollTop=x.scrollHeight;}); await p.waitForTimeout(350); if(await p.isVisible("#rulesEmailField") && !(await p.inputValue("#rulesEmail"))) await p.fill("#rulesEmail","x@example.com"); await p.check("#rulesCheck"); await p.click("#rulesAgree"); await p.waitForTimeout(900); } }
async function pinLogin(p,name,pin){ await p.goto(B+"/?v=r"+Math.random()); await p.waitForSelector("#whoOverlay.show"); await p.click('.who-name[data-name="'+name+'"]'); await p.waitForFunction(()=>/PIN/.test(document.getElementById("pinTitle").textContent)); for(const k of pin) await p.click(`#pinPad button[data-k="${k}"]`); await p.waitForTimeout(500); if((await p.textContent("#pinTitle"))==="Confirm your PIN") for(const k of pin) await p.click(`#pinPad button[data-k="${k}"]`); await p.waitForTimeout(1200); await signAll(p).catch(()=>{}); await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show")); document.body.classList.remove("modal-open");}); await p.waitForTimeout(600); return await p.evaluate(()=>localStorage.getItem("bl_me_token")); }
(async()=>{
  let r=await j("/api/data"); const cur=r.j; console.log("1 departments from Toast:", cur.data.dept); if(cur.data.dept.Mariia!=="chef"||cur.data.dept.Marta!=="management") errors.push("Executive Chef / Floor Manager not mapped to chef / management");
  // the manager makes Catherine kitchen staff (so the chef has someone to schedule)
  const d0=JSON.parse(JSON.stringify(cur.data)); d0.dept.Catherine="kitchen"; d0.deptManual=(d0.deptManual||[]).concat(["Catherine"]);
  r=await j("/api/data",{method:"POST",headers:M,body:JSON.stringify({version:cur.version,data:d0})}); console.log("2 Catherine → kitchen:",r.s);
  const b=await chromium.launch();
  // ---- the chef: own PIN → chef mode, kitchen only ----
  const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(); p.on("pageerror",e=>errors.push("pageerror: "+e.message));
  const tok=await pinLogin(p,"Mariia","4321");
  const ui=await p.evaluate(()=>({admin:document.body.classList.contains("admin"), chef:document.body.classList.contains("chef"), mode:document.querySelector("#adminBar [data-t=adminMode]").textContent, names:[...new Set([...document.querySelectorAll(".shift .who")].map(e=>e.firstChild.textContent.trim()))], history:getComputedStyle(document.getElementById("historyBtn")).display, tools:getComputedStyle(document.getElementById("weekTools")).display, daybtn:getComputedStyle(document.querySelector(".daybtn")).display, strip:document.getElementById("meStrip").className}));
  console.log("3 Mariia after her PIN:",ui);
  const dd=(await j("/api/data")).j.data; const K=dd.staff.filter(n=>dd.dept[n]==="kitchen"||dd.dept[n]==="chef"); const inK=(n)=>K.includes(n); console.log("   kitchen set:",K);
  if(!ui.admin||!ui.chef||!/Chef mode/.test(ui.mode)||ui.names.some(n=>!inK(n))||ui.history!=="none"||ui.tools!=="none"||ui.daybtn!=="none"||!/show/.test(ui.strip)) errors.push("chef mode after PIN wrong: "+JSON.stringify(ui));
  await p.click(".addshift"); await p.waitForSelector("#shiftOverlay.show"); const opts=await p.evaluate(()=>[...document.querySelectorAll("#nameSel option")].map(o=>o.value)); console.log("4 chef name picker:",opts); if(opts.some(v=>!inK(v))) errors.push("name picker leaks"); await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))});
  await p.click("#staffBtn"); await p.waitForSelector("#staffOverlay.show"); await p.waitForTimeout(900); const ro=await p.evaluate(()=>({names:[...document.querySelectorAll(".roster .person")].map(b=>b.getAttribute("data-name")), addRow:getComputedStyle(document.querySelector("#staffOverlay .addrow")).display}));
  console.log("5 chef Staff:",ro); if(ro.names.some(n=>!inK(n))||ro.addRow!=="none") errors.push("chef Staff leaks");
  await p.screenshot({path:require("path").join(__dirname,"..","out","chef-mode.png")});
  // ---- server-side, with the chef's token only ----
  const C={ "Content-Type":"application/json","x-staff-token":tok };
  r=await j("/api/data"); const v=r.j.version; const wk=Object.keys(r.j.data.weeks).sort().pop(); const F=r.j.data.staff.find(n=>r.j.data.dept[n]==="floor");
  const d1=JSON.parse(JSON.stringify(r.j.data)); d1.weeks[wk].thu.push({id:"chef-1",name:"Catherine",start:"10:00",end:"14:00",station:"K"});
  r=await j("/api/data",{method:"POST",headers:C,body:JSON.stringify({version:v,data:d1})}); console.log("6 chef adds Catherine (kitchen):",r.s); if(r.s!==200) errors.push("chef could not add a kitchen shift: "+JSON.stringify(r.j));
  const v2=r.j.version, base=JSON.parse(JSON.stringify(r.j.data));
  const d2=JSON.parse(JSON.stringify(base)); d2.weeks[wk].thu.push({id:"chef-2",name:F,start:"10:00",end:"14:00",station:"S1"});
  r=await j("/api/data",{method:"POST",headers:C,body:JSON.stringify({version:v2,data:d2})}); console.log("7 chef adds "+F+" (floor):",r.s,r.j&&r.j.error); if(r.s!==403) errors.push("chef could add a floor shift");
  const d3=JSON.parse(JSON.stringify(base)); d3.weeks[wk].notes=d3.weeks[wk].notes||{}; d3.weeks[wk].notes.fri={status:"closed",text:"chef"};
  r=await j("/api/data",{method:"POST",headers:C,body:JSON.stringify({version:v2,data:d3})}); console.log("8 chef closes a day:",r.s); if(r.s!==403) errors.push("chef could change day settings");
  r=await j("/api/data",{method:"POST",headers:C,body:JSON.stringify({action:"backfillToast"})}); console.log("9 chef import:",r.s); if(r.s!==403) errors.push("chef could run the import");
  r=await j("/api/me?action=list",{headers:C}); console.log("10 chef list:",Object.keys(r.j.accounts),"former:",r.j.formerStaff.length); if(Object.keys(r.j.accounts).some(n=>!inK(n))) errors.push("chef list leaks");
  r=await j("/api/toast?action=leaderboard&period=week",{headers:C}); console.log("11 chef ranking:",(r.j.rows||[]).map(x=>x.name),r.j.scope); if((r.j.rows||[]).some(x=>!inK(x.name))) errors.push("chef ranking leaks");
  const e1=await fetch(B+"/api/export?person="+encodeURIComponent(F),{headers:C}); const e2=await fetch(B+"/api/export?person=Catherine",{headers:C}); const e3=await fetch(B+"/api/export",{headers:C}); console.log("12 export floor:",e1.status,"kitchen:",e2.status,"archive:",e3.status); if(e1.status!==403||e2.status!==200||e3.status!==403) errors.push("export scope wrong");
  r=await j("/api/log?limit=5",{headers:C}); console.log("13 chef history:",r.s); if(r.s!==401) errors.push("chef can read the history");
  // ---- person logout drops the role ----
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))}); await p.click("#managerLink"); await p.waitForTimeout(800);
  const after=await p.evaluate(()=>({admin:document.body.classList.contains("admin"), me:localStorage.getItem("bl_me_name")})); console.log("14 after Log out:",after); if(after.admin||after.me) errors.push("role survived the person logout");
  // ---- Marta (Floor Manager): own PIN → full manager ----
  const m=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(); m.on("pageerror",e=>errors.push("mgr pageerror: "+e.message));
  const mtok=await pinLogin(m,"Marta","6161");
  const mu=await m.evaluate(()=>({admin:document.body.classList.contains("admin"), chef:document.body.classList.contains("chef"), mode:document.querySelector("#adminBar [data-t=adminMode]").textContent, history:getComputedStyle(document.getElementById("historyBtn")).display}));
  console.log("15 Marta after her PIN:",mu); if(!mu.admin||mu.chef||!/Manager mode/.test(mu.mode)||mu.history==="none") errors.push("manager role after PIN wrong");
  r=await j("/api/log?limit=3",{headers:{"x-staff-token":mtok}}); console.log("16 Marta reads the history with her PIN token:",r.s); if(r.s!==200) errors.push("manager-by-PIN cannot read history");
  r=await j("/api/me?action=list",{headers:{"x-staff-token":mtok}}); console.log("17 Marta's Staff list size:",Object.keys(r.j.accounts||{}).length,"role:",r.j.role); if(r.j.role!=="manager") errors.push("manager-by-PIN list wrong");
  // ---- Marta (management) cannot promote to Management/Owner; Sierrah (Owner via Toast) can, and has "View as" ----
  r=await j("/api/data"); const dm=JSON.parse(JSON.stringify(r.j.data)); dm.dept.Joe="management"; dm.deptManual=(dm.deptManual||[]).concat(["Joe"]);
  r=await j("/api/data",{method:"POST",headers:{"Content-Type":"application/json","x-staff-token":mtok},body:JSON.stringify({version:(await j("/api/data")).j.version,data:dm})}); console.log("19 Marta promotes Joe to Management:",r.s,r.j&&r.j.error); if(r.s!==403) errors.push("manager could promote to management");
  const o=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(); o.on("pageerror",e=>errors.push("owner pageerror: "+e.message));
  const otok=await pinLogin(o,"Joe B.","8080");
  const ou=await o.evaluate(()=>({admin:document.body.classList.contains("admin"), owner:document.body.classList.contains("owner"), mode:document.querySelector("#adminBar [data-t=adminMode]").textContent}));
  console.log("20 Joe B. (Owner) after his PIN:",ou); if(!ou.admin||!ou.owner||!/Owner mode/.test(ou.mode)) errors.push("owner mode after PIN wrong");
  // the owner signs nothing: no rules/documents popup, no Documents button in My week, roster line = PIN only
  await o.evaluate(()=>document.getElementById("meOpenBtn").click()); await o.waitForSelector("#meOverlay.show"); await o.waitForTimeout(400);
  const ox=await o.evaluate(()=>({rulesShown:document.getElementById("rulesOverlay").classList.contains("show"), docsBtn:getComputedStyle(document.getElementById("meRules")).display}));
  await o.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(x=>x.classList.remove("show"))}); await o.click("#staffBtn"); await o.waitForSelector("#staffOverlay.show"); await o.waitForTimeout(900);
  const oline=await o.evaluate(()=>document.querySelector('.person[data-name="Joe B."] small')?.textContent||""); await o.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(x=>x.classList.remove("show"))});
  console.log("20b owner exempt from documents:",ox,"| roster line:",oline); if(ox.rulesShown||ox.docsBtn!=="none"||/Rules|Docs/.test(oline)) errors.push("owner not exempt from the documents flow");
  r=await j("/api/data"); const dm2=JSON.parse(JSON.stringify(r.j.data)); dm2.dept.Joe="management"; dm2.deptManual=(dm2.deptManual||[]).concat(["Joe"]);
  r=await j("/api/data",{method:"POST",headers:{"Content-Type":"application/json","x-staff-token":otok},body:JSON.stringify({version:r.j.version,data:dm2})}); console.log("21 owner promotes Joe to Management:",r.s); if(r.s!==200) errors.push("owner could not promote");
  const dm3=JSON.parse(JSON.stringify(r.j.data)); dm3.dept.Joe="floor"; await j("/api/data",{method:"POST",headers:{"Content-Type":"application/json","x-staff-token":otok},body:JSON.stringify({version:r.j.version,data:dm3})});
  await o.click("#staffBtn"); await o.waitForSelector("#staffOverlay.show"); await o.waitForTimeout(900); await o.click('.person[data-name="Mariia"]'); await o.waitForSelector("#personOverlay.show"); await o.waitForTimeout(300);
  const va=await o.isVisible(".pinbtn.viewas"); await o.click(".pinbtn.viewas"); await o.waitForTimeout(600);
  const vw=await o.evaluate(()=>({bar:document.getElementById("viewAsBar").style.display!=="none", txt:document.getElementById("viewAsTxt").textContent.slice(0,40), names:[...new Set([...document.querySelectorAll(".shift .who")].map(e=>e.firstChild.textContent.trim()))], mine:document.querySelectorAll(".shift.mine").length, addshift:getComputedStyle(document.querySelector(".addshift")).display}));
  console.log("22 View as Mariia (chef):",va,vw); if(!va||!vw.bar||vw.names.some(n=>!inK(n))||vw.addshift!=="none") errors.push("view-as wrong: "+JSON.stringify(vw));
  await o.click("#viewAsExit"); await o.waitForTimeout(400); const back=await o.evaluate(()=>({bar:document.getElementById("viewAsBar").style.display!=="none", mode:document.querySelector("#adminBar [data-t=adminMode]").textContent})); console.log("23 exit view-as:",back); if(back.bar||!/Owner mode/.test(back.mode)) errors.push("exit view-as wrong");
  // no Chef login button anywhere
  const p2=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(); await p2.goto(B+"/?v=nochef"); await p2.waitForSelector("#whoOverlay.show"); const btns=await p2.evaluate(()=>[...document.querySelectorAll(".who-logins .btn")].map(b=>b.textContent.trim())); console.log("18 login buttons:",btns); if(btns.length!==1||!/Manager login/.test(btns[0])) errors.push("login buttons wrong");
  await b.close(); console.log("ERRORS:",errors.length?errors:"none"); process.exit(errors.length?1:0);
})().catch(e=>{console.log("ERR",e.message.split("\n")[0]);process.exit(1)});
