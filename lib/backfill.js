// Past weeks = what actually happened (owner's rule 2026-09-19). For every person who clocks in on Toast, a past
// week shows ONLY their real Toast clock-ins (actual in/out times, src:"toast"); the shifts the manager had planned
// for them are replaced (and archived in barlento:plan_archive, never lost). People who clock in from the app or who
// are not in Toast keep their shifts untouched. Only past weeks (before this Monday) inside the range read from
// Toast are rewritten; this week and the future are always scheduled by hand. Idempotent: run it any time.
// Runs by itself (last 8 weeks, at most once every 6 hours, on GET /api/data) and on the manager's button (12 months).
const store = require("./store");
const toast = require("./toast");
const former = require("./former");
const punch = require("./punch");

const TZ = "America/New_York";
const AUTO_KEY = "barlento:backfill_at";
const AUTO_EVERY_MS = 6 * 3600000;
const AUTO_WEEKS = 8;
const QUIET_MS = 90000; // never while the manager is saving
const PLAN_ARCHIVE = "barlento:plan_archive";
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

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
  const thisMonday = mondayOf(todayNY());
  const from = mondayOf(fromISO); // whole weeks only
  const to = addDays(thisMonday, -1);
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
  const toastPeople = new Set(Object.values(guidToName));

  const entries = await toast.timeEntriesSpan(from, to, 300);
  const real = {}; const unknown = new Set(); let seen = 0, skippedOpen = 0, firstIn = null, lastIn = null;
  entries.forEach((t) => {
    if (!t.in) return; seen++;
    const name = guidToName[t.employeeGuid]; if (!name) { unknown.add(t.employeeGuid); return; }
    if (!t.out) { skippedOpen++; return; } // still open: nothing to write
    const date = toast.shiftDate(t.in); const wk = mondayOf(date);
    if (wk < from || wk >= thisMonday) return;
    if (!firstIn || date < firstIn) firstIn = date; if (!lastIn || date > lastIn) lastIn = date;
    const dayKey = DAYS[Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(wk + "T12:00:00Z")) / 86400000)];
    const id = "t-" + String(t.guid).replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
    ((real[wk] = real[wk] || {})[dayKey] = real[wk][dayKey] || []).push({ id, name, station: "", start: nyHM(t.in), end: nyHM(t.out), src: "toast" });
  });

  // Rewrite every past week in range: Toast people = their clock-ins only; everyone else untouched.
  const created = new Set(); const archived = {}; let clockIns = 0, added = 0, replaced = 0; const changedWeeks = new Set();
  const weekKeys = new Set(Object.keys(data.weeks || {}).filter((wk) => wk >= from && wk < thisMonday)); Object.keys(real).forEach((wk) => weekKeys.add(wk));
  [...weekKeys].sort().forEach((wk) => {
    if (!data.weeks[wk]) { data.weeks[wk] = { notes: {} }; DAYS.forEach((d) => (data.weeks[wk][d] = [])); created.add(wk); }
    const before = JSON.stringify(data.weeks[wk]);
    DAYS.forEach((d) => {
      const list = data.weeks[wk][d] || [];
      const keep = list.filter((s) => !toastPeople.has(s.name));
      list.filter((s) => toastPeople.has(s.name) && s.src !== "toast").forEach((s) => { replaced++; archived[`${wk}/${d}/${s.id}`] = JSON.stringify(Object.assign({ week: wk, day: d, archivedAt: new Date().toISOString() }, s)); });
      const news = (real[wk] && real[wk][d]) || []; clockIns += news.length;
      news.forEach((n) => { if (!list.some((s) => s.id === n.id)) added++; });
      data.weeks[wk][d] = keep.concat(news.sort((a, b) => a.start.localeCompare(b.start)));
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
    if (Date.now() - last < AUTO_EVERY_MS) return doc;
    const savedAt = lastManualSave || doc.updatedAt; // the staff sync may have just saved; what matters is the manager's last save
    if (savedAt && Date.now() - Date.parse(savedAt) < QUIET_MS) return doc;
    await store._redis("SET", AUTO_KEY, String(Date.now())).catch(() => {});
    const r = await backfillFromToast(doc, addDays(mondayOf(todayNY()), -7 * AUTO_WEEKS));
    return r && r.doc ? r.doc : doc;
  } catch (e) { return doc; }
}

module.exports = { backfillFromToast, auto, mondayOf };
