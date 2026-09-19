// History before the launch = what actually happened (owner's rule 2026-09-19, "niente storico a caso"). Such a day contains ONLY
// real clock-ins: Toast clock-ins for Toast people (src:"toast") and app clock-ins for people who clock in from the
// app (src:"app"), with the actual in/out times. Every planned shift in a past week is replaced (and archived in
// barlento:plan_archive, never lost). Only days before today inside the range are rewritten; today
// (from today on) and the future are always scheduled by hand; days already gone in the current week follow the same
// rule the next morning. Idempotent: run it any time.
// Runs by itself (last 8 weeks, at most once every 6 hours, on GET /api/data) and on the manager's button (12 months).
const store = require("./store");
const toast = require("./toast");
const former = require("./former");
const punch = require("./punch");

const TZ = "America/New_York";
const AUTO_KEY = "barlento:backfill_at:v3"; // bump when the rule changes so the next visit rewrites the past weeks
const AUTO_EVERY_MS = 6 * 3600000;
const AUTO_WEEKS = 8;
const QUIET_MS = 90000; // never while the manager is saving
const PLAN_ARCHIVE = "barlento:plan_archive";
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
// The calendar is Marta's plan (owner's decision 2026-09-19): clock-ins live in the Time clock, My week and the reports,
// never on the schedule. The rewrite below was a one-time emergency for the history BEFORE the launch: it may touch
// only days up to HISTORY_UNTIL. From the day after, no import ever changes a week, and the automatic run stops by itself.
const HISTORY_UNTIL = process.env.BACKFILL_UNTIL || "2026-09-18";

