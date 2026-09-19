// Chef login: a second, limited role — kitchen only, server-enforced.
const { chromium } = require("playwright");
const B="http://127.0.0.1:4173"; const errors=[]; const M={ "Content-Type":"application/json","x-admin-password":"segreta" };
const j=async(u,o)=>{const r=await fetch(B+u,o); let x=null; try{x=await r.json();}catch(e){} return {s:r.status,j:x,h:r.headers};};
(async()=>{
  let r=await j("/api/me",{method:"POST",headers:M,body:JSON.stringify({action:"setChefPassword",password:"cucina123"})}); console.log("1 manager sets chef password:",r.s,r.j);
  if(!r.j||!r.j.chef) errors.push("chef password not set");
  const C={ "Content-Type":"application/json","x-admin-password":"cucina123" };
  r=await j("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:"cucina123"})}); console.log("2 chef login:",r.s,r.j); if(!r.j||r.j.role!=="chef") errors.push("chef role not returned");
  r=await j("/api/data"); const feat=r.j.features; console.log("3 features.chef:",feat.chef); if(!feat.chef) errors.push("features.chef false");
  const cur=r.j; const data=JSON.parse(JSON.stringify(cur.data)); const wk=Object.keys(data.weeks).sort().pop();
  const K=Object.keys(data.dept).filter(n=>data.dept[n]==="kitchen"); const inK=(n)=>K.includes(n); const F=data.staff.find(n=>!inK(n)&&data.dept[n]==="floor"); console.log("   kitchen:",K,"| a floor person:",F);
  // chef adds a kitchen shift → ok
  data.weeks[wk].thu.push({id:"chef-1",name:"Mariia",start:"10:00",end:"14:00",station:"K"});
  r=await j("/api/data",{method:"POST",headers:C,body:JSON.stringify({version:cur.version,data})}); console.log("4 chef adds Mariia (kitchen):",r.s); if(r.s!==200) errors.push("chef could not add a kitchen shift: "+JSON.stringify(r.j));
  const v=r.j.version, d2=JSON.parse(JSON.stringify(r.j.data));
  // chef adds a floor shift → 403
  const d3=JSON.parse(JSON.stringify(d2)); d3.weeks[wk].thu.push({id:"chef-2",name:F,start:"10:00",end:"14:00",station:"S1"});
  r=await j("/api/data",{method:"POST",headers:C,body:JSON.stringify({version:v,data:d3})}); console.log("5 chef adds "+F+" (floor):",r.s,r.j&&r.j.error); if(r.s!==403) errors.push("chef could add a floor shift");
  // chef changes a day note → 403
  const d4=JSON.parse(JSON.stringify(d2)); d4.weeks[wk].notes=d4.weeks[wk].notes||{}; d4.weeks[wk].notes.fri={status:"closed",text:"chef"};
  r=await j("/api/data",{method:"POST",headers:C,body:JSON.stringify({version:v,data:d4})}); console.log("6 chef closes a day:",r.s); if(r.s!==403) errors.push("chef could change day settings");
  // chef edits an existing floor shift → 403
  const d5=JSON.parse(JSON.stringify(d2)); const fl=["mon","tue","wed","thu","fri","sat","sun"].map(k=>d5.weeks[wk][k].find(s=>s.name===F)).find(Boolean); if(fl){ fl.start="09:00"; r=await j("/api/data",{method:"POST",headers:C,body:JSON.stringify({version:v,data:d5})}); console.log("7 chef moves "+F+"'s shift:",r.s); if(r.s!==403) errors.push("chef could move a floor shift"); }
  r=await j("/api/data",{method:"POST",headers:C,body:JSON.stringify({action:"backfillToast"})}); console.log("8 chef import:",r.s); if(r.s!==403) errors.push("chef could run the import");
  r=await j("/api/me?action=list",{headers:C}); console.log("9 chef Staff list:",Object.keys(r.j.accounts),"presence:",Object.keys(r.j.presence),"former:",r.j.formerStaff.length); if(Object.keys(r.j.accounts).some(n=>!inK(n))||Object.keys(r.j.presence).some(n=>!inK(n))) errors.push("chef list leaks floor people");
  r=await j("/api/toast?action=leaderboard&period=week",{headers:C}); console.log("10 chef ranking rows:",(r.j.rows||[]).map(x=>x.name),"scope:",r.j.scope); if((r.j.rows||[]).some(x=>!inK(x.name))) errors.push("chef ranking leaks floor people");
  const e1=await fetch(B+"/api/export?person="+encodeURIComponent(F),{headers:C}); const e2=await fetch(B+"/api/export?person="+encodeURIComponent(K[0]),{headers:C}); const e3=await fetch(B+"/api/export",{headers:C}); console.log("11 export "+F+":",e1.status,K[0]+":",e2.status,e2.headers.get("content-type"),"archive:",e3.status); if(e1.status!==403||e2.status!==200||e3.status!==403) errors.push("export scope wrong");
  r=await j("/api/me?action=hours&week="+wk+"&name="+encodeURIComponent(F),{headers:C}); console.log("12 chef asks "+F+"'s hours:",r.s,r.j&&r.j.error); if(r.s===200&&r.j&&r.j.name===F) errors.push("chef could read a floor person's hours");
  // UI
  const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(); p.on("pageerror",e=>errors.push("pageerror: "+e.message));
  await p.goto(B+"/?v=ch1"); await p.waitForSelector("#whoOverlay.show"); const chefBtn=await p.isVisible("#whoChef"); console.log("13 Chef login button visible:",chefBtn); if(!chefBtn) errors.push("no Chef login button");
  await p.click("#whoChef"); await p.fill("#pwInput","cucina123"); await p.click("#loginGo"); await p.waitForTimeout(900);
  const ui=await p.evaluate(()=>({mode:document.querySelector("#adminBar [data-t=adminMode]").textContent, chefClass:document.body.classList.contains("chef"), names:[...new Set([...document.querySelectorAll(".shift .who")].map(e=>e.firstChild.textContent.trim()))], history:getComputedStyle(document.getElementById("historyBtn")).display, tools:getComputedStyle(document.getElementById("weekTools")).display, daybtn:getComputedStyle(document.querySelector(".daybtn")).display}));
  console.log("14 chef UI:",ui); if(!/Chef mode/.test(ui.mode)||ui.names.some(n=>!inK(n))||ui.history!=="none"||ui.tools!=="none"||ui.daybtn!=="none") errors.push("chef UI leaks: "+JSON.stringify(ui));
  await p.click(".addshift"); await p.waitForSelector("#shiftOverlay.show"); const opts=await p.evaluate(()=>[...document.querySelectorAll("#nameSel option")].map(o=>o.value)); console.log("15 chef name picker:",opts); if(opts.some(v=>!inK(v))) errors.push("name picker leaks");
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))});
  await p.click("#staffBtn"); await p.waitForSelector("#staffOverlay.show"); await p.waitForTimeout(900); const ro=await p.evaluate(()=>({names:[...document.querySelectorAll(".roster .person")].map(b=>b.getAttribute("data-name")), chefCard:getComputedStyle(document.getElementById("rosterChef")).display, addRow:getComputedStyle(document.querySelector("#staffOverlay .addrow")).display}));
  console.log("16 chef Staff:",ro); if(ro.names.some(n=>!inK(n))||ro.chefCard!=="none"||ro.addRow!=="none") errors.push("chef Staff leaks");
  await p.screenshot({path:require("path").join(__dirname,"..","out","chef-mode.png")});
  // manager still sees the chef card
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))}); await p.click("#managerLink"); await p.waitForTimeout(500); await p.click("#whoManager"); await p.fill("#pwInput","segreta"); await p.click("#loginGo"); await p.waitForTimeout(800);
  await p.click("#staffBtn"); await p.waitForSelector("#staffOverlay.show"); await p.waitForTimeout(900); const mg=await p.evaluate(()=>({mode:document.querySelector("#adminBar [data-t=adminMode]").textContent, chefCard:getComputedStyle(document.getElementById("rosterChef")).display, state:document.getElementById("chefPwState").textContent.slice(0,30)}));
  console.log("17 manager Staff:",mg); if(mg.chefCard==="none"||!/Chef login is on/.test(mg.state)) errors.push("manager chef card wrong");
  // switch the chef login off from the UI
  await p.fill("#chefPw",""); await p.click("#chefPwSave"); await p.waitForTimeout(700); r=await j("/api/data"); console.log("18 chef off:",r.j.features.chef===false); if(r.j.features.chef) errors.push("chef login not switched off");
  // the button stays visible and explains what to do when no password is set
  const p2=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(); await p2.goto(B+"/?v=ch2"); await p2.waitForSelector("#whoOverlay.show"); const vis=await p2.isVisible("#whoChef"); await p2.click("#whoChef"); await p2.waitForTimeout(400); const msg=await p2.evaluate(()=>[...document.querySelectorAll(".toast")].map(x=>x.textContent).join(" | ")); console.log("19 button without password:",vis,"|",msg.slice(0,60)); if(!vis||!/not set up yet/.test(msg)) errors.push("chef button hidden or silent without a password");
  await b.close(); console.log("ERRORS:",errors.length?errors:"none"); process.exit(errors.length?1:0);
})().catch(e=>{console.log("ERR",e.message.split("\n")[0]);process.exit(1)});
