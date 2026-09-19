// Sunday-night weekly report: every person on staff gets their own PDF (hours only) of the week that just ended,
// at the email they signed with (or their Toast email). Fired by the Vercel cron in vercel.json; can also be run by
// the manager (password) with ?week=YYYY-MM-DD (a Monday) to resend. One send per week (Redis flag), never twice.
const store = require("../lib/store");
const auth = require("../lib/auth");
const accounts = require("../lib/accounts");
const toast = require("../lib/toast");
const mail = require("../lib/mail");
const DOCS = require("../documents.js");
const exp = require("./export");

const TZ = "America/New_York";
function nyNow() {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "short" }).formatToParts(new Date());
  const g = (t) => (p.find((x) => x.type === t) || {}).value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) % 24, weekday: g("weekday") };
}
// The week to report: if it is still Sunday in New York, this week; otherwise (early Monday UTC-wise) the week that ended yesterday.
function weekToReport() {
  const n = nyNow(); const d = new Date(n.date + "T12:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow - (n.weekday === "Sun" ? 0 : 7));
  const mon = d.toISOString().slice(0, 10); d.setUTCDate(d.getUTCDate() + 6);
  return { from: mon, to: d.toISOString().slice(0, 10) };
}
const fmtH = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`; };
function label(from, to) {
  const f = new Date(from + "T12:00:00Z"), t = new Date(to + "T12:00:00Z");
  const o = { month: "short", day: "numeric", timeZone: "UTC" };
  return `${f.toLocaleDateString("en-US", o)} – ${t.toLocaleDateString("en-US", o)}, ${t.getUTCFullYear()}`;
}

module.exports = async (req, res) => {
  const send = (code, body) => { res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Type", "application/json; charset=utf-8"); res.status(code).send(JSON.stringify(body)); };
  try {
    const url = new URL(req.url, "http://x");
    const isCron = process.env.CRON_SECRET ? req.headers.authorization === `Bearer ${process.env.CRON_SECRET}` : Boolean(req.headers["x-vercel-cron"] || req.headers["user-agent"] && /vercel-cron/i.test(req.headers["user-agent"]));
    const isAdmin = auth.adminEnabled() && auth.checkPassword(auth.passwordFrom(req));
    if (!isCron && !isAdmin) return send(401, { error: "unauthorized" });
    if (!store.hasStorage()) return send(503, { error: "storage_missing" });
    if (!mail.enabled()) return send(503, { error: "mail_not_configured" });
    let { from, to } = weekToReport();
    const asked = url.searchParams.get("week");
    if (isAdmin && /^\d{4}-\d{2}-\d{2}$/.test(asked || "")) { from = asked; const d = new Date(from + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 6); to = d.toISOString().slice(0, 10); }
    const force = isAdmin && url.searchParams.get("force") === "1";
    const flagKey = "barlento:weekly_sent:" + from;
    if (!force) { const already = await store._redis("GET", flagKey).catch(() => null); if (already) return send(200, { ok: true, week: from, skipped: "already sent", at: already }); }
    await store._redis("SET", flagKey, new Date().toISOString(), "EX", 40 * 86400).catch(() => {});
    const doc = await store.getSchedule();
    let emps = [], map = {};
    if (toast.enabled()) { try { emps = await toast.employees(true); map = toast.autoMap(doc.data.staff, doc.data.toastMap, emps); } catch (e) {} }
    const sent = [], skipped = [], failed = [];
    for (const name of doc.data.staff) {
      if (/^test\b/i.test(name)) { skipped.push(`${name} (test)`); continue; }
      try {
        const rAck = await accounts.getRulesAck(name).catch(() => null);
        const emp = map[name] && emps.find((e) => e.guid === map[name]);
        const email = (rAck && rAck.email) || (emp && emp.email) || "";
        if (!email) { skipped.push(`${name} (no email)`); continue; }
        const rep = await exp.employeeReport(name, from, to, `Week of ${from} to ${to}`);
        if (!rep.totals.clockins) { skipped.push(`${name} (no clock-ins this week)`); continue; }
        const first = name.split(/\s+/)[0]; const wk = label(from, to);
        const text = `Hi ${first},\n\nhere is your Bar Lento report for the week ${wk}.\n\nHours worked: ${fmtH(rep.totals.worked)} in ${rep.totals.clockins} clock-in${rep.totals.clockins === 1 ? "" : "s"}\n\nThe PDF attached lists every clock-in and clock-out with the exact times recorded, and the hours of each day. It comes from the same records the owners see. If something does not match, tell the manager or an owner as soon as possible.\n\nBar Lento · 158 8th Avenue, New York`;
        const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1D1D1F;max-width:560px"><p>Hi ${first},</p><p>here is your Bar Lento report for the week <b>${wk}</b>.</p><table style="border-collapse:collapse;margin:12px 0"><tr><td style="padding:6px 14px 6px 0;color:#6E6E73">Hours worked</td><td style="padding:6px 0"><b>${fmtH(rep.totals.worked)}</b> in ${rep.totals.clockins} clock-in${rep.totals.clockins === 1 ? "" : "s"}</td></tr></table><p>The PDF attached lists every clock-in and clock-out with the exact times recorded, and the hours of each day. It comes from the same records the owners see. If something does not match, tell the manager or an owner as soon as possible.</p><p style="color:#6E6E73;font-size:13px">Bar Lento · 158 8th Avenue, New York</p></div>`;
        await mail.send({ to: email, subject: `Your Bar Lento week — ${wk}`, text, html, attachments: [{ filename: rep.filename, content: rep.buf }] });
        sent.push(`${name} <${email}> ${fmtH(rep.totals.worked)}`);
      } catch (e) { failed.push(`${name}: ${String(e && e.message || e).slice(0, 120)}`); }
    }
    if (DOCS.copyTo && (sent.length || failed.length)) { // one line to the owner, never one email per person
      const body = `Weekly reports for ${label(from, to)}\n\nSent (${sent.length}):\n${sent.map((s) => "- " + s).join("\n") || "- none"}\n\nSkipped (${skipped.length}):\n${skipped.map((s) => "- " + s).join("\n") || "- none"}\n\nFailed (${failed.length}):\n${failed.map((s) => "- " + s).join("\n") || "- none"}`;
      await mail.send({ to: DOCS.copyTo, subject: `Weekly reports sent — ${label(from, to)} (${sent.length} people)`, text: body, html: `<pre style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;white-space:pre-wrap;color:#1D1D1F">${body.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</pre>` }).catch(() => {});
    }
    await store.appendLog({ at: new Date().toISOString(), version: null, changes: [`Weekly reports ${from}: sent to ${sent.length}${skipped.length ? `, skipped ${skipped.length}` : ""}${failed.length ? `, failed ${failed.length}` : ""}`] }).catch(() => {});
    return send(200, { ok: true, week: from, to, sent, skipped, failed });
  } catch (err) {
    return send(500, { error: "server_error", detail: String(err && err.message || err) });
  }
};
