const store = require("../lib/store");
const auth = require("../lib/auth");
const toast = require("../lib/toast");
const punch = require("../lib/punch");

function todayNY() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()); }

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}

// GET ?action=status               → is Toast connected / reachable
// GET ?action=today[&date=YYYY-MM-DD] → clock in/out for mapped staff (public, cached 60s)
// GET ?action=clock[&date=YYYY-MM-DD] → public time clock: everyone who punched that day
// GET ?action=mystats[&period=] (x-staff-token, or manager + &name=) → one person's own stats + team totals
// GET ?action=leaderboard[&period=] (manager) → full ranking
// GET ?action=employees (manager)  → Toast employee list, to map names
module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return send(res, 405, { error: "method_not_allowed" }); }
    if (!toast.enabled()) return send(res, 503, { error: "toast_disabled" });
    const url = new URL(req.url, "http://x");
    const action = url.searchParams.get("action") || "status";

    if (action === "status") {
      try { const r = await toast.restaurant(); const all = await toast.employees(true); const active = all.filter((e) => !e.archived); const jobs = await toast.jobs().catch((e) => ({ error: String(e && e.message || e).slice(0, 120) })); return send(res, 200, { ok: true, restaurant: r, employees: active.length, archived: all.length - active.length, names: active.map((e) => e.name), jobs: active.map((e) => ({ name: e.name, jobs: e.jobs || [], salaried: !!e.salaried })), jobTitles: jobs }); }
      catch (e) { return send(res, 200, { ok: false, error: String(e.message || e) }); }
    }
    if (action === "employees") {
      if (!auth.checkPassword(auth.passwordFrom(req))) return send(res, 401, { error: "unauthorized" });
      const emps = await toast.employees(true);
      return send(res, 200, { employees: emps.filter((e) => !/^test\b/i.test(e.name)).sort((a, b) => a.name.localeCompare(b.name)) });
    }
    if (action === "today") {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") || "") ? url.searchParams.get("date") : todayNY();
      const [doc, emps] = await Promise.all([store.getSchedule(), toast.employees(true)]);
      const map = toast.autoMap(doc.data.staff, doc.data.toastMap, emps);
      const status = await toast.dayStatus(date, map);
      // people who clock in from the app (not in Toast) join the same day view
      const b = toast.dayBounds(date);
      for (const n of await punch.appClockNames(doc.data)) { const l = await punch.between(n, b.start, b.end).catch(() => []); if (l.length) status.byName[n] = l.map((e) => ({ in: e.in, out: e.out, breakMin: e.breakMin, breakStart: e.breakStart })); }
      return send(res, 200, status);
    }
    // Public time clock: everyone who punched in on that day (Toast names), newest day first. Last 31 days only.
    if (action === "clock") {
      const today = todayNY();
      let date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") || "") ? url.searchParams.get("date") : today;
      if (date > today) date = today;
      const ageDays = Math.round((Date.parse(today) - Date.parse(date)) / 86400000);
      if (ageDays > 31) return send(res, 400, { error: "too_old" });
      const b = toast.dayBounds(date);
      const [entries, emps, doc] = await Promise.all([toast.timeEntriesDay(date), toast.employees(true), store.getSchedule()]);
      const byGuid = Object.fromEntries(emps.map((e) => [e.guid, e]));
      // Prefer the short name used on the schedule when it is linked (Joe rather than Joseph Ricciardi).
      const map = toast.autoMap(doc.data.staff, doc.data.toastMap, emps);
      const guidToShort = {}; Object.keys(map).forEach((n) => { guidToShort[map[n]] = n; });
      const list = entries
        .filter((t) => byGuid[t.employeeGuid] && !/^test\b/i.test(byGuid[t.employeeGuid].name))
        .map((t) => ({ name: guidToShort[t.employeeGuid] || byGuid[t.employeeGuid].name, full: byGuid[t.employeeGuid].name, in: t.in, out: t.out }));
      for (const n of await punch.appClockNames(doc.data)) { const l = await punch.between(n, b.start, b.end).catch(() => []); l.forEach((e) => list.push({ name: n, full: n, in: e.in, out: e.out, app: true, breakMin: e.breakMin, breakStart: e.breakStart })); }
      list.sort((a, b) => String(a.in).localeCompare(String(b.in)));
      return send(res, 200, { date, today, entries: list, fetchedAt: new Date().toISOString() });
    }
    // Ranking of the whole team — MANAGER ONLY (the owner/manager use it privately; staff never see comparisons).
    if (action === "leaderboard") {
      const role = await auth.roleFrom(req);
      if (!role) return send(res, 401, { error: "unauthorized" });
      const lb = require("../lib/leaderboard");
      const period = url.searchParams.get("period") || "week";
      const full = await lb.leaderboard(period);
      if (role === "chef") { const k = new Set(auth.kitchenNames((await store.getSchedule()).data)); full.rows = (full.rows || []).filter((r) => k.has(r.name)); full.scope = "kitchen"; } // the chef ranks the kitchen only
      return send(res, 200, full);
    }
    // Personal stats — public, but returns ONLY that person's numbers plus anonymous team totals.
    if (action === "mystats") {
      const lb = require("../lib/leaderboard");
      const period = url.searchParams.get("period") || "week";
      // Identity comes from the person's PIN login (x-staff-token); the manager may look at anyone with &name=.
      const accounts = require("../lib/accounts");
      const doc = await store.getSchedule();
      const asked = String(url.searchParams.get("name") || "").trim().slice(0, 60);
      let name = await accounts.whoIs(req.headers["x-staff-token"], doc.data.staff);
      if (asked) { const role = await auth.roleFrom(req); if (auth.isManagerish(role) || (role === "chef" && auth.kitchenNames(doc.data).includes(asked))) name = asked; }
      if (!name) return send(res, 401, { error: "unauthorized" });
      const full = await lb.leaderboard(period);
      const me = full.rows.find((r) => r.name === name);
      if (!me) return send(res, 404, { error: "unknown_name" });
      const active = full.rows.filter((r) => r.shifts > 0);
      const team = {
        people: active.length,
        msClosed: active.reduce((a, r) => a + r.msClosed, 0),
        openNow: active.filter((r) => r.openSince).map((r) => r.openSince),
        onTimePct: (() => { const m = active.filter((r) => r.onTimePct != null); return m.length ? Math.round(m.reduce((a, r) => a + r.onTimePct, 0) / m.length) : null; })(),
        shifts: active.reduce((a, r) => a + r.shifts, 0),
      };
      const { rank, prevRank, points, ...mine } = me; // never expose rank/points
      return send(res, 200, { period: full.period, start: full.start, end: full.end, grace: full.grace, me: mine, team, fetchedAt: full.fetchedAt });
    }
    if (action === "who") {
      if (!auth.checkPassword(auth.passwordFrom(req))) return send(res, 401, { error: "unauthorized" });
      const date = todayNY();
      const b = toast.dayBounds(date); const entries = await toast.timeEntries(b.start, b.end); const emps = await toast.employees(true);
      const byGuid = Object.fromEntries(emps.map((e) => [e.guid, e]));
      return send(res, 200, { date, entries: entries.map((t) => ({ name: (byGuid[t.employeeGuid] || {}).name || "(unknown " + t.employeeGuid + ")", in: t.in, out: t.out })) });
    }
    return send(res, 400, { error: "bad_action" });
  } catch (err) {
    return send(res, 500, { error: "server_error", detail: String(err && err.message || err) });
  }
};
