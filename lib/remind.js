// Owner 2026-09-22, "l'app ti segue": (1) a personal push every morning at 10 (New York) to everyone who works today —
// "Today 4:00–10:00 PM · S1 · with Joe, Sierrah"; (2) an alert to the managers when a scheduled person has not clocked
// in 15 minutes after the start ("Joe has not clocked in · 4:00 PM shift"). Both run from any GET /api/data (the app
// polls every 30 s) and from the daily cron; Redis flags make every message fire once. Never throws.
const store = require("./store");
const push = require("./push");
const toast = require("./toast");
const punch = require("./punch");
const auth = require("./auth");
const { nyInstant } = require("./requests");

const TZ = "America/New_York";
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const redis = (...cmd) => store._redis(...cmd);
const LATE_MIN = 15, LATE_WINDOW_MIN = 120, MORNING_HOUR = 10;

function nyNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t) => (parts.find((p) => p.type === t) || {}).value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) % 24, minute: Number(g("minute")) };
}
function weekOf(dateISO) { const d = new Date(dateISO + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
function dayKey(dateISO) { return DAYS[(new Date(dateISO + "T12:00:00Z").getUTCDay() + 6) % 7]; }
const h12 = (t) => { const [h, m] = t.split(":").map(Number); const s = h % 12 === 0 ? 12 : h % 12; return `${s}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 || h === 24 ? "AM" : "PM"}`; };
const isClosed = (n) => n && (n.status === "closed" || n.status === "holiday");

// today's planned shifts: [{name, start, end, station}] (no clock-in rows, no closed day, no test accounts)
function todayShifts(data, date) {
  const week = (data.weeks || {})[weekOf(date)]; if (!week) return [];
  const d = dayKey(date); if (isClosed((week.notes || {})[d])) return [];
  return (week[d] || []).filter((s) => s && s.name && !s.src && !auth.isTestName(s.name) && (data.staff || []).includes(s.name));
}
async function once(key, ttlSec) { const r = await redis("SET", key, new Date().toISOString(), "NX", "EX", ttlSec).catch(() => null); return r === "OK" || r === true; }

// (1) the morning reminder — once per day, only from 10 AM New York
async function morning(doc, force) {
  const now = nyNow(); if (!force && now.hour < MORNING_HOUR) return { skipped: "before 10" };
  if (!(await once("barlento:remind:" + now.date, 36 * 3600)) && !force) return { skipped: "done" };
  const shifts = todayShifts(doc.data, now.date); const byName = {};
  shifts.forEach((s) => { (byName[s.name] = byName[s.name] || []).push(s); });
  const messages = [];
  for (const name of Object.keys(byName)) {
    const mine = byName[name].sort((a, b) => a.start.localeCompare(b.start));
    const others = [...new Set(shifts.filter((s) => s.name !== name).map((s) => s.name))];
    const body = mine.map((s) => `${h12(s.start)}–${h12(s.end)}${s.station ? " · " + s.station : ""}`).join(", ") + (others.length ? ` · with ${others.slice(0, 4).join(", ")}${others.length > 4 ? " +" + (others.length - 4) : ""}` : "");
    messages.push({ name, body });
    await push.broadcast({ title: "Your shift today", body, url: "/", tag: "today" }, [name]).catch(() => {});
  }
  return { date: now.date, sent: messages.length, messages };
}

// who decides for this person: management + owner, plus the chef for kitchen people
function managersFor(data, name) {
  const dept = data.dept || {}; const kitchen = dept[name] === "kitchen" || dept[name] === "chef";
  return (data.staff || []).filter((n) => n !== name && !auth.isTestName(n) && (dept[n] === "management" || dept[n] === "owner" || (kitchen && dept[n] === "chef")));
}
// (2) late alerts — checked at most every 2 minutes, one alert per person per day, only 15–120 min after the start
async function late(doc, force) {
  const now = nyNow(); if (!force && (now.hour < MORNING_HOUR || now.hour >= 23)) return { skipped: "night" };
  if (!force && !(await once("barlento:late:check", 120))) return { skipped: "throttled" };
  const data = doc.data; const nowMs = Date.now();
  const due = todayShifts(data, now.date).filter((s) => { const st = nyInstant(now.date, s.start); return nowMs >= st + LATE_MIN * 60000 && nowMs <= st + LATE_WINDOW_MIN * 60000; });
  if (!due.length) return { date: now.date, alerts: [] };
  // who has clocked in today (Toast people from Toast, app-clock people from the app)
  const clocked = new Set(); const appNames = await punch.appClockNames(data).catch(() => new Set());
  const b = toast.dayBounds(now.date);
  for (const n of appNames) { const l = await punch.between(n, b.start, b.end).catch(() => []); if (l.length) clocked.add(n); }
  let toastOk = false;
  if (toast.enabled()) { try { const emps = await toast.employees(true); const map = toast.autoMap(data.staff, data.toastMap, emps); const st = await toast.dayStatus(now.date, map); Object.keys(st.byName || {}).forEach((n) => clocked.add(n)); toastOk = true; } catch (e) {} }
  const alerts = [];
  for (const s of due) {
    if (clocked.has(s.name)) continue;
    if (!appNames.has(s.name) && !toastOk) continue; // Toast unreachable: we cannot know, so no false alarm
    if (!(await once(`barlento:late:${now.date}:${s.name}`, 36 * 3600)) && !force) continue;
    const mins = Math.round((nowMs - nyInstant(now.date, s.start)) / 60000);
    const body = `${s.name} has not clocked in · ${h12(s.start)} shift${s.station ? " · " + s.station : ""} · ${mins} min late`;
    const to = managersFor(data, s.name);
    alerts.push({ name: s.name, to, body });
    if (to.length) await push.broadcast({ title: "Not clocked in", body, url: "/", tag: "late-" + s.name }, to).catch(() => {});
  }
  return { date: now.date, alerts };
}
// called from GET /api/data: cheap when nothing is due (one Redis read for the morning flag, one SET NX for the throttle)
async function tick(doc) {
  if (!store.hasStorage()) return;
  try { await morning(doc, false); } catch (e) {}
  try { await late(doc, false); } catch (e) {}
}
module.exports = { morning, late, tick, todayShifts, managersFor, LATE_MIN };
