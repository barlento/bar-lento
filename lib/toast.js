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
async function employees(includeArchived) {
  const all = await cached("employees_all", 600, async () => {
    const list = await toastGetAll("/labor/v1/employees");
    return list.map((e) => ({ guid: e.guid, name: fullName(e), first: e.firstName || "", last: e.lastName || "", archived: Boolean(e.deleted || e.deletedDate || e.disabled) }));
  });
  return includeArchived ? all : all.filter((e) => !e.archived);
}

// Time entries between two ISO instants: [{guid, employeeGuid, in, out, jobGuid}]
async function timeEntries(startISO, endISO) {
  const key = `te:${startISO}:${endISO}`;
  return cached(key, 60, async () => {
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

module.exports = { enabled, employees, timeEntries, dayStatus, dayBounds, restaurant, HOST };
