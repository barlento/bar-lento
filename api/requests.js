// Time off and shift cover requests. GET = what the signed-in person (or manager) sees; POST {action} = off | cover | offer | withdraw | cancel | approve | decline.
const store = require("../lib/store");
const auth = require("../lib/auth");
const accounts = require("../lib/accounts");
const requests = require("../lib/requests");

function send(res, code, body) { res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Type", "application/json"); return res.status(code).send(JSON.stringify(body)); }

module.exports = async (req, res) => {
  try {
    if (!store.hasStorage()) return send(res, 503, { error: "storage_missing" });
    const doc = await store.getSchedule();
    const tok = String(req.headers["x-staff-token"] || "");
    const name = tok ? await accounts.whoIs(tok, doc.data.staff).catch(() => null) : null;
    const role = (await auth.roleFrom(req, doc).catch(() => null)) || (name ? "staff" : null);
    if (!name && !auth.isManagerish(role)) return send(res, 401, { error: "unauthorized" });
    if (req.method === "GET") return send(res, 200, await requests.listFor(doc, name, role));
    if (req.method !== "POST") return send(res, 405, { error: "method" });
    const b = req.body || {}; let r;
    if (b.action === "off") r = name ? await requests.createOff(doc, name, b) : { status: 403, body: { error: "no_person" } };
    else if (b.action === "cover") r = name ? await requests.createCover(doc, name, b) : { status: 403, body: { error: "no_person" } };
    else if (b.action === "offer" || b.action === "withdraw") r = name ? await requests.volunteer(doc, name, b, b.action === "offer") : { status: 403, body: { error: "no_person" } };
    else if (b.action === "cancel") r = name ? await requests.cancel(name, b) : { status: 403, body: { error: "no_person" } };
    else if (b.action === "approve" || b.action === "decline") r = await requests.decide(doc, role, name, b);
    else r = { status: 400, body: { error: "bad_action" } };
    return send(res, r.status, r.body);
  } catch (e) { console.error("requests", e && e.message); return send(res, 500, { error: "server" }); }
};
