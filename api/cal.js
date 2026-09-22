// GET /api/cal?t=<calendar token> → the person's own shifts as an iCalendar feed (subscribe from iPhone / Google Calendar).
const store = require("../lib/store");
const cal = require("../lib/cal");

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const name = await cal.nameFor(url.searchParams.get("t"));
    const plain = (code, txt) => { res.setHeader("Content-Type", "text/plain"); return res.status(code).send(txt); };
    if (!name) return plain(404, "Unknown calendar");
    const doc = await store.getSchedule();
    if (!(doc.data.staff || []).includes(name)) return plain(404, "Unknown calendar");
    let offs = [];
    try { const requests = require("../lib/requests"); const mine = (await requests.listFor(doc, name, null)).mine || []; offs = mine.filter((r) => r.type === "off" && r.status === "approved"); } catch (e) {}
    const body = await cal.ics(doc, name, offs);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="bar-lento.ics"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(body);
  } catch (e) { res.setHeader("Content-Type", "text/plain"); return res.status(500).send("error"); }
};
