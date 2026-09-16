// Web Push notifications to every phone that opted in.
// Public key lives in code (safe); the private key must be set on Vercel as VAPID_PRIVATE_KEY.
const store = require("./store");

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BARWVwCcuR21NWmtgK__YvVHjhjjoAJRGYRZjwprJCYugNL32PBJ8QO8pzI1zPRzCYaNW0UmcyHwudx_lwduOgE";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:info@barlentony.com";

function pushEnabled() {
  return Boolean(PRIVATE_KEY && store.hasStorage());
}

function webpush() {
  const wp = require("web-push");
  wp.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  return wp;
}

// Sends to all subscribers; drops subscriptions the push service says are gone.
async function broadcast(payload) {
  if (!pushEnabled()) return { sent: 0, skipped: "disabled" };
  const subs = await store.getPushSubscriptions();
  if (!subs.length) return { sent: 0 };
  const wp = webpush();
  const body = JSON.stringify(payload);
  let sent = 0, removed = 0;
  const work = subs.map(async (sub) => {
    try {
      await wp.sendNotification(sub, body, { TTL: 60 * 60 * 12 });
      sent++;
    } catch (err) {
      const code = err && err.statusCode;
      if (code === 404 || code === 410) { await store.removePushSubscription(sub.endpoint).catch(() => {}); removed++; }
    }
  });
  await Promise.all(work);
  return { sent, removed, total: subs.length };
}

// Send ONE summary notification for everything that changed since the last one.
const AUTO_FLUSH_MS = 10 * 60 * 1000; // if the manager just closed the app, flush on the next visit after 10 min
function summarize(changes) {
  const n = changes.length;
  if (!n) return "";
  const days = new Set(changes.map((c) => (c.match(/^(\w{3} \d{1,2}\/\d{1,2})/) || [])[1]).filter(Boolean));
  const head = n === 1 ? changes[0] : `${n} changes` + (days.size ? ` on ${[...days].slice(0, 4).join(", ")}${days.size > 4 ? "…" : ""}` : "");
  return head + " — tap to see the schedule";
}
async function flushPending(force) {
  const p = await store.getPending();
  if (!p.changes.length) return { sent: 0, pending: 0 };
  if (!force) {
    const age = p.since ? Date.now() - Date.parse(p.since) : Infinity;
    if (age < AUTO_FLUSH_MS) return { sent: 0, pending: p.changes.length, waiting: true };
  }
  const res = await broadcast({ title: "Bar Lento — schedule updated", body: summarize(p.changes), url: "/", tag: "schedule" });
  await store.clearPending();
  return Object.assign({ pending: 0, changes: p.changes.length }, res);
}

module.exports = { PUBLIC_KEY, pushEnabled, broadcast, flushPending, summarize };
