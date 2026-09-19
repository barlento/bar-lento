// Staff follows Toast: every active Toast employee becomes a person in the app by themselves
// (first name, exact guid link, so their Toast email prefills the signature). Nobody types names twice.
// Runs on GET /api/data, at most once every 10 minutes, never while the manager is editing.
const store = require("./store");
const toast = require("./toast");

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
    if (doc.updatedAt && Date.now() - Date.parse(doc.updatedAt) < QUIET_MS) return { added: [], doc };
  }
  await store._redis("SET", SYNC_KEY, String(Date.now())).catch(() => {});
  const emps = await toast.employees(false);
  if (!emps.length) return { added: [], doc };
  const data = doc.data;
  const ignore = new Set(data.toastIgnore || []);
  const map = toast.autoMap(data.staff, data.toastMap, emps); // explicit links + safe fuzzy matches of existing names
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
    if (data.staff.length >= 80) return;
    const name = displayName(e, data.staff);
    if (!name) return;
    data.staff.push(name); map[name] = e.guid; linked.add(e.guid);
    added.push({ name, fullName: e.name, email: e.email });
  });
  const mapChanged = JSON.stringify(map) !== JSON.stringify(data.toastMap || {});
  if (!added.length && !mapChanged) return { added: [], doc };
  data.toastMap = map;
  const next = { version: (doc.version || 0) + 1, data, updatedAt: added.length ? new Date().toISOString() : doc.updatedAt };
  await store.saveSchedule(next);
  if (added.length) await store.appendLog({ at: next.updatedAt, version: next.version, changes: added.map((a) => `Added from Toast: ${a.name} (${a.fullName}${a.email ? " · " + a.email : ""})`) }).catch(() => {});
  return { added, doc: Object.assign({}, doc, next) };
}

module.exports = { syncFromToast, displayName };
