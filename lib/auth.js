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

function passwordFrom(req) {
  const h = req.headers["x-admin-password"];
  if (typeof h === "string" && h) return h;
  if (req.body && typeof req.body.password === "string") return req.body.password;
  return "";
}

module.exports = { adminEnabled, checkPassword, passwordFrom };
