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
function sumMinutes(list) {
  return list.reduce((a, s) => a + Math.max(0, (Date.parse(s.out || new Date().toISOString()) - Date.parse(s.in)) / 60000), 0);
}

// Personal access (name + 4-digit PIN, remembered per device).
//   POST {action:"begin", name}          → does this name have a PIN yet? locked?
//   POST {action:"create", name, pin}    → first PIN → token
//   POST {action:"login", name, pin}     → token
//   POST {action:"logout"}  (x-staff-token)
//   GET  ?action=who                      (x-staff-token) → {name}
//   GET  ?action=hours&week=YYYY-MM-DD    (x-staff-token, or manager + &name=) → Toast clock-ins of that week
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
        return send(res, 200, { accounts: await accounts.summary() });
      }
      // Who is on this device? (also used by "hours" below)
      let name = await accounts.whoIs(tokenFrom(req), doc.data.staff);
      if (action === "who") {
        if (!name) return send(res, 401, { error: "unauthorized" });
        return send(res, 200, { name });
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
      return send(res, 400, { error: "bad_action" });
    }

    if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return send(res, 405, { error: "method_not_allowed" }); }

    if (action === "logout") { await accounts.logout(tokenFrom(req)); return send(res, 200, { ok: true }); }

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
