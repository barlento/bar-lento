// Requests (owner's request 2026-09-21): time off ("I can't work on these days") and shift cover ("I can't make this shift").
// The person asks from My week; eligible colleagues may offer to take a cover; the manager decides (approve = the shift changes
// name in the schedule, one history line). Rule from the owner: a cover can be asked only with a full day of margin, so the
// manager always has a whole day to organize if nobody volunteers: COVER_MIN_HOURS before the shift starts.
// Storage: barlento:requests (hash id → JSON). Pushes: managers on new requests and volunteers, colleagues on new covers,
// the requester (and the taker) on decisions; nothing during quiet hours (the cards in the app carry it).
const crypto = require("crypto");
const store = require("./store");
const auth = require("./auth");
const push = require("./push");

const KEY = "barlento:requests";
const COVER_MIN_HOURS = 24;
const TZ = "America/New_York";
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAMES = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const KEEP_DAYS = 60;

function todayNY() { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); }
function addDays(iso, n) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function dateText(iso) { const d = new Date(iso + "T12:00:00Z"); return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; }
function h12(t) { const [h, m] = String(t || "").split(":").map(Number); if (isNaN(h)) return t; const s = h % 12 === 0 ? 12 : h % 12; return `${s}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 || h === 24 ? "AM" : "PM"}`; }
// Instant of a wall-clock time in New York (DST-safe: probe the offset at that date).
function nyInstant(dateISO, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = Date.UTC(...dateISO.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v)), h, m);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return guess - (asUTC - guess);
}
function isKitchen(data, n) { const d = (data.dept || {})[n]; return d === "kitchen" || d === "chef"; }
function managersFor(data, name) { // who decides for this person: management + owner, plus the chef for kitchen people
  const d = data.dept || {};
  return (data.staff || []).filter((n) => d[n] === "management" || d[n] === "owner" || (isKitchen(data, name) && d[n] === "chef"));
}
function canDecide(role, data, name) { return auth.isManagerish(role) || (role === "chef" && isKitchen(data, name)); }
function mins(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

async function all() {
  const raw = await store._redis("HGETALL", KEY).catch(() => []);
  const out = []; for (let i = 0; i + 1 < raw.length; i += 2) { try { out.push(JSON.parse(raw[i + 1])); } catch (e) {} }
  return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
async function save(r) { await store._redis("HSET", KEY, r.id, JSON.stringify(r)); return r; }
async function tidy(list) { // expire covers whose shift has started; drop very old decided ones
  const now = Date.now(), cutoff = addDays(todayNY(), -KEEP_DAYS);
  for (const r of list) {
    if (r.type === "cover" && r.status === "pending" && nyInstant(r.date, r.start) <= now) { r.status = "expired"; r.decidedAt = new Date().toISOString(); await save(r); }
    if (r.status !== "pending" && String(r.createdAt).slice(0, 10) < cutoff) await store._redis("HDEL", KEY, r.id).catch(() => {});
  }
  return list.filter((r) => r.status === "pending" || String(r.createdAt).slice(0, 10) >= cutoff);
}

function coverText(r) { return `${dateText(r.date)}, ${h12(r.start)}–${h12(r.end)}${r.station ? " (" + r.station + ")" : ""}`; }
function offText(r) { return r.from === r.to ? dateText(r.from) : `${dateText(r.from)} to ${dateText(r.to)}`; }
async function notify(names, title, body) { if (!names.length || push.isQuietHours()) return; await push.broadcast({ title, body, url: "/", tag: "requests" }, [...new Set(names)]).catch(() => {}); }
async function log(line) { await store.appendLog({ at: new Date().toISOString(), changes: [line] }).catch(() => {}); }

// Colleagues who could take a cover: same side of the house, not the requester, not already on a shift that overlaps that day.
function eligibleFor(data, r) {
  const week = (data.weeks || {})[r.week] || {}; const dayShifts = week[r.day] || [];
  return (data.staff || []).filter((n) => {
    if (n === r.name || /^test\b/i.test(n)) return false;
    if (isKitchen(data, n) !== isKitchen(data, r.name)) return false;
    const d = (data.dept || {})[n]; if (d === "owner") return false;
    return !dayShifts.some((s) => s.name === n && mins(s.start) < mins(r.end) && mins(s.end) > mins(r.start));
  });
}

// ---- actions ----
async function createOff(doc, name, body) {
  const from = String(body.from || "").slice(0, 10), to = String(body.to || from).slice(0, 10), note = String(body.note || "").trim().slice(0, 140);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return { status: 400, body: { error: "bad_dates" } };
  if (from < todayNY()) return { status: 400, body: { error: "past" } };
  if (addDays(from, 60) < to) return { status: 400, body: { error: "too_long" } };
  const list = await all();
  if (list.filter((r) => r.name === name && r.status === "pending").length >= 6) return { status: 429, body: { error: "too_many" } };
  if (list.some((r) => r.type === "off" && r.name === name && r.status === "pending" && r.from === from && r.to === to)) return { status: 409, body: { error: "duplicate" } };
  const r = await save({ id: "off-" + crypto.randomBytes(5).toString("hex"), type: "off", name, from, to, note, status: "pending", createdAt: new Date().toISOString() });
  await log(`Time off requested: ${name}, ${offText(r)}${note ? " (" + note + ")" : ""}`);
  await notify(managersFor(doc.data, name), "Time off request", `${name} asks for ${offText(r)}${note ? ": " + note : ""}.`);
  return { status: 200, body: { ok: true, request: r } };
}

async function createCover(doc, name, body) {
  const data = doc.data; const wk = String(body.week || ""), day = String(body.day || ""), id = String(body.shiftId || "");
  const week = (data.weeks || {})[wk]; const s = week && Array.isArray(week[day]) ? week[day].find((x) => x.id === id) : null;
  if (!s) return { status: 404, body: { error: "no_shift" } };
  if (s.name !== name) return { status: 403, body: { error: "not_yours" } };
  const date = addDays(wk, DAYS.indexOf(day)); const startAt = nyInstant(date, s.start);
  if (startAt - Date.now() < COVER_MIN_HOURS * 3600 * 1000) return { status: 400, body: { error: "too_late", minHours: COVER_MIN_HOURS } };
  const list = await all();
  if (list.some((r) => r.type === "cover" && r.status === "pending" && r.week === wk && r.day === day && r.shiftId === id)) return { status: 409, body: { error: "duplicate" } };
  if (list.filter((r) => r.name === name && r.status === "pending").length >= 6) return { status: 429, body: { error: "too_many" } };
  const r = await save({ id: "cov-" + crypto.randomBytes(5).toString("hex"), type: "cover", name, week: wk, day, shiftId: id, date, start: s.start, end: s.end, station: s.station || "", note: String(body.note || "").trim().slice(0, 140), volunteers: [], status: "pending", createdAt: new Date().toISOString() });
  await log(`Cover requested: ${name}, ${coverText(r)}`);
  await notify(managersFor(data, name), "Cover request", `${name} can't make ${coverText(r)}. Colleagues are being asked; you decide.`);
  await notify(eligibleFor(data, r), "Can you cover a shift?", `${name} can't make ${coverText(r)}. Open the app to offer.`);
  return { status: 200, body: { ok: true, request: r } };
}

async function volunteer(doc, name, body, on) {
  const list = await all(); const r = list.find((x) => x.id === body.id);
  if (!r || r.type !== "cover" || r.status !== "pending") return { status: 404, body: { error: "not_open" } };
  if (!eligibleFor(doc.data, r).includes(name)) return { status: 403, body: { error: "not_eligible" } };
  r.volunteers = (r.volunteers || []).filter((n) => n !== name); if (on) r.volunteers.push(name); await save(r);
  if (on) await notify(managersFor(doc.data, r.name), "Someone can cover", `${name} can take ${r.name}'s shift, ${coverText(r)}. Assign it in Requests.`);
  return { status: 200, body: { ok: true, request: r } };
}

async function cancel(name, body) {
  const list = await all(); const r = list.find((x) => x.id === body.id);
  if (!r || r.name !== name || r.status !== "pending") return { status: 404, body: { error: "not_open" } };
  r.status = "cancelled"; r.decidedAt = new Date().toISOString(); await save(r);
  await log(`${r.type === "cover" ? "Cover" : "Time off"} request withdrawn: ${name}, ${r.type === "cover" ? coverText(r) : offText(r)}`);
  return { status: 200, body: { ok: true, request: r } };
}

async function decide(doc, role, who, body) {
  const list = await all(); const r = list.find((x) => x.id === body.id);
  if (!r || r.status !== "pending") return { status: 404, body: { error: "not_open" } };
  if (!canDecide(role, doc.data, r.name)) return { status: 403, body: { error: "forbidden" } };
  const by = who || "manager"; const approve = body.action === "approve";
  if (!approve) {
    r.status = "declined"; r.decidedBy = by; r.decidedAt = new Date().toISOString(); r.reply = String(body.note || "").trim().slice(0, 140); await save(r);
    await log(`${r.type === "cover" ? "Cover" : "Time off"} request declined by ${by}: ${r.name}, ${r.type === "cover" ? coverText(r) : offText(r)}`);
    await notify([r.name], "Request declined", `${r.type === "cover" ? "Cover for " + coverText(r) : "Time off " + offText(r)}: not approved${r.reply ? " — " + r.reply : ""}. Talk to the manager.`);
    return { status: 200, body: { ok: true, request: r } };
  }
  if (r.type === "off") {
    r.status = "approved"; r.decidedBy = by; r.decidedAt = new Date().toISOString(); await save(r);
    await log(`Time off approved by ${by}: ${r.name}, ${offText(r)}`);
    await notify([r.name], "Time off approved", `${offText(r)}: approved by ${by}.`);
    return { status: 200, body: { ok: true, request: r } };
  }
  // cover: the shift changes name in the schedule
  const taker = String(body.taker || "").trim();
  if (!taker || !(doc.data.staff || []).includes(taker) || taker === r.name) return { status: 400, body: { error: "bad_taker" } };
  if (role === "chef" && !isKitchen(doc.data, taker)) return { status: 403, body: { error: "chef_forbidden" } };
  const current = await store.getSchedule(); const data = JSON.parse(JSON.stringify(current.data));
  const week = (data.weeks || {})[r.week]; const s = week && Array.isArray(week[r.day]) ? week[r.day].find((x) => x.id === r.shiftId) : null;
  if (!s || s.name !== r.name) { r.status = "expired"; r.decidedAt = new Date().toISOString(); await save(r); return { status: 409, body: { error: "shift_changed" } }; }
  s.name = taker;
  const next = { version: (current.version || 0) + 1, data: store.normalizeData(data), updatedAt: new Date().toISOString() };
  await store.saveSchedule(next);
  await store.pruneConfirmations(next.data).catch(() => {});
  r.status = "approved"; r.taker = taker; r.decidedBy = by; r.decidedAt = new Date().toISOString(); await save(r);
  await store.appendLog({ at: next.updatedAt, version: next.version, changes: [`Cover approved by ${by}: ${taker} takes ${r.name}'s shift, ${coverText(r)}`] }).catch(() => {});
  await notify([r.name], "Cover approved", `${taker} takes your shift ${coverText(r)}.`);
  await notify([taker], "You have a new shift", `You take ${r.name}'s shift: ${coverText(r)}.`);
  return { status: 200, body: { ok: true, request: r, version: next.version } };
}

// What each person sees: own requests, the open covers they could take (with whether they offered);
// managers (and the chef for the kitchen) also every pending request with volunteers and eligible names.
async function listFor(doc, name, role) {
  const data = doc.data; const list = await tidy(await all());
  const mine = name ? list.filter((r) => r.name === name) : [];
  const open = name ? list.filter((r) => r.type === "cover" && r.status === "pending" && eligibleFor(data, r).includes(name)).map((r) => Object.assign({}, r, { offered: (r.volunteers || []).includes(name) })) : [];
  const out = { mine, open, coverMinHours: COVER_MIN_HOURS };
  if (auth.isManagerish(role) || role === "chef") {
    const scope = (r) => role === "chef" ? isKitchen(data, r.name) : true;
    out.pending = list.filter((r) => r.status === "pending" && scope(r)).map((r) => Object.assign({}, r, r.type === "cover" ? { eligible: eligibleFor(data, r) } : {}));
    out.decided = list.filter((r) => r.status !== "pending" && scope(r)).slice(0, 20);
    // approved time off by date, for the day cards while planning
    out.off = list.filter((r) => r.type === "off" && (r.status === "approved" || r.status === "pending") && scope(r)).map((r) => ({ name: r.name, from: r.from, to: r.to, status: r.status }));
  }
  return out;
}

module.exports = { createOff, createCover, volunteer, cancel, decide, listFor, eligibleFor, COVER_MIN_HOURS, nyInstant };
