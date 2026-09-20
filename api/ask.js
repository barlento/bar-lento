// POST /api/ask {messages:[{role,content}]} — the in-app assistant. Identity from x-staff-token (or the manager password).
const store = require("../lib/store");
const auth = require("../lib/auth");
const accounts = require("../lib/accounts");
const ai = require("../lib/ai");

function send(res, code, body) { res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Type", "application/json"); return res.status(code).send(JSON.stringify(body)); }

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return send(res, 405, { error: "method" });
    if (!ai.enabled()) return send(res, 503, { error: "ai_disabled" });
    const doc = await store.getSchedule();
    const tok = String(req.headers["x-staff-token"] || "");
    const name = tok ? await accounts.whoIs(tok, doc.data.staff).catch(() => null) : null;
    const role = await auth.roleFrom(req, doc).catch(() => null);
    if (!name && !auth.isManagerish(role)) return send(res, 401, { error: "unauthorized" });
    const r = await ai.ask({ doc, name, role: role || "staff", messages: (req.body || {}).messages });
    return send(res, r.status, r.body);
  } catch (e) {
    console.error("ask", e && e.message);
    return send(res, 502, { error: "ai_error" });
  }
};