function nyHM(iso) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t) => (p.find((x) => x.type === t) || {}).value;
  return `${String(Number(g("hour")) % 24).padStart(2, "0")}:${g("minute")}`;
}
function mondayOf(dateISO) { const d = new Date(dateISO + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
function addDays(dateISO, n) { const d = new Date(dateISO + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function todayNY() { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); }

async function backfillFromToast(doc, fromISO) {
  if (!toast.enabled()) return { error: "toast_disabled" };
  const today = todayNY(); const thisMonday = mondayOf(today);
  const from = mondayOf(fromISO); // whole weeks only
  const to = [addDays(today, -1), HISTORY_UNTIL].sort()[0]; // history only: never today, never after HISTORY_UNTIL
  const base = { clockIns: 0, added: 0, replaced: 0, weeks: [], seen: 0, skippedOpen: 0, unknown: 0, from, to, firstIn: null, lastIn: null, doc };
  if (from > to) return base;
  const data = doc.data;
  const emps = await toast.employees(true);
  // guid → name: explicit links first, then safe fuzzy matches, then people no longer on staff (former register).
  // People who clock in from the app (or are not in Toast) are never touched.
  const appNames = await punch.appClockNames(data);
  const map = toast.autoMap(data.staff, data.toastMap, emps);
  const guidToName = {}; Object.keys(map).forEach((n) => { if (map[n] && !appNames.has(n)) guidToName[map[n]] = n; });
  (await former.all().catch(() => [])).forEach((f) => { if (f.guid && !guidToName[f.guid] && !(data.staff || []).includes(f.name)) guidToName[f.guid] = f.name; });

  const entries = await toast.timeEntriesSpan(from, to, 300);
  const real = {}; const unknown = new Set(); let seen = 0, skippedOpen = 0, firstIn = null, lastIn = null;
  const place = (name, inISO, outISO, id, src) => {
    const date = toast.shiftDate(inISO); const wk = mondayOf(date);
    if (wk < from || date > to) return;
    if (!firstIn || date < firstIn) firstIn = date; if (!lastIn || date > lastIn) lastIn = date;
    const dayKey = DAYS[Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(wk + "T12:00:00Z")) / 86400000)];
    ((real[wk] = real[wk] || {})[dayKey] = real[wk][dayKey] || []).push({ id, name, station: "", start: nyHM(inISO), end: nyHM(outISO), src });
  };
  entries.forEach((t) => {
    if (!t.in) return; seen++;
    const name = guidToName[t.employeeGuid]; if (!name) { unknown.add(t.employeeGuid); return; }
    if (!t.out) { skippedOpen++; return; } // still open: nothing to write
    place(name, t.in, t.out, "t-" + String(t.guid).replace(/[^A-Za-z0-9]/g, "").slice(0, 12), "toast");
  });
  // people who clock in from the app: their real app clock-ins (current + archived)
  for (const name of appNames) {
    const list = (await punch.all(name).catch(() => [])).concat(await punch.archivedFor(name).catch(() => []));
    list.forEach((e) => { if (e.in && e.out) { seen++; place(name, e.in, e.out, "a-" + String(e.in).replace(/[^0-9]/g, "").slice(0, 14), "app"); } });
  }

  // Rewrite every past week in range: real clock-ins only, every planned shift replaced (archived).
  const created = new Set(); const archived = {}; let clockIns = 0, added = 0, replaced = 0; const changedWeeks = new Set();
  const weekKeys = new Set(Object.keys(data.weeks || {}).filter((wk) => wk >= from && wk <= thisMonday)); Object.keys(real).forEach((wk) => weekKeys.add(wk));
  [...weekKeys].sort().forEach((wk) => {
    if (!data.weeks[wk]) { data.weeks[wk] = { notes: {} }; DAYS.forEach((d) => (data.weeks[wk][d] = [])); created.add(wk); }
    const before = JSON.stringify(data.weeks[wk]);
    DAYS.forEach((d, di) => {
      if (addDays(wk, di) > to) return; // today and the future: the plan, untouched
      const list = data.weeks[wk][d] || [];
      list.filter((s) => !s.src).forEach((s) => { replaced++; archived[`${wk}/${d}/${s.id}`] = JSON.stringify(Object.assign({ week: wk, day: d, archivedAt: new Date().toISOString() }, s)); });
      const news = (real[wk] && real[wk][d]) || []; clockIns += news.length;
      news.forEach((n) => { if (!list.some((s) => s.id === n.id)) added++; });
      data.weeks[wk][d] = news.sort((a, b) => a.start.localeCompare(b.start));
    });
    if (JSON.stringify(data.weeks[wk]) !== before) changedWeeks.add(wk);
  });
  const out = Object.assign(base, { clockIns, added, replaced, weeks: [...created].sort(), seen, skippedOpen, unknown: unknown.size, firstIn, lastIn });
  if (!changedWeeks.size) return out;
  const fields = Object.keys(archived); if (fields.length) await store._redis("HSET", PLAN_ARCHIVE, ...fields.flatMap((k) => [k, archived[k]])).catch(() => {});
  const next = { version: (doc.version || 0) + 1, data: store.normalizeData(data), updatedAt: new Date().toISOString() };
  await store.saveSchedule(next);
  await store.pruneConfirmations(next.data).catch(() => {});
  const line = `Past weeks from Toast: ${clockIns} clock-ins (${firstIn || from} to ${lastIn || to})${added ? `, ${added} new` : ""}${replaced ? `, ${replaced} planned shifts replaced` : ""}${created.size ? `, ${created.size} new week${created.size === 1 ? "" : "s"} (${[...created].sort().join(", ")})` : ""}`;
  await store.appendLog({ at: next.updatedAt, version: next.version, changes: [line] }).catch(() => {});
  return Object.assign(out, { doc: Object.assign({}, doc, next), changed: [...changedWeeks].sort() });
}

// Automatic run on GET /api/data: the last AUTO_WEEKS weeks, at most once per AUTO_EVERY_MS, never while the manager is
// editing. Never throws: the schedule is served as it is if Toast is down.
async function auto(doc, lastManualSave) {
  if (!toast.enabled() || !store.hasStorage()) return doc;
  try {
    const last = Number(await store._redis("GET", AUTO_KEY).catch(() => 0)) || 0;
    if (todayNY() > addDays(HISTORY_UNTIL, 14)) return doc; // the history is settled: nothing left to import
    if (Date.now() - last < AUTO_EVERY_MS) return doc;
    const savedAt = lastManualSave || doc.updatedAt; // the staff sync may have just saved; what matters is the manager's last save
    if (savedAt && Date.now() - Date.parse(savedAt) < QUIET_MS) return doc;
    await store._redis("SET", AUTO_KEY, String(Date.now())).catch(() => {});
    const r = await backfillFromToast(doc, addDays(mondayOf(todayNY()), -7 * AUTO_WEEKS));
    return r && r.doc ? r.doc : doc;
  } catch (e) { return doc; }
}

module.exports = { backfillFromToast, auto, mondayOf };
