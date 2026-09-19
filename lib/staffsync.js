// Staff follows Toast: every active Toast employee becomes a person in the app by themselves
// (first name, exact guid link, so their Toast email prefills the signature). Nobody types names twice.
// Runs on GET /api/data, at most once every 10 minutes, never while the manager is editing.
const store = require("./store");
const toast = require("./toast");
const accounts = require("./accounts");
const punch = require("./punch");
const former = require("./former");

const SYNC_KEY = "barlento:toast:sync_at";
const EVERY_MS = 10 * 60000;
const QUIET_MS = 90 * 1000; // a save in the last 90 s = the manager is editing: wait

function cap(s) { s = String(s || "").trim(); return s ? s[0].toUpperCase() + s.slice(1) : ""; }

// Pick the name staff will see: first name; "First L." if that first name is already taken; full name as a last resort.
function displayName(e, taken) {
  const first = cap(e.first) || cap(e.name.split(/\s+/)[0]);
  if (!first) return null;
  const has = (n) => taken.some((t) => t.toLowerCase() === n.toLowerCase());
  if (!has(first)) return first;
  const initial = cap(e.last)[0];
  if (initial && !has(first + " " + initial + ".")) return first + " " + initial + ".";
  const full = cap(e.first) + " " + cap(e.last);
  return has(full) ? null : full;
}

