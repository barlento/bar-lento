const crypto = require("crypto");

// The variable may have been created as ADMIN_PASSWORD, admin_password, Admin_Password…
function expectedPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const key = Object.keys(process.env).find((k) => k.toLowerCase() === "admin_password" && process.env[k]);
  return key ? process.env[key] : "";
}

function adminEnabled() {
  return Boolean(expectedPassword());
}

// Constant-time comparison so response timing reveals nothing about the password.
function checkPassword(candidate) {
  const expected = expectedPassword();
  if (!expected || typeof candidate !== "string") return false;
  const a = Buffer.from(candidate.normalize("NFKC"));
  const b = Buffer.from(expected.normalize("NFKC"));
  if (a.length !== b.length) {
    // Compare against itself to keep timing flat, then fail.
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

// ---- Chef login (owner's request 2026-09-19): a second, limited role. The manager sets the chef's password from the
// Staff screen; it is stored scrypt-hashed in Redis (barlento:chef_pw), never in code or env. The chef sees and
// schedules ONLY the kitchen (people with department "kitchen"); everything else is refused server-side.
const CHEF_KEY = "barlento:chef_pw";
function scryptHex(pw, saltHex) { return crypto.scryptSync(String(pw).normalize("NFKC"), Buffer.from(saltHex, "hex"), 32, { N: 16384, r: 8, p: 1 }).toString("hex"); }
async function chefRecord() { try { const raw = await require("./store")._redis("GET", CHEF_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
async function chefEnabled() { return Boolean(await chefRecord()); }
async function setChefPassword(pw) {
  const store = require("./store");
  if (!pw) { await store._redis("DEL", CHEF_KEY); return false; }
  const salt = crypto.randomBytes(16).toString("hex");
  await store._redis("SET", CHEF_KEY, JSON.stringify({ salt, hash: scryptHex(pw, salt), at: new Date().toISOString() }));
  return true;
}
async function checkChef(candidate) {
  const rec = await chefRecord(); if (!rec || typeof candidate !== "string" || !candidate) return false;
  const a = Buffer.from(scryptHex(candidate, rec.salt), "hex"), b = Buffer.from(rec.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// "manager" | "chef" | null
async function roleOf(candidate) {
  if (!adminEnabled()) return null;
  if (checkPassword(candidate)) return "manager";
  return (await checkChef(candidate)) ? "chef" : null;
}
async function roleFrom(req) { return roleOf(passwordFrom(req)); }
// Kitchen people = the only names the chef may see or schedule
function kitchenNames(data) { const d = (data && data.dept) || {}; return (data.staff || []).filter((n) => d[n] === "kitchen"); }

function passwordFrom(req) {
  const h = req.headers["x-admin-password"];
  if (typeof h === "string" && h) return h;
  if (req.body && typeof req.body.password === "string") return req.body.password;
  return "";
}

module.exports = { adminEnabled, checkPassword, passwordFrom, roleOf, roleFrom, chefEnabled, setChefPassword, kitchenNames };
