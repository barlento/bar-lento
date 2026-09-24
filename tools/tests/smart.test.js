// Calendar feed, morning reminder + late alert, week checks (owner 2026-09-22)
const { chromium, devices } = require("playwright");
const B="http://127.0.0.1:4173"; const errors=[]; const M={"Content-Type":"application/json","x-admin-password":"segreta"};
async function j(p,o){const r=await fetch(B+p,o);let x=null,txt="";try{txt=await r.text();x=JSON.parse(txt);}catch(e){}return{s:r.status,j:x,txt,h:r.headers};}
(async()=>{
  const DAYS=["mon","tue","wed","thu","fri","sat","sun"]; const ny=new Date(new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(new Date())+"T12:00:00Z");
  const mon=new Date(ny); mon.setUTCDate(mon.getUTCDate()-((mon.getUTCDay()+6)%7)); const wk=mon.toISOString().slice(0,10); const todayKey=DAYS[(ny.getUTCDay()+6)%7];
  const nyParts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date()); const nh=Number(nyParts.find(p=>p.type==="hour").value)%24, nm=Number(nyParts.find(p=>p.type==="minute").value);
  const pad=(n)=>String(n).padStart(2,"0"); const back=(min)=>{ let t=nh*60+nm-min; if(t<0) t+=1440; return pad(Math.floor(t/60))+":"+pad(t%60); };
  // schedule: Astrea 7 days × 9h (overtime + 7 days), Pietro (app clock, no punch) a shift that started 30 min ago → late alert, Sunday closed with a shift
  let r=await j("/api/data"); const d=JSON.parse(JSON.stringify(r.j.data)); if(!d.weeks[wk]){d.weeks[wk]={notes:{}};DAYS.forEach(x=>d.weeks[wk][x]=[]);}
  DAYS.forEach((k,i)=>{ d.weeks[wk][k]=[{id:"sm-a"+i,name:"Astrea",start:"12:00",end:"22:00",station:"S1"}]; });
  d.weeks[wk][todayKey].push({id:"sm-p",name:"Pietro",start:back(30),end:"23:30",station:"Bar"});
  d.weeks[wk].notes={sun:{status:"closed",text:"Staff party"}};
  r=await j("/api/data",{method:"POST",headers:M,body:JSON.stringify({version:r.j.version,data:d})}); console.log("1 schedule saved:",r.s);
  // ---- calendar feed
  const tokOf=async(n,pin)=>{ let x=await j("/api/me",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"login",name:n,pin})}); if(x.s!==200) x=await j("/api/me",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create",name:n,pin})}); return x.j.token; };
  const ta=await tokOf("Astrea","1111");
  r=await j("/api/me",{method:"POST",headers:{"Content-Type":"application/json","x-staff-token":ta},body:JSON.stringify({action:"calendar"})});
  console.log("2 calendar link:",r.s,(r.j.webcal||"").replace(/t=.*/,"t=…"));
  const feed=await j(r.j.https.replace(/^https?:\/\/[^/]+/,""));
  const events=(feed.txt.match(/BEGIN:VEVENT/g)||[]).length; console.log("3 feed:",feed.s,feed.h.get("content-type"),"| events:",events,"| has Astrea S1:",/SUMMARY:Bar Lento · S1/.test(feed.txt),"| Pietro only as colleague:",!/SUMMARY:[^\n]*Pietro/.test(feed.txt),"| sunday skipped (closed):",events===6);
  if(feed.s!==200||events!==6) errors.push("feed wrong");
  const r2=await j("/api/me",{method:"POST",headers:{"Content-Type":"application/json","x-staff-token":ta},body:JSON.stringify({action:"calendar"})}); console.log("4 same token twice:",r2.j.https===r.j.https);
  const cm=await j("/api/me",{method:"POST",headers:{"Content-Type":"application/json","x-staff-token":ta},body:JSON.stringify({action:"calendarMail"})});
  const mails=await j("/__mail"); const calMail=(mails.j||[]).filter(m=>/calendar link/i.test(m.subject||""));
  console.log("4b calendar link by email:",cm.s,"to",cm.j&&cm.j.to,"| mails with the link:",calMail.length,"| link inside:",calMail.some(m=>/\/api\/cal\?t=[a-f0-9]{40}/.test(m.text||"")));
  if(cm.s!==200||!calMail.length) errors.push("calendar mail not sent");
  const cm2=await j("/api/me",{method:"POST",headers:{"Content-Type":"application/json","x-staff-token":ta},body:JSON.stringify({action:"calendarMail"})}); console.log("4c second send within 10 min →",cm2.s,"(expect 429)");
  const bad=await j("/api/cal?t=0000000000000000000000000000000000000000"); console.log("5 unknown token →",bad.s,"(expect 404)");
  // ---- reminders (force = build now, whatever the hour)
  r=await j("/api/remind?force=1",{headers:M}); console.log("6 remind:",r.s,"| morning to:",(r.j.morning.messages||[]).map(m=>m.name+": "+m.body).join(" / "));
  console.log("7 late alerts:",JSON.stringify((r.j.late.alerts||[]).map(a=>({who:a.name,to:a.to,body:a.body}))));
  if(!(r.j.late.alerts||[]).some(a=>a.name==="Pietro")) errors.push("no late alert for Pietro");
  if((r.j.late.alerts||[]).some(a=>a.name==="Astrea")) errors.push("Astrea clocked in on Toast but flagged late");
  const noauth=await j("/api/remind"); console.log("8 remind without password →",noauth.s,"(expect 401)");
  // ---- reports: team PDF over a period (password), person PDF over a period; login carries the profile (one round-trip)
  const tp=await fetch(B+"/api/export?team=1&from="+wk+"&to="+wk.slice(0,8)+String(Number(wk.slice(8))+6).padStart(2,"0")+"&label=Test%20week",{headers:M}); const tb=Buffer.from(await tp.arrayBuffer());
  console.log("8b team PDF:",tp.status,tp.headers.get("content-type"),"| bytes:",tb.length,"| is PDF:",tb.slice(0,5).toString()==="%PDF-"); if(tp.status!==200||tb.length<3000) errors.push("team pdf failed");
  const pp=await fetch(B+"/api/export?person=Astrea&from="+wk+"&to="+wk,{headers:M}); console.log("8c person PDF one day:",pp.status,pp.headers.get("content-type")); if(pp.status!==200) errors.push("person pdf failed");
  // Marta: manager AND worker → team report with her PIN, plus her own report for one day (owner 2026-09-24)
  const tm=await tokOf("Marta","6161"); const mt=await fetch(B+"/api/export?team=1&from="+wk+"&to="+wk,{headers:{"x-staff-token":tm}}); const mm=await fetch(B+"/api/export?mine=1&from="+wk+"&to="+wk+"&label=Today",{headers:{"x-staff-token":tm}});
  console.log("8c2 Marta team PDF:",mt.status,"| Marta own report (today):",mm.status,mm.headers.get("content-type")); if(mt.status!==200||mm.status!==200) errors.push("Marta reports wrong");
  const lg=await j("/api/me",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"login",name:"Astrea",pin:"1111"})}); console.log("8d login carries the profile:",!!(lg.j&&lg.j.who&&lg.j.who.name==="Astrea"),"| appClock:",lg.j&&lg.j.who&&lg.j.who.appClock); if(!(lg.j&&lg.j.who)) errors.push("login without who");
  // ---- checks card (manager) + calendar sheet (staff)
  const b=await chromium.launch();
  const m=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(); m.on("pageerror",e=>errors.push("mgr pageerror: "+e.message));
  await m.goto(B+"/?v=sm1"); await m.waitForTimeout(300); await m.evaluate(()=>{localStorage.setItem("bl_admin_pw","segreta");}); await m.reload(); await m.waitForTimeout(2500);
  await m.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))});
  await m.waitForSelector("#checksCard.show",{timeout:8000}); const txt=(await m.textContent("#checksCard")).replace(/\s+/g," ");
  console.log("9 checks:",txt.slice(0,400));
  ["over 40 h","all 7 days","closed but","shifts of 10 h or more"].forEach(k=>{ if(!txt.includes(k)) errors.push("check missing: "+k); });
  await m.screenshot({path:require("path").join(__dirname,"..","out","smart-checks.png")});
  await m.click("#exportBtn"); await m.waitForSelector("#repOverlay.show"); await m.waitForTimeout(400);
  const repOpts=await m.evaluate(()=>Array.from(document.querSelectorAll?[]:document.querySelectorAll("#repWho option")).map(o=>o.value)); console.log("9b reports sheet: options",repOpts.length,"| Everyone first:",repOpts[0]==="*","| summary:",(await m.textContent("#repSum")).replace(/\s+/g," "));
  if(!repOpts.includes("*")||!repOpts.includes("Astrea")) errors.push("reports options wrong");
  await m.click('#repSeg button[data-p="lastmonth"]'); await m.waitForTimeout(200); console.log("9c last month:",(await m.textContent("#repSum")).replace(/\s+/g," "));
  await m.screenshot({path:require("path").join(__dirname,"..","out","smart-reports.png")}); await m.click("#repClose");
  const p=await (await b.newContext({...devices["iPhone 13"]})).newPage(); p.on("pageerror",e=>errors.push("pageerror: "+e.message));
  await p.goto(B+"/?v=sm2"); await p.waitForTimeout(300); await p.evaluate((t)=>{localStorage.setItem("bl_me_token",t);localStorage.setItem("bl_me_name","Astrea");},ta); await p.reload(); await p.waitForTimeout(2000);
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))});
  console.log("10 staff sees no checks card:", await p.evaluate(()=>!document.getElementById("checksCard").classList.contains("show")));
  await p.evaluate(()=>document.getElementById("meOpenBtn").click()); await p.waitForSelector("#meOverlay.show"); await p.waitForTimeout(600);
  await p.click("#meReport"); await p.waitForSelector("#repOverlay.show"); await p.waitForTimeout(300);
  console.log("10b My report sheet:", await p.textContent("#repTitle"), "| who hidden:", await p.evaluate(()=>document.getElementById("repWho").style.display==="none"), "| periods:", await p.evaluate(()=>document.querySelectorAll("#repSeg button").length));
  await p.click('#repSeg button[data-p="today"]'); await p.waitForTimeout(200); console.log("10c today:",(await p.textContent("#repSum")).replace(/\s+/g," ")); await p.screenshot({path:require("path").join(__dirname,"..","out","smart-myreport.png")}); await p.click("#repClose");
  await p.evaluate(()=>document.getElementById("meOpenBtn").click()); await p.waitForSelector("#meOverlay.show"); await p.waitForTimeout(400);
  console.log("11 calendar row:", await p.evaluate(()=>document.getElementById("meCal").style.display!=="none"));
  await p.evaluate(()=>document.getElementById("meClose").click()); await p.waitForTimeout(300);
  const bell=await p.evaluate(()=>({shown:document.getElementById("todoBtn").style.display!=="none", n:document.getElementById("todoCnt").textContent})); console.log("11b to-do bell:",JSON.stringify(bell)); if(!bell.shown||Number(bell.n)<1) errors.push("to-do bell missing");
  await p.click("#todoBtn"); await p.waitForSelector("#todoOverlay.show"); await p.waitForTimeout(300); const rows=await p.evaluate(()=>Array.from(document.querySelectorAll("#todoList .todo-row b")).map(b=>b.textContent)); console.log("11c tasks:",JSON.stringify(rows)); if(!rows.some(r=>/birthday/i.test(r))) errors.push("birthday task missing");
  await p.screenshot({path:require("path").join(__dirname,"..","out","smart-todo.png")});
  if(await p.$('#todoList [data-todo="bday"]')){ await p.click('#todoList [data-todo="bday"]'); await p.waitForSelector("#meOverlay.show"); await p.waitForTimeout(600); console.log("11d birthday row focused:", await p.evaluate(()=>document.activeElement&&document.activeElement.id==="meBdayInput"));
  await p.fill("#meBdayInput","1995-06-14"); await p.click("#meBdaySave"); await p.waitForTimeout(900); } else { await p.click("#todoClose"); console.log("11d birthday already set on this server"); }
  const bell2=await p.evaluate(()=>({shown:document.getElementById("todoBtn").style.display!=="none", n:document.getElementById("todoCnt").textContent, rows:Array.from(document.querySelectorAll("#todoList .todo-row b")).map(b=>b.textContent)})); console.log("11e after saving the birthday:",JSON.stringify(bell2)); if(rows.some(r=>/birthday/i.test(r))&&Number(bell2.n)!==Number(bell.n)-1&&bell2.shown) errors.push("to-do count did not drop");
  await p.evaluate(()=>document.getElementById("meClose").click()); await p.waitForTimeout(200);
  await p.click("#meCalBtn"); await p.waitForSelector("#calOverlay.show",{timeout:8000}); const href=await p.getAttribute("#calApple","href"), g=await p.getAttribute("#calGoogle","href"); console.log("12 sheet open, Apple webcal:",/^webcal:\/\/.+\/api\/cal\?t=[a-f0-9]{40}$/.test(href),"| Google:",/^https:\/\/calendar\.google\.com\/calendar\/r\?cid=webcal/.test(g));
  await p.screenshot({path:require("path").join(__dirname,"..","out","smart-cal.png")});
  await b.close();
  console.log("ERRORS:",errors.length?JSON.stringify(errors):"none"); process.exit(errors.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