async function syncFromToast(doc, opts) {
  opts = opts || {};
  if (!toast.enabled() || !store.hasStorage()) return { added: [], doc };
  if (!opts.force) {
    const last = Number(await store._redis("GET", SYNC_KEY).catch(() => 0)) || 0;
    if (Date.now() - last < EVERY_MS) return { added: [], doc };
  }
  if (!opts.now && doc.updatedAt && Date.now() - Date.parse(doc.updatedAt) < QUIET_MS) return { added: [], doc };
  await store._redis("SET", SYNC_KEY, String(Date.now())).catch(() => {});
  const emps = await toast.employees(false, !!opts.force);
  if (!emps.length) return { added: [], doc };
  const data = doc.data;
  const ignore = new Set(data.toastIgnore || []);
  const map = toast.autoMap(data.staff, data.toastMap, emps); // explicit links + safe fuzzy matches of existing names
  Object.keys(map).forEach((n) => { if (!data.staff.includes(n)) delete map[n]; }); // links of people no longer here
  const linked = new Set(Object.values(map));
  // Two Toast employees with the same first name as an existing, still unlinked person (a new hire who shares
  // a name with someone already here): the older Toast record is the person already on staff.
  const blocked = new Set();
  data.staff.forEach((n) => {
    if (map[n]) return;
    const hits = emps.filter((e) => !linked.has(e.guid) && (toast.firstMatches(n.split(/\s+/)[0], e.first) || toast.firstMatches(n, e.name)));
    if (hits.length < 2) return;
    const dated = hits.filter((e) => e.created).sort((a, b) => String(a.created).localeCompare(String(b.created)));
    if (dated.length === hits.length) { map[n] = dated[0].guid; linked.add(dated[0].guid); }
    else hits.forEach((e) => blocked.add(e.guid)); // cannot tell who is who: add nobody rather than a duplicate
  });
  const added = [];
  emps.forEach((e) => {
    if (linked.has(e.guid) || ignore.has(e.guid) || blocked.has(e.guid)) return;
    if (/^test\b/i.test(e.name) || /^test\b/i.test(e.first)) return; // Toast test accounts never become people
    if (data.staff.length >= 80) return;
    const name = displayName(e, data.staff);
    if (!name) return;
    data.staff.push(name); map[name] = e.guid; linked.add(e.guid);
    added.push({ name, fullName: e.name, email: e.email });
  });
  // Archived in Toast → gone from the app too (only people with an explicit Toast link; people added by hand are
  // managed in the app only). Same as the manager's Remove: upcoming shifts deleted, past weeks untouched,
  // access closed, signatures and clock-ins archived. Not put on the ignore list: if Toast re-activates them, they come back.
  const removed = [];
  try {
    const all = await toast.employees(true);
    const byGuid = Object.fromEntries(all.map((e) => [e.guid, e]));
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
    const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    data.staff.slice().forEach((n) => {
      const g = map[n]; const e = g && byGuid[g];
      if (!e || !e.archived) return; // a guid missing from the list is never a reason to remove anyone (partial answer, glitch)
      let shifts = 0;
      Object.keys(data.weeks || {}).forEach((wk) => {
        DAYS.forEach((d, i) => {
          const date = new Date(Date.UTC(Number(wk.slice(0, 4)), Number(wk.slice(5, 7)) - 1, Number(wk.slice(8, 10)) + i)).toISOString().slice(0, 10);
          if (date < today || !Array.isArray(data.weeks[wk][d])) return;
          const before = data.weeks[wk][d].length;
          data.weeks[wk][d] = data.weeks[wk][d].filter((sh) => sh.name !== n);
          shifts += before - data.weeks[wk][d].length;
        });
      });
      data.staff = data.staff.filter((x) => x !== n);
      delete data.birthdays[n]; delete map[n]; if (data.dept) delete data.dept[n]; if (Array.isArray(data.deptManual)) data.deptManual = data.deptManual.filter((x) => x !== n);
      if (Array.isArray(data.appClock)) data.appClock = data.appClock.filter((x) => x !== n);
      removed.push({ name: n, fullName: e.name, email: e.email, guid: g, shifts });
    });
  } catch (err) {}
  // Department from the Toast job titles: follows Toast (a changed job changes the department) except for the people
  // whose department the manager chose by hand in the person sheet (deptManual).
  data.dept = data.dept || {}; const manual = new Set(data.deptManual || []); let deptChanged = false;
  { const byGuid = Object.fromEntries(emps.map((e) => [e.guid, e]));
    data.staff.forEach((n) => { if (manual.has(n)) return; const e = map[n] && byGuid[map[n]]; const d = e && toast.deptOf(e.jobs); if (d && data.dept[n] !== d) { data.dept[n] = d; deptChanged = true; } });
    Object.keys(data.dept).forEach((n) => { if (!data.staff.includes(n)) { delete data.dept[n]; deptChanged = true; } });
    const dm = (data.deptManual || []).filter((n) => data.staff.includes(n)); if (dm.length !== (data.deptManual || []).length) { data.deptManual = dm; deptChanged = true; } }
  const mapChanged = JSON.stringify(map) !== JSON.stringify(data.toastMap || {});
  if (!added.length && !removed.length && !mapChanged && !deptChanged) return { added: [], removed: [], doc };
  data.toastMap = map;
  const next = { version: (doc.version || 0) + 1, data, updatedAt: (added.length || removed.length) ? new Date().toISOString() : doc.updatedAt };
  await store.saveSchedule(next);
  if (removed.length) {
    await store.pruneConfirmations(data).catch(() => {});
    for (const r of removed) await former.note(r.name, { guid: r.guid, fullName: r.fullName, email: r.email, by: "toast" }).catch(() => {});
    await accounts.removeAccounts(removed.map((r) => r.name)).catch(() => {});
    await punch.archive(removed.map((r) => r.name)).catch(() => {});
  }
  const changes = added.map((a) => `Added from Toast: ${a.name} (${a.fullName}${a.email ? " · " + a.email : ""})`)
    .concat(removed.map((r) => `Removed from staff (archived in Toast): ${r.name} (${r.fullName})${r.shifts ? ` — ${r.shifts} upcoming shift${r.shifts === 1 ? "" : "s"} deleted` : ""}`));
  if (changes.length) await store.appendLog({ at: next.updatedAt, version: next.version, changes }).catch(() => {});
  return { added, removed, doc: Object.assign({}, doc, next) };
}

module.exports = { syncFromToast, displayName };
