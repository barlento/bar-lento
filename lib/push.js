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

// Sends to subscribers (all, or only the phones signed in as one of `names`); drops subscriptions the push service says are gone.
async function broadcast(payload, names) {
  if (!pushEnabled()) return { sent: 0, skipped: "disabled" };
  let subs = await store.getPushSubscriptions();
  if (names) { const set = new Set(names); subs = subs.filter((sub) => sub.name && set.has(sub.name)); }
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

// Delivery (owner's rule 2026-09-19): no button, nothing team-wide. Changes accumulate while the manager works; once
// nothing has changed for QUIET_MS (she is done), every person concerned gets ONE push about their own changes
// (shift added/removed/moved, a day closed/opened when they were scheduled). A new week posted goes to everyone.
// Never at night (11 PM – 10 AM New York): it waits for the morning. Runs on the next visit of anyone (GET /api/data).
const QUIET_MS = 10 * 60 * 1000;
const QUIET_START = 23, QUIET_END = 10;
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

// One person's summary of their own changes
function personalSummary(items) {
  const n = items.length;
  const days = [...new Set(items.map((c) => (String(c.text).match(/^(\w{3} \d{1,2}\/\d{1,2})/) || [])[1]).filter(Boolean))];
  const body = n === 1 ? items[0].text : `${n} changes to your shifts` + (days.length ? ` on ${days.slice(0, 4).join(", ")}${days.length > 4 ? "…" : ""}` : "");
  return { title: "Bar Lento — your schedule changed", body: body + " — tap to see your shifts" };
}
function newWeekSummary(weeks) {
  const label = weeks.map(weekRange).join(" and ");
  return { title: "Bar Lento — new work week posted", body: `Week of ${label} is out — check your shifts`, kind: "newweek", weeks };
}
// kept for the tests and the history: a team-wide reading of a batch
function summarize(items) {
  const weeks = items.filter((c) => c.kind === "newweek").map((c) => c.week);
  if (weeks.length) return newWeekSummary(weeks);
  const upd = items.filter((c) => c.kind === "update");
  return Object.assign({ kind: "update", weeks: [] }, personalSummary(upd.length ? upd : [{ text: "Schedule updated" }]));
}

async function flushPending(force) {
  const p = await store.getPending();
  if (!p.changes.length) return { sent: 0, pending: 0 };
  if (!force) {
    const age = p.last ? Date.now() - Date.parse(p.last) : Infinity;
    if (age < QUIET_MS) return { sent: 0, pending: p.changes.length, waiting: "editing" };
    if (isQuietHours()) return { sent: 0, pending: p.changes.length, waiting: "quiet_hours" };
  }
  const weeks = [...new Set(p.changes.filter((c) => c.kind === "newweek").map((c) => c.week))];
  const byName = {};
  p.changes.filter((c) => c.kind === "update").forEach((c) => (c.names || []).forEach((n) => { (byName[n] = byName[n] || []).push(c); }));
  let sent = 0, people = 0;
  if (pushEnabled()) {
    if (weeks.length) { const s = newWeekSummary(weeks); const r = await broadcast({ title: s.title, body: s.body, url: "/", tag: "newweek" }); sent += r.sent || 0; }
    for (const n of Object.keys(byName)) { const s = personalSummary(byName[n]); const r = await broadcast({ title: s.title, body: s.body, url: "/", tag: "mine" }, [n]); sent += r.sent || 0; if (r.sent) people++; }
  }
  // The in-site announcement (popup) is independent from push: everyone who opens the site sees it once.
  if (weeks.length) await store.setAnnouncement({ kind: "newweek", weeks, at: new Date().toISOString() }).catch(() => {});
  await store.clearPending();
  return { pending: 0, changes: p.changes.length, kind: weeks.length ? "newweek" : "update", sent, people, names: Object.keys(byName) };
}

module.exports = { PUBLIC_KEY, pushEnabled, broadcast, flushPending, summarize, personalSummary, isQuietHours, QUIET_MS };
