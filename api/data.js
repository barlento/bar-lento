const store = require("../lib/store");
const auth = require("../lib/auth");
const { diffData } = require("../lib/diff");
const push = require("../lib/push");
const toast = require("../lib/toast");
const accounts = require("../lib/accounts");
const staffsync = require("../lib/staffsync");

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      // Lazy delivery: if the manager closed the app without notifying, the next visitor triggers the summary push.
      const flushed = store.hasStorage() ? await push.flushPending(false).catch(() => null) : null;
      const [doc0, confirmations, announcement] = await Promise.all([store.getSchedule(), store.getConfirmations(), store.getAnnouncement().catch(() => null)]);
      // New Toast employees appear in Staff by themselves (never throws, never while the manager is editing).
      const doc = await staffsync.syncFromToast(doc0).then((r) => r.doc).catch(() => doc0);
      return send(res, 200, {
        version: doc.version,
        updatedAt: doc.updatedAt,
        data: doc.data,
        confirmations,
        announcement,
        pendingNotify: flushed && flushed.pending ? flushed.pending : 0,
        features: { storage: store.hasStorage(), admin: auth.adminEnabled(), push: push.pushEnabled(), toast: toast.enabled(), mail: require("../lib/mail").enabled() },
      });
    }

    if (req.method === "POST") {
      if (!auth.adminEnabled()) return send(res, 503, { error: "admin_disabled" });
      if (!auth.checkPassword(auth.passwordFrom(req))) return send(res, 401, { error: "unauthorized" });
      if (!store.hasStorage()) return send(res, 503, { error: "storage_missing" });

      const body = req.body || {};
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
      const doc = { version: (current.version || 0) + 1, data, updatedAt: new Date().toISOString() };
      await store.saveSchedule(doc);
      await store.removeConfirmations(resetKeys).catch(() => {});
      await store.pruneConfirmations(data).catch(() => {});
      if (gone.length) await accounts.removeAccounts(gone).catch(() => {});
      if (changes.length) {
        await store.appendLog({ at: doc.updatedAt, version: doc.version, changes: changes.slice(0, 200) }).catch(() => {});
        // Only what matters to employees accumulates for ONE summary push later
        // (manager idle/logout, "Notify team", or automatically on the next visit after 10 min, never at night).
        const items = newWeeks.map((wk) => `NEWWEEK:${wk}`).concat(notable);
        if (items.length) await store.appendPending(items).catch(() => {});
      }
      const [confirmations, pending] = await Promise.all([store.getConfirmations(), store.getPending().catch(() => ({ changes: [] }))]);
      return send(res, 200, { version: doc.version, updatedAt: doc.updatedAt, data: doc.data, confirmations, changes: changes.length, pendingNotify: pending.changes.length });
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "method_not_allowed" });
  } catch (err) {
    return send(res, 500, { error: "server_error", detail: String(err && err.message || err) });
  }
};
