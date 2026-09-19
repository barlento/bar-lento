// Toast POS (read-only Standard API Access): employees + time entries (clock in / clock out).
// Env on Vercel: TOAST_CLIENT_ID, TOAST_CLIENT_SECRET, TOAST_RESTAURANT_GUID  (optional: TOAST_API_HOST)
const store = require("./store");

const HOST = (process.env.TOAST_API_HOST || "https://ws-api.toasttab.com").replace(/\/$/, "");
const CLIENT_ID = process.env.TOAST_CLIENT_ID || "";
const CLIENT_SECRET = process.env.TOAST_CLIENT_SECRET || "";
const RESTAURANT_ENV = process.env.TOAST_RESTAURANT_GUID || "";
const TZ = "America/New_York";

const TOKEN_KEY = "barlento:toast:token";
const RESTAURANT_KEY = "barlento:toast:restaurant";
const CACHE_PREFIX = "barlento:toast:cache:";

function enabled() { return Boolean(CLIENT_ID && CLIENT_SECRET); }

async function redis(...cmd) { return store._redis(...cmd); }

async function getToken() {
  const cached = await redis("GET", TOKEN_KEY).catch(() => null);
  if (cached) return cached;
  const res = await fetch(`${HOST}/authentication/v1/authentication/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, userAccessType: "TOAST_MACHINE_CLIENT" }),
  });
  if (!res.ok) throw new Error(`Toast login failed (${res.status})`);
  const json = await res.json();
  const token = json && json.token && json.token.accessToken;
  if (!token) throw new Error("Toast login: no token in response");
  const ttl = Math.max(60, Math.min(Number(json.token.expiresIn || 3600) - 120, 6 * 3600));
  await redis("SET", TOKEN_KEY, token, "EX", ttl).catch(() => {});
  return token;
}

async function rawGetFull(path, headers, retry) {
  const token = await getToken();
  const res = await fetch(`${HOST}${path}`, { headers: Object.assign({ Authorization: `Bearer ${token}`, Accept: "application/json" }, headers || {}) });
  if (res.status === 401 && !retry) { await redis("DEL", TOKEN_KEY).catch(() => {}); return rawGetFull(path, headers, true); }
  if (!res.ok) throw new Error(`Toast ${path.split("?")[0]} → ${res.status}`);
  const json = await res.json();
  return { json, next: res.headers.get("toast-next-page-token") || res.headers.get("Toast-Next-Page-Token") || null };
}
async function rawGet(path, headers) { return (await rawGetFull(path, headers)).json; }

// Follows Toast pagination (Toast-Next-Page-Token header) and concatenates array pages.
async function toastGetAll(path) {
  const r = await restaurant();
  const out = []; let token = null; let guard = 0;
  do {
    const url = token ? `${path}${path.includes("?") ? "&" : "?"}pageToken=${encodeURIComponent(token)}` : path;
    const page = await rawGetFull(url, { "Toast-Restaurant-External-ID": r.guid });
    if (Array.isArray(page.json)) out.push(...page.json); else if (page.json) out.push(page.json);
    token = page.next; guard++;
  } while (token && guard < 50);
  return out;
}

// The restaurant GUID: from env if given, otherwise discovered once from Toast and remembered.
async function restaurant() {
  if (RESTAURANT_ENV) return { guid: RESTAURANT_ENV, name: "" };
  const cached = await redis("GET", RESTAURANT_KEY).catch(() => null);
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  let found = null;
  // Partner-style listing (works for machine clients): [{restaurantGuid, restaurantName, locationName, ...}]
  try {
    const list = await rawGet("/partners/v1/restaurants");
    const arr = Array.isArray(list) ? list : (list && list.results) || [];
    const r = arr.find((x) => !x.deleted) || arr[0];
    if (r) found = { guid: r.restaurantGuid || r.guid, name: r.restaurantName || r.locationName || "" };
  } catch (e) {}
  if (!found) throw new Error("Could not discover the restaurant GUID — set TOAST_RESTAURANT_GUID on Vercel");
  await redis("SET", RESTAURANT_KEY, JSON.stringify(found)).catch(() => {});
  return found;
}

async function toastGet(path) {
  const r = await restaurant();
  return rawGet(path, { "Toast-Restaurant-External-ID": r.guid });
}

async function cached(key, ttlSec, fn) {
  const raw = await redis("GET", CACHE_PREFIX + key).catch(() => null);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  const val = await fn();
  await redis("SET", CACHE_PREFIX + key, JSON.stringify(val), "EX", ttlSec).catch(() => {});
  return val;
}

function fullName(e) {
  const n = [e.firstName, e.lastName].filter(Boolean).join(" ").trim();
  return n || e.chosenName || e.email || e.guid;
}

// Employees (all pages). Archived ones are kept but flagged, so old time entries can still be matched.
// Toast marks "never deleted" with the epoch ("1970-01-01T00:00:00.000+0000"), not with null: only a real date archives.
function isArchived(e) {
  if (e.deleted === true) return true;
  const d = String(e.deletedDate || "");
  return Boolean(d) && !/^1970-01-01/.test(d);
}
// Job titles (guid → title), so every employee carries the names of the jobs Toast gives them.
async function jobs() {
  return cached("jobs", 3600, async () => {
    const list = await toastGetAll("/labor/v1/jobs").catch(() => []);
    const out = {}; (list || []).forEach((j) => { if (j && j.guid && j.title) out[j.guid] = { title: String(j.title).trim(), salaried: /salar/i.test(String(j.wageFrequency || "")) }; }); return out;
  });
}
// Kitchen or floor, from the job titles Toast gives the person (kitchen words win; nothing known → null).
const KITCHEN_RE = /\b(cook|chef|kitchen|dish|prep|line|sous|pastry|bak(er|ery)|cucina|cuoc|lavapiatt|pizz|grill|fry|expo)\b/i;
const MGMT_RE = /\b(owner|manager|gm|direttore|titolare|propriet)/i; // Owner, Floor Manager, General Manager, Shift Manager…
function deptOf(jobTitles) { const list = (jobTitles || []).filter(Boolean); if (!list.length) return null; if (list.some((t) => /\b(owner|titolare|propriet)/i.test(t))) return "owner"; if (list.some((t) => MGMT_RE.test(t))) return "management"; return list.some((t) => KITCHEN_RE.test(t)) ? "kitchen" : "floor"; }

async function employees(includeArchived, fresh) {
  if (fresh) await redis("DEL", CACHE_PREFIX + "employees_all").catch(() => {}); // straight from Toast (manager opening Staff)
  const all = await cached("employees_all", 600, async () => {
    const [list, titles] = await Promise.all([toastGetAll("/labor/v1/employees"), jobs().catch(() => ({}))]);
    return list.map((e) => ({ guid: e.guid, name: fullName(e), first: e.firstName || "", last: e.lastName || "", email: String(e.email || "").trim().toLowerCase(), created: e.createdDate || null, archived: isArchived(e), jobs: (e.jobReferences || []).map((j) => (titles[j && j.guid] || {}).title).filter(Boolean), salaried: (e.jobReferences || []).some((j) => (titles[j && j.guid] || {}).salaried) }));
  });
  return includeArchived ? all : all.filter((e) => !e.archived);
}

// Time entries between two ISO instants: [{guid, employeeGuid, in, out, jobGuid}]
async function timeEntries(startISO, endISO, ttl) {
  const key = `te:${startISO}:${endISO}`;
  return cached(key, ttl || 30, async () => {
    const q = `startDate=${encodeURIComponent(startISO)}&endDate=${encodeURIComponent(endISO)}`;
    const list = await toastGetAll(`/labor/v1/timeEntries?${q}`);
    return list.filter((t) => !t.deleted).map((t) => ({
      guid: t.guid,
      employeeGuid: t.employeeReference && t.employeeReference.guid,
      jobGuid: t.jobReference && t.jobReference.guid,
      in: t.inDate || null,
      out: t.outDate || null,
    }));
  });
}

// Same entries, asked by Toast "business date" (how Toast Web files a manual entry): catches time entries added by
// hand whose in/out instants fall outside the range query. Merged with the range query by entry guid.
async function timeEntriesBusiness(dateISO, ttl) {
  const key = `teb:${dateISO}`;
  return cached(key, ttl || 60, async () => {
    const list = await toastGetAll(`/labor/v1/timeEntries?businessDate=${dateISO.replace(/-/g, "")}`);
    return list.filter((t) => !t.deleted).map((t) => ({ guid: t.guid, employeeGuid: t.employeeReference && t.employeeReference.guid, jobGuid: t.jobReference && t.jobReference.guid, in: t.inDate || null, out: t.outDate || null }));
  });
}
async function timeEntriesDay(dateISO, ttl) { // range + business date, merged
  const b = dayBounds(dateISO);
  const [r1, r2] = await Promise.all([timeEntries(b.start, b.end, ttl), timeEntriesBusiness(dateISO, ttl).catch(() => [])]);
  const seen = new Set(); return r1.concat(r2).filter((t) => (seen.has(t.guid) ? false : (seen.add(t.guid), true)));
}

// Any span of days, in chunks Toast accepts (its timeEntries endpoint refuses ranges longer than 30 days).
async function timeEntriesSpan(fromDateISO, toDateISO, ttl) {
  const out = []; let cur = fromDateISO;
  while (cur <= toDateISO) {
    const d = new Date(cur + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 27);
    const chunkEnd = d.toISOString().slice(0, 10) < toDateISO ? d.toISOString().slice(0, 10) : toDateISO;
    const list = await timeEntries(dayBounds(cur).start, dayBounds(chunkEnd).end, ttl);
    out.push(...list);
    const n = new Date(chunkEnd + "T12:00:00Z"); n.setUTCDate(n.getUTCDate() + 1); cur = n.toISOString().slice(0, 10);
  }
  const seen = new Set(); return out.filter((t) => (seen.has(t.guid) ? false : (seen.add(t.guid), true)));
}

// Local (New York) day bounds → ISO instants; entries of a bar day can end after midnight, so we widen the end.
function dayBounds(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  // Find UTC offset for that date in NY by formatting a known instant.
  const probe = new Date(Date.UTC(y, m - 1, d, 12));
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset", hour: "numeric" }).formatToParts(probe);
  const off = (parts.find((p) => p.type === "timeZoneName") || {}).value || "GMT-4";
  const mOff = off.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const sign = mOff && mOff[1] === "-" ? -1 : 1;
  const offMin = mOff ? sign * (Number(mOff[2]) * 60 + Number(mOff[3] || 0)) : -240;
  const startUTC = Date.UTC(y, m - 1, d, 0, 0) - offMin * 60000;
  return { start: new Date(startUTC).toISOString(), end: new Date(startUTC + 30 * 3600 * 1000).toISOString() }; // 30h window: until 6 AM next day
}

// For a given local date: which mapped staff names are clocked in/out, with times.
async function dayStatus(dateISO, nameToGuid) {
  const { start, end } = dayBounds(dateISO);
  const entries = await timeEntries(start, end);
  const guidToName = {};
  Object.keys(nameToGuid || {}).forEach((n) => { if (nameToGuid[n]) guidToName[nameToGuid[n]] = n; });
  const byName = {};
  const unmapped = [];
  entries.forEach((t) => {
    const name = guidToName[t.employeeGuid];
    if (!name) { unmapped.push(t.employeeGuid); return; }
    (byName[name] = byName[name] || []).push({ in: t.in, out: t.out });
  });
  Object.values(byName).forEach((l) => l.sort((a, b) => String(a.in).localeCompare(String(b.in))));
  return { date: dateISO, byName, unmapped: [...new Set(unmapped)], fetchedAt: new Date().toISOString() };
}

// One person's clock-ins for a schedule week (Mon..Sun, bar nights included): [{day, in, out}]
// A punch before 6 AM belongs to the previous bar day.
function nyLocal(iso) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}
function shiftDate(iso) {
  const l = nyLocal(iso);
  if (l.hour >= 6) return l.date;
  const [y, m, d] = l.date.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}
async function weekEntriesFor(guid, weekISO) {
  const [y, m, d] = weekISO.split("-").map(Number);
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
  const start = dayBounds(days[0]).start, end = dayBounds(days[6]).end;
  const entries = await timeEntries(start, end);
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  return entries
    .filter((t) => t.employeeGuid === guid && t.in)
    .map((t) => { const date = shiftDate(t.in); const i = days.indexOf(date); return i < 0 ? null : { day: DAYS[i], date, in: t.in, out: t.out }; })
    .filter(Boolean)
    .sort((a, b) => String(a.in).localeCompare(String(b.in)));
}

// ---- name matching (so nobody has to map names by hand) ----
function levenshtein(a, b) {
  a = String(a).toLowerCase(); b = String(b).toLowerCase();
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const NICK = { joe: ["joseph", "giuseppe"], dan: ["daniel", "danny"], kate: ["catherine", "katherine"], cathy: ["catherine"], mike: ["michael"], alex: ["alexander", "alessandro", "alexandra"], tony: ["anthony", "antonio"], chris: ["christopher", "christian"], sam: ["samuel", "samantha"], nick: ["nicholas", "nicola"], matt: ["matthew", "matteo"], will: ["william"], liz: ["elizabeth"] };
function firstMatches(short, first) {
  const s = String(short).toLowerCase().trim(), f = String(first).toLowerCase().trim();
  if (!s || !f) return false;
  if (s === f || levenshtein(s, f) <= 1) return true;
  if (f.startsWith(s) && s.length >= 4) return true;
  return (NICK[s] || []).includes(f);
}
// Explicit manager mapping wins; otherwise a staff name is linked to the ONE Toast employee whose first name matches.
function autoMap(staff, toastMap, emps) {
  const out = Object.assign({}, toastMap || {});
  (staff || []).forEach((name) => {
    if (out[name]) return;
    const hits = emps.filter((e) => firstMatches(name.split(/\s+/)[0], e.first) || firstMatches(name, e.name));
    if (hits.length === 1) out[name] = hits[0].guid;
  });
  return out;
}

module.exports = { enabled, employees, jobs, deptOf, timeEntries, timeEntriesBusiness, timeEntriesDay, timeEntriesSpan, dayStatus, dayBounds, restaurant, autoMap, firstMatches, levenshtein, weekEntriesFor, shiftDate, HOST };
