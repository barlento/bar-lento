// Leaderboard: objective scores from Toast clock-ins vs the published schedule.
// Points = hours worked ×10  +  on-time % (once you have 3+ clocked shifts)  +  5 × current on-time streak.
// "On time" = clocked in within 5 minutes of the scheduled start.
const toast = require("./toast");
const store = require("./store");

const TZ = "America/New_York";
const DAY_KEYS = store.DAY_KEYS;
const ON_TIME_GRACE_MIN = 5;
const CHUNK_DAYS = 28;

function pad(n) { return n < 10 ? "0" + n : "" + n; }
function isoAdd(iso, days) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function todayNY() { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); }
function mondayOf(iso) { const d = new Date(iso + "T12:00:00Z"); const wd = d.getUTCDay(); return isoAdd(iso, wd === 0 ? -6 : 1 - wd); }
function monthStart(iso) { return iso.slice(0, 8) + "01"; }
function dayKeyOf(iso) { return DAY_KEYS[(new Date(iso + "T12:00:00Z").getUTCDay() + 6) % 7]; }

// NY local date + minutes for an instant; punches before 6 AM belong to the previous bar day.
const fmtParts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
function nyLocal(isoInstant) {
  const p = {}; fmtParts.formatToParts(new Date(isoInstant)).forEach((x) => { p[x.type] = x.value; });
  let date = `${p.year}-${p.month}-${p.day}`; let h = Number(p.hour) % 24; const m = Number(p.minute);
  let mins = h * 60 + m;
  if (h < 6) { date = isoAdd(date, -1); mins += 24 * 60; }
  return { date, mins };
}

function periodRange(period, ref) {
  const today = ref || todayNY();
  if (period === "month") return { start: monthStart(today), end: today, prev: { start: monthStart(isoAdd(monthStart(today), -1)), end: isoAdd(monthStart(today), -1) } };
  if (period === "all") return { start: isoAdd(today, -180), end: today, prev: null };
  const mon = mondayOf(today);
  return { start: mon, end: today, prev: { start: isoAdd(mon, -7), end: isoAdd(mon, -1) } };
}

// All entries between two NY dates (inclusive), fetched in chunks so long ranges work; old chunks cache longer.
async function entriesBetween(startISO, endISO) {
  const today = todayNY(); const out = [];
  let s = startISO;
  while (s <= endISO) {
    const e = isoAdd(s, CHUNK_DAYS - 1) < endISO ? isoAdd(s, CHUNK_DAYS - 1) : endISO;
    const b1 = toast.dayBounds(s), b2 = toast.dayBounds(e);
    const ttl = e < isoAdd(today, -1) ? 6 * 3600 : 60;
    out.push(...await toast.timeEntries(b1.start, b2.end, ttl));
    s = isoAdd(e, 1);
  }
  const seen = new Set();
  return out.filter((t) => { if (seen.has(t.guid)) return false; seen.add(t.guid); return true; });
}

function mins(t) { const p = String(t || "0:0").split(":").map(Number); return p[0] * 60 + (p[1] || 0); }

// Scheduled shifts per name per date inside the range (earliest start of the day).
function scheduledByNameDate(weeks, startISO, endISO) {
  const map = {}; // name -> date -> startMins
  Object.keys(weeks).forEach((wk) => {
    DAY_KEYS.forEach((d, i) => {
      const date = isoAdd(wk, i);
      if (date < startISO || date > endISO) return;
      const note = weeks[wk].notes && weeks[wk].notes[d];
      if (note && (note.status === "closed" || note.status === "holiday")) return;
      (weeks[wk][d] || []).forEach((s) => {
        const cur = (map[s.name] = map[s.name] || {});
        const st = mins(s.start);
        if (cur[date] == null || st < cur[date]) cur[date] = st;
      });
    });
  });
  return map;
}

function scoreRows(names, entries, guidToName, sched, nowMs) {
  const byName = {};
  names.forEach((n) => { byName[n] = { name: n, msClosed: 0, openSince: null, days: {}, }; });
  entries.forEach((t) => {
    const n = guidToName[t.employeeGuid]; if (!n || !byName[n] || !t.in) return;
    const r = byName[n]; const inMs = Date.parse(t.in);
    if (t.out) r.msClosed += Math.max(0, Date.parse(t.out) - inMs); else if (!r.openSince || inMs < Date.parse(r.openSince)) r.openSince = t.in;
    const loc = nyLocal(t.in);
    if (r.days[loc.date] == null || loc.mins < r.days[loc.date]) r.days[loc.date] = loc.mins;
  });
  return names.map((n) => {
    const r = byName[n]; const sd = sched[n] || {};
    const matched = Object.keys(r.days).filter((d) => sd[d] != null).sort();
    let onTime = 0, lateSum = 0;
    matched.forEach((d) => { const late = Math.max(0, r.days[d] - sd[d]); lateSum += late; if (late <= ON_TIME_GRACE_MIN) onTime++; });
    let streak = 0;
    for (let i = matched.length - 1; i >= 0; i--) { const d = matched[i]; if (r.days[d] - sd[d] <= ON_TIME_GRACE_MIN) streak++; else break; }
    const shifts = Object.keys(r.days).length;
    const onTimePct = matched.length ? Math.round(onTime / matched.length * 100) : null;
    const avgLate = matched.length ? Math.round(lateSum / matched.length) : null;
    const liveMs = r.openSince ? Math.max(0, nowMs - Date.parse(r.openSince)) : 0;
    const hours = (r.msClosed + liveMs) / 3600000;
    const points = Math.round(hours * 10) + (matched.length >= 3 && onTimePct != null ? onTimePct : 0) + streak * 5;
    return { name: n, msClosed: r.msClosed, openSince: r.openSince, shifts, matched: matched.length, onTime, onTimePct, avgLate, streak, points };
  });
}

async function leaderboard(period) {
  const p = ["week", "month", "all"].includes(period) ? period : "week";
  const range = periodRange(p);
  const [doc, emps] = await Promise.all([store.getSchedule(), toast.employees(true)]);
  const names = doc.data.staff.slice();
  const map = toast.autoMap(names, doc.data.toastMap, emps);
  const guidToName = {}; Object.keys(map).forEach((n) => { guidToName[map[n]] = n; });
  const nowMs = Date.now();

  const entries = await entriesBetween(range.start, range.end);
  const rows = scoreRows(names, entries, guidToName, scheduledByNameDate(doc.data.weeks, range.start, range.end), nowMs);
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  let prevRank = {};
  if (range.prev) {
    try {
      const pe = await entriesBetween(range.prev.start, range.prev.end);
      const prows = scoreRows(names, pe, guidToName, scheduledByNameDate(doc.data.weeks, range.prev.start, range.prev.end), nowMs);
      prows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
      prows.forEach((r, i) => { if (r.points > 0) prevRank[r.name] = i + 1; });
    } catch (e) { prevRank = {}; }
  }
  return {
    period: p, start: range.start, end: range.end, grace: ON_TIME_GRACE_MIN,
    rows: rows.map((r, i) => Object.assign({ rank: i + 1, prevRank: prevRank[r.name] || null }, r)),
    fetchedAt: new Date(nowMs).toISOString(),
  };
}

module.exports = { leaderboard, periodRange, nyLocal, ON_TIME_GRACE_MIN };
