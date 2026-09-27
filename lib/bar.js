// Bar notes (owner 2026-09-27, "una sezione bar sempre visibile"): what is NOT available behind the bar right now, a note and
// how to make things (spritz, wine by the glass…), written from the app by the owner or the manager in Italian or English and
// translated by the assistant (lib/ai.translateBar) so the team reads it in EN or IT. One JSON blob `barlento:bar`
// {rev, updatedAt, updatedBy, src, en, it} — rev lives INSIDE the blob (GET → rev+1 → SET); `barlento:bar:seen` = name → last
// rev opened (NEW badge + to-do task until read). When the "not available" list changes, everyone scheduled today or tomorrow
// (New York) gets ONE push "Bar update"; in quiet hours (23–10 NY) it waits in `barlento:bar:pending` and remind.tick →
// flushPending sends it in the morning to the people scheduled at that moment. Storage errors are marked (e.storage) so the API
// answers 503 instead of 500.
const store = require("./store");
const push = require("./push");
const auth = require("./auth");

const KEY = "barlento:bar", SEEN_KEY = "barlento:bar:seen", PENDING_KEY = "barlento:bar:pending";
const TZ = "America/New_York";
const LIMITS = { unavailable: 40, line: 120, note: 1500, recipes: 40, title: 80, text: 2500 };
const PUSH_MAX_ITEMS = 8; // a push body stays short: after 8 items "+N more"

// First content, from the owner's WhatsApp (2026-09-27): written once with SET NX, never overwrites an edit.
const SEED_SRC = {
  unavailable: ["Birre (tutte)", "Feral analcolico"],
  note: "Per ora abbiamo solo la licenza vino e birra: niente superalcolici, niente cocktail con liquori. Al calice: Li Sureddi bianco (non Pinot). Una bottiglia = 5 calici perfetti.",
  recipes: [
    { title: "Spritz (Ceraso / Agrumato / Vermouth)", text: "Bicchiere da vino bello pieno di ghiaccio.\n2 oz di Ceraso, Agrumato o Vermouth, il resto vino frizzante.\nGuarnizione: fetta d'arancia per l'Agrumato; ciliegia al maraschino (o arancia) per il Ceraso; arancia o limone per il Vermouth.\nGli spritz sono facili: stessi passaggi per tutti e tre." },
    { title: "Vino al calice", text: "Li Sureddi bianco, non Pinot.\nUna bottiglia = 5 calici." },
  ],
};
const SEED_EN = {
  unavailable: ["Beers (all)", "Feral non-alcoholic"],
  note: "Wine and beer licence only for now: no spirits, no cocktails with liquor. Wine by the glass: Li Sureddi white (not Pinot). One bottle = 5 perfect glasses.",
  recipes: [
    { title: "Spritz (Ceraso / Agrumato / Vermouth)", text: "Wine glass, full of ice.\n2 oz of Ceraso, Agrumato or Vermouth, top up with sparkling wine.\nGarnish: orange slice for Agrumato; maraschino cherry (or orange) for Ceraso; orange or lemon for Vermouth.\nSpritzes are easy: same steps for all three." },
    { title: "Wine by the glass", text: "Li Sureddi white, not Pinot.\nOne bottle = 5 glasses." },
  ],
};
const SEED = { rev: 1, updatedBy: "Simone", src: SEED_SRC, en: SEED_EN, it: SEED_SRC };

const redis = (...cmd) => store._redis(...cmd).catch((e) => { e.storage = true; throw e; });
function todayNY() { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); }
function addDays(iso, n) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const str = (v) => (v == null ? "" : typeof v === "string" ? v : null); // null = not a string (bad content)
const nl = (s) => s.replace(/\r\n?/g, "\n");

