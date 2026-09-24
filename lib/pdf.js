// Official PDF reports (US Letter): the personnel record of one person and the schedule archive.
// Generated from stored data only, never edited by hand; printing allowed, editing disabled (PDF permissions);
// every page carries the document fingerprint (SHA-256 of the data the report was built from).
const PDFDocument = require("pdfkit");
require("pdfkit/standard-fonts/Helvetica"); require("pdfkit/standard-fonts/HelveticaBold"); // static requires: the serverless bundler ships the font data
const crypto = require("crypto");

const INK = "#1D1D1F", MUTED = "#6E6E73", LINE = "#E5E5EA", HEAD = "#F2F2F4", ACCENT = "#0071E3", SOFT = "#F5F5F7";
const PAGE = { size: "LETTER", margin: 40 };
const FOOT_H = 34;

const CERTIFICATION = "This document was generated automatically by the Bar Lento staff application from the records it stores, without manual editing. " +
  "Bar Lento keeps these records in accordance with New York Labor Law §195(4) and §661 and 12 NYCRR §146-2.1 (payroll and time records, kept for six years), " +
  "New York City Administrative Code §20-919 (safe and sick time records, kept for three years) and New York Labor Law §201-g (sexual harassment prevention policy acknowledgments and annual training records). " +
  "Signed documents are identified by the SHA-256 fingerprint of the exact text acknowledged. The document fingerprint printed on every page identifies this report. " +
  "Clock-ins marked “Toast POS” are mirrored read-only from the Toast point-of-sale system; clock-ins marked “Bar Lento app” were recorded by the employee on their own phone. Scheduled shifts are the published plan and are listed for reference only: hours worked are established by clock-ins alone. Printing is allowed; editing is disabled.";

const EMPLOYEE_NOTE = "This report was generated automatically by the Bar Lento staff application from the same clock-in records the owners see: every clock-in and clock-out with the exact time recorded. " +
  "Nothing in it is typed by hand and nothing can be edited after the fact: the document fingerprint printed on every page identifies this exact report. " +
  "It shows times and hours only; pay is handled separately through payroll. Bar Lento keeps these records as required by New York Labor Law §195(4) and §661 and 12 NYCRR §146-2.1. " +
  "If a time or an hour does not match what you remember, tell the manager or an owner as soon as possible.";
