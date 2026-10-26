// Opening hours of the venue (owner 2026-10-26, "memorizzali"): Monday closed; Tuesday–Thursday 12 PM–10 PM; Friday–Saturday
// 12 PM–11 PM; Sunday 11 AM–6 PM. The kitchen closes ONE HOUR earlier every day. Day settings win (closed / holiday, a half day or
// a private event with its own hours). The client's OPENING table in index.html mirrors OPEN; keep the two in step.
// Used by the reports (a clock-in far outside these hours is a "probable wrong clock-in/out", with tolerance: people arrive for
// prep, leave after cleaning) and by the "still clocked in after closing" alert.
const OPEN = { mon: null, tue: { open: "12:00", close: "22:00" }, wed: { open: "12:00", close: "22:00" }, thu: { open: "12:00", close: "22:00" }, fri: { open: "12:00", close: "23:00" }, sat: { open: "12:00", close: "23:00" }, sun: { open: "11:00", close: "18:00" } };
const KITCHEN_EARLIER_MIN = 60;
const LATE_TOL_MIN = 150; // elastic (owner): cleaning and closing after. An EARLY clock-in is never flagged: it is extra hours (owner 2026-10-26, "Luis timbra prima del turno: ore in più, calcola e basta")
const TZ = "America/New_York";
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const mins = (hhmm) => { const [h, m] = String(hhmm || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const fmtMins = (m) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;
function h12(hhmm) { const m = mins(hhmm); const h = Math.floor(m / 60) % 24, mm = m % 60; return `${h % 12 || 12}${mm ? ":" + String(mm).padStart(2, "0") : ""} ${h >= 12 ? "PM" : "AM"}`; }
function hTxt(min) { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} h${m ? " " + m + " min" : ""}` : `${m} min`; }
function weekOf(dateISO) { const d = new Date(dateISO + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
function dayKey(dateISO) { return DAYS[(new Date(dateISO + "T12:00:00Z").getUTCDay() + 6) % 7]; }
function nyLocal(iso) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t) => (p.find((x) => x.type === t) || {}).value; return { date: `${g("year")}-${g("month")}-${g("day")}`, min: (Number(g("hour")) % 24) * 60 + Number(g("minute")) };
}
// The hours of one day for one person: {day, open, close, closed, why, kitchen}. dept "kitchen"/"chef" → the kitchen's closing.
function hoursFor(data, dateISO, dept) {
  const d = dayKey(dateISO); const notes = ((((data || {}).weeks || {})[weekOf(dateISO)] || {}).notes) || {}; const n = notes[d];
  const kitchen = dept === "kitchen" || dept === "chef";
  const out = { day: d, open: null, close: null, closed: false, why: "", kitchen };
  if (n && (n.status === "closed" || n.status === "holiday")) return Object.assign(out, { closed: true, why: n.status === "holiday" ? "closed for the holiday" : "closed that day" });
  if (n && (n.status === "half" || n.status === "event") && n.open && n.close) { out.open = n.open; out.close = n.close; }
  else if (OPEN[d]) { out.open = OPEN[d].open; out.close = OPEN[d].close; }
  else if (n && n.status === "event") return out; // a private event on a closed weekday without hours: open, hours unknown
  else return Object.assign(out, { closed: true, why: `closed on ${DAY_NAMES[d]}s` });
  if (kitchen) out.close = fmtMins(mins(out.close) - KITCHEN_EARLIER_MIN);
  return out;
}
// Is this clock-in plausible for that bar day? null = fine, else {kind: "in"|"out", text} to print as "Probable wrong clock-<kind>: <text>".
// Flags: a clock-in on a closed day, a clock-out long after closing (a forgotten clock-out). Never an early clock-in (extra hours).
function check(data, dateISO, inISO, outISO, dept) {
  const h = hoursFor(data, dateISO, dept);
  if (h.closed) return { kind: "in", text: `the bar is ${h.why}` };
  if (!h.open || !h.close || !inISO) return null;
  const rel = (iso) => { const l = nyLocal(iso); return l.min + Math.round((Date.parse(l.date + "T12:00:00Z") - Date.parse(dateISO + "T12:00:00Z")) / 86400000) * 1440; };
  if (outISO) { const late = rel(outISO) - mins(h.close); if (late > LATE_TOL_MIN) return { kind: "out", text: `clocked out ${hTxt(late)} after ${h.kitchen ? "the kitchen closed" : "closing"} (${h12(h.close)})` }; }
  return null;
}
// Extra hours (owner 2026-10-26, Luis: "di norma 40 ore; le ore oltre l'orario standard del giorno, apertura → chiusura cucina, in rosso"):
// the minutes of a closed entry outside the day's standard window (kitchen people: the kitchen's closing); a closed day → the whole entry.
function extraMinutes(data, dateISO, inISO, outISO, dept) {
  if (!inISO || !outISO) return null;
  const h = hoursFor(data, dateISO, dept);
  const rel = (iso) => { const l = nyLocal(iso); return l.min + Math.round((Date.parse(l.date + "T12:00:00Z") - Date.parse(dateISO + "T12:00:00Z")) / 86400000) * 1440; };
  const a = rel(inISO), b = rel(outISO); if (!(b > a)) return null;
  if (h.closed) return { before: 0, after: 0, total: b - a, window: "closed" };
  if (!h.open || !h.close) return null;
  const o = mins(h.open), c = mins(h.close);
  const before = Math.max(0, Math.min(b, o) - a), after = Math.max(0, b - Math.max(a, c));
  return { before, after, total: before + after, window: `${h12(h.open)}–${h12(h.close)}` };
}
module.exports = { OPEN, KITCHEN_EARLIER_MIN, LATE_TOL_MIN, extraMinutes, DAY_NAMES, hoursFor, check, h12, hTxt, mins, dayKey, weekOf, nyLocal };