// What the editor typed → trimmed content within the limits, or null (400 bad_content). Empty lines and empty recipes are dropped.
function validate(src) {
  if (!src || typeof src !== "object" || Array.isArray(src)) return null;
  const un = src.unavailable == null ? [] : src.unavailable, rc = src.recipes == null ? [] : src.recipes, note = str(src.note);
  if (!Array.isArray(un) || !Array.isArray(rc) || note === null) return null;
  const unavailable = [];
  for (const l of un) { const s = str(l); if (s === null) return null; for (const t of nl(s).split("\n").map((x) => x.trim()).filter(Boolean)) { if (t.length > LIMITS.line) return null; unavailable.push(t); } }
  const recipes = [];
  for (const r of rc) {
    if (!r || typeof r !== "object") return null;
    const title = str(r.title), text = str(r.text); if (title === null || text === null) return null;
    const tt = title.trim(), tx = nl(text).trim(); if (!tt && !tx) continue;
    if (tt.length > LIMITS.title || tx.length > LIMITS.text) return null;
    recipes.push({ title: tt, text: tx });
  }
  const n = nl(note).trim();
  if (n.length > LIMITS.note || unavailable.length > LIMITS.unavailable || recipes.length > LIMITS.recipes) return null;
  return { unavailable, note: n, recipes };
}
// A translation is accepted only with the same counts in the same order (strings trimmed); null otherwise → the caller falls back.
function matchShape(src, t) {
  if (!t || typeof t !== "object") return null;
  const un = Array.isArray(t.unavailable) ? t.unavailable : null, rc = Array.isArray(t.recipes) ? t.recipes : null, note = str(t.note);
  if (!un || !rc || note === null || un.length !== src.unavailable.length || rc.length !== src.recipes.length) return null;
  if (!un.every((s) => typeof s === "string" && s.trim())) return null;
  if (!rc.every((r, i) => r && typeof r === "object" && str(r.title) !== null && str(r.text) !== null && (!src.recipes[i].title || String(r.title || "").trim()))) return null;
  if (Boolean(src.note) !== Boolean(note.trim())) return null;
  return { unavailable: un.map((s) => s.trim()), note: nl(note).trim(), recipes: rc.map((r) => ({ title: String(r.title || "").trim(), text: nl(String(r.text || "")).trim() })) };
}
// Whatever is in Redis → a well-formed content object (never crashes a consumer)
function content(o) {
  o = o && typeof o === "object" ? o : {};
  return { unavailable: Array.isArray(o.unavailable) ? o.unavailable.map((s) => String(s == null ? "" : s)) : [], note: String(o.note == null ? "" : o.note), recipes: Array.isArray(o.recipes) ? o.recipes.map((r) => ({ title: String(r && r.title != null ? r.title : ""), text: String(r && r.text != null ? r.text : "") })) : [] };
}
function seedBar(now) { return Object.assign({}, SEED, { updatedAt: now }); }
function view(b, withSrc) { const out = { rev: b.rev, updatedAt: b.updatedAt, updatedBy: b.updatedBy, en: b.en, it: b.it }; if (withSrc) out.src = b.src; return out; }

// The bar notes; a missing key = the seed, written once (SET NX) so a concurrent edit is never overwritten.
async function get() {
  const now = new Date().toISOString();
  if (!store.hasStorage()) return seedBar(now);
  let raw = await redis("GET", KEY);
  if (!raw) { const s = seedBar(now); const r = await redis("SET", KEY, JSON.stringify(s), "NX"); if (r === "OK" || r === true) return s; raw = await redis("GET", KEY); }
  let b; try { b = JSON.parse(raw); } catch (e) { b = null; }
  if (!b || typeof b !== "object") return seedBar(now);
  return { rev: Number(b.rev) || 1, updatedAt: b.updatedAt || now, updatedBy: String(b.updatedBy || "manager"), src: content(b.src), en: content(b.en), it: content(b.it || b.src) };
}
async function seenRev(name) { return Number(await redis("HGET", SEEN_KEY, name)) || 0; }
async function markSeen(name) { const b = await get(); await redis("HSET", SEEN_KEY, name, String(b.rev)); return b.rev; }

