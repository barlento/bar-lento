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

// ---- Roles (owner's decision 2026-09-20, "un solo accesso a persona: il ruolo lo decide il reparto") ----
// Everyone signs in with their own name + PIN. What they can do follows their department (data.dept, kept in step with
// the Toast job): "chef" (Executive Chef) = kitchen manager, "management" / "owner" = manager; everyone else = staff.
// The env password ("Emergency access" link) is the service door only, and behind it there is EVERYTHING: it is the owner
// role (owner 2026-09-21, "deve poter fare qualsiasi cosa"): every manager tool plus View as and promotions. No second password.
// owner (Titolare, own PIN) = everything the manager has + the owner-only extras (promoting to Direzione/Titolare, "view as")
function roleOfDept(dept) { return dept === "chef" ? "chef" : dept === "management" ? "manager" : dept === "owner" ? "owner" : null; }
const isManagerish = (role) => role === "manager" || role === "owner";
// "owner" | "manager" | "chef" | null — the password header = owner, else the staff token (the person's department)
async function roleFrom(req, doc) {
  if (!adminEnabled()) return null;
  if (checkPassword(passwordFrom(req))) return "owner";
  const tok = String(req.headers["x-staff-token"] || ""); if (!tok) return null;
  const store = require("./store"); const accounts = require("./accounts");
  const d = doc || await store.getSchedule();
  const name = await accounts.whoIs(tok, d.data.staff).catch(() => null);
  return name && !isTestName(name) ? roleOfDept((d.data.dept || {})[name]) : null; // test accounts are always plain staff (owner 2026-09-21)
}
async function roleOf(candidate) { return adminEnabled() && checkPassword(candidate) ? "owner" : null; }
// Kitchen people = what the chef may see or schedule (the kitchen and the chef themself)
function kitchenNames(data) { const d = (data && data.dept) || {}; return (data.staff || []).filter((n) => d[n] === "kitchen" || d[n] === "chef"); }

function passwordFrom(req) {
  const h = req.headers["x-admin-password"];
  if (typeof h === "string" && h) return h;
  if (req.body && typeof req.body.password === "string") return req.body.password;
  return "";
}

function isTestName(n) { return /^test\b/i.test(String(n || "")); }
module.exports = { isTestName, adminEnabled, checkPassword, passwordFrom, roleOf, roleFrom, roleOfDept, isManagerish, kitchenNames };
