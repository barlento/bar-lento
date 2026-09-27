// What's new → the team (owner 2026-09-27): one push, one email per person at the registered email, a summary to the owner,
// one history line, never twice. In-process with stubs (deterministic, any hour), then the real devserver path when the clock allows.
process.env.AI_FAKE = "1";
const fs = require("fs"), path = require("path");
const B = "http://127.0.0.1:4173"; const errors = []; const OUT = path.join(__dirname, "..", "out"); fs.mkdirSync(OUT, { recursive: true });
async function j(p, o) { const r = await fetch(B + p, o); let x = null; try { x = await r.json(); } catch (e) {} return { s: r.status, j: x }; }
(async () => {
  const NEWS = require("../../whatsnew.js"); const entry = NEWS.entries[0];
  console.log("1 entries:", NEWS.entries.length, "| newest:", entry.id, "| copyTo set:", !!NEWS.copyTo);
  if (!entry || !entry.id || !entry.title || !entry.title.en || !entry.title.it || !(entry.items || []).length) errors.push("newest entry incomplete");
  // ---- 2. the email itself: English first, Italian below, one button, no emoji, every item in both languages
  const w = require("../../lib/whatsnew"); const m = w.render(entry, "Astrea");
  fs.writeFileSync(path.join(OUT, "whatsnew.html"), m.html);
  const ok = /Hi Astrea,/.test(m.html) && /Open the app/.test(m.html) && /In italiano/.test(m.html) && /bar-lento\.vercel\.app/.test(m.html) && !/[\u{1F300}-\u{1FAFF}]/u.test(m.html);
  console.log("2 email:", m.subject, "| bytes:", m.html.length, "| shape ok:", ok, "| items:", entry.items.length, "| both languages:", entry.items.every((it) => it.en && it.it));
  if (!ok || !entry.items.every((it) => it.en && it.it && it.en.length === 2 && it.it.length === 2)) errors.push("email shape wrong");
  // ---- 3. in-process sending with stubs: push once, emails in batches over several polls, summary to the owner, done once, never twice
  {
    const store = require("../../lib/store"), push = require("../../lib/push"), mail = require("../../lib/mail"), toast = require("../../lib/toast"), accounts = require("../../lib/accounts");
    const kv = new Map();
    store.hasStorage = () => true; store.appendLog = async (e) => { kv.set("log", (kv.get("log") || []).concat(e.changes)); };
    store._redis = async (...a) => { const c = a[0]; if (c === "GET") return kv.has(a[1]) ? kv.get(a[1]) : null; if (c === "SET") { if (a.includes("NX") && kv.has(a[1])) return null; kv.set(a[1], String(a[2])); return "OK"; } if (c === "DEL") return kv.delete(a[1]) ? 1 : 0; throw new Error("stub: " + c); };
    let pushes = 0; push.broadcast = async () => { pushes++; return { sent: 4 }; }; push.isQuietHours = () => true; // quiet: nothing must go out
    const sent = []; mail.enabled = () => true; mail.send = async (x) => { sent.push(x); };
    toast.enabled = () => false; accounts.getRulesAck = async (n) => (n === "Pietro" ? null : { email: n.toLowerCase() + "@example.com" });
    const doc = { data: { staff: ["Astrea", "Joe", "Sierrah", "Pietro", "Test Account", "Marta", "Mariia"], toastMap: {} } };
    const q = await w.flush(doc); console.log("3 quiet hours:", JSON.stringify(q)); if (q.skipped !== "quiet_hours" || pushes || sent.length) errors.push("sent during quiet hours");
    push.isQuietHours = () => false;
    const r1 = await w.flush(doc); const r2 = await w.flush(doc); const r3 = await w.flush(doc); const r4 = await w.flush(doc);
    const team = sent.filter((x) => x.to !== NEWS.copyTo), owner = sent.filter((x) => x.to === NEWS.copyTo);
    console.log("4 polls:", JSON.stringify([r1, r2, r3].map((r) => [r.mailed, r.left, r.done])), "| 4th:", JSON.stringify(r4), "| pushes:", pushes, "| team emails:", team.map((x) => x.to).join(","), "| owner summary:", owner.length);
    const log = kv.get("log") || []; console.log("5 history:", log.join(" / "));
    if (pushes !== 1 || ![r1, r2, r3].some((r) => r && r.done) || r4.skipped !== "nothing") errors.push("batches/done wrong"); // 6 people = 2 polls of 3, the 3rd poll finds nothing left
    if (team.length !== 5 || team.some((x) => /pietro|test/i.test(x.to)) || !team.every((x) => /Hi \w+,/.test(x.html))) errors.push("team recipients wrong");
    if (owner.length !== 1 || !/Skipped \(1\)/.test(owner[0].html) || !/Pietro \(no email\)/.test(owner[0].html)) errors.push("owner summary wrong");
    if (!log.some((l) => /What's new sent to the team: .* 5 emails, 4 pushes .*Pietro \(no email\)/.test(l))) errors.push("history line wrong");
  }
  // ---- 6. the real wiring (GET /api/data → remind.tick → flush → mail captured at /__mail) on a devserver of its own, quiet hours off
  {
    const { spawn } = require("child_process"); const B2 = "http://127.0.0.1:4180";
    const child = spawn(process.execPath, [path.join(__dirname, "..", "devserver.js")], { env: Object.assign({}, process.env, { PORT: "4180", QUIET_HOURS_OFF: "1", WHATSNEW_OFF: "" }), stdio: "ignore" });
    try {
      let up = false; for (let i = 0; i < 40 && !up; i++) { await new Promise((r) => setTimeout(r, 250)); up = await fetch(B2 + "/api/data").then((r) => r.ok).catch(() => false); }
      if (!up) throw new Error("second devserver did not start");
      for (let i = 0; i < 6; i++) await fetch(B2 + "/api/data"); // each poll sends a batch
      const mails = await (await fetch(B2 + "/__mail")).json(); const mine = mails.filter((x) => /What's new|New in the app/.test(x.subject || ""));
      const before = mine.length; await fetch(B2 + "/api/data"); await fetch(B2 + "/api/data");
      const again = (await (await fetch(B2 + "/__mail")).json()).filter((x) => /What's new|New in the app/.test(x.subject || "")).length;
      const owner = mine.filter((x) => [].concat(x.to).includes(NEWS.copyTo));
      console.log("6 devserver: announcement emails:", before, "| to:", mine.map((x) => [].concat(x.to).join("")).join(","), "| owner summary:", owner.length, "| after two more polls:", again);
      if (before < 3 || again !== before || owner.length !== 1) errors.push("devserver announcement wrong");
      const hist = await (await fetch(B2 + "/api/log", { headers: { "x-admin-password": "segreta" } })).json().catch(() => null); if (!/What's new sent to the team/.test(JSON.stringify(hist || ""))) errors.push("history line missing on the devserver");
    } catch (e) { errors.push("devserver path: " + e.message); } finally { child.kill(); }
  }
  console.log("ERRORS:", errors.length ? JSON.stringify(errors) : "none"); process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
