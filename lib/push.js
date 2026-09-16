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

module.exports = { PUBLIC_KEY, pushEnabled, broadcast };
