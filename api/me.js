const store = require("../lib/store");
const auth = require("../lib/auth");
const accounts = require("../lib/accounts");
const toast = require("../lib/toast");

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}
function tokenFrom(req) {
  const h = req.headers["x-staff-token"];
  return typeof h === "string" ? h : "";
}
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
function mins(t) { const p = String(t || "0:0").split(":").map(Number); return p[0] * 60 + (p[1] || 0); }
// NY minutes-of-day for an instant (punches after midnight count past 24h so 1 AM after a 4 PM start is "late", not "early").
function nyMinutes(iso) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t) => Number((parts.find((p) => p.type === t) || {}).value);
  const h = g("hour") % 24; return (h < 6 ? h + 24 : h) * 60 + g("minute");
}
// One person's week: scheduled minutes, worked minutes, and per-shift clock-in deviation vs scheduled start.
async function weekSummary(data, name, guid, weekISO) {
  const w = data.weeks[weekISO];
  const out = { week: weekISO, exists: Boolean(w), scheduledMin: 0, scheduledShifts: 0, workedMin: 0, clockedShifts: 0, matched: 0, onTime: 0, early: 0, devSum: 0, avgDev: null, onTimePct: null };
  if (!w) return out;
  const startByDay = {};
  DAYS.forEach((d) => {
    const note = w.notes && w.notes[d]; if (note && (note.status === "closed" || note.status === "holiday")) return;
    (w[d] || []).filter((s) => s.name === name).forEach((s) => { out.scheduledShifts++; out.scheduledMin += Math.max(0, mins(s.end) - mins(s.start)); if (startByDay[d] == null || mins(s.start) < startByDay[d]) startByDay[d] = mins(s.start); });
  });
  if (!guid) return out;
  const entries = await toast.weekEntriesFor(guid, weekISO);
  const firstInByDay = {};
  entries.forEach((e) => {
    out.workedMin += Math.max(0, (Date.parse(e.out || new Date().toISOString()) - Date.parse(e.in)) / 60000);
    const m = nyMinutes(e.in); if (firstInByDay[e.day] == null || m < firstInByDay[e.day]) firstInByDay[e.day] = m;
  });
  out.workedMin = Math.round(out.workedMin);
  out.clockedShifts = Object.keys(firstInByDay).length;
  Object.keys(firstInByDay).forEach((d) => {
    if (startByDay[d] == null) return;
    const dev = firstInByDay[d] - startByDay[d]; // negative = early
    out.matched++; out.devSum += dev; if (dev <= 5) out.onTime++; if (dev < 0) out.early++;
  });
  if (out.matched) { out.avgDev = Math.round(out.devSum / out.matched); out.onTimePct = Math.round(out.onTime / out.matched * 100); }
  return out;
}
function sumMinutes(list) {
  return list.reduce((a, s) => a + Math.max(0, (Date.parse(s.out || new Date().toISOString()) - Date.parse(s.in)) / 60000), 0);
}

