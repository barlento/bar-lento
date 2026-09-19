// Local test server: fake Upstash REST (in-memory) + fake Toast + real api/*.js handlers.
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = require("path").join(__dirname, "..");

// ---- fake Upstash ----
const kv = new Map();
function redisExec(cmd) {
  const [c, ...a] = cmd; const C = String(c).toUpperCase();
  switch (C) {
    case "GET": return kv.has(a[0]) && typeof kv.get(a[0]) === "string" ? kv.get(a[0]) : null;
    case "SET": { if (a.includes("NX") && kv.has(a[0])) return null; kv.set(a[0], String(a[1])); return "OK"; }
    case "DEL": { let n = 0; a.forEach((k) => { if (kv.delete(k)) n++; }); return n; }
    case "HSET": { const h = kv.get(a[0]) instanceof Map ? kv.get(a[0]) : new Map(); let n = 0; for (let i = 1; i + 1 < a.length; i += 2) { if (!h.has(a[i])) n++; h.set(a[i], String(a[i + 1])); } kv.set(a[0], h); return n; }
    case "HSETNX": { const h = kv.get(a[0]) instanceof Map ? kv.get(a[0]) : new Map(); if (h.has(a[1])) return 0; h.set(a[1], String(a[2])); kv.set(a[0], h); return 1; }
    case "HGET": { const h = kv.get(a[0]); return h instanceof Map && h.has(a[1]) ? h.get(a[1]) : null; }
    case "HDEL": { const h = kv.get(a[0]); let n = 0; if (h instanceof Map) a.slice(1).forEach((f) => { if (h.delete(f)) n++; }); return n; }
    case "HGETALL": { const h = kv.get(a[0]); const out = []; if (h instanceof Map) h.forEach((v, k) => out.push(k, v)); return out; }
    case "RPUSH": { const l = Array.isArray(kv.get(a[0])) ? kv.get(a[0]) : []; l.push(...a.slice(1).map(String)); kv.set(a[0], l); return l.length; }
    case "LTRIM": { const l = Array.isArray(kv.get(a[0])) ? kv.get(a[0]) : []; let s = Number(a[1]), e = Number(a[2]); if (s < 0) s = Math.max(0, l.length + s); if (e < 0) e = l.length + e; kv.set(a[0], l.slice(s, e + 1)); return "OK"; }
    case "LRANGE": { const l = Array.isArray(kv.get(a[0])) ? kv.get(a[0]) : []; let s = Number(a[1]), e = Number(a[2]); if (s < 0) s = Math.max(0, l.length + s); if (e < 0) e = l.length + e; return l.slice(s, e + 1); }
    default: throw new Error("fake redis: unsupported " + C);
  }
}
const kvServer = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    try { const r = redisExec(JSON.parse(b)); res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ result: r })); }
    catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: String(e.message) })); }
  });
});

