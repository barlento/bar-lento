// Register of people no longer on staff (removed by the manager or archived in Toast). Kept forever: it holds the
// Toast link so the personnel record (CSV) can still be produced years later. Never deleted.
const store = require("./store");
const KEY = "barlento:former";
const redis = (...cmd) => store._redis(...cmd);

async function note(name, info) {
  const rec = Object.assign({ name, removedAt: new Date().toISOString() }, info || {});
  await redis("HSET", KEY, name + " @ " + rec.removedAt, JSON.stringify(rec));
}
async function all() {
  const flat = await redis("HGETALL", KEY).catch(() => []);
  const out = [];
  for (let i = 0; i + 1 < (flat || []).length; i += 2) { try { out.push(JSON.parse(flat[i + 1])); } catch (e) {} }
  return out.sort((a, b) => String(b.removedAt).localeCompare(String(a.removedAt)));
}
async function forName(name) { return (await all()).filter((r) => r.name === name); }

module.exports = { note, all, forName };