// Personal access (name + 4-digit PIN, remembered per device).
//   POST {action:"begin", name}          → does this name have a PIN yet? locked?
//   POST {action:"create", name, pin}    → first PIN → token
//   POST {action:"login", name, pin}     → token
//   POST {action:"logout"}  (x-staff-token)
//   POST {action:"ackRules", email, version} (x-staff-token) → House Rules read & acknowledged (once per version)
//   GET  ?action=who                      (x-staff-token) → {name}
//   GET  ?action=hours&week=YYYY-MM-DD    (x-staff-token, or manager + &name=) → Toast clock-ins of that week
//   GET  ?action=recap&week=YYYY-MM-DD    (x-staff-token) → that week vs the week before (for the encouraging weekly review)
//   GET  ?action=list                     (manager) → who has a PIN / how many devices
//   POST {action:"reset", name}           (manager) → clear PIN + sign out everywhere
module.exports = async (req, res) => {
  try {
    if (!store.hasStorage()) return send(res, 503, { error: "storage_missing" });
    const url = new URL(req.url, "http://x");
    const body = req.body || {};
    const action = req.method === "GET" ? (url.searchParams.get("action") || "who") : String(body.action || "");
    const isAdmin = auth.adminEnabled() && auth.checkPassword(auth.passwordFrom(req));

    if (req.method === "GET") {
      const doc = await store.getSchedule();
      if (action === "list") {
        if (!isAdmin) return send(res, 401, { error: "unauthorized" });
        const [summary, acks] = await Promise.all([accounts.summary(), accounts.allRulesAck().catch(() => ({}))]);
        Object.keys(acks).forEach((n) => { summary[n] = summary[n] || { pin: false, devices: 0 }; summary[n].rules = { version: acks[n].version, at: acks[n].at, email: acks[n].email }; });
        return send(res, 200, { accounts: summary });
      }
      // Who is on this device? (also used by "hours" below)
      let name = await accounts.whoIs(tokenFrom(req), doc.data.staff);
      if (action === "who") {
        if (!name) return send(res, 401, { error: "unauthorized" });
        const ack = await accounts.getRulesAck(name).catch(() => null);
        return send(res, 200, { name, rulesAck: ack ? { version: ack.version, at: ack.at } : null });
      }
      if (action === "hours") {
        const asked = String(url.searchParams.get("name") || "");
        if (isAdmin && asked) name = doc.data.staff.includes(asked) ? asked : null;
        if (!name) return send(res, 401, { error: "unauthorized" });
        const week = String(url.searchParams.get("week") || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return send(res, 400, { error: "bad_week" });
        if (!toast.enabled()) return send(res, 200, { name, week, toast: false, linked: false, entries: [] });
        const emps = await toast.employees(true);
        const map = toast.autoMap(doc.data.staff, doc.data.toastMap, emps);
        const guid = map[name];
        if (!guid) return send(res, 200, { name, week, toast: true, linked: false, entries: [] });
        const entries = await toast.weekEntriesFor(guid, week);
        return send(res, 200, { name, week, toast: true, linked: true, entries, workedMinutes: Math.round(sumMinutes(entries)), fetchedAt: new Date().toISOString() });
      }
      // Personal week in review: last completed week vs the one before (hours, punctuality, early/late minutes).
      if (action === "recap") {
        if (!name) return send(res, 401, { error: "unauthorized" });
        const week = String(url.searchParams.get("week") || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return send(res, 400, { error: "bad_week" });
        const [wy, wm, wd] = week.split("-").map(Number);
        const prevISO = new Date(Date.UTC(wy, wm - 1, wd - 7)).toISOString().slice(0, 10);
        let guid = null;
        if (toast.enabled()) { const emps = await toast.employees(true); guid = toast.autoMap(doc.data.staff, doc.data.toastMap, emps)[name] || null; }
        const [cur, prev] = await Promise.all([weekSummary(doc.data, name, guid, week), weekSummary(doc.data, name, guid, prevISO)]);
        return send(res, 200, { name, week, prevWeek: prevISO, linked: Boolean(guid), cur, prev });
      }
      return send(res, 400, { error: "bad_action" });
    }

    if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return send(res, 405, { error: "method_not_allowed" }); }

    if (action === "logout") { await accounts.logout(tokenFrom(req)); return send(res, 200, { ok: true }); }

    // House Rules read & acknowledged (once per version). Recorded with the email the person typed, the time, and the device.
    if (action === "ackRules") {
      const doc0 = await store.getSchedule();
      const who = await accounts.whoIs(tokenFrom(req), doc0.data.staff);
      if (!who) return send(res, 401, { error: "unauthorized" });
      const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
      const version = String(body.version || "").trim().slice(0, 20);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !/^\d{4}-\d{2}-\d{2}$/.test(version)) return send(res, 400, { error: "bad_request" });
      const at = new Date().toISOString();
      await accounts.setRulesAck(who, { version, email, at, ua: String(req.headers["user-agent"] || "").slice(0, 160) });
      await store.appendLog({ at, version: null, changes: [`House Rules ${version} acknowledged by ${who} (${email})`] }).catch(() => {});
      return send(res, 200, { ok: true, rulesAck: { version, at } });
    }

    if (action === "reset") {
      if (!isAdmin) return send(res, 401, { error: "unauthorized" });
      const name = String(body.name || "").trim().slice(0, 60);
      if (!name) return send(res, 400, { error: "bad_request" });
      const devices = await accounts.resetPin(name);
      await store.appendLog({ at: new Date().toISOString(), version: null, changes: [`Staff: PIN reset for ${name}`] }).catch(() => {});
      return send(res, 200, { ok: true, devices });
    }

    // Everything below is a person acting on their own name.
    const doc = await store.getSchedule();
    const name = String(body.name || "").trim().slice(0, 60);
    if (!name || !doc.data.staff.includes(name)) return send(res, 404, { error: "unknown_name" });
    const ua = req.headers["user-agent"];

    if (action === "begin") {
      const rec = await accounts.getPinRecord(name);
      const lock = accounts.lockInfo(rec);
      return send(res, 200, { name, hasPin: Boolean(rec), locked: lock.locked, retryIn: lock.retryIn });
    }
    // Small fixed delay blunts guessing without hurting a real login.
    await new Promise((r) => setTimeout(r, 350));
    if (action === "create") {
      const r = await accounts.createPin(name, body.pin, ua);
      if (r.error === "bad_pin") return send(res, 400, { error: "bad_pin" });
      if (r.error === "pin_exists") return send(res, 409, { error: "pin_exists" });
      return send(res, 200, { ok: true, name, token: r.token });
    }
    if (action === "login") {
      const r = await accounts.login(name, body.pin, ua);
      if (r.error === "no_pin") return send(res, 404, { error: "no_pin" });
      if (r.error === "bad_pin") return send(res, 400, { error: "bad_pin" });
      if (r.error === "locked") return send(res, 423, { error: "locked", retryIn: r.retryIn });
      if (r.error === "wrong_pin") return send(res, 401, { error: "wrong_pin", attemptsLeft: r.attemptsLeft });
      return send(res, 200, { ok: true, name, token: r.token });
    }
    return send(res, 400, { error: "bad_action" });
  } catch (err) {
    return send(res, 500, { error: "server_error", detail: String(err && err.message || err) });
  }
};
