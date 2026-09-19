// Personal access for staff: name + 4-digit PIN, remembered per device with a random token.
// PINs are never stored in clear (scrypt + per-person salt). No emails, no passwords to remember.
const crypto = require("crypto");
const store = require("./store");

const PIN_KEY = "barlento:pin";          // hash: name → {salt, hash, createdAt, failed, lockedUntil, rounds}
const SESSION_KEY = "barlento:sessions"; // hash: token → {name, createdAt, lastSeen, ua}

const PIN_RE = /^\d{4}$/;
const TOKEN_RE = /^[a-f0-9]{48}$/;
const MAX_FAILED = 5;          // wrong PINs before a temporary lock
const SESSION_DAYS = 400;      // "remember this device" — effectively until they log out or change phone

async function redis(...cmd) { return store._redis(...cmd); }

async function hgetallObj(key) {
  const flat = await redis("HGETALL", key);
  const out = {};
  if (Array.isArray(flat)) { for (let i = 0; i + 1 < flat.length; i += 2) out[flat[i]] = flat[i + 1]; }
  else if (flat && typeof flat === "object") Object.assign(out, flat);
  Object.keys(out).forEach((k) => { try { out[k] = JSON.parse(out[k]); } catch (e) { delete out[k]; } });
  return out;
}

function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), Buffer.from(salt, "hex"), 32, { N: 16384, r: 8, p: 1 }).toString("hex");
}
function validPin(pin) { return PIN_RE.test(String(pin || "")); }
function validToken(t) { return TOKEN_RE.test(String(t || "")); }

// Lock grows with repeated rounds of failures: 5 min, 10, 20, 40, max 60.
function lockMinutes(rounds) { return Math.min(60, 5 * Math.pow(2, Math.max(0, rounds - 1))); }

async function getPinRecord(name) {
  const raw = await redis("HGET", PIN_KEY, name);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
async function setPinRecord(name, rec) { await redis("HSET", PIN_KEY, name, JSON.stringify(rec)); }

async function hasPin(name) { return Boolean(await getPinRecord(name)); }

// Names that already created a PIN (manager view).
async function summary() {
  const [pins, sessions] = await Promise.all([hgetallObj(PIN_KEY), hgetallObj(SESSION_KEY)]);
  const out = {};
  Object.keys(pins).forEach((n) => { out[n] = { pin: true, devices: 0, createdAt: pins[n].createdAt || null, lockedUntil: pins[n].lockedUntil || null }; });
  Object.values(sessions).forEach((s) => { if (s && s.name) { out[s.name] = out[s.name] || { pin: false, devices: 0 }; out[s.name].devices++; const seen = s.lastSeen || s.createdAt || null; if (seen && (!out[s.name].lastSeen || seen > out[s.name].lastSeen)) out[s.name].lastSeen = seen; } });
  return out;
}

function lockInfo(rec) {
  if (rec && rec.lockedUntil && Date.parse(rec.lockedUntil) > Date.now()) {
    return { locked: true, retryIn: Math.max(1, Math.ceil((Date.parse(rec.lockedUntil) - Date.now()) / 1000)) };
  }
  return { locked: false, retryIn: 0 };
}

async function newSession(name, ua) {
  const token = crypto.randomBytes(24).toString("hex");
  const now = new Date().toISOString();
  await redis("HSET", SESSION_KEY, token, JSON.stringify({ name, createdAt: now, lastSeen: now, ua: String(ua || "").slice(0, 120) }));
  return token;
}

// First time: the person creates their PIN. Refused if one already exists (only the manager can reset it).
async function createPin(name, pin, ua) {
  if (!validPin(pin)) return { error: "bad_pin" };
  if (await getPinRecord(name)) return { error: "pin_exists" };
  const salt = crypto.randomBytes(16).toString("hex");
  await setPinRecord(name, { salt, hash: hashPin(pin, salt), createdAt: new Date().toISOString(), failed: 0, rounds: 0, lockedUntil: null });
  const token = await newSession(name, ua);
  return { token };
}

async function login(name, pin, ua) {
  const rec = await getPinRecord(name);
  if (!rec) return { error: "no_pin" };
  const lock = lockInfo(rec);
  if (lock.locked) return { error: "locked", retryIn: lock.retryIn };
  if (!validPin(pin)) return { error: "bad_pin" };
  const a = Buffer.from(hashPin(pin, rec.salt), "hex"), b = Buffer.from(rec.hash, "hex");
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    rec.failed = (rec.failed || 0) + 1;
    if (rec.failed >= MAX_FAILED) {
      rec.rounds = (rec.rounds || 0) + 1;
      rec.failed = 0;
      rec.lockedUntil = new Date(Date.now() + lockMinutes(rec.rounds) * 60000).toISOString();
      await setPinRecord(name, rec);
      return { error: "locked", retryIn: lockMinutes(rec.rounds) * 60 };
    }
    await setPinRecord(name, rec);
    return { error: "wrong_pin", attemptsLeft: MAX_FAILED - rec.failed };
  }
  if (rec.failed || rec.rounds || rec.lockedUntil) { rec.failed = 0; rec.rounds = 0; rec.lockedUntil = null; await setPinRecord(name, rec); }
  const token = await newSession(name, ua);
  return { token };
}

