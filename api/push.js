const store = require("../lib/store");
const push = require("../lib/push");
const accounts = require("../lib/accounts");

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}

// GET  → public key + whether push is enabled
// POST {subscription} → save this phone's subscription
// DELETE {endpoint}   → remove it
module.exports = async (req, res) => {
  try {
    if (req.method === "GET") return send(res, 200, { enabled: push.pushEnabled(), publicKey: push.PUBLIC_KEY });
    if (!push.pushEnabled()) return send(res, 503, { error: "push_disabled" });

    if (req.method === "POST") {
      const sub = req.body && req.body.subscription;
      if (!sub || typeof sub.endpoint !== "string" || !/^https:\/\//.test(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        return send(res, 400, { error: "bad_subscription" });
      }
      // Whose phone is this? Personal changes go only to the phones signed in as that person (re-sent at every sign-in).
      let name = null;
      try { const tok = String(req.headers["x-staff-token"] || ""); if (tok) { const doc = await store.getSchedule(); name = await accounts.whoIs(tok, doc.data.staff); } } catch (e) { name = null; }
      await store.savePushSubscription({ endpoint: sub.endpoint, expirationTime: sub.expirationTime || null, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) }, name: name || null, at: new Date().toISOString() });
      return send(res, 200, { ok: true, name: name || null });
    }
    if (req.method === "DELETE") {
      const endpoint = req.body && req.body.endpoint;
      if (typeof endpoint !== "string") return send(res, 400, { error: "bad_request" });
      await store.removePushSubscription(endpoint);
      return send(res, 200, { ok: true });
    }
    res.setHeader("Allow", "GET, POST, DELETE");
    return send(res, 405, { error: "method_not_allowed" });
  } catch (err) {
    return send(res, 500, { error: "server_error", detail: String(err && err.message || err) });
  }
};
