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
  const bad=await j("/api/cal?t=0000000000000000000000000000000000000000"); console.log("5 unknown token →",bad.s,"(expect 404)");
  // ---- reminders (force = build now, whatever the hour)
  r=await j("/api/remind?force=1",{headers:M}); console.log("6 remind:",r.s,"| morning to:",(r.j.morning.messages||[]).map(m=>m.name+": "+m.body).join(" / "));
  console.log("7 late alerts:",JSON.stringify((r.j.late.alerts||[]).map(a=>({who:a.name,to:a.to,body:a.body}))));
  if(!(r.j.late.alerts||[]).some(a=>a.name==="Pietro")) errors.push("no late alert for Pietro");
  if((r.j.late.alerts||[]).some(a=>a.name==="Astrea")) errors.push("Astrea clocked in on Toast but flagged late");
  const noauth=await j("/api/remind"); console.log("8 remind without password →",noauth.s,"(expect 401)");
  // ---- checks card (manager) + calendar sheet (staff)
  const b=await chromium.launch();
  const m=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(); m.on("pageerror",e=>errors.push("mgr pageerror: "+e.message));
  await m.goto(B+"/?v=sm1"); await m.waitForTimeout(300); await m.evaluate(()=>{localStorage.setItem("bl_admin_pw","segreta");}); await m.reload(); await m.waitForTimeout(2500);
  await m.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))});
  await m.waitForSelector("#checksCard.show",{timeout:8000}); const txt=(await m.textContent("#checksCard")).replace(/\s+/g," ");
  console.log("9 checks:",txt.slice(0,400));
  ["over 40 h","all 7 days","closed but","shifts of 10 h or more"].forEach(k=>{ if(!txt.includes(k)) errors.push("check missing: "+k); });
  await m.screenshot({path:require("path").join(__dirname,"..","out","smart-checks.png")});
  const p=await (await b.newContext({...devices["iPhone 13"]})).newPage(); p.on("pageerror",e=>errors.push("pageerror: "+e.message));
  await p.goto(B+"/?v=sm2"); await p.waitForTimeout(300); await p.evaluate((t)=>{localStorage.setItem("bl_me_token",t);localStorage.setItem("bl_me_name","Astrea");},ta); await p.reload(); await p.waitForTimeout(2000);
  await p.evaluate(()=>{document.querySelectorAll(".overlay.show").forEach(o=>o.classList.remove("show"))});
  console.log("10 staff sees no checks card:", await p.evaluate(()=>!document.getElementById("checksCard").classList.contains("show")));
  await p.evaluate(()=>document.getElementById("meOpenBtn").click()); await p.waitForSelector("#meOverlay.show"); await p.waitForTimeout(600);
  console.log("11 calendar row:", await p.evaluate(()=>document.getElementById("meCal").style.display!=="none"));
  await p.click("#meCalBtn"); await p.waitForSelector("#calOverlay.show",{timeout:8000}); const href=await p.getAttribute("#calOpen","href"); console.log("12 sheet open, webcal link:",/^webcal:\/\/.+\/api\/cal\?t=[a-f0-9]{40}$/.test(href));
  await p.screenshot({path:require("path").join(__dirname,"..","out","smart-cal.png")});
  await b.close();
  console.log("ERRORS:",errors.length?JSON.stringify(errors):"none"); process.exit(errors.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
