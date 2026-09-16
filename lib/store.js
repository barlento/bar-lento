// Shared storage for Bar Lento — Upstash Redis via REST (no npm dependencies).
// Env vars are injected automatically by the Vercel ↔ Upstash integration.
// Without them the site still works read-only from the seed file (data.json).

const seed = require("../data.json");

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

const SCHEDULE_KEY = "barlento:schedule";
const CONFIRM_KEY = "barlento:confirm";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

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
  const w = {};
  DAY_KEYS.forEach((k) => (w[k] = []));
  return w;
}

// Accepts old-style names like "Kayla (BAR)" and splits them into name/station.
function normalizeShift(s, idx) {
  const out = {
    id: String(s.id || `s${Date.now().toString(36)}${idx}`),
    name: String(s.name || "").trim(),
    station: String(s.station || "").trim(),
    start: String(s.start || ""),
    end: String(s.end || ""),
  };
  const m = out.name.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (m && !out.station) {
    out.name = m[1].trim();
    out.station = m[2].trim();
  }
  return out;
}

function normalizeData(raw) {
  const data = { staff: [], weeks: {} };
  if (Array.isArray(raw.staff)) {
    data.staff = raw.staff.map((n) => String(n).trim()).filter(Boolean).slice(0, 60);
  }
  const weeks = raw.weeks && typeof raw.weeks === "object" ? raw.weeks : {};
  Object.keys(weeks)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort()
    .slice(0, 60)
    .forEach((k) => {
      const src = weeks[k] || {};
      const w = emptyWeek();
      DAY_KEYS.forEach((d) => {
        const list = Array.isArray(src[d]) ? src[d] : [];
        w[d] = list.slice(0, 30).map(normalizeShift);
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

// Remove confirmations that point at shifts that no longer exist.
async function pruneConfirmations(data) {
  const valid = new Set();
  Object.keys(data.weeks).forEach((wk) => {
    DAY_KEYS.forEach((d) => {
      data.weeks[wk][d].forEach((s) => valid.add(`${wk}:${d}:${s.id}`));
    });
  });
  const current = await getConfirmations();
  const stale = Object.keys(current).filter((f) => !valid.has(f));
  if (stale.length) await redis("HDEL", CONFIRM_KEY, ...stale);
}

module.exports = {
  DAY_KEYS,
  hasStorage,
  normalizeData,
  getSchedule,
  saveSchedule,
  getConfirmations,
  setConfirmation,
  pruneConfirmations,
};