function fingerprint(data) { return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex"); }

class Report {
  constructor(meta) {
    this.meta = meta; // {title, subtitle, generated, fingerprint}
    this.doc = new PDFDocument(Object.assign({ bufferPages: true, pdfVersion: "1.7", info: { Title: meta.title, Author: "Bar Lento staff app", Creator: "Bar Lento staff app · © Simone Viola" },
      ownerPassword: crypto.randomBytes(16).toString("hex"), permissions: { printing: "highResolution", modifying: false, copying: true, annotating: false, fillingForms: false, contentAccessibility: true, documentAssembly: false } }, PAGE));
    this.left = PAGE.margin; this.width = this.doc.page.width - 2 * PAGE.margin; this.bottom = this.doc.page.height - PAGE.margin - FOOT_H;
    this.y = PAGE.margin;
  }
  get d() { return this.doc; }
  newPage() { this.doc.addPage(); this.y = PAGE.margin; }
  ensure(h) { if (this.y + h > this.bottom) this.newPage(); }
  text(str, opts) { // one paragraph at the current y
    opts = opts || {}; const d = this.doc;
    d.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size || 9.5).fillColor(opts.color || INK);
    const w = opts.width || this.width; const h = d.heightOfString(str, { width: w, lineGap: 2 });
    this.ensure(h);
    d.text(str, opts.x || this.left, this.y, { width: w, lineGap: 2, align: opts.align || "left" });
    this.y += h + (opts.after == null ? 6 : opts.after);
  }
  heading(str) { this.ensure(90); this.y += 6; this.text(str, { bold: true, size: 13, after: 2 }); this.doc.moveTo(this.left, this.y).lineTo(this.left + this.width, this.y).lineWidth(0.8).strokeColor(ACCENT).stroke(); this.y += 8; }
  keyValues(pairs, cols) { // grid of label/value
    cols = cols || 2; const d = this.doc; const colW = this.width / cols; const labelW = cols === 1 ? 140 : 100;
    for (let i = 0; i < pairs.length; i += cols) {
      const row = pairs.slice(i, i + cols);
      let h = 0;
      row.forEach(([k, v]) => { d.font("Helvetica").fontSize(9); h = Math.max(h, d.heightOfString(String(v == null ? "" : v), { width: colW - labelW - 10 })); d.font("Helvetica-Bold").fontSize(8); h = Math.max(h, d.heightOfString(String(k).toUpperCase(), { width: labelW - 6 })); });
      this.ensure(h + 8);
      row.forEach(([k, v], j) => {
        const x = this.left + j * colW;
        d.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(String(k).toUpperCase(), x, this.y + 1, { width: labelW - 6 });
        d.font("Helvetica").fontSize(9).fillColor(INK).text(String(v == null ? "" : v), x + labelW, this.y, { width: colW - labelW - 10 });
      });
      this.y += h + 7;
    }
    this.y += 4;
  }
  tiles(items) { // big numbers in a row
    const d = this.doc; const n = items.length; const gap = 8; const w = (this.width - gap * (n - 1)) / n; const h = 48;
    this.ensure(h + 10);
    items.forEach((it, i) => {
      const x = this.left + i * (w + gap);
      d.roundedRect(x, this.y, w, h, 8).fillColor(SOFT).fill();
      d.font("Helvetica-Bold").fontSize(15).fillColor(it.accent ? ACCENT : INK).text(it.value, x + 10, this.y + 9, { width: w - 20 });
      d.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(String(it.label).toUpperCase(), x + 10, this.y + 31, { width: w - 20 });
    });
    this.y += h + 12;
  }
  table(columns, rows, opts) { // columns [{header,key,w,align,wrap}] widths in fractions of the page width
    opts = opts || {}; const d = this.doc; const fs = opts.fontSize || 8.2; const pad = 4;
    const total = columns.reduce((a, c) => a + (c.w || 1), 0);
    const widths = columns.map((c) => (c.w || 1) / total * this.width);
    const header = () => {
      d.font("Helvetica-Bold").fontSize(fs);
      const h = Math.max(16, ...columns.map((c, i) => d.heightOfString(c.header, { width: widths[i] - 2 * pad }) + 8)); this.ensure(h + 30); // never a header alone at the bottom
      d.rect(this.left, this.y, this.width, h).fillColor(HEAD).fill();
      let x = this.left;
      columns.forEach((c, i) => { d.font("Helvetica-Bold").fontSize(fs).fillColor(INK).text(c.header, x + pad, this.y + 4, { width: widths[i] - 2 * pad, align: c.align || "left" }); x += widths[i]; });
      this.y += h;
    };
    if (!rows.length) { this.text(opts.empty || "Nothing recorded in this period.", { color: MUTED, size: 9 }); return; }
    header();
    rows.forEach((r) => {
      d.font(r.__bold ? "Helvetica-Bold" : "Helvetica").fontSize(fs);
      const cells = columns.map((c, i) => { const v = r[c.key]; const s = v == null ? "" : (c.format ? c.format(v) : String(v)); return { s, h: d.heightOfString(s, { width: widths[i] - 2 * pad }) }; });
      const h = Math.max(14, ...cells.map((c) => c.h + 6));
      if (this.y + h > this.bottom) { this.newPage(); header(); }
      if (r.__fill) d.rect(this.left, this.y, this.width, h).fillColor(r.__fill).fill();
      let x = this.left;
      columns.forEach((c, i) => { d.font(r.__bold ? "Helvetica-Bold" : "Helvetica").fontSize(fs).fillColor(r.__muted ? MUTED : INK).text(cells[i].s, x + pad, this.y + 3, { width: widths[i] - 2 * pad, align: c.align || "left" }); x += widths[i]; });
      d.moveTo(this.left, this.y + h).lineTo(this.left + this.width, this.y + h).lineWidth(0.4).strokeColor(LINE).stroke();
      this.y += h;
    });
    this.y += 10;
  }
  finish() {
    const d = this.doc; const range = d.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      d.switchToPage(i);
      const y = d.page.height - PAGE.margin - FOOT_H + 8;
      d.moveTo(this.left, y).lineTo(this.left + this.width, y).lineWidth(0.5).strokeColor(LINE).stroke();
      d.font("Helvetica").fontSize(6.8).fillColor(MUTED)
        .text(`Bar Lento · 158 8th Avenue, New York, NY · ${this.meta.title} · generated ${this.meta.generated} NY time`, this.left, y + 5, { width: this.width - 80, lineBreak: false, ellipsis: true })
        .text(`Page ${i - range.start + 1} of ${range.count}`, this.left + this.width - 80, y + 5, { width: 80, align: "right", lineBreak: false })
        .text(`System-generated record, not editable · document fingerprint SHA-256 ${this.meta.fingerprint}`, this.left, y + 15, { width: this.width, lineBreak: false, ellipsis: true });
    }
    d.end();
    return new Promise((resolve, reject) => { const chunks = []; d.on("data", (c) => chunks.push(c)); d.on("end", () => resolve(Buffer.concat(chunks))); d.on("error", reject); });
  }
}