// Who gets the push: everyone scheduled today or tomorrow (New York), floor and kitchen, no test accounts, no duplicates.
function recipients(doc) {
  const remind = require("./remind"); // lazy: remind.tick calls flushPending below
  const data = doc && doc.data ? doc.data : doc || {};
  const today = todayNY(), dates = [today, addDays(today, 1)];
  const names = [...new Set(dates.flatMap((d) => remind.todayShifts(data, d).map((s) => s.name)))].filter((n) => !auth.isTestName(n));
  return { dates, names };
}
const listKey = (l) => (l || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean).sort().join("\n");
function pushBody(list) { if (!list.length) return "Everything is available again"; const shown = list.slice(0, PUSH_MAX_ITEMS).join(", "); return "Not available: " + shown + (list.length > PUSH_MAX_ITEMS ? " +" + (list.length - PUSH_MAX_ITEMS) + " more" : ""); }

// Save what the manager typed: validate → translate (fallback: en = it = src) → rev+1 → history line → push to today's and
// tomorrow's people when the "not available" list changed (order-insensitive), queued during quiet hours.
async function save(src, by, doc) {
  const clean = validate(src); if (!clean) return { status: 400, body: { error: "bad_content" } };
  const prev = await get();
  const tr = await require("./ai").translateBar(clean).catch((e) => { console.warn("translateBar", e && e.message); return null; });
  const en = (tr && matchShape(clean, tr.en)) || clean, it = (tr && matchShape(clean, tr.it)) || clean;
  const bar = { rev: (Number(prev.rev) || 0) + 1, updatedAt: new Date().toISOString(), updatedBy: String(by || "manager").slice(0, 60), src: clean, en, it };
  await redis("SET", KEY, JSON.stringify(bar));
  const changed = listKey(prev.en.unavailable) !== listKey(en.unavailable);
  const k = en.recipes.length;
  const line = `Bar notes updated by ${bar.updatedBy}: ${en.unavailable.length} not available, ${k} recipe${k === 1 ? "" : "s"}` + (changed ? (en.unavailable.length ? ` · not available: ${en.unavailable.join(", ")}` : " · everything available") : "");
  await store.appendLog({ at: bar.updatedAt, changes: [line] }).catch(() => {});
  let pushed = [], queued = false;
  if (changed) {
    const body = pushBody(en.unavailable); pushed = recipients(doc).names;
    if (push.isQuietHours()) { await redis("SET", PENDING_KEY, JSON.stringify({ names: pushed, body, at: bar.updatedAt })); queued = true; } // one item: the latest state
    else if (pushed.length) await push.broadcast({ title: "Bar update", body, url: "/", tag: "bar" }, pushed).catch(() => {});
  }
  return { status: 200, body: { ok: true, bar: view(bar, true), pushed, queued } };
}
// After quiet hours (from remind.tick): one GET when nothing waits; DEL first so two polls never send twice; recipients recomputed now.
async function flushPending(doc) {
  if (!store.hasStorage()) return { sent: 0 };
  const raw = await redis("GET", PENDING_KEY); if (!raw) return { sent: 0 };
  if (push.isQuietHours()) return { sent: 0, waiting: "quiet_hours" };
  if ((await redis("DEL", PENDING_KEY)) !== 1) return { sent: 0 };
  let p; try { p = JSON.parse(raw); } catch (e) { p = null; }
  if (!p || !p.body) return { sent: 0 };
  const names = recipients(doc).names;
  const r = names.length ? await push.broadcast({ title: "Bar update", body: p.body, url: "/", tag: "bar" }, names).catch(() => ({ sent: 0 })) : { sent: 0 };
  return { sent: r.sent || 0, names, body: p.body };
}

module.exports = { get, save, markSeen, seenRev, recipients, flushPending, validate, matchShape, view, SEED, LIMITS, KEY, SEEN_KEY, PENDING_KEY };
