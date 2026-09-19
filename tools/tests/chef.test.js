// Chef login: a second, limited role — kitchen only, server-enforced.
const { chromium } = require("playwright");
const B="http://127.0.0.1:4173"; const errors=[]; const M={ "Content-Type":"application/json","x-admin-password":"segreta" };
const j=async(u,o)=>{const r=await fetch(B+u,o); let x=null; try{x=await r.json();}catch(e){} return {s:r.status,j:x,h:r.headers};};
(async()=>{
  let r=await j("/api/me",{method:"POST",headers:M,body:JSON.stringify({action:"setChefPassword",password:"cucina123",name:"Mariia"})}); console.log("1 manager gives Mariia the chef login:",r.s,r.j);
  if(!r.j||!r.j.chef||!r.j.chef.on||r.j.chef.name!=="Mariia") errors.push("chef password not set for Mariia");
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
  await p.goto(B+"/?v=ch1"); await p.waitForSelector("#whoOverlay.show"); const chefBtn=await p.isVisible("#whoChef"); const pos=await p.evaluate(()=>{const a=document.getElementById("whoManager").getBoundingClientRect(), b=document.getElementById("whoChef").getBoundingClientRect(), g=document.getElementById("whoGrid").getBoundingClientRect(); return {sameRow:Math.abs(a.top-b.top)<2, sameSize:Math.abs(a.width-b.width)<2&&Math.abs(a.height-b.height)<2, aboveGrid:a.bottom<=g.top};}); console.log("13 Chef login button visible:",chefBtn,pos); if(!chefBtn||!pos.sameRow||!pos.sameSize||!pos.aboveGrid) errors.push("login buttons layout wrong: "+JSON.stringify(pos));
  await p.click("#whoChef"); await p.fill("#pwInput","cucina123"); await p.click("#loginGo"); await p.waitForTimeout(900);
  const ui=await p.evaluate(()=>({mode:document.querySelector("#adminBar [data-t=adminMode]").textContent, chefClass:document.body.classList.contains("chef"), names:[...new Set([...document.querySelectorAll(".shift .who")].map(e=>e.firstChild.textContent.trim()))], history:getComputedStyle(document.getElementById("historyBtn")).display, tools:getComputedStyle(document.getElementById("weekTools")).display, daybtn:getComputedStyle(document.querySelector(".daybtn")).display}));
  console.log("14 chef UI:",ui); if(!/Chef mode/.test(ui.mode)||ui.names.some(n=>!inK(n))||ui.history!=="none"||ui.tools!=="none"||ui.daybtn!=="none") errors.push("chef UI leaks: "+JSON.stringify(ui));
  await p.click(".addshift"); await p.waitForSelector("#shiftOverlay.show"); const opts=await p.evaluate(()=>[...document.querySelectorAll("#nameSel option")].map(o=>o.value)); console.log("15 chef name picker:",opts); if(opts.some(v=>!inK(v))) errors.push("name picker leaks");
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))});
  await p.click("#staffBtn"); await p.waitForSelector("#staffOverlay.show"); await p.waitForTimeout(900); const ro=await p.evaluate(()=>({names:[...document.querySelectorAll(".roster .person")].map(b=>b.getAttribute("data-name")), addRow:getComputedStyle(document.querySelector("#staffOverlay .addrow")).display}));
  console.log("16 chef Staff:",ro); if(ro.names.some(n=>!inK(n))||ro.addRow!=="none") errors.push("chef Staff leaks");
  await p.click('.person[data-name="'+K[0]+'"]'); await p.waitForSelector("#personOverlay.show"); await p.waitForTimeout(300); const lvlChef=await p.evaluate(()=>!!document.querySelector(".lvl-pick")); console.log("16b chef sees no access-level card:",!lvlChef); if(lvlChef) errors.push("chef can see the access level card");
  await p.screenshot({path:require("path").join(__dirname,"..","out","chef-mode.png")});
  // manager: the access level lives in the person sheet
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))}); await p.click("#managerLink"); await p.waitForTimeout(500); await p.click("#whoManager");
  const eye=await p.evaluate(()=>{const i=document.getElementById("pwInput"); const e=document.querySelector('.eye[data-for="pwInput"]'); if(!e) return null; i.value="abc"; e.click(); const shown=i.type; e.click(); return {shown, hidden:i.type};}); console.log("17 eye on the login password:",eye); if(!eye||eye.shown!=="text"||eye.hidden!=="password") errors.push("eye toggle missing on login");
  await p.fill("#pwInput","segreta"); await p.click("#loginGo"); await p.waitForTimeout(800);
  await p.click("#staffBtn"); await p.waitForSelector("#staffOverlay.show"); await p.waitForTimeout(900); await p.click('.person[data-name="Mariia"]'); await p.waitForSelector("#personOverlay.show"); await p.waitForTimeout(300);
  const mg=await p.evaluate(()=>({sel:document.querySelector(".lvl-pick.sel")?.getAttribute("data-l"), hint:[...document.querySelectorAll("#personBody .hint")].map(x=>x.textContent).find(x=>/Chef login/.test(x))||"", eye:!!document.querySelector('.eye[data-for="lvlPw"]')}));
  console.log("17b Mariia's sheet:",mg); if(mg.sel!=="chef"||!/Chef login is on for Mariia/.test(mg.hint)||!mg.eye) errors.push("access level card wrong for the chef");
  // take the chef login away: tap Staff
  await p.click('.lvl-pick[data-l="staff"]'); await p.waitForTimeout(800); r=await j("/api/data"); console.log("18 chef off:",r.j.features.chef===false); if(r.j.features.chef) errors.push("chef login not switched off");
  // give it to Joe from his sheet
  await p.evaluate(()=>{document.getElementById("personOverlay").classList.remove("show")}); await p.click('.person[data-name="'+F+'"]'); await p.waitForSelector("#personOverlay.show"); await p.waitForTimeout(300); await p.click('.lvl-pick[data-l="chef"]'); await p.waitForTimeout(300); await p.fill("#lvlPw","nuova123"); await p.click(".pinbtn.lvlsave"); await p.waitForTimeout(800);
  const l2=await j("/api/me?action=list",{headers:M}); console.log("18b chef login now held by:",l2.j.chef); if(!l2.j.chef||l2.j.chef.name!==F) errors.push("chef login not given from the person sheet");
  await j("/api/me",{method:"POST",headers:M,body:JSON.stringify({action:"setChefPassword",password:"",name:F})});
  // PIN pad: show digits
  const p3=await (await b.newContext({...require("playwright").devices["iPhone 13"]})).newPage(); await p3.goto(B+"/?v=ch3"); await p3.waitForSelector("#whoOverlay.show"); await p3.click('.who-name[data-name="Catherine"]'); await p3.waitForFunction(()=>/PIN/.test(document.getElementById("pinTitle").textContent)); await p3.click("#pinEye"); for(const k of "12") await p3.click(`#pinPad button[data-k="${k}"]`); const dig=await p3.evaluate(()=>({shown:document.getElementById("pinDigits").style.display!=="none", txt:document.getElementById("pinDigits").textContent})); console.log("18c PIN show:",dig); if(!dig.shown||!/^12/.test(dig.txt)) errors.push("PIN eye not working"); await p3.context().close();
  // the button stays visible and explains what to do when no password is set
  const p2=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(); await p2.goto(B+"/?v=ch2"); await p2.waitForSelector("#whoOverlay.show"); const vis=await p2.isVisible("#whoChef"); await p2.click("#whoChef"); await p2.waitForTimeout(400); const msg=await p2.evaluate(()=>[...document.querySelectorAll(".toast")].map(x=>x.textContent).join(" | ")); console.log("19 button without password:",vis,"|",msg.slice(0,60)); if(!vis||!/not set up yet/.test(msg)) errors.push("chef button hidden or silent without a password");
  await b.close(); console.log("ERRORS:",errors.length?errors:"none"); process.exit(errors.length?1:0);
})().catch(e=>{console.log("ERR",e.message.split("\n")[0]);process.exit(1)});
