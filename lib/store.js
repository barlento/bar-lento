// Shared storage for Bar Lento — Upstash Redis via REST (no npm dependencies).
// Env vars are injected automatically by the Vercel ↔ Upstash integration.
// Without them the site still works read-only from the seed file (data.json).

const seed = require("../data.json");

// Accept whatever prefix the Vercel ↔ Upstash integration was given (KV_, STORAGE_, REDIS_, …).
function findEnv(suffix) {
  const preferred = ["KV_" + suffix, "UPSTASH_REDIS_" + suffix, "STORAGE_" + suffix, "REDIS_" + suffix];
  for (const k of preferred) if (process.env[k]) return process.env[k];
  const any = Object.keys(process.env).find((k) => k.endsWith("_" + suffix) && process.env[k]);
  return any ? process.env[any] : "";
}
const REST_URL = findEnv("REST_API_URL") || findEnv("REST_URL") || "";
const REST_TOKEN = findEnv("REST_API_TOKEN") || findEnv("REST_TOKEN") || "";

const SCHEDULE_KEY = "barlento:schedule";
const CONFIRM_KEY = "barlento:confirm";
const LOG_KEY = "barlento:log";
const LOG_MAX = 3000;

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_STATUSES = ["", "closed", "holiday", "half", "event"];
const PUSH_KEY = "barlento:push";

function hasStorage() {
  return Boolean(REST_URL && REST_TOKEN);
}

