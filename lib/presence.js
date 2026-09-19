// Who has the app open right now. Every signed-in device polls /api/data with its staff token (every 45 s while the
// app is visible); the server notes "name → last seen". The manager's Staff list shows a live green dot for people
// seen in the last ONLINE_MS, a red one otherwise. Operational only, never shown to staff.
const store = require("./store");
const KEY = "barlento:presence";
const ONLINE_MS = 2 * 60000;
const redis = (...cmd) => store._redis(...cmd);

async function touch(name) { if (name && store.hasStorage()) await redis("HSET", KEY, name, new Date().toISOString()).catch(() => {}); }
async function all() {
  const flat = await redis("HGETALL", KEY).catch(() => []); const out = {};
  for (let i = 0; i + 1 < (flat || []).length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
}
function isOnline(lastSeen, now) { return !!lastSeen && (now || Date.now()) - Date.parse(lastSeen) < ONLINE_MS; }
module.exports = { touch, all, isOnline, ONLINE_MS };
