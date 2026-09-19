// Past weeks from Toast: for every clock-in already recorded in Toast (bar day, person), create in the schedule the
// week (if missing) and the person's shift with the ACTUAL clock-in/out times, marked src:"toast". Only past weeks,
// only where a clock-in exists, never over a shift already there. Idempotent: run it again any time, nothing doubles.
const store = require("./store");
const toast = require("./toast");
const former = require("./former");

const TZ = "America/New_York";
function nyHM(iso) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t) => (p.find((x) => x.type === t) || {}).value;
  return `${String(Number(g("hour")) % 24).padStart(2, "0")}:${g("minute")}`;
}
function mondayOf(dateISO) { const d = new Date(dateISO + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

async function backfillFromToast(doc, fromISO) {
  if (!toast.enabled()) return { error: "toast_disabled" };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const thisMonday = mondayOf(today);
  const emps = await toast.employees(true);
  // guid → name: explicit links first, then safe fuzzy matches, then people no longer on staff (former register)
  const map = toast.autoMap(doc.data.staff, doc.data.toastMap, emps);
  const guidToName = {}; Object.keys(map).forEach((n) => { if (map[n]) guidToName[map[n]] = n; });
  (await former.all().catch(() => [])).forEach((f) => { if (f.guid && !guidToName[f.guid]) guidToName[f.guid] = f.name; });
  const data = doc.data; const created = new Set(); let added = 0, seen = 0, skippedOpen = 0, unknown = new Set();
  { // one pass over the whole span, in chunks Toast accepts
    const lastDay = new Date(thisMonday + "T12:00:00Z"); lastDay.setUTCDate(lastDay.getUTCDate() - 1);
    const entries = await toast.timeEntriesSpan(fromISO, lastDay.toISOString().slice(0, 10), 300);
    entries.forEach((t) => {
      if (!t.in) return; seen++;
      const name = guidToName[t.employeeGuid]; if (!name) { unknown.add(t.employeeGuid); return; }
      if (!t.out) { skippedOpen++; return; } // still open: nothing to write
      const date = toast.shiftDate(t.in); const wk = mondayOf(date);
      if (wk >= thisMonday) return; // this week and the future are scheduled by hand
      const dayKey = DAYS[Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(wk + "T12:00:00Z")) / 86400000)];
      if (!data.weeks[wk]) { data.weeks[wk] = { notes: {} }; DAYS.forEach((d) => (data.weeks[wk][d] = [])); created.add(wk); }
      const list = data.weeks[wk][dayKey];
      const id = "t-" + String(t.guid).replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
      if (list.some((s) => s.id === id)) return; // this very clock-in is already there
      if (list.some((s) => s.name === name && s.src !== "toast")) return; // a shift written by the manager wins
      list.push({ id, name, station: "", start: nyHM(t.in), end: nyHM(t.out), src: "toast" });
      added++;
    });
  }
  if (!added) return { added: 0, weeks: [], seen, skippedOpen, unknown: unknown.size, doc };
  const next = { version: (doc.version || 0) + 1, data: store.normalizeData(data), updatedAt: new Date().toISOString() };
  await store.saveSchedule(next);
  await store.appendLog({ at: next.updatedAt, version: next.version, changes: [`Past weeks from Toast: ${added} clock-ins added as shifts${created.size ? ` in ${created.size} new week${created.size === 1 ? "" : "s"} (${[...created].sort().join(", ")})` : ""}`] }).catch(() => {});
  return { added, weeks: [...created].sort(), seen, skippedOpen, unknown: unknown.size, doc: Object.assign({}, doc, next) };
}

module.exports = { backfillFromToast };
