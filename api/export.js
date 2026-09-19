const store = require("../lib/store");
const auth = require("../lib/auth");
const { fmt12 } = require("../lib/diff");

const DAY_LONG = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const STATUS_LABEL = { "": "Open", closed: "Closed", holiday: "Holiday", half: "Half day", event: "Private event" };

function csvCell(v) {
  const s = String(v == null ? "" : v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function isoDate(weekISO, dayKey) {
  const [y, m, d] = weekISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + store.DAY_KEYS.indexOf(dayKey)));
  return dt.toISOString().slice(0, 10);
}

const accounts = require("../lib/accounts");
const punch = require("../lib/punch");
const former = require("../lib/former");
const toast = require("../lib/toast");
const RULES = require("../rules.js");
const DOCS = require("../documents.js");

const TZ = "America/New_York";
function nyParts(iso) {
  const d = new Date(iso); if (isNaN(d)) return null;
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "long" }).formatToParts(d);
  const g = (t) => (p.find((x) => x.type === t) || {}).value;
  const hh = Number(g("hour")) % 24;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: fmt12(`${String(hh).padStart(2, "0")}:${g("minute")}`), weekday: g("weekday"), stamp: `${g("year")}-${g("month")}-${g("day")} ${String(hh).padStart(2, "0")}:${g("minute")}` };
}
const hours = (ms) => (Math.round(ms / 36000) / 100).toFixed(2);
function weekdayOf(dateISO) { const [y, m, d] = dateISO.split("-").map(Number); return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; }
function minutesOf(hhmm) { const [h, m] = String(hhmm || "0:0").split(":").map(Number); return h * 60 + m; }

