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
const QUIET_START = 23, QUIET_END = 10; // no automatic pushes 11 PM – 10 AM New York time
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function nyHour(d) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(d || new Date()));
}
function isQuietHours() { const h = nyHour(); return h >= QUIET_START || h < QUIET_END; }

function weekRange(wk) {
  const [y, m, d] = wk.split("-").map(Number);
  const a = new Date(Date.UTC(y, m - 1, d)), b = new Date(Date.UTC(y, m - 1, d + 6));
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${MONTHS[a.getUTCMonth()]} ${a.getUTCDate()}–${b.getUTCDate()}`
    : `${MONTHS[a.getUTCMonth()]} ${a.getUTCDate()} – ${MONTHS[b.getUTCMonth()]} ${b.getUTCDate()}`;
}

function summarize(items) {
  const weeks = items.filter((c) => c.startsWith("NEWWEEK:")).map((c) => c.slice(8));
  const changes = items.filter((c) => !c.startsWith("NEWWEEK:"));
  if (weeks.length) {
    const label = weeks.map(weekRange).join(" and ");
    return { title: "Bar Lento — new work week posted", body: `Week of ${label} is out — check your shifts` + (changes.length ? ` (+${changes.length} other change${changes.length === 1 ? "" : "s"})` : ""), kind: "newweek", weeks };
  }
  const n = changes.length;
  const days = new Set(changes.map((c) => (c.match(/^(\w{3} \d{1,2}\/\d{1,2})/) || [])[1]).filter(Boolean));
  const body = n === 1 ? changes[0] : `${n} changes` + (days.size ? ` on ${[...days].slice(0, 4).join(", ")}${days.size > 4 ? "…" : ""}` : "");
  return { title: "Bar Lento — schedule updated", body: body + " — tap to see your shifts", kind: "update", weeks: [] };
}

async function flushPending(force) {
  const p = await store.getPending();
  if (!p.changes.length) return { sent: 0, pending: 0 };
  if (!force) {
    const age = p.since ? Date.now() - Date.parse(p.since) : Infinity;
    if (age < AUTO_FLUSH_MS) return { sent: 0, pending: p.changes.length, waiting: "recent" };
    if (isQuietHours()) return { sent: 0, pending: p.changes.length, waiting: "quiet_hours" };
  }
  const s = summarize(p.changes);
  let res = { sent: 0 };
  if (pushEnabled()) res = await broadcast({ title: s.title, body: s.body, url: "/", tag: "schedule" });
  // The in-site announcement (popup) is independent from push: everyone who opens the site sees it once.
  if (s.kind === "newweek") await store.setAnnouncement({ kind: "newweek", weeks: s.weeks, at: new Date().toISOString() }).catch(() => {});
  await store.clearPending();
  return Object.assign({ pending: 0, changes: p.changes.length, kind: s.kind }, res);
}

module.exports = { PUBLIC_KEY, pushEnabled, broadcast, flushPending, summarize, isQuietHours };
