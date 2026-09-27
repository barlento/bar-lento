// Bar notes (owner 2026-09-27). GET = what the signed-in person (PIN token) or the manager (password) sees: {bar, seenRev, canEdit},
// `src` only for editors; GET ?action=recipients (manager/owner) = dry run of who would get the push now. POST {action:"save", src}
// (manager/owner only) | {action:"seen"} (PIN token). Storage errors → 503 storage.
const store = require("../lib/store");
const auth = require("../lib/auth");
const accounts = require("../lib/accounts");
const bar = require("../lib/bar");

function send(res, code, body) { res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Type", "application/json"); return res.status(code).send(JSON.stringify(body)); }

module.exports = async (req, res) => {
  try {
    if (!store.hasStorage()) return send(res, 503, { error: "storage_missing" });
    const doc = await store.getSchedule();
    const tok = String(req.headers["x-staff-token"] || "");
    const name = tok ? await accounts.whoIs(tok, doc.data.staff).catch(() => null) : null;
    const role = (await auth.roleFrom(req, doc).catch(() => null)) || (name ? "staff" : null);
    if (!name && !auth.isManagerish(role)) return send(res, 401, { error: "unauthorized" });
    const canEdit = auth.isManagerish(role); // management, owner, env password; the chef reads only
    if (req.method === "GET") {
      const action = new URL(req.url, "http://x").searchParams.get("action") || "";
      if (action === "recipients") return canEdit ? send(res, 200, bar.recipients(doc)) : send(res, 403, { error: "manager_only" });
      const b = await bar.get();
      return send(res, 200, { bar: bar.view(b, canEdit), seenRev: name ? await bar.seenRev(name) : b.rev, canEdit }); // no person (password only) = nothing to read-track
    }
    if (req.method !== "POST") return send(res, 405, { error: "method" });
    const b = req.body || {}; let r;
    if (b.action === "save") r = canEdit ? await bar.save(b.src, name || "manager", doc) : { status: 403, body: { error: "manager_only" } };
    else if (b.action === "seen") r = name ? { status: 200, body: { ok: true, seenRev: await bar.markSeen(name) } } : { status: 401, body: { error: "unauthorized" } };
    else r = { status: 400, body: { error: "bad_action" } };
    return send(res, r.status, r.body);
  } catch (e) {
    console.error("bar", e && e.message);
    const storage = Boolean(e && (e.storage || /^Redis/.test(String(e.message))));
    return send(res, storage ? 503 : 500, { error: storage ? "storage" : "server" });
  }
};