function titleBlock(rep, kicker, title, sub) {
  const d = rep.doc;
  d.font("Helvetica-Bold").fontSize(9).fillColor(ACCENT).text(kicker.toUpperCase(), rep.left, rep.y, { characterSpacing: 1 });
  rep.y += 14;
  d.font("Helvetica-Bold").fontSize(20).fillColor(INK).text(title, rep.left, rep.y, { width: rep.width });
  rep.y += 26;
  d.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(sub, rep.left, rep.y, { width: rep.width });
  rep.y += 22;
}

const h2 = (n) => (n == null ? "" : Number(n).toFixed(2));

// Totals by day, from clock-ins only (what was actually worked; the schedule is a plan, never proof)
function dayTotals(r) {
  const days = {};
  r.clock.forEach((c) => { const d = (days[c.date] = days[c.date] || { date: c.date, weekday: c.weekday, n: 0, hours: 0, open: false }); d.n++; d.hours += c.hours || 0; if (!c.out) d.open = true; });
  return Object.keys(days).sort().map((k) => { const d = days[k]; return { date: d.date, weekday: d.weekday, n: d.n, hours: d.hours, note: d.open ? "one clock-in still open" : "" }; });
}
const signed = (n) => (n == null ? "" : (n > 0 ? "+" : "") + h2(n));

