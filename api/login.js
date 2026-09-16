const auth = require("../lib/auth");

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "method_not_allowed" });
  }
  if (!auth.adminEnabled()) return send(res, 503, { error: "admin_disabled" });
  // Small fixed delay blunts brute-force attempts without hurting a real login.
  await new Promise((r) => setTimeout(r, 350));
  if (!auth.checkPassword(auth.passwordFrom(req))) return send(res, 401, { error: "unauthorized" });
  return send(res, 200, { ok: true });
};
