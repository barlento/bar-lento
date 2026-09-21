// App time clock — ONLY for people the manager marked "clocks in from the app" (data.appClock), i.e. people who do not
// exist in Toast (a temporary job). Everyone else clocks in on the Toast terminal and this file never touches them.
// One open entry per person; entries are never edited or deleted; removing the person archives them (legal record).
const store = require("./store");
const toast = require("./toast");

const safe = (n) => String(n || "").replace(/[^A-Za-z0-9 ._-]/g, "").slice(0, 60);
const KEY = (name) => "barlento:punch:" + safe(name);
const ARCHIVE_KEY = "barlento:punch_archive";
const redis = (...cmd) => store._redis(...cmd);

// Who clocks in from the app (owner's rules 2026-09-19): everyone on staff who is NOT linked to a Toast employee
// (people added by hand, temporary jobs, e.g. Pietro), and everyone whose Toast job is SALARIED (Owner, Floor Manager,
// Executive Chef… — they never clock in on the terminal), plus the explicit list (data.appClock). Hourly Toast people
// never. If Toast cannot be reached, only the explicit list counts, so nobody on Toast ever gets a clock button by accident.
async function appClockNames(data) {
  const set = new Set(Array.isArray(data.appClock) ? data.appClock : []);
  if (toast.enabled()) {
    try { const emps = await toast.employees(true); const map = toast.autoMap(data.staff, data.toastMap, emps); const byGuid = Object.fromEntries(emps.map((e) => [e.guid, e])); (data.staff || []).forEach((n) => { if (!map[n]) set.add(n); else if (byGuid[map[n]] && byGuid[map[n]].salaried && (data.dept || {})[n] !== "owner") set.add(n); }); } catch (e) {} // the owner never clocks in (owner's rule 2026-09-20)
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

// Breaks (owner 2026-09-21): while clocked in a person can start a break and come back; breaks live inside the open
// entry as breaks:[{start, end}], are unpaid and subtracted from the hours. A break still open at clock-out ends at the
// clock-out time and is marked auto. Nothing is ever edited afterwards.
function openBreak(e) { return ((e && e.breaks) || []).find((b) => b && b.start && !b.end) || null; }
function breakMinutes(e, now) {
  const t = now || Date.now();
  return ((e && e.breaks) || []).reduce((s, b) => { if (!b || !b.start) return s; const end = b.end ? Date.parse(b.end) : (e.out ? Date.parse(e.out) : t); return s + Math.max(0, (end - Date.parse(b.start)) / 60000); }, 0);
}
// What the app shows: the entry plus breakMin (minutes on break so far) and breakStart while a break is open.
function closedBreakMinutes(e) { return ((e && e.breaks) || []).reduce((s, b) => (b && b.start && (b.end || e.out) ? s + Math.max(0, (Date.parse(b.end || e.out) - Date.parse(b.start)) / 60000) : s), 0); }
// breakMin = minutes of the breaks already over; a break still running is only breakStart (whoever shows it adds now − breakStart)
function view(e, now) {
  if (!e) return e; const ob = openBreak(e);
  return Object.assign({}, e, { breakMin: Math.round(closedBreakMinutes(e)), breakStart: ob && !e.out ? ob.start : undefined, breaks: (e.breaks || []).map((b) => ({ start: b.start, end: b.end || e.out || null, auto: b.auto })) });
}

// Clock in: refused if already in. Clock out: refused if not in. Never throws for business reasons — returns {error}.
async function punch(name, on, ua) {
  const now = new Date().toISOString();
  const open = await openEntry(name);
  if (on) {
    if (open) return { error: "already_in", entry: view(open) };
    const entry = { id: now, in: now, out: null, inUa: String(ua || "").slice(0, 120) };
    await redis("HSET", KEY(name), entry.id, JSON.stringify(entry));
    return { entry: view(entry) };
  }
  if (!open) return { error: "not_in" };
  // A shift longer than 20 hours is a forgotten clock-out: close it 20 h after the clock-in and mark it.
  const maxOut = new Date(Date.parse(open.in) + 20 * 3600000).toISOString();
  const out = now <= maxOut ? now : maxOut;
  const breaks = (open.breaks || []).map((b) => (b.end ? b : Object.assign({}, b, { end: out, auto: true }))); // an open break ends with the shift
  const entry = Object.assign({}, open, { out, outUa: String(ua || "").slice(0, 120), auto: now > maxOut ? true : undefined, breaks: breaks.length ? breaks : undefined });
  await redis("HSET", KEY(name), entry.id, JSON.stringify(entry));
  return { entry: view(entry) };
}
// Break: start (on=true) or end (on=false). Needs an open entry; one open break at a time.
async function pause(name, on, ua) {
  const now = new Date().toISOString();
  const open = await openEntry(name);
  if (!open) return { error: "not_in" };
  const breaks = (open.breaks || []).slice(); const ob = openBreak(open);
  if (on) { if (ob) return { error: "on_break", entry: view(open) }; breaks.push({ start: now, end: null, ua: String(ua || "").slice(0, 120) }); }
  else { if (!ob) return { error: "not_on_break", entry: view(open) }; breaks[breaks.indexOf(ob)] = Object.assign({}, ob, { end: now }); }
  const entry = Object.assign({}, open, { breaks });
  await redis("HSET", KEY(name), entry.id, JSON.stringify(entry));
  return { entry: view(entry) };
}

// Entries whose clock-in falls in [startISO, endISO) — same shape as the Toast ones ({in, out}).
async function between(name, startISO, endISO) {
  return (await all(name)).filter((e) => e.in >= startISO && e.in < endISO).map((e) => view(e));
}
// One schedule week (Mon..Sun, bar nights included): [{day, date, in, out}] like toast.weekEntriesFor.
async function weekEntries(name, weekISO) {
  const [y, m, d] = weekISO.split("-").map(Number);
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
  const start = toast.dayBounds(days[0]).start, end = toast.dayBounds(days[6]).end;
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  return (await between(name, start, end)).map((e) => { const date = toast.shiftDate(e.in); const i = days.indexOf(date); return i < 0 ? null : { day: DAYS[i], date, in: e.in, out: e.out, auto: e.auto, breakMin: e.breakMin, breakStart: e.breakStart }; }).filter(Boolean);
}
// One calendar month (bar days), for the manager's list and the person's own record.
async function month(name, ym) {
  return (await all(name)).filter((e) => toast.shiftDate(e.in).slice(0, 7) === ym).map((e) => Object.assign({ date: toast.shiftDate(e.in) }, view(e)));
}
// Minutes worked = clock-in → clock-out (or now) minus the breaks.
function minutes(entries, now) {
  const t = now || Date.now();
  const brk = (e) => (typeof e.breakMin === "number" ? e.breakMin + (!e.out && e.breakStart ? Math.max(0, (t - Date.parse(e.breakStart)) / 60000) : 0) : breakMinutes(e, t));
  return entries.reduce((s, e) => s + Math.max(0, (Date.parse(e.out || new Date(t).toISOString()) - Date.parse(e.in)) / 60000 - brk(e)), 0);
}
// Removing a person from staff: their clock-ins move to the archive (never deleted).
async function archive(names) {
  for (const n of names || []) {
    const l = await all(n);
    for (const e of l) await redis("HSET", ARCHIVE_KEY, n + " @ " + e.id, JSON.stringify(Object.assign({ name: n, removedAt: new Date().toISOString() }, e))).catch(() => {});
    if (l.length) await redis("DEL", KEY(n)).catch(() => {});
  }
}

// Archived clock-ins of a person no longer on staff (for the personnel record).
async function archivedFor(name) {
  const flat = await redis("HGETALL", ARCHIVE_KEY).catch(() => []);
  const out = [];
  for (let i = 0; i + 1 < (flat || []).length; i += 2) { try { const e = JSON.parse(flat[i + 1]); if (e && e.name === name && e.in) out.push(e); } catch (e) {} }
  return out.sort((a, b) => String(a.in).localeCompare(String(b.in)));
}
module.exports = { isAppClock, appClockNames, archivedFor, all, openEntry, punch, pause, view, breakMinutes, between, weekEntries, month, minutes, archive };
