const store = require("../lib/store");
const auth = require("../lib/auth");
const { diffData } = require("../lib/diff");
const push = require("../lib/push");
const toast = require("../lib/toast");
const accounts = require("../lib/accounts");
const staffsync = require("../lib/staffsync");
const punch = require("../lib/punch");
const former = require("../lib/former");
const backfill = require("../lib/backfill");
const presence = require("../lib/presence");

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}

// One-time data fixes decided by the owner, applied on the next visit and never again (flag key per migration).
async function migrations(doc) {
  if (!store.hasStorage()) return doc;
  const FLAG = "barlento:migr:2026-09-19-marta-app";
  if (await store._redis("GET", FLAG).catch(() => null)) return doc;
  await store._redis("SET", FLAG, new Date().toISOString()).catch(() => {});
  const data = doc.data; const list = Array.isArray(data.appClock) ? data.appClock.slice() : [];
  if (!(data.staff || []).includes("Marta") || list.includes("Marta")) return doc;
  list.push("Marta"); // Marta is salaried and clocks in from the app, never on the Toast terminal (owner's decision 2026-09-19)
  const next = { version: (doc.version || 0) + 1, data: store.normalizeData(Object.assign({}, data, { appClock: list })), updatedAt: doc.updatedAt };
  await store.saveSchedule(next);
  await store.appendLog({ at: new Date().toISOString(), version: next.version, changes: ["Marta now clocks in from the app (salaried, owner's decision)"] }).catch(() => {});
  return next;
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      // Automatic delivery: any visit checks whether pending changes have waited long enough and sends them.
      if (store.hasStorage()) await push.flushPending(false).catch(() => null);
      const [doc0, confirmations, announcement] = await Promise.all([store.getSchedule(), store.getConfirmations(), store.getAnnouncement().catch(() => null)]);
      // New Toast employees appear in Staff by themselves (never throws, never while the manager is editing).
      const docS = await staffsync.syncFromToast(doc0).then((r) => r.doc).catch(() => doc0);
      const doc = await migrations(docS).catch(() => docS);
      // Past weeks follow Toast by themselves (real clock-ins replace the plan; last 8 weeks, every 6 h).
      const doc1 = await backfill.auto(doc, doc0.updatedAt).catch(() => doc);
      // A signed-in device polling = that person has the app open: note it for the manager's live Staff list.
      { const tok = String(req.headers["x-staff-token"] || ""); if (tok) accounts.whoIs(tok, doc1.data.staff).then((n) => presence.touch(n)).catch(() => {}); }
      return send(res, 200, {
        version: doc1.version,
        updatedAt: doc1.updatedAt,
        data: doc1.data,
        confirmations,
        announcement,
        features: { storage: store.hasStorage(), admin: auth.adminEnabled(), push: push.pushEnabled(), toast: toast.enabled(), mail: require("../lib/mail").enabled() },
      });
    }

    if (req.method === "POST") {
      if (!auth.adminEnabled()) return send(res, 503, { error: "admin_disabled" });
      if (!auth.checkPassword(auth.passwordFrom(req))) return send(res, 401, { error: "unauthorized" });
      if (!store.hasStorage()) return send(res, 503, { error: "storage_missing" });

      const body = req.body || {};
      if (body.action === "backfillToast") { // manager: past weeks from the clock-ins already in Toast (idempotent)
        const from = /^\d{4}-\d{2}-\d{2}$/.test(body.from || "") ? body.from : (() => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 12); return d.toISOString().slice(0, 10); })();
        const r = await backfill.backfillFromToast(await store.getSchedule(), from);
        if (r.error) return send(res, 503, { error: r.error });
        const confirmations = await store.getConfirmations();
        return send(res, 200, { ok: true, clockIns: r.clockIns, added: r.added, replaced: r.replaced, changed: r.changed || [], weeks: r.weeks, seen: r.seen, skippedOpen: r.skippedOpen, unknown: r.unknown, from: r.from, to: r.to, firstIn: r.firstIn, lastIn: r.lastIn, version: r.doc.version, updatedAt: r.doc.updatedAt, data: r.doc.data, confirmations });
      }
      const data = store.normalizeData(body.data || {});
      const current = await store.getSchedule();
      if (typeof body.version === "number" && body.version !== current.version) {
        return send(res, 409, { error: "version_conflict", version: current.version, data: current.data, updatedAt: current.updatedAt });
      }

      const { changes, resetKeys, notable, newWeeks } = diffData(current.data, data);
      // Someone removed from staff loses their personal access (PIN + devices). Past shifts stay in the archive,
      // and their Toast employee must not come back at the next sync.
      const gone = (current.data.staff || []).filter((n) => !data.staff.includes(n));
      const ignore = new Set(data.toastIgnore || []);
      gone.forEach((n) => { const g = (current.data.toastMap || {})[n]; if (g) ignore.add(g); delete data.toastMap[n]; });
      data.toastIgnore = Array.from(ignore);
      data.appClock = (data.appClock || []).filter((n) => data.staff.includes(n)); // app clock only for people still here
      const doc = { version: (current.version || 0) + 1, data, updatedAt: new Date().toISOString() };
      await store.saveSchedule(doc);
      await store.removeConfirmations(resetKeys).catch(() => {});
      await store.pruneConfirmations(data).catch(() => {});
      if (gone.length) {
        for (const n of gone) await former.note(n, { guid: (current.data.toastMap || {})[n] || null, by: "manager" }).catch(() => {});
        await accounts.removeAccounts(gone).catch(() => {}); await punch.archive(gone).catch(() => {});
      }
      if (changes.length) {
        await store.appendLog({ at: doc.updatedAt, version: doc.version, changes: changes.slice(0, 200) }).catch(() => {});
        // Only what matters to each employee accumulates; delivered by itself, one push per person about their own
        // changes, once the manager has been quiet for 10 minutes (lib/push.flushPending, never at night).
        const items = newWeeks.map((wk) => ({ kind: "newweek", week: wk })).concat(notable.map((c) => ({ kind: "update", text: c.text, names: c.names || [] })));
        if (items.length) await store.appendPending(items).catch(() => {});
      }
      const confirmations = await store.getConfirmations();
      return send(res, 200, { version: doc.version, updatedAt: doc.updatedAt, data: doc.data, confirmations, changes: changes.length });
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "method_not_allowed" });
  } catch (err) {
    return send(res, 500, { error: "server_error", detail: String(err && err.message || err) });
  }
};
