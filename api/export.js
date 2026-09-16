const store = require("../lib/store");
const auth = require("../lib/auth");
const { fmt12 } = require("../lib/diff");

const DAY_LONG = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const STATUS_LABEL = { "": "Open", closed: "Closed", holiday: "Holiday", event: "Private event" };

function csvCell(v) {
  const s = String(v == null ? "" : v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function isoDate(weekISO, dayKey) {
  const [y, m, d] = weekISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + store.DAY_KEYS.indexOf(dayKey)));
  return dt.toISOString().slice(0, 10);
}

// Manager-only: full archive as CSV (every shift ever scheduled + confirmation time + day notes).
module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).send("method_not_allowed"); }
    if (!auth.adminEnabled()) return res.status(503).send("admin_disabled");
    if (!auth.checkPassword(auth.passwordFrom(req))) return res.status(401).send("unauthorized");

    const [doc, confirmations] = await Promise.all([store.getSchedule(), store.getConfirmations()]);
    const rows = [["date", "weekday", "week_of", "day_status", "day_note", "name", "station", "start", "end", "confirmed_at"]];

    Object.keys(doc.data.weeks).sort().forEach((wk) => {
      const w = doc.data.weeks[wk];
      store.DAY_KEYS.forEach((d) => {
        const note = (w.notes && w.notes[d]) || { status: "", text: "" };
        const base = [isoDate(wk, d), DAY_LONG[d], wk, STATUS_LABEL[note.status] || "Open", note.text || ""];
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