async function redis(...command) {
  const res = await fetch(REST_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Redis: ${json.error}`);
  return json.result;
}

function emptyWeek() {
  const w = { notes: {} };
  DAY_KEYS.forEach((k) => (w[k] = []));
  return w;
}

// Accepts old-style names like "Kayla (BAR)" and splits them into name/station.
function normalizeShift(s, idx) {
  const out = {
    id: String(s.id || `s${Date.now().toString(36)}${idx}`).slice(0, 64),
    name: String(s.name || "").trim().slice(0, 60),
    station: String(s.station || "").trim().slice(0, 12),
    start: /^\d{2}:\d{2}$/.test(s.start) ? s.start : "16:00",
    end: /^\d{2}:\d{2}$/.test(s.end) ? s.end : "22:00",
  };
  const m = out.name.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (m && !out.station) {
    out.name = m[1].trim();
    out.station = m[2].trim().slice(0, 12);
  }
  return out;
}

function normalizeNote(n) {
  if (!n || typeof n !== "object") return null;
  const status = DAY_STATUSES.includes(n.status) ? n.status : "";
  const text = String(n.text || "").trim().slice(0, 140);
  if (!status && !text) return null;
  const out = { status, text };
  if (status === "half") {
    out.open = /^\d{2}:\d{2}$/.test(n.open) ? n.open : "16:00";
    out.close = /^\d{2}:\d{2}$/.test(n.close) ? n.close : "19:00";
  }
  return out;
}

function normalizeData(raw) {
  const data = { staff: [], birthdays: {}, weeks: {} };
  if (Array.isArray(raw.staff)) {
    data.staff = raw.staff.map((n) => String(n).trim().slice(0, 60)).filter(Boolean).slice(0, 80);
  }
  if (raw.birthdays && typeof raw.birthdays === "object") {
    Object.keys(raw.birthdays).slice(0, 200).forEach((name) => {
      const v = String(raw.birthdays[name] || "");
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) data.birthdays[String(name).trim().slice(0, 60)] = v;
    });
  }
  const weeks = raw.weeks && typeof raw.weeks === "object" ? raw.weeks : {};
  Object.keys(weeks)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort()
    .slice(0, 260)
    .forEach((k) => {
      const src = weeks[k] || {};
      const w = emptyWeek();
      DAY_KEYS.forEach((d) => {
        const list = Array.isArray(src[d]) ? src[d] : [];
        w[d] = list.slice(0, 40).map(normalizeShift);
        const note = normalizeNote(src.notes && src.notes[d]);
        if (note) w.notes[d] = note;
      });
      data.weeks[k] = w;
    });
  return data;
}

function seedDoc() {
  return {
    version: 1,
    data: normalizeData(seed),
    updatedAt: seed.publishedAt || new Date().toISOString(),
  };
}

async function getSchedule() {
  if (!hasStorage()) return { ...seedDoc(), source: "seed" };
  const raw = await redis("GET", SCHEDULE_KEY);
  if (!raw) {
    const doc = seedDoc();
    await redis("SET", SCHEDULE_KEY, JSON.stringify(doc));
    return { ...doc, source: "redis" };
  }
  const doc = JSON.parse(raw);
  return { ...doc, data: normalizeData(doc.data || {}), source: "redis" };
}

async function saveSchedule(doc) {
  await redis("SET", SCHEDULE_KEY, JSON.stringify(doc));
}

async function getConfirmations() {
  if (!hasStorage()) return {};
  const flat = await redis("HGETALL", CONFIRM_KEY);
  const out = {};
  if (Array.isArray(flat)) {
    for (let i = 0; i + 1 < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  } else if (flat && typeof flat === "object") {
    Object.assign(out, flat);
  }
  return out;
}

async function setConfirmation(field, on) {
  if (on) await redis("HSET", CONFIRM_KEY, field, new Date().toISOString());
  else await redis("HDEL", CONFIRM_KEY, field);
}

async function removeConfirmations(fields) {
  if (fields.length) await redis("HDEL", CONFIRM_KEY, ...fields);
}

// Remove confirmations that point at shifts that no longer exist.
async function pruneConfirmations(data) {
  const valid = new Set();
  Object.keys(data.weeks).forEach((wk) => {
    DAY_KEYS.forEach((d) => data.weeks[wk][d].forEach((s) => valid.add(`${wk}:${d}:${s.id}`)));
  });
  const current = await getConfirmations();
  const stale = Object.keys(current).filter((f) => !valid.has(f));
  await removeConfirmations(stale);
}

// ---- change log (append-only) ----
async function appendLog(entry) {
  if (!hasStorage()) return;
  await redis("RPUSH", LOG_KEY, JSON.stringify(entry));
  await redis("LTRIM", LOG_KEY, -LOG_MAX, -1);
}

async function getLog(limit) {
  if (!hasStorage()) return [];
  const n = Math.max(1, Math.min(Number(limit) || 200, 1000));
  const raw = await redis("LRANGE", LOG_KEY, -n, -1);
  return (raw || []).map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean).reverse();
}

// ---- push subscriptions (one per phone/browser) ----
async function getPushSubscriptions() {
  if (!hasStorage()) return [];
  const flat = await redis("HGETALL", PUSH_KEY);
  const out = [];
  const push = (v) => { try { out.push(JSON.parse(v)); } catch (e) {} };
  if (Array.isArray(flat)) { for (let i = 0; i + 1 < flat.length; i += 2) push(flat[i + 1]); }
  else if (flat && typeof flat === "object") Object.values(flat).forEach(push);
  return out;
}
function pushId(endpoint) {
  return require("crypto").createHash("sha256").update(String(endpoint)).digest("hex").slice(0, 32);
}
async function savePushSubscription(sub) {
  await redis("HSET", PUSH_KEY, pushId(sub.endpoint), JSON.stringify(sub));
}
async function removePushSubscription(endpoint) {
  await redis("HDEL", PUSH_KEY, pushId(endpoint));
}

module.exports = {
  DAY_KEYS,
  getPushSubscriptions,
  savePushSubscription,
  removePushSubscription,
  DAY_STATUSES,
  hasStorage,
  normalizeData,
  getSchedule,
  saveSchedule,
  getConfirmations,
  setConfirmation,
  removeConfirmations,
  pruneConfirmations,
  appendLog,
  getLog,
};
