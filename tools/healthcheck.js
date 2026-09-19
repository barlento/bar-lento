#!/usr/bin/env node
// Weekly health check of the Bar Lento app (read-only, never creates signatures, punches or emails):
//   1. every link inside the legal texts (documents.js, rules.js) answers;
//   2. the live site answers and every feature is on (storage, admin, push, Toast, mail);
//   3. Toast is reachable from the live site (status + today's time clock);
//   4. every printable page renders (rules.html, docs.html?id=…);
//   5. the schedule is not stale (a current or future week exists).
// Exit code 1 when something needs attention. Run: node tools/healthcheck.js [--site https://…]
const path = require("path");
const ROOT = path.join(__dirname, "..");
const DOCS = require(path.join(ROOT, "documents.js"));
const RULES = require(path.join(ROOT, "rules.js"));
const SITE = (process.argv.indexOf("--site") > -1 ? process.argv[process.argv.indexOf("--site") + 1] : null) || "https://bar-lento.vercel.app";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
// Hosts behind bot walls answer 403 to anything that is not a real browser: report them as "unverified", not broken.
const BOT_WALLS = [/\.dol\.gov$/];

const out = { ok: [], warn: [], fail: [] };
const ok = (m) => out.ok.push(m), warn = (m) => out.warn.push(m), fail = (m) => out.fail.push(m);

async function get(url, opts) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), (opts && opts.timeout) || 30000);
  try { return await fetch(url, { redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html,application/json,application/pdf,*/*" }, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

function collectLinks() {
  const set = new Map();
  DOCS.list.forEach((d) => (d.links || []).forEach((l) => set.set(l.url, `${d.id}: ${l.label}`)));
  (RULES.links || []).forEach((l) => set.set(l.url, `rules: ${l.label}`));
  return set;
}

async function checkLinks() {
  for (const [url, label] of collectLinks()) {
    let status = 0, err = null;
    try { const r = await get(url); status = r.status; } catch (e) { err = e.message; }
    const host = new URL(url).hostname;
    if (url.includes("youtube.com/watch") || url.includes("youtu.be/")) { // YouTube rate-limits plain requests: ask oEmbed whether the video exists
      const id = url.match(/[?&]v=([^&]+)/) ? url.match(/[?&]v=([^&]+)/)[1] : url.split("/").pop();
      try { const r = await get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`); if (r.status === 200) { ok(`link ok (video exists): ${label}`); continue; } if (r.status === 404) { fail(`video removed: ${label} → ${url}`); continue; } } catch (e) {}
    }
    if (err) { fail(`link unreachable: ${label} → ${url} (${err})`); continue; }
    if (status >= 200 && status < 400) ok(`link ok: ${label}`);
    else if (status === 403 && BOT_WALLS.some((re) => re.test(host))) warn(`link unverified (bot wall, open it in a browser once): ${label} → ${url}`);
    else if (status === 429) warn(`link rate-limited, retry later: ${label} → ${url}`);
    else fail(`link broken (${status}): ${label} → ${url}`);
  }
}

async function checkSite() {
  let r;
  try { r = await get(SITE + "/?v=hc" + Date.now()); } catch (e) { fail(`site unreachable: ${SITE} (${e.message})`); return; }
  const html = await r.text();
  if (r.status !== 200 || !/Bar Lento/.test(html)) fail(`home page: HTTP ${r.status}`); else ok("home page answers");
  try {
    const d = await (await get(SITE + "/api/data")).json();
    const f = d.features || {};
    ["storage", "admin", "push", "toast", "mail"].forEach((k) => { if (f[k]) ok(`feature on: ${k}`); else fail(`feature OFF on the live site: ${k} (check the Vercel environment variables)`); });
    const staff = (d.data && d.data.staff) || [];
    if (staff.length) ok(`staff: ${staff.length} people`); else fail("staff list is empty");
    const weeks = Object.keys((d.data && d.data.weeks) || {}).sort();
    const monday = (() => { const n = new Date(); const day = (n.getUTCDay() + 6) % 7; n.setUTCDate(n.getUTCDate() - day); return n.toISOString().slice(0, 10); })();
    if (weeks.some((w) => w >= monday)) ok(`schedule has the current or a future week (${weeks[weeks.length - 1]})`); else warn(`no current week published yet (latest: ${weeks[weeks.length - 1] || "none"})`);
    if (d.updatedAt) ok(`last save: ${d.updatedAt}`);
  } catch (e) { fail(`/api/data: ${e.message}`); }
  try {
    const s = await (await get(SITE + "/api/toast?action=status")).json();
    if (s.ok || s.enabled || s.restaurant) ok(`Toast reachable from the site${s.restaurant ? ` (${s.restaurant.name || s.restaurant})` : ""}`); else fail(`Toast status: ${JSON.stringify(s).slice(0, 160)}`);
  } catch (e) { fail(`Toast status: ${e.message}`); }
  try {
    const c = await (await get(SITE + "/api/toast?action=clock")).json();
    if (Array.isArray(c.entries)) ok(`time clock answers (${c.entries.length} entries today)`); else fail(`time clock: ${JSON.stringify(c).slice(0, 160)}`);
  } catch (e) { fail(`time clock: ${e.message}`); }
  for (const p of ["/sw.js", "/manifest.webmanifest", "/rules.html", "/docs.html"].concat(DOCS.list.map((d) => "/docs.html?id=" + d.id))) {
    try { const x = await get(SITE + p); if (x.status === 200) ok(`page ok: ${p}`); else fail(`page ${p}: HTTP ${x.status}`); } catch (e) { fail(`page ${p}: ${e.message}`); }
  }
  // the texts the live site serves must be the ones in the repo (a deploy that did not go through would show here)
  try {
    const live = await (await get(SITE + "/documents.js?v=hc" + Date.now())).text();
    DOCS.list.forEach((d) => {
      const m = live.match(new RegExp('"id":\\s*"' + d.id + '"[\\s\\S]{0,400}?"version":\\s*"([^"]+)"'));
      if (m && m[1] === d.version) ok(`live text matches repo: ${d.id} ${d.version}`);
      else fail(`live text differs for ${d.id}: site ${m ? m[1] : "?"} vs repo ${d.version} (deploy pending or failed?)`);
    });
    const liveRules = await (await get(SITE + "/rules.js?v=hc" + Date.now())).text();
    const rv = liveRules.match(/version:\s*"([^"]+)"/) || liveRules.match(/"version":\s*"([^"]+)"/);
    if (rv && rv[1] === RULES.version) ok(`live House Rules match repo: ${RULES.version}`); else fail(`live House Rules version ${rv ? rv[1] : "?"} vs repo ${RULES.version}`);
  } catch (e) { warn(`could not compare live texts: ${e.message}`); }
}

(async () => {
  await checkLinks();
  await checkSite();
  const line = (s) => console.log(s);
  line(`# Bar Lento health check — ${new Date().toISOString()} — ${SITE}`);
  line(`\n## Needs attention (${out.fail.length})`); out.fail.forEach((m) => line("- " + m)); if (!out.fail.length) line("- nothing");
  line(`\n## To look at once (${out.warn.length})`); out.warn.forEach((m) => line("- " + m)); if (!out.warn.length) line("- nothing");
  line(`\n## OK (${out.ok.length})`); out.ok.forEach((m) => line("- " + m));
  process.exit(out.fail.length ? 1 : 0);
})();
