const store = require("../lib/store");
const auth = require("../lib/auth");
const { diffData } = require("../lib/diff");

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const [doc, confirmations] = await Promise.all([store.getSchedule(), store.getConfirmations()]);
      return send(res, 200, {
        version: doc.version,
        updatedAt: doc.updatedAt,
        data: doc.data,
        confirmations,
        features: { storage: store.hasStorage(), admin: auth.adminEnabled() },
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

      const { changes, resetKeys } = diffData(current.data, data);
      const doc = { version: (current.version || 0) + 1, data, updatedAt: new Date().toISOString() };
      await store.saveSchedule(doc);
      await store.removeConfirmations(resetKeys).catch(() => {});
      await store.pruneConfirmations(data).catch(() => {});
      if (changes.length) {
        await store.appendLog({ at: doc.updatedAt, version: doc.version, changes: changes.slice(0, 200) }).catch(() => {});
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
