// App time clock — ONLY for people the manager marked "clocks in from the app" (data.appClock), i.e. people who do not
// exist in Toast (a temporary job). Everyone else clocks in on the Toast terminal and this file never touches them.
// One open entry per person; entries are never edited or deleted; removing the person archives them (legal record).
const store = require("./store");
const toast = require("./toast");

const safe = (n) => String(n || "").replace(/[^A-Za-z0-9 ._-]/g, "").slice(0, 60);
const KEY = (name) => "barlento:punch:" + safe(name);
const ARCHIVE_KEY = "barlento:punch_archive";
const redis = (...cmd) => store._redis(...cmd);

// Who clocks in from the app: everyone on staff who is NOT linked to a Toast employee (people added by hand,
// temporary jobs). Toast people never. If Toast cannot be reached, only the explicit list (data.appClock) counts,
// so nobody on Toast ever gets a clock button by accident.
async function appClockNames(data) {
  const set = new Set(Array.isArray(data.appClock) ? data.appClock : []);
  if (toast.enabled()) {
    try { const emps = await toast.employees(true); const map = toast.autoMap(data.staff, data.toastMap, emps); (data.staff || []).forEach((n) => { if (!map[n]) set.add(n); }); } catch (e) {}
  }
  return set;
}
async function isAppClock(data, name) { return (await appClockNames(data)).has(name); }

async function all(name) {
  const flat = await redis("HGETALL", KEY(name)).catch(() => []);
  const out = [];
  for (let i = 0; i + 1 < (flat || []).length; i += 2) { try { out.push(JSON.parse(flat[i + 1])); } catch (e) {} }
  return out.filter((e) => e && e.in).sort((a, b) => String(a.in).localeCompare(String(b.in)));
}
async function openEntry(name) { const l = await all(name); return l.find((e) => !e.out) || null; }

// Clock in: refused if already in. Clock out: refused if not in. Never throws for business reasons — returns {error}.
async function punch(name, on, ua) {
  const now = new Date().toISOString();
  const open = await openEntry(name);
  if (on) {
    if (open) return { error: "already_in", entry: open };
    const entry = { id: now, in: now, out: null, inUa: String(ua || "").slice(0, 120) };
    await redis("HSET", KEY(name), entry.id, JSON.stringify(entry));
    return { entry };
  }
  if (!open) return { error: "not_in" };
  // A shift longer than 20 hours is a forgotten clock-out: close it 20 h after the clock-in and mark it.
  const maxOut = new Date(Date.parse(open.in) + 20 * 3600000).toISOString();
  const entry = Object.assign({}, open, { out: now <= maxOut ? now : maxOut, outUa: String(ua || "").slice(0, 120), auto: now > maxOut ? true : undefined });
  await redis("HSET", KEY(name), entry.id, JSON.stringify(entry));
  return { entry };
}

// Entries whose clock-in falls in [startISO, endISO) — same shape as the Toast ones ({in, out}).
async function between(name, startISO, endISO) {
  return (await all(name)).filter((e) => e.in >= startISO && e.in < endISO);
}
// One schedule week (Mon..Sun, bar nights included): [{day, date, in, out}] like toast.weekEntriesFor.
async function weekEntries(name, weekISO) {
  const [y, m, d] = weekISO.split("-").map(Number);
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
  const start = toast.dayBounds(days[0]).start, end = toast.dayBounds(days[6]).end;
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  return (await between(name, start, end)).map((e) => { const date = toast.shiftDate(e.in); const i = days.indexOf(date); return i < 0 ? null : { day: DAYS[i], date, in: e.in, out: e.out, auto: e.auto }; }).filter(Boolean);
}
// One calendar month (bar days), for the manager's list and the person's own record.
async function month(name, ym) {
  return (await all(name)).filter((e) => toast.shiftDate(e.in).slice(0, 7) === ym).map((e) => Object.assign({ date: toast.shiftDate(e.in) }, e));
}
function minutes(entries, now) {
  const t = now || Date.now();
  return entries.reduce((s, e) => s + Math.max(0, (Date.parse(e.out || new Date(t).toISOString()) - Date.parse(e.in)) / 60000), 0);
}
// Removing a person from staff: their clock-ins move to the archive (never deleted).
async function archive(names) {
  for (const n of names || []) {
    const l = await all(n);
    for (const e of l) await redis("HSET", ARCHIVE_KEY, n + " @ " + e.id, JSON.stringify(Object.assign({ name: n, removedAt: new Date().toISOString() }, e))).catch(() => {});
    if (l.length) await redis("DEL", KEY(n)).catch(() => {});
  }
}

module.exports = { isAppClock, appClockNames, all, openEntry, punch, between, weekEntries, month, minutes, archive };