// ---- fake Toast ----
const NY = "America/New_York";
function nyTodayISO() { return new Intl.DateTimeFormat("en-CA", { timeZone: NY }).format(new Date()); }
function nyInstant(dateISO, hh, mm) { // approximate: use offset -4 (EDT) — enough for tests in September
  const [y, m, d] = dateISO.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, hh + 4, mm)).toISOString();
}
process.env.BACKFILL_UNTIL = process.env.BACKFILL_UNTIL || "2099-12-31"; // the fake bar is always "before launch": the import rule stays testable
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, "data.json"), "utf8"));
// GUIDE_STAFF=1 → invented names for the welcome-guide screenshots (never real staff names in the PDF)
const GUIDE = process.env.GUIDE_STAFF === "1";
const RENAME = { Kayla: "Emma", Joe: "Alex", Sierrah: "Sofia", Marta: "Lisa", Astrea: "Nora", Pietro: "Marco", Catherine: "Anna", Mariia: "Sara" };
if (GUIDE) {
  seed.staff = seed.staff.map((n) => RENAME[n] || n);
  Object.values(seed.weeks || {}).forEach((w) => Object.keys(w).forEach((d) => { if (Array.isArray(w[d])) w[d].forEach((s) => { s.name = RENAME[s.name] || s.name; }); }));
  if (seed.birthdays) seed.birthdays = Object.fromEntries(Object.entries(seed.birthdays).map(([k, v]) => [RENAME[k] || k, v]));
  if (seed.toastMap) seed.toastMap = Object.fromEntries(Object.entries(seed.toastMap).map(([k, v]) => [RENAME[k] || k, v]));
}
const NO_TOAST = GUIDE ? "Marco" : "Pietro"; // the one person who is not in Toast
// The schedule starts with Kayla explicitly linked to her Toast record (which is archived below): the sync must remove her.
kv.set("barlento:schedule", JSON.stringify({ version: 1, data: Object.assign({}, seed, GUIDE ? {} : { toastMap: { Kayla: "guid-kayla" } }), updatedAt: new Date(Date.now() - 3600000).toISOString() }));
const EMPS = seed.staff.filter((n) => n !== NO_TOAST).map((n, i) => ({ guid: "guid-" + n.toLowerCase(), firstName: n, lastName: "Test" + i, email: n.toLowerCase() + "@example.com", createdDate: "2025-01-01T00:00:00.000Z", deleted: false }));
EMPS.forEach((e) => { e.jobReferences = [{ guid: e.firstName === "Mariia" ? "job-cook" : "job-server" }]; }); // Mariia is kitchen, everyone else floor
EMPS.forEach((e) => { if (e.firstName === "Kayla") { e.deleted = true; e.deletedDate = "2026-09-01T00:00:00.000+0000"; } }); // archived in Toast while still on staff → the sync removes her
EMPS.push({ guid: "guid-luca-rossi-0001", firstName: "Luca", lastName: "Rossi", email: "luca.rossi@example.com", createdDate: "2026-09-10T00:00:00.000Z", deleted: false, deletedDate: "1970-01-01T00:00:00.000+0000" });
EMPS.push({ guid: "guid-joe-second-0002", firstName: GUIDE ? "Leo" : "Joe", lastName: "Bianchi", email: "joe.b@example.com", createdDate: "2026-09-01T00:00:00.000Z", deleted: false });
EMPS.push({ guid: "guid-old-gone-0003", firstName: "Old", lastName: "Gone", email: "old@example.com", deleted: true, deletedDate: "2026-08-01T10:00:00.000+0000" });
const MAILS = [];
// time entries: for every scheduled shift in the current week whose date <= today, a punch 3 min late, out 10 min after end (open if today & ongoing)
function fakeEntries() {
  const today = nyTodayISO(); const out = [];
  // past weeks with no schedule at all: real-looking clock-ins to import
  [["2026-08-25", "joe", "16:02", "22:07"], ["2026-08-25", "sierrah", "17:01", "23:12"], ["2026-08-27", "joe", "15:58", "21:03"], ["2026-09-01", "kayla", "16:05", "22:40"], ["2026-09-03", "joe", "16:00", "01:10"]].forEach(([date, who, i, o], k) => {
    const [ih, im] = i.split(":").map(Number), [oh, om] = o.split(":").map(Number);
    const inISO = nyInstant(date, ih, im); let outISO = nyInstant(date, oh, om); if (Date.parse(outISO) < Date.parse(inISO)) outISO = new Date(Date.parse(outISO) + 86400000).toISOString();
    if (Date.parse(inISO) < Date.now()) out.push({ guid: "te-past-" + k, employeeReference: { guid: "guid-" + who }, inDate: inISO, outDate: outISO, deleted: false });
  });
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  Object.keys(seed.weeks).forEach((wk) => {
    DAYS.forEach((d, i) => {
      const [y, m, dd] = wk.split("-").map(Number); const date = new Date(Date.UTC(y, m - 1, dd + i)).toISOString().slice(0, 10);
      if (date > today) return;
      (seed.weeks[wk][d] || []).forEach((s) => {
        const [sh, sm] = s.start.split(":").map(Number); const [eh, em] = s.end.split(":").map(Number);
        const inISO = nyInstant(date, sh, sm + 3);
        let outISO = nyInstant(date, eh, em + 10);
        if (Date.parse(outISO) > Date.now()) outISO = null;
        if (Date.parse(inISO) > Date.now()) return;
        out.push({ guid: "te-" + s.id, employeeReference: { guid: "guid-" + s.name.toLowerCase() }, inDate: inISO, outDate: outISO, deleted: false });
      });
    });
  });
  return out;
}
const toastServer = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); res.setHeader("Content-Type", "application/json");
  if (u.pathname.endsWith("/authentication/login")) return res.end(JSON.stringify({ token: { accessToken: "tok", expiresIn: 3600 } }));
  if (u.pathname === "/partners/v1/restaurants") return res.end(JSON.stringify([{ restaurantGuid: "rest-1", restaurantName: "Bar Lento" }]));
  if (u.pathname === "/labor/v1/employees") return res.end(JSON.stringify(EMPS));
  if (u.pathname === "/labor/v1/jobs") return res.end(JSON.stringify([{ guid: "job-server", title: "Server" }, { guid: "job-cook", title: "Line Cook" }, { guid: "job-bar", title: "Bartender" }]));
  if (u.pathname === "/labor/v1/timeEntries") {
    if (u.searchParams.get("businessDate")) return res.end("[]"); // the fake Toast files nothing by business date
    const s = Date.parse(u.searchParams.get("startDate")), e = Date.parse(u.searchParams.get("endDate"));
    return res.end(JSON.stringify(fakeEntries().filter((t) => Date.parse(t.inDate) >= s && Date.parse(t.inDate) <= e)));
  }
  res.statusCode = 404; res.end("{}");
});

