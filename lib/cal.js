// Personal calendar feed (owner 2026-09-22, "turni nel calendario del telefono"): every person can subscribe their
// iPhone/Google calendar to their own shifts. A random token per person (never the PIN token) opens a read-only
// iCalendar feed with ONLY their shifts (plan, not clock-ins) and their approved days off. Revoked on staff removal.
const crypto = require("crypto");
const store = require("./store");
const { nyInstant } = require("./requests");

const BY_NAME = "barlento:cal:byname", BY_TOKEN = "barlento:cal:bytoken";
const redis = (...cmd) => store._redis(...cmd);
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const todayNY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

async function tokenFor(name) {
  let tok = await redis("HGET", BY_NAME, name).catch(() => null);
  if (tok) return tok;
  tok = crypto.randomBytes(20).toString("hex");
  await redis("HSET", BY_NAME, name, tok); await redis("HSET", BY_TOKEN, tok, name);
  return tok;
}
async function nameFor(token) { if (!/^[a-f0-9]{40}$/.test(String(token || ""))) return null; return redis("HGET", BY_TOKEN, token).catch(() => null); }
async function revoke(name) { const tok = await redis("HGET", BY_NAME, name).catch(() => null); if (tok) await redis("HDEL", BY_TOKEN, tok).catch(() => {}); await redis("HDEL", BY_NAME, name).catch(() => {}); }

const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line) => { const out = []; let s = line; while (Buffer.byteLength(s) > 72) { let cut = 72; while (Buffer.byteLength(s.slice(0, cut)) > 72) cut--; out.push(s.slice(0, cut)); s = " " + s.slice(cut); } out.push(s); return out.join("\r\n"); };
const h12 = (t) => { const [h, m] = t.split(":").map(Number); const s = h % 12 === 0 ? 12 : h % 12; return `${s}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 || h === 24 ? "AM" : "PM"}`; };
const isClosed = (n) => n && (n.status === "closed" || n.status === "holiday");

// The feed: shifts from 4 weeks back to every future week, plus approved days off (all-day events).
async function ics(doc, name, offs) {
  const data = doc.data; const from = addDays(todayNY(), -28); const now = stamp(Date.now());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bar Lento//Staff app//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Bar Lento shifts", "X-WR-TIMEZONE:America/New_York", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  Object.keys(data.weeks || {}).sort().forEach((wk) => {
    const week = data.weeks[wk];
    DAYS.forEach((d, i) => {
      const date = addDays(wk, i); if (date < from) return;
      const note = (week.notes || {})[d]; if (isClosed(note)) return; // a closed day has no shift to show
      (week[d] || []).forEach((s) => {
        if (s.name !== name || s.src) return; // own shifts only; clock-ins from Toast/app are history, not the plan
        const startMs = nyInstant(date, s.start); let endMs = nyInstant(date, s.end); if (endMs <= startMs) endMs += 86400000;
        const others = (week[d] || []).filter((x) => x.name !== name && !x.src).map((x) => x.name + (x.station ? " (" + x.station + ")" : ""));
        const desc = [others.length ? "With: " + others.join(", ") : "", note && note.text ? "Note: " + note.text : "", note && note.status === "event" ? "Private event" : note && note.status === "half" ? "Half day" : ""].filter(Boolean).join("\n");
        lines.push("BEGIN:VEVENT", `UID:${wk}-${d}-${s.id}@bar-lento`, `DTSTAMP:${now}`, `DTSTART:${stamp(startMs)}`, `DTEND:${stamp(endMs)}`,
          fold(`SUMMARY:${esc("Bar Lento" + (s.station ? " · " + s.station : "") + " · " + h12(s.start) + "–" + h12(s.end))}`),
          fold(`DESCRIPTION:${esc(desc)}`), "LOCATION:Bar Lento\\, 158 8th Avenue\\, New York", "END:VEVENT");
      });
    });
  });
  (offs || []).forEach((o) => {
    lines.push("BEGIN:VEVENT", `UID:off-${o.id}@bar-lento`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${o.from.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${addDays(o.to, 1).replace(/-/g, "")}`, "SUMMARY:Bar Lento · Day off (approved)", "TRANSP:TRANSPARENT", "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
module.exports = { tokenFor, nameFor, revoke, ics };