// ---- personnel record (manager) / my report (employee: hours only, no manager-only fields, nothing about money) ----
async function personRecordPdf(r, generated, opts) {
  opts = opts || {}; const emp = !!opts.employee;
  const fp = fingerprint({ kind: emp ? "myreport" : "record", r });
  const period = opts.periodLabel || `Period ${r.fromISO} to ${r.toISO}`;
  const rep = new Report({ title: emp ? `My report — ${r.name}` : `Personnel record — ${r.name}`, generated, fingerprint: fp });
  titleBlock(rep, emp ? "Bar Lento · my hours report" : "Bar Lento · personnel record", r.fullName ? `${r.name} (${r.fullName})` : r.name, `${period} · generated ${generated} New York time`);
  const totals = r.months.reduce((a, m) => ({ worked: a.worked + m.worked, scheduled: a.scheduled + m.scheduled, clockins: a.clockins + m.clockins, shifts: a.shifts + m.shifts }), { worked: 0, scheduled: 0, clockins: 0, shifts: 0 });
  const days = dayTotals(r);
  if (emp) {
    rep.tiles([{ value: h2(totals.worked) + " h", label: "hours worked", accent: true }, { value: String(totals.clockins), label: "clock-ins" }, { value: String(days.length), label: "days worked" }]);
    rep.text("Every line below is a real clock-in" + (r.guid ? " on the Toast terminal" : " in the app") + ", with the exact times recorded. If a time does not match what you remember, tell the manager or an owner right away: the record can only be checked, never rewritten.", { color: MUTED, size: 8.5 });
    if (r.notes.length) rep.text(r.notes.join(" "), { color: MUTED, size: 8.5 });
    rep.heading("Clock-ins");
    rep.table([{ header: "Date", key: "date", w: 1 }, { header: "Weekday", key: "weekday", w: 0.9 }, { header: "Clock-in", key: "in", w: 0.9 }, { header: "Clock-out", key: "out", w: 0.9 }, { header: "Hours", key: "hours", w: 0.7, align: "right", format: h2 }, { header: "Recorded by", key: "source", w: 1.4 }, { header: "Note", key: "note", w: 1.6 }], r.clock, { empty: "No clock-ins in this period." });
    rep.heading("Totals by day");
    rep.table([{ header: "Date", key: "date", w: 1 }, { header: "Weekday", key: "weekday", w: 0.9 }, { header: "Clock-ins", key: "n", w: 0.7, align: "right" }, { header: "Hours worked", key: "hours", w: 0.9, align: "right", format: h2 }, { header: "Note", key: "note", w: 2 }], days.concat(days.length ? [{ date: "Total", weekday: "", n: totals.clockins, hours: totals.worked, note: "", __bold: true, __fill: SOFT }] : []), { empty: "No clock-ins in this period." });
  } else {
    rep.tiles([{ value: h2(totals.worked) + " h", label: "hours worked (clock-ins)", accent: true }, { value: String(totals.clockins), label: "clock-ins" }, { value: h2(totals.scheduled) + " h", label: "hours scheduled" }, { value: String(totals.shifts), label: "shifts" }, { value: String(r.documents.length), label: "documents signed" }]);
    rep.keyValues([["Status", r.status], ["Email on record", r.email || "—"], ["Toast employee", r.guid || "not linked (clock-ins from the app)"], ["Name in the app", r.name]]);
    if (r.notes.length) rep.text(r.notes.join(" "), { color: MUTED, size: 8.5 });
  }
  if (emp) { rep.heading("About this report"); rep.text(EMPLOYEE_NOTE, { size: 8.2, color: MUTED }); return { buf: await rep.finish(), fingerprint: fp }; }
  rep.heading("Clock-ins (actual work)");
  rep.table([{ header: "Date", key: "date", w: 1 }, { header: "Weekday", key: "weekday", w: 0.9 }, { header: "Source", key: "source", w: 1.4 }, { header: "In", key: "in", w: 0.8 }, { header: "Out", key: "out", w: 0.8 }, { header: "Hours", key: "hours", w: 0.6, align: "right", format: h2 }, { header: "Note", key: "note", w: 1.4 }, { header: "Reference", key: "ref", w: 2.4 }], r.clock, { empty: "No clock-ins in this period." });
  rep.heading("Totals by day (actual work)");
  rep.table([{ header: "Date", key: "date", w: 1 }, { header: "Weekday", key: "weekday", w: 0.9 }, { header: "Clock-ins", key: "n", w: 0.7, align: "right" }, { header: "Hours worked", key: "hours", w: 0.9, align: "right", format: h2 }, { header: "Note", key: "note", w: 2 }], days.concat(days.length ? [{ date: "Total", weekday: "", n: totals.clockins, hours: totals.worked, note: "", __bold: true, __fill: SOFT }] : []), { empty: "No clock-ins in this period." });
  rep.heading("Month by month");
  rep.table([{ header: "Month", key: "month", w: 1.2 }, { header: "Hours worked", key: "worked", w: 1, align: "right", format: h2 }, { header: "Clock-ins", key: "clockins", w: 0.8, align: "right" }, { header: "Hours scheduled", key: "scheduled", w: 1, align: "right", format: h2 }, { header: "Shifts", key: "shifts", w: 0.8, align: "right" }],
    r.months.concat(r.months.length ? [{ month: "Total", worked: totals.worked, clockins: totals.clockins, scheduled: totals.scheduled, shifts: totals.shifts, __bold: true, __fill: SOFT }] : []));
  rep.heading("Scheduled shifts (the plan, not proof of work)");
  rep.table([{ header: "Date", key: "date", w: 1 }, { header: "Weekday", key: "weekday", w: 0.9 }, { header: "Start", key: "start", w: 0.8 }, { header: "End", key: "end", w: 0.8 }, { header: "Hours", key: "hours", w: 0.6, align: "right", format: h2 }, { header: "Station", key: "station", w: 0.7 }, { header: "Confirmed by employee", key: "confirmed", w: 1.5 }, { header: "Day", key: "day", w: 0.9 }, { header: "Shift id", key: "id", w: 1 }], r.shifts, { empty: "No shifts scheduled in this period." });
  rep.heading("Documents signed");
  rep.table([{ header: "Date", key: "date", w: 1.15 }, { header: "Time", key: "time", w: 0.9 }, { header: "Document", key: "title", w: 2.3 }, { header: "Version", key: "version", w: 1.15 }, { header: "Signed as", key: "signedAs", w: 1.2 }, { header: "Email", key: "email", w: 1.7 }, { header: "Sent", key: "emailed", w: 0.6 }, { header: "Text fingerprint (SHA-256)", key: "hash", w: 2.4 }], r.documents, { fontSize: 7.4 });
  rep.heading("Staff events");
  rep.table([{ header: "Date", key: "date", w: 1 }, { header: "Time", key: "time", w: 0.7 }, { header: "Event", key: "text", w: 6 }], r.events);
  rep.heading("Certification");
  rep.text(CERTIFICATION, { size: 8.2, color: MUTED });
  return { buf: await rep.finish(), fingerprint: fp };
}