kvServer.listen(4174, () => {
  toastServer.listen(4175, () => {
    process.env.KV_REST_API_URL = "http://127.0.0.1:4174";
    process.env.KV_REST_API_TOKEN = "x";
    process.env.ADMIN_PASSWORD = "segreta";
    process.env.MAIL_WEBHOOK_URL = "http://127.0.0.1:4173/__mail";
    process.env.TOAST_CLIENT_ID = "id"; process.env.TOAST_CLIENT_SECRET = "sec"; process.env.TOAST_API_HOST = "http://127.0.0.1:4175";
    startApp();
  });
});

function startApp() {
  const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".css": "text/css" };
  const app = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/__mail") {
      if (req.method === "POST") { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { MAILS.push(JSON.parse(b)); } catch (e) {} res.end("{}"); }); return; }
      res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify(MAILS));
    }
    if (u.pathname.startsWith("/api/")) {
      const name = u.pathname.slice(5).replace(/\.js$/, "");
      const file = path.join(ROOT, "api", name + ".js");
      if (!fs.existsSync(file)) { res.statusCode = 404; return res.end("no api"); }
      let b = ""; req.on("data", (c) => (b += c)); req.on("end", async () => {
        try { req.body = b ? JSON.parse(b) : {}; } catch (e) { req.body = {}; }
        const r = { setHeader: (k, v) => res.setHeader(k, v), status: (c) => { res.statusCode = c; return r; }, send: (x) => res.end(typeof x === "string" || Buffer.isBuffer(x) ? x : JSON.stringify(x)), end: (x) => res.end(x), json: (x) => res.end(JSON.stringify(x)) };
        delete require.cache[require.resolve(file)];
        try { await require(file)(req, r); } catch (e) { res.statusCode = 500; res.end(String(e.stack)); }
      });
      return;
    }
    let p = u.pathname === "/" ? "/index.html" : u.pathname; const f = path.join(ROOT, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end("not found"); }
    res.setHeader("Content-Type", MIME[path.extname(f)] || "application/octet-stream"); res.end(fs.readFileSync(f));
  });
  app.listen(4173, () => console.log("dev on http://127.0.0.1:4173"));
}
