const store = require("../lib/store");
const auth = require("../lib/auth");

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}

// Manager-only: recent change history (newest first).
module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return send(res, 405, { error: "method_not_allowed" }); }
    if (!auth.adminEnabled()) return send(res, 503, { error: "admin_disabled" });
    if (!auth.checkPassword(auth.passwordFrom(req))) return send(res, 401, { error: "unauthorized" });
    const url = new URL(req.url, "http://x");
    const entries = await store.getLog(url.searchParams.get("limit") || 300);
    return send(res, 200, { entries, storage: store.hasStorage() });
  } catch (err) {
    return send(res, 500, { error: "server_error", detail: String(err && err.message || err) });
  }
};