// Who is this device? null when the token is unknown or the person is no longer on staff.
async function whoIs(token, staff) {
  if (!validToken(token)) return null;
  const raw = await redis("HGET", SESSION_KEY, token);
  if (!raw) return null;
  let s; try { s = JSON.parse(raw); } catch (e) { return null; }
  if (!s || !s.name) return null;
  if (Array.isArray(staff) && !staff.includes(s.name)) { await redis("HDEL", SESSION_KEY, token).catch(() => {}); return null; }
  if (Date.parse(s.createdAt || 0) < Date.now() - SESSION_DAYS * 86400000) { await redis("HDEL", SESSION_KEY, token).catch(() => {}); return null; }
  // touch (at most once an hour, keeps writes low)
  if (!s.lastSeen || Date.parse(s.lastSeen) < Date.now() - 3600000) {
    s.lastSeen = new Date().toISOString();
    await redis("HSET", SESSION_KEY, token, JSON.stringify(s)).catch(() => {});
  }
  return s.name;
}

async function logout(token) {
  if (!validToken(token)) return;
  await redis("HDEL", SESSION_KEY, token);
}

async function logoutEverywhere(name) {
  const sessions = await hgetallObj(SESSION_KEY);
  const tokens = Object.keys(sessions).filter((t) => sessions[t] && sessions[t].name === name);
  if (tokens.length) await redis("HDEL", SESSION_KEY, ...tokens);
  return tokens.length;
}

// ---- House Rules acknowledgments: name → {version, email, at, ua} ----
const RULES_KEY = "barlento:rules_ack";
const RULES_ARCHIVE_KEY = "barlento:rules_ack_archive"; // "name @ at" → record of people no longer on staff
async function getRulesAck(name) {
  const raw = await redis("HGET", RULES_KEY, name);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
async function setRulesAck(name, rec) { await redis("HSET", RULES_KEY, name, JSON.stringify(rec)); }
// Writes only if nobody wrote first (two taps at the same instant): returns true when this record is the one stored.
async function setRulesAckIfAbsent(name, rec) { return Number(await redis("HSETNX", RULES_KEY, name, JSON.stringify(rec))) === 1; }
async function allRulesAck() { return hgetallObj(RULES_KEY); }
async function allRulesAckArchive() { return hgetallObj(RULES_ARCHIVE_KEY); }

// ---- Other documents (documents.js): one hash per document, name → {version, email, at, ua, hash, ...} ----
const DOC_KEY = (id) => "barlento:doc_ack:" + String(id).replace(/[^a-z0-9_-]/gi, "");
const DOC_ARCHIVE_KEY = "barlento:doc_ack_archive"; // "docId | name @ at" → record of people no longer on staff
async function getDocAck(id, name) {
  const raw = await redis("HGET", DOC_KEY(id), name);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
async function setDocAck(id, name, rec) { await redis("HSET", DOC_KEY(id), name, JSON.stringify(rec)); }
async function setDocAckIfAbsent(id, name, rec) { return Number(await redis("HSETNX", DOC_KEY(id), name, JSON.stringify(rec))) === 1; }
async function allDocAck(id) { return hgetallObj(DOC_KEY(id)); }
async function allDocAckArchive() { return hgetallObj(DOC_ARCHIVE_KEY); }
// All of a person's document acknowledgments at once: {docId: rec}
async function docAcksFor(name, ids) {
  const out = {};
  await Promise.all(ids.map(async (id) => { out[id] = await getDocAck(id, name).catch(() => null); }));
  return out;
}

// Manager: clear the PIN (the person creates a new one next time) and sign out all their devices.
async function resetPin(name) {
  await redis("HDEL", PIN_KEY, name);
  return logoutEverywhere(name);
}

// When the manager removes someone from staff, their access disappears too. The archive of past shifts stays.
async function removeAccounts(names, docIds) {
  docIds = Array.isArray(docIds) ? docIds : (() => { try { return require("../documents.js").list.map((d) => d.id); } catch (e) { return []; } })();
  for (const n of names) {
    await resetPin(n).catch(() => {});
    // The House Rules acknowledgment is a legal record: move it to the archive (never delete it) so a rehire or a new person with the same name is asked again.
    const ack = await getRulesAck(n).catch(() => null);
    if (ack) {
      try {
        await redis("HSET", RULES_ARCHIVE_KEY, n + " @ " + (ack.at || new Date().toISOString()), JSON.stringify(Object.assign({}, ack, { name: n, removedAt: new Date().toISOString() })));
        await redis("HDEL", RULES_KEY, n); // only after the archive write succeeded: never lose the legal proof
      } catch (e) { /* archive failed → keep the live record */ }
    }
    // Same for every other document (policies, training).
    for (const id of docIds) {
      const a = await getDocAck(id, n).catch(() => null);
      if (!a) continue;
      try {
        await redis("HSET", DOC_ARCHIVE_KEY, id + " | " + n + " @ " + (a.at || new Date().toISOString()), JSON.stringify(Object.assign({}, a, { doc: id, name: n, removedAt: new Date().toISOString() })));
        await redis("HDEL", DOC_KEY(id), n);
      } catch (e) { /* keep the live record */ }
    }
  }
}

module.exports = { getRulesAck, setRulesAck, setRulesAckIfAbsent, setDocAckIfAbsent, allRulesAck, allRulesAckArchive, getDocAck, setDocAck, allDocAck, allDocAckArchive, docAcksFor, hasPin, createPin, login, whoIs, logout, logoutEverywhere, resetPin, removeAccounts, summary, lockInfo, getPinRecord, validPin, validToken };