// One person's complete record, current or former: schedule, Toast clock-ins, app clock-ins, signed documents,
// staff events, monthly totals. One clean table, chronological, NY times. This is the owner's legal proof file.
async function personRecord(name, doc, confirmations, fromISO, toISO) {
  const rows = []; // {key, cells}
  const H = ["date", "weekday", "type", "start", "end", "hours", "details", "source", "recorded_at_ny", "reference"];
  const push = (key, date, type, start, end, hrs, details, source, recorded, ref) => rows.push({ key, cells: [date, date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? weekdayOf(date) : "", type, start || "", end || "", hrs == null ? "" : hrs, details || "", source || "", recorded || "", ref || ""] });
  const onStaff = doc.data.staff.includes(name);
  const formerRecs = await former.forName(name).catch(() => []);
  // identity: Toast link now, or the one kept when the person was removed
  let guid = (doc.data.toastMap || {})[name] || null, fullName = null, email = null;
  let emps = [];
  if (toast.enabled()) { try { emps = await toast.employees(true); if (!guid && onStaff) guid = toast.autoMap(doc.data.staff, doc.data.toastMap, emps)[name] || null; } catch (e) {} }
  if (!guid && formerRecs.length) guid = formerRecs[0].guid || null;
  const emp = guid && emps.find((e) => e.guid === guid);
  if (emp) { fullName = emp.name; email = emp.email; } else if (formerRecs.length) { fullName = formerRecs[0].fullName || null; email = formerRecs[0].email || null; }
  const today = nyParts(new Date().toISOString());
  const status = onStaff ? "on staff" : formerRecs.length ? `removed on ${nyParts(formerRecs[0].removedAt).stamp} (${formerRecs[0].by === "toast" ? "archived in Toast" : "by the manager"})` : "not on staff";
  push("0000", today.date, "Record", "", "", "", `Personnel record of ${name}${fullName ? ` (${fullName})` : ""}${email ? ` · ${email}` : ""} · status: ${status} · period ${fromISO} to ${toISO} · generated ${today.stamp} New York time`, "Bar Lento app", today.stamp, guid ? `Toast employee ${guid}` : "not linked to Toast");
  // 1. schedule
  const monthly = {};
  const M = (d) => (monthly[d.slice(0, 7)] = monthly[d.slice(0, 7)] || { sched: 0, worked: 0, shifts: 0, clock: 0 });
  Object.keys(doc.data.weeks).sort().forEach((wk) => {
    const w = doc.data.weeks[wk];
    store.DAY_KEYS.forEach((d) => {
      const date = isoDate(wk, d); if (date < fromISO || date > toISO) return;
      (w[d] || []).filter((sh) => sh.name === name).forEach((sh) => {
        const mins = Math.max(0, minutesOf(sh.end) - minutesOf(sh.start) + (minutesOf(sh.end) < minutesOf(sh.start) ? 1440 : 0));
        const conf = confirmations[`${wk}:${d}:${sh.id}`];
        const note = (w.notes && w.notes[d]) || {};
        const m = M(date); m.sched += mins; m.shifts++;
        push(`${date} 1 ${sh.start}`, date, "Shift scheduled", fmt12(sh.start), fmt12(sh.end), hours(mins * 60000), `${sh.station ? "station " + sh.station : "no station"}${conf ? " · confirmed by the employee" : " · not confirmed"}${note.status ? " · day: " + (STATUS_LABEL[note.status] || note.status) : ""}`, "Schedule", conf ? nyParts(conf).stamp : "", `shift ${sh.id} · week of ${wk}`);
      });
    });
  });
  // 2. Toast clock-ins, month by month (Toast keeps them for archived employees too)
  const toastNotes = [];
  if (guid && toast.enabled()) {
    let cur = fromISO;
    while (cur <= toISO) {
      const [y, m] = cur.split("-").map(Number);
      const endOfMonth = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      const winEnd = endOfMonth < toISO ? endOfMonth : toISO;
      try {
        const b1 = toast.dayBounds(cur), b2 = toast.dayBounds(winEnd);
        const entries = await toast.timeEntries(b1.start, b2.end, 300);
        entries.filter((t) => t.employeeGuid === guid && t.in).forEach((t) => {
          const date = toast.shiftDate(t.in); if (date < fromISO || date > toISO) return;
          const ms = t.out ? Date.parse(t.out) - Date.parse(t.in) : 0;
          const m = M(date); m.worked += ms / 60000; m.clock++;
          push(`${date} 2 ${t.in}`, date, "Clock-in (Toast)", nyParts(t.in).time, t.out ? nyParts(t.out).time : "", t.out ? hours(ms) : "", t.out ? "" : "still open / no clock-out recorded", "Toast POS", nyParts(t.in).stamp, `Toast time entry ${t.guid}`);
        });
      } catch (e) { toastNotes.push(`${cur.slice(0, 7)}: Toast did not answer (${String(e.message || e).slice(0, 80)})`); }
      cur = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    }
  }
  toastNotes.forEach((n) => push("9998 " + n, today.date, "Note", "", "", "", `Toast clock-ins missing for ${n} — export again later`, "Toast POS", today.stamp, ""));
  // 3. app clock-ins (current + archived)
  const punches = (onStaff ? await punch.all(name).catch(() => []) : []).concat(await punch.archivedFor(name).catch(() => []));
  punches.forEach((e) => {
    const date = toast.shiftDate(e.in); if (date < fromISO || date > toISO) return;
    const ms = e.out ? Date.parse(e.out) - Date.parse(e.in) : 0;
    const m = M(date); m.worked += ms / 60000; m.clock++;
    push(`${date} 2 ${e.in}`, date, "Clock-in (app)", nyParts(e.in).time, e.out ? nyParts(e.out).time : "", e.out ? hours(ms) : "", (e.auto ? "clock-out auto-closed after 20 h" : "") + (e.out ? "" : "still open"), "Bar Lento app (phone)", nyParts(e.in).stamp, `app entry ${e.id}`);
  });
  // 4. signed documents: current records + archive, every version incl. history
  const docRows = [];
  const addAck = (title, a) => { if (!a || !a.at) return; docRows.push({ title, a }); (a.history || []).forEach((h) => docRows.push({ title, a: h })); };
  addAck("House Rules", await accounts.getRulesAck(name).catch(() => null));
  Object.values(await accounts.allRulesAckArchive().catch(() => ({}))).filter((a) => a && a.name === name).forEach((a) => addAck("House Rules", a));
  for (const d of DOCS.list) {
    addAck(d.title, await accounts.getDocAck(d.id, name).catch(() => null));
  }
  Object.values(await accounts.allDocAckArchive().catch(() => ({}))).filter((a) => a && a.name === name).forEach((a) => { const d = DOCS.list.find((x) => x.id === a.doc); addAck(d ? d.title : a.doc, a); });
  const seen = new Set();
  docRows.forEach(({ title, a }) => {
    const k = `${title}|${a.version}|${a.at}`; if (seen.has(k)) return; seen.add(k);
    const p = nyParts(a.at); if (!p) return;
    push(`${p.date} 3 ${a.at}`, p.date, "Document signed", p.time, "", "", `${title} · version ${a.version} · signed as ${a.fullName || name}${a.email ? " · " + a.email : ""}${a.emailedAt ? " · signed copy emailed" : ""}`, "Bar Lento app", p.stamp, a.hash ? `sha256 ${a.hash}` : "");
  });
  // 5. staff events from the change history
  try {
    const log = await store.getLog(2000);
    const N = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // exactly this person, never "Joe B." for "Joe"
    const re = new RegExp("^(Staff: (added|removed) " + N + "$|Staff: PIN reset for " + N + "$|Added from Toast: " + N + " \\(|Removed from staff \\(archived in Toast\\): " + N + " \\(|Signed copies re-sent to " + N + "( \\(self-service\\))?:)");
    (Array.isArray(log) ? log : (log && log.entries) || []).forEach((en) => (en.changes || []).forEach((c) => {
      if (!re.test(c)) return;
      const p = nyParts(en.at); if (!p || p.date < fromISO || p.date > toISO) return;
      push(`${p.date} 4 ${en.at}`, p.date, "Staff event", p.time, "", "", c, "Bar Lento app", p.stamp, "");
    }));
  } catch (e) {}
  // 6. monthly totals
  Object.keys(monthly).sort().forEach((ym) => {
    const m = monthly[ym];
    push(`${ym}-99`, ym, "Month total", "", "", hours(m.worked * 60000), `worked ${hours(m.worked * 60000)} h in ${m.clock} clock-in${m.clock === 1 ? "" : "s"} · scheduled ${hours(m.sched * 60000)} h in ${m.shifts} shift${m.shifts === 1 ? "" : "s"}`, "Bar Lento app", "", "");
  });
  rows.sort((a, b) => a.key.localeCompare(b.key));
  return [H].concat(rows.map((r) => r.cells));
}

