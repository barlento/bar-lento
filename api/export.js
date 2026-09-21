// Manager-only exports, as real Excel workbooks (.xlsx) that open cleanly in Excel, Numbers and Google Sheets:
//   GET /api/export                 → the whole schedule archive (every shift ever scheduled, day statuses and notes)
//   GET /api/export?person=Name     → one person's complete record (current or former): summary, shifts, clock-ins,
//                                     signed documents, staff events. Optional &from=YYYY-MM-DD&to=YYYY-MM-DD (max 24 months).
// This is the owner's proof file: nothing is ever invented, every row cites its source and, where it exists, a reference id.
const ExcelJS = require("exceljs");
const store = require("../lib/store");
const auth = require("../lib/auth");
const { fmt12 } = require("../lib/diff");
const accounts = require("../lib/accounts");
const punch = require("../lib/punch");
const former = require("../lib/former");
const toast = require("../lib/toast");
const DOCS = require("../documents.js");
const pdf = require("../lib/pdf");

const DAY_LONG = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const STATUS_LABEL = { "": "Open", closed: "Closed", holiday: "Holiday", half: "Half day", event: "Private event" };
const TZ = "America/New_York";

// ---------- small helpers ----------
function isoDate(weekISO, dayKey) {
  const [y, m, d] = weekISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + store.DAY_KEYS.indexOf(dayKey))).toISOString().slice(0, 10);
}
function weekdayOf(dateISO) { const [y, m, d] = dateISO.split("-").map(Number); return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; }
function minutesOf(hhmm) { const [h, m] = String(hhmm || "0:0").split(":").map(Number); return h * 60 + m; }
function nyParts(iso) {
  const d = new Date(iso); if (isNaN(d)) return null;
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t) => (p.find((x) => x.type === t) || {}).value;
  const hh = Number(g("hour")) % 24;
  const date = `${g("year")}-${g("month")}-${g("day")}`;
  return { date, time: fmt12(`${String(hh).padStart(2, "0")}:${g("minute")}`), stamp: `${date} ${String(hh).padStart(2, "0")}:${g("minute")}` };
}
const round2 = (n) => Math.round(n * 100) / 100;
const dateCell = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const todayNY = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

