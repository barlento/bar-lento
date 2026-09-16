const auth = require("../lib/auth");
const push = require("../lib/push");

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}

// Manager-only: send the summary notification for all pending changes now.
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "method_not_allowed" }); }
    if (!auth.adminEnabled()) return send(res, 503, { error: "admin_disabled" });
    if (!auth.checkPassword(auth.passwordFrom(req))) return send(res, 401, { error: "unauthorized" });
    const r = await push.flushPending(true);
    r.pushEnabled = push.pushEnabled();
    return send(res, 200, r);
  } catch (err) {
    return send(res, 500, { error: "server_error", detail: String(err && err.message || err) });
  }
};
