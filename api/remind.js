// Daily cron (10 AM New York = 14:00 UTC in summer) for the morning reminder, and a manager tool: GET /api/remind
// (password) runs both checks now and shows what was sent; &force=1 rebuilds the messages even if already sent.
const auth = require("../lib/auth");
const store = require("../lib/store");
const remind = require("../lib/remind");

module.exports = async (req, res) => {
  const send = (code, body) => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.status(code).send(JSON.stringify(body)); };
  try {
    const url = new URL(req.url, "http://x");
    const isCron = process.env.CRON_SECRET ? req.headers.authorization === `Bearer ${process.env.CRON_SECRET}` : Boolean(req.headers["x-vercel-cron"] || (req.headers["user-agent"] && /vercel-cron/i.test(req.headers["user-agent"])));
    const isAdmin = auth.adminEnabled() && auth.checkPassword(auth.passwordFrom(req));
    if (!isCron && !isAdmin) return send(401, { error: "unauthorized" });
    const force = isAdmin && url.searchParams.get("force") === "1";
    const doc = await store.getSchedule();
    const morning = await remind.morning(doc, force);
    const late = await remind.late(doc, force);
    return send(200, { ok: true, morning, late });
  } catch (e) { return send(500, { error: String(e.message || e) }); }
};