// ---------- workbook look (one style for every sheet) ----------
const INK = "FF1D1D1F", MUTED = "FF6E6E73", LINE = "FFE5E5EA", HEAD = "FFF2F2F4", ACCENT = "FF0071E3";
function sheetTable(wb, name, columns, rows, opts) {
  opts = opts || {};
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: opts.titleRows ? opts.titleRows + 1 : 1 }] });
  let headerRow = 1;
  if (opts.title) {
    ws.mergeCells(1, 1, 1, columns.length);
    const t = ws.getCell(1, 1); t.value = opts.title; t.font = { name: "Calibri", size: 14, bold: true, color: { argb: INK } }; t.alignment = { vertical: "middle" };
    ws.getRow(1).height = 24;
    if (opts.subtitle) { ws.mergeCells(2, 1, 2, columns.length); const s = ws.getCell(2, 1); s.value = opts.subtitle; s.font = { name: "Calibri", size: 10, color: { argb: MUTED } }; s.alignment = { wrapText: true, vertical: "top" }; ws.getRow(2).height = 30; }
    headerRow = (opts.titleRows || 2) + 1;
  }
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width || 14 }));
  const hr = ws.getRow(headerRow);
  columns.forEach((c, i) => { const cell = hr.getCell(i + 1); cell.value = c.header; cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: INK } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } }; cell.alignment = { vertical: "middle", horizontal: c.align || "left" }; cell.border = { bottom: { style: "thin", color: { argb: LINE } } }; });
  hr.height = 20;
  rows.forEach((r, ri) => {
    const row = ws.getRow(headerRow + 1 + ri);
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1); let v = r[c.key];
      if (c.type === "date" && v) v = dateCell(v);
      cell.value = v == null ? "" : v;
      cell.font = { name: "Calibri", size: 11, color: { argb: r.__muted ? MUTED : INK }, bold: !!r.__bold };
      cell.alignment = { vertical: "top", horizontal: c.align || (c.type === "num" ? "right" : "left"), wrapText: !!c.wrap };
      if (c.type === "date") cell.numFmt = "ddd d mmm yyyy";
      if (c.type === "num") cell.numFmt = "0.00";
      cell.border = { bottom: { style: "hair", color: { argb: LINE } } };
      if (r.__fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: r.__fill } };
    });
  });
  if (rows.length) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + rows.length, column: columns.length } };
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.headerFooter = { oddFooter: "&L&8Bar Lento staff app · © Simone Viola&R&8Page &P of &N" };
  return ws;
}
function summarySheet(wb, title, subtitle, pairs, tables) {
  const ws = wb.addWorksheet("Summary");
  ws.columns = [{ width: 26 }, { width: 62 }];
  ws.mergeCells("A1:B1"); ws.getCell("A1").value = title; ws.getCell("A1").font = { name: "Calibri", size: 16, bold: true, color: { argb: INK } }; ws.getRow(1).height = 28;
  ws.mergeCells("A2:B2"); ws.getCell("A2").value = subtitle; ws.getCell("A2").font = { name: "Calibri", size: 10, color: { argb: MUTED } };
  let r = 4;
  pairs.forEach(([k, v]) => { const a = ws.getCell(r, 1), b = ws.getCell(r, 2); a.value = k; a.font = { name: "Calibri", size: 11, bold: true, color: { argb: MUTED } }; b.value = v; b.font = { name: "Calibri", size: 11, color: { argb: INK } }; b.alignment = { wrapText: true, vertical: "top" }; a.border = b.border = { bottom: { style: "hair", color: { argb: LINE } } }; r++; });
  (tables || []).forEach((t) => {
    r += 1; ws.mergeCells(r, 1, r, 2); const h = ws.getCell(r, 1); h.value = t.title; h.font = { name: "Calibri", size: 12, bold: true, color: { argb: INK } }; r++;
    const cols = t.columns; // [{header,key,width?,type?}]
    // widen to the table's column count on the right side of the summary sheet
    cols.forEach((c, i) => { const cell = ws.getCell(r, i + 1); cell.value = c.header; cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: INK } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } }; cell.alignment = { horizontal: c.type === "num" ? "right" : "left" }; if (i >= 2) ws.getColumn(i + 1).width = Math.max(ws.getColumn(i + 1).width || 10, c.width || 14); });
    r++;
    t.rows.forEach((row) => { cols.forEach((c, i) => { const cell = ws.getCell(r, i + 1); cell.value = row[c.key] == null ? "" : row[c.key]; cell.font = { name: "Calibri", size: 11, color: { argb: INK }, bold: !!row.__bold }; cell.alignment = { horizontal: c.type === "num" ? "right" : "left" }; if (c.type === "num") cell.numFmt = "0.00"; cell.border = { bottom: { style: "hair", color: { argb: LINE } } }; }); r++; });
  });
  ws.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.headerFooter = { oddFooter: "&L&8Bar Lento staff app · © Simone Viola&R&8Page &P of &N" };
  return ws;
}