// Manager-only: full archive as CSV (every shift ever scheduled + confirmation time + day notes),
// or one person's complete record with ?person=Name[&from=YYYY-MM-DD&to=YYYY-MM-DD].
module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).send("method_not_allowed"); }
    if (!auth.adminEnabled()) return res.status(503).send("admin_disabled");
    if (!auth.checkPassword(auth.passwordFrom(req))) return res.status(401).send("unauthorized");

    const url = new URL(req.url, "http://x");
    const person = String(url.searchParams.get("person") || "").trim().slice(0, 60);
    if (person) {
      const [doc, confirmations] = await Promise.all([store.getSchedule(), store.getConfirmations()]);
      const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
      const isD = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
      let from = url.searchParams.get("from"), to = url.searchParams.get("to");
      if (!isD(to)) to = todayISO;
      if (!isD(from)) { const d = new Date(to + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 12); from = d.toISOString().slice(0, 10); }
      const minFrom = new Date(to + "T12:00:00Z"); minFrom.setUTCMonth(minFrom.getUTCMonth() - 24); // at most 24 months per file
      if (from < minFrom.toISOString().slice(0, 10)) from = minFrom.toISOString().slice(0, 10);
      const rows = await personRecord(person, doc, confirmations, from, to);
      const csv = "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="bar-lento-record-${person.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-${from}-to-${to}.csv"`);
      return res.status(200).send(csv);
    }

    const [doc, confirmations] = await Promise.all([store.getSchedule(), store.getConfirmations()]);
    const rows = [["date", "weekday", "week_of", "day_status", "day_note", "name", "station", "start", "end", "confirmed_at"]];

    Object.keys(doc.data.weeks).sort().forEach((wk) => {
      const w = doc.data.weeks[wk];
      store.DAY_KEYS.forEach((d) => {
        const note = (w.notes && w.notes[d]) || { status: "", text: "" };
        const statusLabel = (STATUS_LABEL[note.status] || "Open") + (note.status === "half" ? ` ${fmt12(note.open)}–${fmt12(note.close)}` : "");
        const base = [isoDate(wk, d), DAY_LONG[d], wk, statusLabel, note.text || ""];
        const list = (w[d] || []).slice().sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
        if (!list.length) { rows.push([...base, "", "", "", "", ""]); return; }
        list.forEach((s) => rows.push([...base, s.name, s.station || "", fmt12(s.start), fmt12(s.end), confirmations[`${wk}:${d}:${s.id}`] || ""]));
      });
    });

    const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="bar-lento-schedule-archive-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).send("server_error: " + String(err && err.message || err));
  }
};