// ---- schedule archive ----
async function archivePdf(a, generated) { // a: {first,last,weeks:[{wk,label,days:[{date,weekday,status,note,shifts:[...]}]}], staff, totalShifts}
  const fp = fingerprint({ kind: "archive", a });
  const rep = new Report({ title: "Schedule archive", generated, fingerprint: fp });
  titleBlock(rep, "Bar Lento · schedule archive", "Every week published in the app", `${a.first} to ${a.last} · ${a.weeks.length} weeks · ${a.totalShifts} shifts · generated ${generated} New York time`);
  rep.keyValues([["People on staff today", a.staff.join(", ")], ["Confirmed", "the time the employee confirmed the shift in the app, New York time"]], 1);
  a.weeks.forEach((w) => {
    rep.heading(w.label);
    const rows = [];
    w.days.forEach((dday) => {
      if (dday.status !== "Open" || dday.note) rows.push({ date: dday.date, weekday: dday.weekday, name: dday.status + (dday.note ? " — " + dday.note : ""), __muted: true, __fill: SOFT });
      dday.shifts.forEach((s) => rows.push(Object.assign({ date: dday.date, weekday: dday.weekday }, s)));
    });
    rep.table([{ header: "Date", key: "date", w: 1 }, { header: "Weekday", key: "weekday", w: 0.9 }, { header: "Name / day note", key: "name", w: 2.2 }, { header: "Station", key: "station", w: 0.7 }, { header: "Start", key: "start", w: 0.8 }, { header: "End", key: "end", w: 0.8 }, { header: "Hours", key: "hours", w: 0.6, align: "right", format: (v) => (v === "" ? "" : h2(v)) }, { header: "Confirmed by employee", key: "confirmed", w: 1.6 }], rows, { empty: "No shifts this week." });
  });
  rep.heading("Certification");
  rep.text(CERTIFICATION, { size: 8.2, color: MUTED });
  return { buf: await rep.finish(), fingerprint: fp };
}