// ---------- 1. schedule archive ----------
async function collectArchive() {
  const [doc, confirmations] = await Promise.all([store.getSchedule(), store.getConfirmations()]);
  const shifts = [], days = [];
  Object.keys(doc.data.weeks).sort().forEach((wk) => {
    const w = doc.data.weeks[wk];
    store.DAY_KEYS.forEach((d) => {
      const note = (w.notes && w.notes[d]) || { status: "", text: "" };
      const date = isoDate(wk, d);
      const statusLabel = (STATUS_LABEL[note.status] || "Open") + (note.status === "half" ? ` ${fmt12(note.open)}–${fmt12(note.close)}` : "");
      days.push({ date, weekday: DAY_LONG[d], week: wk, status: statusLabel, note: note.text || "", people: (w[d] || []).length });
      (w[d] || []).slice().sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name)).forEach((s) => {
        const mins = Math.max(0, minutesOf(s.end) - minutesOf(s.start) + (minutesOf(s.end) < minutesOf(s.start) ? 1440 : 0));
        const conf = confirmations[`${wk}:${d}:${s.id}`];
        shifts.push({ date, weekday: DAY_LONG[d], week: wk, name: s.name, station: s.src === "toast" ? "Toast" : s.src === "app" ? "App" : (s.station || ""), start: fmt12(s.start), end: fmt12(s.end), hours: round2(mins / 60), status: statusLabel, confirmed: s.src === "toast" ? "clock-in from Toast" : s.src === "app" ? "clock-in from the app" : (conf ? nyParts(conf).stamp : ""), id: s.id });
      });
    });
  });
  return { doc, shifts, days };
}
async function archiveWorkbook() {
  const { doc, shifts, days } = await collectArchive();
  const wb = new ExcelJS.Workbook(); wb.creator = "Bar Lento staff app"; wb.created = new Date();
  const first = days[0] ? days[0].date : "", last = days.length ? days[days.length - 1].date : "";
  summarySheet(wb, "Bar Lento — schedule archive", `Generated ${nyParts(new Date().toISOString()).stamp} New York time · every week ever published in the app`, [
    ["Period", `${first} to ${last}`], ["Weeks", String(Object.keys(doc.data.weeks).length)], ["Shifts", String(shifts.length)], ["People on staff today", doc.data.staff.join(", ")],
    ["Sheets", "Shifts: one row per scheduled shift, with the employee's confirmation time. Days: one row per day, with opening status and note."],
  ]);
  sheetTable(wb, "Shifts", [
    { header: "Date", key: "date", type: "date", width: 16 }, { header: "Weekday", key: "weekday", width: 11 }, { header: "Name", key: "name", width: 14 }, { header: "Station", key: "station", width: 9 },
    { header: "Start", key: "start", width: 10 }, { header: "End", key: "end", width: 10 }, { header: "Hours", key: "hours", type: "num", width: 8 }, { header: "Day status", key: "status", width: 16 },
    { header: "Confirmed by employee (NY time)", key: "confirmed", width: 28 }, { header: "Week of", key: "week", type: "date", width: 16 }, { header: "Shift id", key: "id", width: 14 },
  ], shifts);
  sheetTable(wb, "Days", [
    { header: "Date", key: "date", type: "date", width: 16 }, { header: "Weekday", key: "weekday", width: 11 }, { header: "Status", key: "status", width: 18 }, { header: "Note", key: "note", width: 50, wrap: true }, { header: "People scheduled", key: "people", width: 16, align: "right" }, { header: "Week of", key: "week", type: "date", width: 16 },
  ], days);
  return { wb, filename: `bar-lento-schedule-archive-${todayNY()}.xlsx` };
}
async function archivePdfFile() {
  const { doc, shifts, days } = await collectArchive();
  const weeks = Object.keys(doc.data.weeks).sort().map((wk) => {
    const wdays = days.filter((d) => d.week === wk).map((d) => ({ date: d.date, weekday: d.weekday, status: d.status, note: d.note, shifts: shifts.filter((s) => s.date === d.date).map((s) => ({ name: s.name, station: s.station, start: s.start, end: s.end, hours: s.hours, confirmed: s.confirmed })) }));
    const f = wdays[0] ? dateCell(wdays[0].date) : null, l = wdays[6] ? dateCell(wdays[6].date) : null;
    const lab = (dt) => dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    return { wk, label: f && l ? `Week of ${lab(f)} – ${lab(l)}, ${l.getUTCFullYear()}` : `Week of ${wk}`, days: wdays };
  });
  const a = { first: days[0] ? days[0].date : "", last: days.length ? days[days.length - 1].date : "", weeks, staff: doc.data.staff, totalShifts: shifts.length };
  const out = await pdf.archivePdf(a, nyParts(new Date().toISOString()).stamp);
  return { buf: out.buf, filename: `bar-lento-schedule-archive-${todayNY()}.pdf` };
}

