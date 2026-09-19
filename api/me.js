const store = require("../lib/store");
const auth = require("../lib/auth");
const accounts = require("../lib/accounts");
const toast = require("../lib/toast");
const crypto = require("crypto");
const RULES = require("../rules.js");
const DOCS = require("../documents.js");
const mail = require("../lib/mail");

const DOC_IDS = DOCS.list.map((d) => d.id);
function docById(id) { return DOCS.list.find((d) => d.id === id) || null; }
// What the client needs to know about a person's acknowledgment of a document (never the device or the hash).
function ackView(a) { return a ? { version: a.version, at: a.at, emailed: Boolean(a.emailedAt) } : null; }
function docVersions() { const v = {}; DOCS.list.forEach((d) => { v[d.id] = d.version; }); return v; }

// The person's Toast record (full legal-ish name + email), when Toast is connected and the name is linked.
async function toastIdentity(data, name) {
  try {
    if (!toast.enabled()) return null;
    const emps = await toast.employees(true);
    const guid = toast.autoMap(data.staff, data.toastMap, emps)[name];
    const e = guid ? emps.find((x) => x.guid === guid) : null;
    return e ? { fullName: e.name, email: e.email || "" } : null;
  } catch (e) { return null; }
}
function fullDoc(doc) { return Object.assign({ contacts: DOCS.contacts, printUrl: "https://bar-lento.vercel.app/docs.html?id=" + encodeURIComponent(doc.id) }, doc); }
// One email with several documents (the "Your documents" packet) + the owner's proof. `ack.hashes` = {docId: sha256}. Never throws.
async function emailPacket(docs, ack, ownerToo) {
  if (!mail.enabled()) return { sent: false, reason: "mail_not_configured" };
  try {
    const full = docs.map(fullDoc);
    const m = mail.packetCopy(full, ack);
    await mail.send({ to: ack.email, subject: m.subject, html: m.html, text: m.text });
    if (ownerToo !== false && DOCS.copyTo) {
      const o = mail.packetCopy(full, ack, true);
      await mail.send({ to: DOCS.copyTo, subject: o.subject, html: o.html, text: o.text }).catch((e) => console.error("owner copy failed:", e && e.message));
    }
    return { sent: true };
  } catch (e) { return { sent: false, reason: String(e && e.message || e).slice(0, 160) }; }
}
// Build (and store) the acknowledgment record of one document; first acknowledgment of a version wins. Returns {rec, existed}.
async function recordDocAck(docDef, who, email, at, ua, ident) {
  const prev = await accounts.getDocAck(docDef.id, who).catch(() => null);
  if (prev && prev.version === docDef.version) return { rec: prev, existed: true };
  const hash = crypto.createHash("sha256").update(JSON.stringify(docDef)).digest("hex");
  const history = prev ? (prev.history || []).concat([{ version: prev.version, email: prev.email, at: prev.at, ua: prev.ua, hash: prev.hash || null, fullName: prev.fullName || null, emailedAt: prev.emailedAt || null }]) : [];
  const rec = { version: docDef.version, email, at, ua, hash, history, name: who, doc: docDef.id, fullName: ident ? ident.fullName : null, emailedAt: null };
  if (prev) await accounts.setDocAck(docDef.id, who, rec); // new version replaces the old one (kept in history)
  else if (!(await accounts.setDocAckIfAbsent(docDef.id, who, rec))) { // someone (the same person, twice) got there first
    const first = await accounts.getDocAck(docDef.id, who).catch(() => null);
    if (first && first.version === docDef.version) return { rec: first, existed: true };
    await accounts.setDocAck(docDef.id, who, rec);
  }
  return { rec, existed: false };
}
// Email the signed copy of a document (documents.js) to the person and the owner's proof copy. Never throws.
async function emailDocCopy(doc, ack) {
  if (!mail.enabled()) return { sent: false, reason: "mail_not_configured" };
  try {
    const full = Object.assign({ contacts: DOCS.contacts, printUrl: "https://bar-lento.vercel.app/docs.html?id=" + encodeURIComponent(doc.id) }, doc);
    const m = mail.docCopy(full, ack);
    await mail.send({ to: ack.email, subject: m.subject, html: m.html, text: m.text });
    if (DOCS.copyTo) {
      const o = mail.docCopy(full, ack, true);
      await mail.send({ to: DOCS.copyTo, subject: o.subject, html: o.html, text: o.text }).catch((e) => console.error("owner copy failed:", e && e.message));
    }
    return { sent: true };
  } catch (e) { return { sent: false, reason: String(e && e.message || e).slice(0, 160) }; }
}
// Email the signed copy to the person and a copy to the owner. Never throws.
async function emailRulesCopy(ack, ownerToo) {
  if (!mail.enabled()) return { sent: false, reason: "mail_not_configured" };
  try {
    // Two separate emails: the person's signed copy, and the owner's proof ("X acknowledged…") — distinct subjects so
    // mailboxes never merge them, even when the two addresses are the same.
    const m = mail.rulesCopy(ack);
    await mail.send({ to: ack.email, subject: m.subject, html: m.html, text: m.text });
    if (ownerToo !== false && RULES.copyTo) {
      const o = mail.rulesCopy(ack, true);
      await mail.send({ to: RULES.copyTo, subject: o.subject, html: o.html, text: o.text }).catch((e) => console.error("owner copy failed:", e && e.message));
    }
    return { sent: true };
  } catch (e) { return { sent: false, reason: String(e && e.message || e).slice(0, 160) }; }
}

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}
function tokenFrom(req) {
  const h = req.headers["x-staff-token"];
  return typeof h === "string" ? h : "";
}
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
function mins(t) { const p = String(t || "0:0").split(":").map(Number); return p[0] * 60 + (p[1] || 0); }
// NY minutes-of-day for an instant (punches after midnight count past 24h so 1 AM after a 4 PM start is "late", not "early").
function nyMinutes(iso) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t) => Number((parts.find((p) => p.type === t) || {}).value);
  const h = g("hour") % 24; return (h < 6 ? h + 24 : h) * 60 + g("minute");
}
// One person's week: scheduled minutes, worked minutes, and per-shift clock-in deviation vs scheduled start.
async function weekSummary(data, name, guid, weekISO) {
  const w = data.weeks[weekISO];
  const out = { week: weekISO, exists: Boolean(w), scheduledMin: 0, scheduledShifts: 0, workedMin: 0, clockedShifts: 0, matched: 0, onTime: 0, early: 0, devSum: 0, avgDev: null, onTimePct: null };
  if (!w) return out;
  const startByDay = {};
  DAYS.forEach((d) => {
    const note = w.notes && w.notes[d]; if (note && (note.status === "closed" || note.status === "holiday")) return;
    (w[d] || []).filter((s) => s.name === name).forEach((s) => { out.scheduledShifts++; out.scheduledMin += Math.max(0, mins(s.end) - mins(s.start)); if (startByDay[d] == null || mins(s.start) < startByDay[d]) startByDay[d] = mins(s.start); });
  });
  if (!guid) return out;
  const entries = await toast.weekEntriesFor(guid, weekISO);
  const firstInByDay = {};
  entries.forEach((e) => {
    out.workedMin += Math.max(0, (Date.parse(e.out || new Date().toISOString()) - Date.parse(e.in)) / 60000);
    const m = nyMinutes(e.in); if (firstInByDay[e.day] == null || m < firstInByDay[e.day]) firstInByDay[e.day] = m;
  });
  out.workedMin = Math.round(out.workedMin);
  out.clockedShifts = Object.keys(firstInByDay).length;
  Object.keys(firstInByDay).forEach((d) => {
    if (startByDay[d] == null) return;
    const dev = firstInByDay[d] - startByDay[d]; // negative = early
    out.matched++; out.devSum += dev; if (dev <= 5) out.onTime++; if (dev < 0) out.early++;
  });
  if (out.matched) { out.avgDev = Math.round(out.devSum / out.matched); out.onTimePct = Math.round(out.onTime / out.matched * 100); }
  return out;
}
function sumMinutes(list) {
  return list.reduce((a, s) => a + Math.max(0, (Date.parse(s.out || new Date().toISOString()) - Date.parse(s.in)) / 60000), 0);
}

