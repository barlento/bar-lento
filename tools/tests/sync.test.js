const B="http://127.0.0.1:4173";
(async()=>{
  const j=async(p,o)=>{const r=await fetch(B+p,o);return {s:r.status,j:await r.json()};};
  let r=await j("/api/data"); console.log("1 staff after first GET:",r.j.data.staff.join(", "));
  console.log("  toastMap Luca:",r.j.data.toastMap["Luca"],"| Joe B.:",r.j.data.toastMap["Joe B."],"| Old present:",r.j.data.staff.includes("Old"));
  const log=await j("/api/log?limit=5"); console.log("  log:",JSON.stringify(log.j).slice(0,300));
  // manager removes Luca
  const d=r.j.data; d.staff=d.staff.filter(n=>n!=="Luca");
  const save=await j("/api/data",{method:"POST",headers:{"Content-Type":"application/json","x-admin-password":"segreta"},body:JSON.stringify({version:r.j.version,data:d})});
  console.log("2 save:",save.s,"| ignore:",save.j.data.toastIgnore,"| staff has Luca:",save.j.data.staff.includes("Luca"));
  // forced second sync (bypasses the 10-minute throttle) straight through the module against the fake Redis/Toast
  process.env.KV_REST_API_URL="http://127.0.0.1:4174"; process.env.KV_REST_API_TOKEN="x"; process.env.TOAST_CLIENT_ID="id"; process.env.TOAST_CLIENT_SECRET="sec"; process.env.TOAST_API_HOST="http://127.0.0.1:4175";
  const store=require("../../lib/store.js"); const sync=require("../../lib/staffsync.js");
  const doc=await store.getSchedule(); const res=await sync.syncFromToast(doc,{force:true});
  console.log("3 forced resync added:",res.added.map(a=>a.name),"| Luca back:",res.doc.data.staff.includes("Luca"));
  const me=await j("/api/me?action=list",{headers:{"x-admin-password":"segreta"}}); console.log("4 list toast for Joe B.:",JSON.stringify(me.j.accounts["Joe B."]&&me.j.accounts["Joe B."].toast));
})();