// ---------- 2. one person's record ----------
async function collectPerson(name, doc, confirmations, fromISO, toISO) {
  const onStaff = doc.data.staff.includes(name);
  const formerRecs = await former.forName(name).catch(() => []);
  let guid = (doc.data.toastMap || {})[name] || null, fullName = null, email = null, emps = [];
  if (toast.enabled()) { try { emps = await toast.employees(true); if (!guid && onStaff) guid = toast.autoMap(doc.data.staff, doc.data.toastMap, emps)[name] || null; } catch (e) {} }
  if (!guid && formerRecs.length) guid = formerRecs[0].guid || null;
  const emp = guid && emps.find((e) => e.guid === guid);
  if (emp) { fullName = emp.name; email = emp.email; } else if (formerRecs.length) { fullName = formerRecs[0].fullName || null; email = formerRecs[0].email || null; }
  const status = onStaff ? "On staff" : formerRecs.length ? `Left — removed on ${nyParts(formerRecs[0].removedAt).stamp} (${formerRecs[0].by === "toast" ? "archived in Toast" : "removed by the manager"})` : "Not on staff";
  const monthly = {};
  const M = (d) => (monthly[d.slice(0, 7)] = monthly[d.slice(0, 7)] || { month: d.slice(0, 7), scheduled: 0, worked: 0, shifts: 0, clockins: 0 });
  // shifts
  const shifts = [];
  Object.keys(doc.data.weeks).sort().forEach((wk) => {
    const w = doc.data.weeks[wk];
    store.DAY_KEYS.forEach((d) => {
      const date = isoDate(wk, d); if (date < fromISO || date > toISO) return;
      (w[d] || []).filter((sh) => sh.name === name && !sh.src).forEach((sh) => {
        const mins = Math.max(0, minutesOf(sh.end) - minutesOf(sh.start) + (minutesOf(sh.end) < minutesOf(sh.start) ? 1440 : 0));
        const conf = confirmations[`${wk}:${d}:${sh.id}`]; const note = (w.notes && w.notes[d]) || {};
        const m = M(date); m.scheduled += mins / 60; m.shifts++;
        shifts.push({ date, weekday: weekdayOf(date), start: fmt12(sh.start), end: fmt12(sh.end), hours: round2(mins / 60), station: sh.station || "", confirmed: conf ? nyParts(conf).stamp : "not confirmed", day: STATUS_LABEL[note.status] || "Open", week: wk, id: sh.id });
      });
    });
  });
  // Toast clock-ins, month by month
  const clock = [], notes = [];
  if (guid && toast.enabled()) {
    try {
      (await toast.timeEntriesSpan(fromISO, toISO, 300)).filter((t) => t.employeeGuid === guid && t.in).forEach((t) => {
        const date = toast.shiftDate(t.in); if (date < fromISO || date > toISO) return;
        const brk = t.out ? (t.breakMin || 0) : 0; // unpaid breaks taken on the terminal, subtracted from the hours
        const ms = t.out ? Math.max(0, Date.parse(t.out) - Date.parse(t.in) - brk * 60000) : 0; const mm = M(date); mm.worked += ms / 3600000; mm.clockins++;
        clock.push({ date, weekday: weekdayOf(date), source: "Toast POS", in: nyParts(t.in).time, out: t.out ? nyParts(t.out).time : "", hours: t.out ? round2(ms / 3600000) : null, note: [t.out ? "" : "no clock-out recorded", brk ? `break ${Math.round(brk)} min (unpaid, not counted)` : ""].filter(Boolean).join(" · "), recorded: nyParts(t.in).stamp, ref: `Toast time entry ${t.guid}` });
      });
    } catch (e) { notes.push(`Toast clock-ins could not be read completely (${String(e.message || e).slice(0, 80)}) — export again later.`); }
  } else if (!guid) notes.push("Not linked to a Toast employee: clock-ins come from the app only.");
  // app clock-ins (current + archived)
  const punches = (onStaff ? await punch.all(name).catch(() => []) : []).concat(await punch.archivedFor(name).catch(() => []));
  punches.forEach((e) => {
    const date = toast.shiftDate(e.in); if (date < fromISO || date > toISO) return;
    const brk = e.out ? punch.breakMinutes(e) : 0; // unpaid breaks taken from the app, subtracted from the hours
    const ms = e.out ? Math.max(0, Date.parse(e.out) - Date.parse(e.in) - brk * 60000) : 0; const mm = M(date); mm.worked += ms / 3600000; mm.clockins++;
    const noteParts = [e.manual ? (e.note || "entered by the owner") : e.auto ? "clock-out auto-closed after 20 h" : (e.out ? "" : "still clocked in"), brk ? `break ${Math.round(brk)} min (unpaid, not counted)` : ""].filter(Boolean);
    clock.push({ date, weekday: weekdayOf(date), source: e.manual ? "Entered by the owner" : "Bar Lento app (phone)", in: nyParts(e.in).time, out: e.out ? nyParts(e.out).time : "", hours: e.out ? round2(ms / 3600000) : null, note: noteParts.join(" · "), recorded: nyParts(e.in).stamp, ref: `app entry ${e.id}` });
  });
  clock.sort((a, b) => (a.date + a.recorded).localeCompare(b.date + b.recorded));
  // signed documents: current + archive, every version incl. history
  const docRows = [];
  const addAck = (title, a) => { if (!a || !a.at) return; docRows.push({ title, a }); (a.history || []).forEach((h) => docRows.push({ title, a: h })); };
  addAck("House Rules", await accounts.getRulesAck(name).catch(() => null));
  Object.values(await accounts.allRulesAckArchive().catch(() => ({}))).filter((a) => a && a.name === name).forEach((a) => addAck("House Rules", a));
  for (const d of DOCS.list) addAck(d.title, await accounts.getDocAck(d.id, name).catch(() => null));
  Object.values(await accounts.allDocAckArchive().catch(() => ({}))).filter((a) => a && a.name === name).forEach((a) => { const d = DOCS.list.find((x) => x.id === a.doc); addAck(d ? d.title : a.doc, a); });
  const seen = new Set(), documents = [];
  docRows.forEach(({ title, a }) => {
    const k = `${title}|${a.version}|${a.at}`; if (seen.has(k)) return; seen.add(k);
    const p = nyParts(a.at); if (!p) return;
    documents.push({ date: p.date, time: p.time, title, version: a.version, signedAs: a.fullName || name, email: a.email || "", emailed: a.emailedAt ? "yes" : "no", device: a.ua || "", hash: a.hash || "" });
  });
  documents.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  // staff events (exact name)
  const events = [];
  try {
    const log = await store.getLog(2000);
    const N = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("^(Staff: (added|removed) " + N + "$|Staff: PIN reset for " + N + "$|Added from Toast: " + N + " \\(|Removed from staff \\(archived in Toast\\): " + N + " \\(|Signed copies re-sent to " + N + "( \\(self-service\\))?:)");
    (Array.isArray(log) ? log : (log && log.entries) || []).forEach((en) => (en.changes || []).forEach((c) => { if (!re.test(c)) return; const p = nyParts(en.at); if (!p) return; events.push({ date: p.date, time: p.time, text: c }); }));
  } catch (e) {}
  events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const months = Object.keys(monthly).sort().map((k) => Object.assign({}, monthly[k], { scheduled: round2(monthly[k].scheduled), worked: round2(monthly[k].worked) }));
  return { name, fullName, email, guid, status, onStaff, fromISO, toISO, shifts, clock, documents, events, months, notes };
}

