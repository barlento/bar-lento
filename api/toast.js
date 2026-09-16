const store = require("../lib/store");
const auth = require("../lib/auth");
const toast = require("../lib/toast");

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}

// GET ?action=status               → is Toast connected / reachable
// GET ?action=today[&date=YYYY-MM-DD] → clock in/out for mapped staff (public, cached 60s)
// GET ?action=employees (manager)  → Toast employee list, to map names
module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return send(res, 405, { error: "method_not_allowed" }); }
    if (!toast.enabled()) return send(res, 503, { error: "toast_disabled" });
    const url = new URL(req.url, "http://x");
    const action = url.searchParams.get("action") || "status";

    if (action === "status") {
      try { const r = await toast.restaurant(); const all = await toast.employees(true); const active = all.filter((e) => !e.archived); return send(res, 200, { ok: true, restaurant: r, employees: active.length, archived: all.length - active.length, names: active.map((e) => e.name) }); }
      catch (e) { return send(res, 200, { ok: false, error: String(e.message || e) }); }
    }
    if (action === "employees") {
      if (!auth.checkPassword(auth.passwordFrom(req))) return send(res, 401, { error: "unauthorized" });
      const emps = await toast.employees(true);
      return send(res, 200, { employees: emps.filter((e) => !/^test\b/i.test(e.name)).sort((a, b) => a.name.localeCompare(b.name)) });
    }
    if (action === "today") {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") || "") ? url.searchParams.get("date") : new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
      const doc = await store.getSchedule();
      const status = await toast.dayStatus(date, doc.data.toastMap || {});
      return send(res, 200, status);
    }
    if (action === "who") {
      if (!auth.checkPassword(auth.passwordFrom(req))) return send(res, 401, { error: "unauthorized" });
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
      const b = toast.dayBounds(date); const entries = await toast.timeEntries(b.start, b.end); const emps = await toast.employees(true);
      const byGuid = Object.fromEntries(emps.map((e) => [e.guid, e]));
      return send(res, 200, { date, entries: entries.map((t) => ({ name: (byGuid[t.employeeGuid] || {}).name || "(unknown " + t.employeeGuid + ")", in: t.in, out: t.out })) });
    }
    return send(res, 400, { error: "bad_action" });
  } catch (err) {
    return send(res, 500, { error: "server_error", detail: String(err && err.message || err) });
  }
};