async function selfTestPdf(generated) {
  const rep = new Report({ title: "Export self-test", generated, fingerprint: fingerprint({ kind: "selftest", generated }) });
  titleBlock(rep, "Bar Lento \u00b7 export self-test", "PDF generation works", `Generated ${generated} New York time \u00b7 this page contains no data`);
  rep.text("If you can read this, the report engine, its fonts and its permissions are working on the server.", { color: MUTED });
  return { buf: await rep.finish() };
}

// ---- team hours (owner/manager, owner 2026-09-24): one PDF, everyone, one period. Hours from clock-ins only; nothing about money.
async function teamPdf(t, generated) { // t: {fromISO, toISO, periodLabel, people:[{name, dept, fullName, worked, scheduled, clockins, days, breakMin, dayRows:[{date,weekday,n,hours}]}]}
  const fp = fingerprint({ kind: "team", t });
  const rep = new Report({ title: `Team hours — ${t.periodLabel}`, generated, fingerprint: fp });
  titleBlock(rep, "Bar Lento · team hours", t.periodLabel, `${t.fromISO} to ${t.toISO} · ${t.people.length} people · generated ${generated} New York time`);
  const tot = t.people.reduce((a, p) => ({ worked: a.worked + p.worked, scheduled: a.scheduled + p.scheduled, clockins: a.clockins + p.clockins, days: a.days + p.days }), { worked: 0, scheduled: 0, clockins: 0, days: 0 });
  rep.tiles([{ value: h2(tot.worked) + " h", label: "hours worked (clock-ins)", accent: true }, { value: String(t.people.filter((p) => p.clockins).length), label: "people who worked" }, { value: String(tot.clockins), label: "clock-ins" }, { value: h2(tot.scheduled) + " h", label: "hours scheduled" }]);
  rep.text("Hours worked come from clock-ins on the Toast terminal or in the app, net of unpaid breaks. The schedule is a plan and is never counted as work. Nothing in this report concerns pay or tips.", { color: MUTED, size: 8.5 });
  rep.heading("By person");
  const rows = t.people.slice().sort((a, b) => b.worked - a.worked).map((p) => ({ name: p.fullName && p.fullName !== p.name ? `${p.name} (${p.fullName})` : p.name, dept: p.dept, days: p.days, clockins: p.clockins, worked: p.worked, brk: p.breakMin ? Math.round(p.breakMin) + " min" : "", scheduled: p.scheduled }));
  rows.push({ name: "Total", days: tot.days, clockins: tot.clockins, worked: tot.worked, scheduled: tot.scheduled, __bold: true, __fill: SOFT });
  rep.table([{ header: "Person", key: "name", w: 2 }, { header: "Department", key: "dept", w: 1 }, { header: "Days", key: "days", w: 0.6, align: "right" }, { header: "Clock-ins", key: "clockins", w: 0.8, align: "right" }, { header: "Hours worked", key: "worked", w: 1, align: "right", format: h2 }, { header: "Breaks", key: "brk", w: 0.8, align: "right" }, { header: "Scheduled", key: "scheduled", w: 0.9, align: "right", format: h2 }], rows);
  t.people.filter((p) => p.dayRows.length).sort((a, b) => a.name.localeCompare(b.name)).forEach((p) => {
    rep.heading(`${p.name} · day by day`);
    rep.table([{ header: "Date", key: "date", w: 1 }, { header: "Weekday", key: "weekday", w: 1 }, { header: "Clock-ins", key: "n", w: 0.7, align: "right" }, { header: "Hours worked", key: "hours", w: 1, align: "right", format: h2 }], p.dayRows.concat([{ date: "Total", n: p.clockins, hours: p.worked, __bold: true, __fill: SOFT }]));
  });
  rep.heading("Certification");
  rep.text(CERTIFICATION, { size: 8.2, color: MUTED });
  return { buf: await rep.finish(), fingerprint: fp };
}
module.exports = { personRecordPdf, archivePdf, teamPdf, selfTestPdf, CERTIFICATION };