async function personWorkbook(name, fromISO, toISO) {
  const [doc, confirmations] = await Promise.all([store.getSchedule(), store.getConfirmations()]);
  const r = await collectPerson(name, doc, confirmations, fromISO, toISO);
  const wb = new ExcelJS.Workbook(); wb.creator = "Bar Lento staff app"; wb.created = new Date();
  const now = nyParts(new Date().toISOString()).stamp;
  const totals = r.months.reduce((a, m) => ({ worked: a.worked + m.worked, scheduled: a.scheduled + m.scheduled, clockins: a.clockins + m.clockins, shifts: a.shifts + m.shifts }), { worked: 0, scheduled: 0, clockins: 0, shifts: 0 });
  summarySheet(wb, `Personnel record — ${r.name}`, `Bar Lento · 158 8th Avenue, New York · generated ${now} New York time`, [
    ["Name in the app", r.name], ["Full name (Toast)", r.fullName || "—"], ["Email on record", r.email || "—"], ["Status", r.status],
    ["Toast employee", r.guid ? r.guid : "not linked (clock-ins from the app)"], ["Period", `${r.fromISO} to ${r.toISO}`],
    ["Hours worked (clock-ins)", `${round2(totals.worked).toFixed(2)} h in ${totals.clockins} clock-ins`], ["Hours scheduled", `${round2(totals.scheduled).toFixed(2)} h in ${totals.shifts} shifts`],
    ["Documents signed", r.documents.length ? r.documents.map((d) => `${d.title} (v${d.version}, ${d.date})`).join("; ") : "none"],
    ["Notes", r.notes.length ? r.notes.join(" ") : "—"],
    ["Sheets", "Shifts (schedule), Clock-ins (Toast POS and app, with source), Documents (every signed policy with version, email and text fingerprint), Events (staff changes)."],
  ], [{ title: "Month by month", columns: [{ header: "Month", key: "month" }, { header: "Hours worked", key: "worked", type: "num" }, { header: "Clock-ins", key: "clockins", type: "num" }, { header: "Hours scheduled", key: "scheduled", type: "num" }, { header: "Shifts", key: "shifts", type: "num" }],
    rows: r.months.map((m) => ({ month: m.month, worked: m.worked, clockins: m.clockins, scheduled: m.scheduled, shifts: m.shifts })).concat(r.months.length ? [{ month: "Total", worked: round2(totals.worked), clockins: totals.clockins, scheduled: round2(totals.scheduled), shifts: totals.shifts, __bold: true }] : []) }]);
  sheetTable(wb, "Shifts", [
    { header: "Date", key: "date", type: "date", width: 16 }, { header: "Weekday", key: "weekday", width: 11 }, { header: "Start", key: "start", width: 10 }, { header: "End", key: "end", width: 10 }, { header: "Hours", key: "hours", type: "num", width: 8 },
    { header: "Station", key: "station", width: 9 }, { header: "Confirmed by employee (NY time)", key: "confirmed", width: 28 }, { header: "Day", key: "day", width: 14 }, { header: "Week of", key: "week", type: "date", width: 16 }, { header: "Shift id", key: "id", width: 14 },
  ], r.shifts);
  sheetTable(wb, "Clock-ins", [
    { header: "Date", key: "date", type: "date", width: 16 }, { header: "Weekday", key: "weekday", width: 11 }, { header: "Source", key: "source", width: 20 }, { header: "In", key: "in", width: 10 }, { header: "Out", key: "out", width: 10 }, { header: "Hours", key: "hours", type: "num", width: 8 },
    { header: "Note", key: "note", width: 28 }, { header: "Recorded (NY time)", key: "recorded", width: 18 }, { header: "Reference", key: "ref", width: 44 },
  ], r.clock);
  sheetTable(wb, "Documents", [
    { header: "Date", key: "date", type: "date", width: 16 }, { header: "Time (NY)", key: "time", width: 10 }, { header: "Document", key: "title", width: 46 }, { header: "Version", key: "version", width: 12 }, { header: "Signed as", key: "signedAs", width: 20 },
    { header: "Email", key: "email", width: 28 }, { header: "Copy emailed", key: "emailed", width: 12 }, { header: "Device", key: "device", width: 40 }, { header: "Text fingerprint (SHA-256)", key: "hash", width: 66 },
  ], r.documents);
  sheetTable(wb, "Events", [
    { header: "Date", key: "date", type: "date", width: 16 }, { header: "Time (NY)", key: "time", width: 10 }, { header: "Event", key: "text", width: 90, wrap: true },
  ], r.events);
  return { wb, filename: `bar-lento-record-${name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-${fromISO}-to-${toISO}.xlsx` };
}
// Employee's own report (hours only): used by the "My report" button and by the Sunday-night email.
async function employeeReport(name, fromISO, toISO, periodLabel) {
  const [doc, confirmations] = await Promise.all([store.getSchedule(), store.getConfirmations()]);
  const r = await collectPerson(name, doc, confirmations, fromISO, toISO);
  const out = await pdf.personRecordPdf(r, nyParts(new Date().toISOString()).stamp, { employee: true, periodLabel });
  const totals = r.months.reduce((a, m) => ({ worked: a.worked + m.worked, scheduled: a.scheduled + m.scheduled, clockins: a.clockins + m.clockins, shifts: a.shifts + m.shifts }), { worked: 0, scheduled: 0, clockins: 0, shifts: 0 });
  return { buf: out.buf, filename: `bar-lento-my-report-${fromISO}-to-${toISO}.pdf`, totals, email: r.email, fullName: r.fullName, guid: r.guid };
}
async function personPdfFile(name, fromISO, toISO) {
  const [doc, confirmations] = await Promise.all([store.getSchedule(), store.getConfirmations()]);
  const r = await collectPerson(name, doc, confirmations, fromISO, toISO);
  const out = await pdf.personRecordPdf(r, nyParts(new Date().toISOString()).stamp);
  return { buf: out.buf, filename: `bar-lento-record-${name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-${fromISO}-to-${toISO}.pdf` };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).send("method_not_allowed"); }
    if (new URL(req.url, "http://x").searchParams.get("selftest") === "1") { // public, no data: proves the PDF engine works on this server
      const out = await pdf.selfTestPdf(nyParts(new Date().toISOString()).stamp);
      res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Type", "application/pdf");
      return res.status(200).send(Buffer.from(out.buf));
    }
    const url = new URL(req.url, "http://x");
    if (url.searchParams.get("mine") === "1") { // an employee's own report, identified by the PIN device token; period = one schedule week by default
      if (!store.hasStorage()) return res.status(503).send("storage_missing");
      const doc0 = await store.getSchedule();
      const who = await accounts.whoIs(String(req.headers["x-staff-token"] || ""), doc0.data.staff);
      if (!who) return res.status(401).send("unauthorized");
      const isD = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
      let from = url.searchParams.get("from"), to = url.searchParams.get("to");
      if (!isD(from)) { const t = todayNY(); const d = new Date(t + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); from = d.toISOString().slice(0, 10); }
      if (!isD(to)) { const d = new Date(from + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 6); to = d.toISOString().slice(0, 10); }
      if (to < from) to = from;
      const maxTo = new Date(from + "T12:00:00Z"); maxTo.setUTCMonth(maxTo.getUTCMonth() + 12); if (to > maxTo.toISOString().slice(0, 10)) to = maxTo.toISOString().slice(0, 10);
      const out = await employeeReport(who, from, to, `Week ${from} to ${to}`.replace(/^Week (\S+) to (\S+)$/, (m, a, b) => (Date.parse(b) - Date.parse(a) === 6 * 86400000 ? `Week of ${a} to ${b}` : `Period ${a} to ${b}`)));
      res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
      return res.status(200).send(Buffer.from(out.buf));
    }
    if (!auth.adminEnabled()) return res.status(503).send("admin_disabled");
    const role = await auth.roleFrom(req);
    if (!role) return res.status(401).send("unauthorized");
    if (!store.hasStorage()) return res.status(503).send("storage_missing");

    const person = String(url.searchParams.get("person") || "").trim().slice(0, 60);
    if (role === "chef" && (!person || !auth.kitchenNames((await store.getSchedule()).data).includes(person))) return res.status(403).send("chef_forbidden"); // kitchen people only, no schedule archive
    const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "pdf"; // PDF by default: opens everywhere, not editable
    let out;
    if (person) {
      const isD = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
      let from = url.searchParams.get("from"), to = url.searchParams.get("to");
      if (!isD(to)) to = todayNY();
      if (!isD(from)) { const d = new Date(to + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 12); from = d.toISOString().slice(0, 10); }
      const minFrom = new Date(to + "T12:00:00Z"); minFrom.setUTCMonth(minFrom.getUTCMonth() - 24);
      if (from < minFrom.toISOString().slice(0, 10)) from = minFrom.toISOString().slice(0, 10);
      out = format === "xlsx" ? await personWorkbook(person, from, to) : await personPdfFile(person, from, to);
    } else out = format === "xlsx" ? await archiveWorkbook() : await archivePdfFile();
    const buf = out.buf || await out.wb.xlsx.writeBuffer();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
    return res.status(200).send(Buffer.from(buf));
  } catch (err) {
    return res.status(500).send("server_error: " + String(err && err.message || err));
  }
};
module.exports.employeeReport = employeeReport;
module.exports.todayNY = todayNY;
