const store = require("../lib/store");

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return send(res, 405, { error: "method_not_allowed" });
    }
    if (!store.hasStorage()) return send(res, 503, { error: "storage_missing" });

    const body = req.body || {};
    const week = String(body.week || "");
    const day = String(body.day || "");
    const id = String(body.id || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !store.DAY_KEYS.includes(day) || !ID_RE.test(id)) {
      return send(res, 400, { error: "bad_request" });
    }

    // Only allow confirming shifts that actually exist.
    const doc = await store.getSchedule();
    const list = (doc.data.weeks[week] || {})[day] || [];
    if (!list.some((s) => s.id === id)) return send(res, 404, { error: "shift_not_found" });

    await store.setConfirmation(`${week}:${day}:${id}`, Boolean(body.on));
    const confirmations = await store.getConfirmations();
    return send(res, 200, { confirmations });
  } catch (err) {
    return send(res, 500, { error: "server_error", detail: String(err && err.message || err) });
  }
};