// Personal access (name + 4-digit PIN, remembered per device).
//   POST {action:"begin", name}          → does this name have a PIN yet? locked?
//   POST {action:"create", name, pin}    → first PIN → token
//   POST {action:"login", name, pin}     → token
//   POST {action:"logout"}  (x-staff-token)
//   POST {action:"ackRules", email, version} (x-staff-token) → House Rules read & acknowledged (once per version)
//   GET  ?action=who                      (x-staff-token) → {name}
//   GET  ?action=hours&week=YYYY-MM-DD    (x-staff-token, or manager + &name=) → Toast clock-ins of that week
//   GET  ?action=recap&week=YYYY-MM-DD    (x-staff-token) → that week vs the week before (for the encouraging weekly review)
//   GET  ?action=list                     (manager) → who has a PIN / how many devices
//   POST {action:"reset", name}           (manager) → clear PIN + sign out everywhere
module.exports = async (req, res) => {
  try {
    if (!store.hasStorage()) return send(res, 503, { error: "storage_missing" });
    const url = new URL(req.url, "http://x");
    const body = req.body || {};
    const action = req.method === "GET" ? (url.searchParams.get("action") || "who") : String(body.action || "");
    const isAdmin = auth.adminEnabled() && auth.checkPassword(auth.passwordFrom(req));

    if (req.method === "GET") {
      const doc = await store.getSchedule();
      if (action === "list") {
        if (!isAdmin) return send(res, 401, { error: "unauthorized" });
        const [summary, acks, former, formerDocs, ...perDoc] = await Promise.all([accounts.summary(), accounts.allRulesAck().catch(() => ({})), accounts.allRulesAckArchive().catch(() => ({})), accounts.allDocAckArchive().catch(() => ({}))].concat(DOC_IDS.map((id) => accounts.allDocAck(id).catch(() => ({})))));
        Object.keys(acks).forEach((n) => { summary[n] = summary[n] || { pin: false, devices: 0 }; summary[n].rules = { version: acks[n].version, at: acks[n].at, email: acks[n].email, fullName: acks[n].fullName || null, emailedAt: acks[n].emailedAt || null, history: acks[n].history || [] }; });
        DOC_IDS.forEach((id, i) => { Object.keys(perDoc[i]).forEach((n) => { const a = perDoc[i][n]; summary[n] = summary[n] || { pin: false, devices: 0 }; summary[n].docs = summary[n].docs || {}; summary[n].docs[id] = { version: a.version, at: a.at, email: a.email, emailedAt: a.emailedAt || null }; }); });
        // Acknowledgments of people no longer on staff (legal archive), for the manager's records.
        const formerAcks = Object.keys(former).map((k) => Object.assign({ key: k }, former[k]));
        const formerDocAcks = Object.keys(formerDocs).map((k) => Object.assign({ key: k }, formerDocs[k]));
        return send(res, 200, { accounts: summary, formerAcks, formerDocAcks, rulesVersion: RULES.version || null, docsVersions: docVersions(), mail: mail.enabled() });
      }
      // Who is on this device? (also used by "hours" below)
      let name = await accounts.whoIs(tokenFrom(req), doc.data.staff);
      if (action === "who") {
        if (!name) return send(res, 401, { error: "unauthorized" });
        const [ack, ident, docAcks, pinRec] = await Promise.all([accounts.getRulesAck(name).catch(() => null), toastIdentity(doc.data, name), accounts.docAcksFor(name, DOC_IDS).catch(() => null), accounts.getPinRecord(name).catch(() => null)]);
        const docsOut = {}; if (docAcks) DOC_IDS.forEach((id) => { docsOut[id] = ackView(docAcks[id]); });
        return send(res, 200, { name, rulesAck: ackView(ack), rulesVersion: RULES.version || null, docAcks: docAcks ? docsOut : undefined, docsVersions: docVersions(), since: pinRec && pinRec.createdAt || null, fullName: ident ? ident.fullName : null, email: ident ? ident.email : null, mail: mail.enabled() });
      }
      if (action === "hours") {
        const asked = String(url.searchParams.get("name") || "");
        if (isAdmin && asked) name = doc.data.staff.includes(asked) ? asked : null;
        if (!name) return send(res, 401, { error: "unauthorized" });
        const week = String(url.searchParams.get("week") || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return send(res, 400, { error: "bad_week" });
        if (!toast.enabled()) return send(res, 200, { name, week, toast: false, linked: false, entries: [] });
        const emps = await toast.employees(true);
        const map = toast.autoMap(doc.data.staff, doc.data.toastMap, emps);
        const guid = map[name];
        if (!guid) return send(res, 200, { name, week, toast: true, linked: false, entries: [] });
        const entries = await toast.weekEntriesFor(guid, week);
        return send(res, 200, { name, week, toast: true, linked: true, entries, workedMinutes: Math.round(sumMinutes(entries)), fetchedAt: new Date().toISOString() });
      }
      // Personal week in review: last completed week vs the one before (hours, punctuality, early/late minutes).
      if (action === "recap") {
        if (!name) return send(res, 401, { error: "unauthorized" });
        const week = String(url.searchParams.get("week") || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return send(res, 400, { error: "bad_week" });
        const [wy, wm, wd] = week.split("-").map(Number);
        const prevISO = new Date(Date.UTC(wy, wm - 1, wd - 7)).toISOString().slice(0, 10);
        let guid = null;
        if (toast.enabled()) { const emps = await toast.employees(true); guid = toast.autoMap(doc.data.staff, doc.data.toastMap, emps)[name] || null; }
        const [cur, prev] = await Promise.all([weekSummary(doc.data, name, guid, week), weekSummary(doc.data, name, guid, prevISO)]);
        return send(res, 200, { name, week, prevWeek: prevISO, linked: Boolean(guid), cur, prev });
      }
      return send(res, 400, { error: "bad_action" });
    }

    if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return send(res, 405, { error: "method_not_allowed" }); }

    if (action === "logout") { await accounts.logout(tokenFrom(req)); return send(res, 200, { ok: true }); }

    // House Rules read & acknowledged (once per version). Recorded with the email the person typed, the time, and the device.
    if (action === "ackRules") {
      const doc0 = await store.getSchedule();
      const who = await accounts.whoIs(tokenFrom(req), doc0.data.staff);
      if (!who) return send(res, 401, { error: "unauthorized" });
      const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
      const version = String(body.version || "").trim().slice(0, 20);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(res, 400, { error: "bad_request" });
      // Only the version that is actually published can be acknowledged.
      if (!RULES.version || version !== RULES.version) return send(res, 400, { error: "bad_version", current: RULES.version || null });
      // First acknowledgment of a version wins (the legal record is never overwritten); older versions travel along as history.
      const prev = await accounts.getRulesAck(who).catch(() => null);
      if (prev && prev.version === version) return send(res, 200, { ok: true, rulesAck: { version: prev.version, at: prev.at } });
      const at = new Date().toISOString();
      const hash = crypto.createHash("sha256").update(JSON.stringify(RULES)).digest("hex"); // fingerprint of the exact text acknowledged
      const history = prev ? (prev.history || []).concat([{ version: prev.version, email: prev.email, at: prev.at, ua: prev.ua, hash: prev.hash || null, fullName: prev.fullName || null, emailedAt: prev.emailedAt || null }]) : [];
      const ident = await toastIdentity(doc0.data, who);
      const rec = { version, email, at, ua: String(req.headers["user-agent"] || "").slice(0, 160), hash, history, name: who, fullName: ident ? ident.fullName : null, emailedAt: null };
      if (prev) await accounts.setRulesAck(who, rec);
      else if (!(await accounts.setRulesAckIfAbsent(who, rec))) { // double tap at the same instant: the first record stays
        const first = await accounts.getRulesAck(who).catch(() => null);
        if (first && first.version === version) return send(res, 200, { ok: true, rulesAck: { version: first.version, at: first.at } });
        await accounts.setRulesAck(who, rec);
      }
      // Signed copy by email to the person, copy to the owner (the acknowledgment is valid even if the email fails).
      const mailed = await emailRulesCopy(rec);
      if (mailed.sent) { rec.emailedAt = new Date().toISOString(); await accounts.setRulesAck(who, rec).catch(() => {}); }
      await store.appendLog({ at, version: null, changes: [`House Rules ${version} acknowledged by ${who}${rec.fullName ? ` (${rec.fullName})` : ""} — ${email}${mailed.sent ? " · signed copy emailed" : " · copy NOT emailed (" + mailed.reason + ")"}`] }).catch(() => {});
      return send(res, 200, { ok: true, rulesAck: { version, at, emailed: mailed.sent }, emailed: mailed.sent, emailError: mailed.sent ? null : mailed.reason });
    }

    // A document from documents.js (policy or annual training) read & acknowledged, once per version. Same guarantees as the House Rules.
    if (action === "ackDoc") {
      const doc0 = await store.getSchedule();
      const who = await accounts.whoIs(tokenFrom(req), doc0.data.staff);
      if (!who) return send(res, 401, { error: "unauthorized" });
      const docDef = docById(String(body.id || ""));
      if (!docDef) return send(res, 404, { error: "unknown_doc" });
      const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
      const version = String(body.version || "").trim().slice(0, 20);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(res, 400, { error: "bad_request" });
      if (!docDef.version || version !== docDef.version) return send(res, 400, { error: "bad_version", current: docDef.version || null });
      const prev = await accounts.getDocAck(docDef.id, who).catch(() => null);
      if (prev && prev.version === version) return send(res, 200, { ok: true, id: docDef.id, ack: ackView(prev) });
      const at = new Date().toISOString();
      const hash = crypto.createHash("sha256").update(JSON.stringify(docDef)).digest("hex");
      const history = prev ? (prev.history || []).concat([{ version: prev.version, email: prev.email, at: prev.at, ua: prev.ua, hash: prev.hash || null, fullName: prev.fullName || null, emailedAt: prev.emailedAt || null }]) : [];
      const ident = await toastIdentity(doc0.data, who);
      const rec = { version, email, at, ua: String(req.headers["user-agent"] || "").slice(0, 160), hash, history, name: who, doc: docDef.id, fullName: ident ? ident.fullName : null, emailedAt: null };
      await accounts.setDocAck(docDef.id, who, rec);
      const mailed = await emailDocCopy(docDef, rec);
      if (mailed.sent) { rec.emailedAt = new Date().toISOString(); await accounts.setDocAck(docDef.id, who, rec).catch(() => {}); }
      const verb = docDef.kind === "training" ? "completed" : "acknowledged";
      await store.appendLog({ at, version: null, changes: [`${docDef.title} ${version} ${verb} by ${who}${rec.fullName ? ` (${rec.fullName})` : ""} — ${email}${mailed.sent ? " · signed copy emailed" : " · copy NOT emailed (" + mailed.reason + ")"}`] }).catch(() => {});
      return send(res, 200, { ok: true, id: docDef.id, ack: { version, at, emailed: mailed.sent }, emailed: mailed.sent, emailError: mailed.sent ? null : mailed.reason });
    }

    // Several documents read & acknowledged at once (the "Your documents" packet after the House Rules): one signature,
    // one record per document (same guarantees as ackDoc), one email with everything + one proof email to the owner.
    if (action === "ackDocs") {
      const doc0 = await store.getSchedule();
      const who = await accounts.whoIs(tokenFrom(req), doc0.data.staff);
      if (!who) return send(res, 401, { error: "unauthorized" });
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 20) : [];
      const defs = ids.map(docById).filter(Boolean);
      if (!defs.length || defs.length !== ids.length) return send(res, 404, { error: "unknown_doc" });
      const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(res, 400, { error: "bad_request" });
      const versions = body.versions && typeof body.versions === "object" ? body.versions : {};
      const stale = defs.filter((d) => !d.version || String(versions[d.id] || "") !== d.version).map((d) => d.id);
      if (stale.length) return send(res, 400, { error: "bad_version", stale });
      const at = new Date().toISOString(), ua = String(req.headers["user-agent"] || "").slice(0, 160);
      const ident = await toastIdentity(doc0.data, who);
      const recs = {}, fresh = [];
      for (const d of defs) { const r = await recordDocAck(d, who, email, at, ua, ident); recs[d.id] = r.rec; if (!r.existed) fresh.push(d); }
      let mailed = { sent: false, reason: "nothing_new" };
      if (fresh.length) {
        const hashes = {}; fresh.forEach((d) => { hashes[d.id] = recs[d.id].hash; });
        mailed = await emailPacket(fresh, { name: who, fullName: ident ? ident.fullName : null, email, at, ua, hashes });
        if (mailed.sent) { const t = new Date().toISOString(); for (const d of fresh) { recs[d.id].emailedAt = t; await accounts.setDocAck(d.id, who, recs[d.id]).catch(() => {}); } }
        await store.appendLog({ at, version: null, changes: [`${fresh.map((d) => `${d.short || d.title} ${d.version}`).join(", ")} acknowledged by ${who}${ident && ident.fullName ? ` (${ident.fullName})` : ""} — ${email}${mailed.sent ? " · signed copy emailed" : " · copy NOT emailed (" + mailed.reason + ")"}`] }).catch(() => {});
      }
      const acks = {}; defs.forEach((d) => { acks[d.id] = ackView(recs[d.id]); });
      return send(res, 200, { ok: true, acks, emailed: mailed.sent, emailError: mailed.sent ? null : (fresh.length ? mailed.reason : null) });
    }

    // (Re)send every signed copy of a person (House Rules + documents): the manager for anyone (`sendCopies`),
    // or a signed-in person for themselves (`myCopies`, from 📂 My documents). Copies go only to the emails they signed with.
    if (action === "sendCopies" || action === "myCopies") {
      let name;
      if (action === "sendCopies") { if (!isAdmin) return send(res, 401, { error: "unauthorized" }); name = String(body.name || "").trim().slice(0, 60); }
      else { const doc0 = await store.getSchedule(); name = await accounts.whoIs(tokenFrom(req), doc0.data.staff); if (!name) return send(res, 401, { error: "unauthorized" }); }
      if (!mail.enabled()) return send(res, 503, { error: "mail_not_configured" });
      if (!name) return send(res, 400, { error: "bad_request" });
      if (action === "myCopies") { // self-service: at most once every 10 minutes per person (mail quota, no accidental double taps)
        const last = Number(await store._redis("HGET", "barlento:copies_sent", name).catch(() => 0)) || 0;
        if (Date.now() - last < 10 * 60000) return send(res, 429, { error: "too_soon", retryIn: Math.ceil((10 * 60000 - (Date.now() - last)) / 1000) });
        await store._redis("HSET", "barlento:copies_sent", name, String(Date.now())).catch(() => {});
      }
      const sent = [], failed = [], skipped = [], emails = [];
      // Only a copy whose text is still exactly the one signed is re-sent (same version → same fingerprint); older signatures stay on record but are not re-rendered.
      const rAck0 = await accounts.getRulesAck(name).catch(() => null);
      const rAck = rAck0 && rAck0.version === RULES.version ? rAck0 : null;
      if (rAck0 && !rAck) skipped.push("House Rules " + rAck0.version);
      if (rAck) { if (!emails.includes(rAck.email)) emails.push(rAck.email); const m = await emailRulesCopy(Object.assign({ name }, rAck), false); if (m.sent) { rAck.emailedAt = new Date().toISOString(); await accounts.setRulesAck(name, rAck).catch(() => {}); sent.push("House Rules"); } else failed.push("House Rules: " + m.reason); }
      // every other signed document in ONE email (to the person only; the owner already has the proof copies)
      const signed = [];
      for (const d of DOCS.list) { const a = await accounts.getDocAck(d.id, name).catch(() => null); if (!a) continue; if (a.version === d.version) signed.push({ d, a }); else skipped.push((d.short || d.title) + " " + a.version); }
      if (signed.length) {
        signed.forEach((x) => { if (x.a.email && !emails.includes(x.a.email)) emails.push(x.a.email); });
        const last = signed.map((x) => x.a).sort((p, q) => String(q.at).localeCompare(String(p.at)))[0];
        const hashes = {}; signed.forEach((x) => { hashes[x.d.id] = x.a.hash; });
        const m = await emailPacket(signed.map((x) => Object.assign({}, x.d, { version: x.a.version })), { name, fullName: last.fullName || null, email: last.email, at: last.at, ua: last.ua, hashes }, false);
        if (m.sent) { const t = new Date().toISOString(); for (const x of signed) { x.a.emailedAt = t; await accounts.setDocAck(x.d.id, name, x.a).catch(() => {}); sent.push(x.d.short || x.d.title); } }
        else failed.push("Documents: " + m.reason);
      }
      if (!sent.length && !failed.length) return send(res, 404, { error: "no_ack", skipped });
      if (sent.length) await store.appendLog({ at: new Date().toISOString(), version: null, changes: [`Signed copies re-sent to ${name}${action === "myCopies" ? " (self-service)" : ""}: ${sent.join(", ")}`] }).catch(() => {});
      return send(res, failed.length && !sent.length ? 502 : 200, { ok: sent.length > 0, sent, failed, skipped, emails, email: emails[0] || null });
    }

    // Manager: (re)send the signed copy of the House Rules to a person who already acknowledged (e.g. mail was configured later).
    if (action === "sendRulesCopy") {
      if (!isAdmin) return send(res, 401, { error: "unauthorized" });
      const name = String(body.name || "").trim().slice(0, 60);
      const ack = name ? await accounts.getRulesAck(name).catch(() => null) : null;
      if (!ack) return send(res, 404, { error: "no_ack" });
      if (!mail.enabled()) return send(res, 503, { error: "mail_not_configured" });
      const mailed = await emailRulesCopy(Object.assign({ name }, ack), false);
      if (mailed.sent) { ack.emailedAt = new Date().toISOString(); await accounts.setRulesAck(name, ack).catch(() => {}); await store.appendLog({ at: ack.emailedAt, version: null, changes: [`House Rules ${ack.version}: signed copy re-sent to ${name} (${ack.email})`] }).catch(() => {}); }
      return mailed.sent ? send(res, 200, { ok: true, email: ack.email }) : send(res, 502, { error: "mail_failed", detail: mailed.reason });
    }

    if (action === "reset") {
      if (!isAdmin) return send(res, 401, { error: "unauthorized" });
      const name = String(body.name || "").trim().slice(0, 60);
      if (!name) return send(res, 400, { error: "bad_request" });
      const devices = await accounts.resetPin(name);
      await store.appendLog({ at: new Date().toISOString(), version: null, changes: [`Staff: PIN reset for ${name}`] }).catch(() => {});
      return send(res, 200, { ok: true, devices });
    }

    // Everything below is a person acting on their own name.
    const doc = await store.getSchedule();
    const name = String(body.name || "").trim().slice(0, 60);
    if (!name || !doc.data.staff.includes(name)) return send(res, 404, { error: "unknown_name" });
    const ua = req.headers["user-agent"];

    if (action === "begin") {
      const rec = await accounts.getPinRecord(name);
      const lock = accounts.lockInfo(rec);
      return send(res, 200, { name, hasPin: Boolean(rec), locked: lock.locked, retryIn: lock.retryIn });
    }
    // Small fixed delay blunts guessing without hurting a real login.
    await new Promise((r) => setTimeout(r, 350));
    if (action === "create") {
      const r = await accounts.createPin(name, body.pin, ua);
      if (r.error === "bad_pin") return send(res, 400, { error: "bad_pin" });
      if (r.error === "pin_exists") return send(res, 409, { error: "pin_exists" });
      return send(res, 200, { ok: true, name, token: r.token });
    }
    if (action === "login") {
      const r = await accounts.login(name, body.pin, ua);
      if (r.error === "no_pin") return send(res, 404, { error: "no_pin" });
      if (r.error === "bad_pin") return send(res, 400, { error: "bad_pin" });
      if (r.error === "locked") return send(res, 423, { error: "locked", retryIn: r.retryIn });
      if (r.error === "wrong_pin") return send(res, 401, { error: "wrong_pin", attemptsLeft: r.attemptsLeft });
      return send(res, 200, { ok: true, name, token: r.token });
    }
    return send(res, 400, { error: "bad_action" });
  } catch (err) {
    return send(res, 500, { error: "server_error", detail: String(err && err.message || err) });
  }
};
