// What's new → the whole team (owner 2026-09-27). One entry in whatsnew.js = one push to every phone with notifications on,
// one email per person on staff (Toast email, else the email they signed with; test accounts skipped), one summary email to
// the owner and one history line. Runs on the polls of /api/data (remind.tick): a few emails per poll (Resend allows ~2/s and
// a serverless call is short), progress in Redis, never at night (quiet hours), never twice. State: `barlento:whatsnew:<id>`
// = {startedAt, push, mailed[], skipped[], failed[], todo[], done}; lock `barlento:whatsnew:lock:<id>` (SET NX EX 20).
const store = require("./store");
const push = require("./push");
const mail = require("./mail");
const auth = require("./auth");
const accounts = require("./accounts");
const toast = require("./toast");
const NEWS = require("../whatsnew.js");

const TZ = "America/New_York";
const BATCH = 3, MAX_AGE_DAYS = 14;
const redis = (...cmd) => store._redis(...cmd);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const key = (id) => `barlento:whatsnew:${id}`;
function todayNY() { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); }
function niceDate(iso, lang) { try { return new Intl.DateTimeFormat(lang === "it" ? "it-IT" : "en-US", { timeZone: TZ, month: "long", day: "numeric", year: "numeric" }).format(new Date(iso + "T12:00:00Z")); } catch (e) { return iso; } }
const daysBetween = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);

// Entries not announced yet (newest first, never older than MAX_AGE_DAYS so a fresh store does not replay history)
function pending() { const today = todayNY(); return (NEWS.entries || []).filter((e) => e && e.id && e.date && daysBetween(e.date, today) <= MAX_AGE_DAYS); }

// The email: white card on the app's grey, English first, Italian below, one blue button. Same look as the signed copies.
function render(entry, firstName) {
  const hi = firstName ? `Hi ${esc(firstName)},` : "Hi,";
  const block = (lang) => {
    const items = (entry.items || []).map((it) => { const [lead, text] = it[lang] || it.en || ["", ""]; return `<li style="margin:0 0 10px"><b>${esc(lead)}</b> — ${esc(text)}</li>`; }).join("");
    const links = (entry.links || []).map((l) => `<a href="${esc(l.url)}" style="color:#0071E3">${esc((l.label && l.label[lang]) || (l.label && l.label.en) || l.url)}</a>`).join(" · ");
    return `<h1 style="font-size:22px;line-height:1.25;margin:0 0 6px;letter-spacing:-.01em">${esc((entry.title && entry.title[lang]) || entry.title.en)}</h1>
<p style="margin:0 0 16px;font-size:15px;color:#6E6E73">${esc((entry.intro && entry.intro[lang]) || (entry.intro && entry.intro.en) || "")}</p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:15px">${items}</ul>${links ? `<p style="margin:0 0 6px;font-size:14px">${links}</p>` : ""}`;
  };
  const html = `<!doctype html><html><body style="margin:0;background:#F5F5F7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1D1D1F;line-height:1.5">
<div style="max-width:620px;margin:0 auto;padding:24px 16px">
<div style="background:#FFFFFF;border:1px solid #E5E5EA;border-radius:16px;padding:26px 24px">
<p style="margin:0 0 18px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6E6E73">Bar Lento · What's new · ${esc(niceDate(entry.date, "en"))}</p>
<p style="margin:0 0 14px;font-size:15px">${hi}</p>
${block("en")}
<p style="margin:22px 0 8px"><a href="${esc(NEWS.appUrl)}" style="display:inline-block;background:#0071E3;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:12px">Open the app</a></p>
<hr style="border:0;border-top:1px solid #E5E5EA;margin:26px 0 22px">
<p style="margin:0 0 14px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6E6E73">In italiano</p>
${block("it")}
<p style="margin:22px 0 0;font-size:12px;color:#6E6E73">This email is sent once, when something new arrives in the app. Questions: ask Marta or Simone.</p>
</div>
<p style="margin:16px 0 0;text-align:center;font-size:11px;color:#6E6E73">© 2026 Simone Viola · Bar Lento staff app · All rights reserved</p>
</div></body></html>`;
  const lines = (lang) => [(entry.title && entry.title[lang]) || entry.title.en, (entry.intro && entry.intro[lang]) || ""].concat((entry.items || []).map((it) => { const [l, t] = it[lang] || it.en; return `- ${l}: ${t}`; })).concat((entry.links || []).map((l) => `${(l.label && l.label[lang]) || l.url}: ${l.url}`));
  const text = [`${hi}`, ""].concat(lines("en")).concat(["", `Open the app: ${NEWS.appUrl}`, "", "— In italiano —", ""]).concat(lines("it")).join("\n");
  return { subject: `Bar Lento — ${(entry.title && entry.title.en) || "What's new"}`, html, text };
}

// Everyone on staff with an address: Toast email first (the owner's rule), else the email they signed with
async function recipients(doc) {
  let emps = [], map = {};
  if (toast.enabled()) { try { emps = await toast.employees(true); map = toast.autoMap(doc.data.staff, doc.data.toastMap, emps); } catch (e) {} }
  const out = [];
  for (const name of doc.data.staff || []) {
    if (auth.isTestName(name)) continue;
    const emp = map[name] && emps.find((e) => e.guid === map[name]);
    const ack = await accounts.getRulesAck(name).catch(() => null);
    out.push({ name, email: (emp && emp.email) || (ack && ack.email) || "" });
  }
  return out;
}

async function getState(id) { try { const raw = await redis("GET", key(id)); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
async function setState(id, st) { await redis("SET", key(id), JSON.stringify(st)); }

// Called on the polls: starts the newest unsent entry (push at once, emails in batches), continues an entry in progress.
async function flush(doc, opts) {
  opts = opts || {};
  if (process.env.WHATSNEW_OFF === "1") return { skipped: "off" }; // the shared test server
  if (!store.hasStorage()) return { skipped: "no_storage" };
  if (!opts.force && push.isQuietHours()) return { skipped: "quiet_hours" };
  for (const entry of pending()) {
    let st = await getState(entry.id);
    if (st && st.done) continue;
    const lock = await redis("SET", `barlento:whatsnew:lock:${entry.id}`, "1", "NX", "EX", 20).catch(() => null);
    if (!(lock === "OK" || lock === true)) return { skipped: "locked", id: entry.id };
    try {
      if (!st) { // first poll: the push to every phone, the list of people to email
        const people = await recipients(doc);
        const p = await push.broadcast({ title: "Bar Lento · What's new", body: (entry.push && entry.push.en) || entry.title.en, url: "/", tag: "whatsnew" }).catch(() => ({ sent: 0 }));
        st = { startedAt: new Date().toISOString(), push: p.sent || 0, todo: people, mailed: [], skipped: [], failed: [], done: false };
        await setState(entry.id, st);
      }
      const batch = st.todo.splice(0, BATCH);
      for (const r of batch) {
        if (!r.email) { st.skipped.push(`${r.name} (no email)`); continue; }
        if (!mail.enabled()) { st.skipped.push(`${r.name} (mail off)`); continue; }
        try { const m = render(entry, r.name.split(/\s+/)[0]); await mail.send({ to: r.email, subject: m.subject, html: m.html, text: m.text }); st.mailed.push(`${r.name} <${r.email}>`); }
        catch (e) { st.failed.push(`${r.name} <${r.email}>: ${(e && e.message) || "error"}`); }
      }
      if (!st.todo.length) { // last batch: the owner's summary + the history line
        st.done = true; st.doneAt = new Date().toISOString();
        const line = `What's new sent to the team: ${entry.title.en} · ${st.mailed.length} email${st.mailed.length === 1 ? "" : "s"}, ${st.push} push${st.push === 1 ? "" : "es"}` + (st.skipped.length ? ` · skipped: ${st.skipped.join(", ")}` : "") + (st.failed.length ? ` · failed: ${st.failed.join(", ")}` : "");
        await store.appendLog({ at: st.doneAt, changes: [line] }).catch(() => {});
        if (NEWS.copyTo && mail.enabled()) {
          const li = (a) => (a.length ? `<ul style="margin:0;padding-left:20px">${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p style=\"margin:0;color:#6E6E73\">—</p>");
          const html = `<!doctype html><html><body style="margin:0;background:#F5F5F7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1D1D1F;line-height:1.5"><div style="max-width:620px;margin:0 auto;padding:24px 16px"><div style="background:#FFFFFF;border:1px solid #E5E5EA;border-radius:16px;padding:26px 24px;font-size:14px">
<p style="margin:0 0 18px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6E6E73">Bar Lento · What's new · sent</p>
<h1 style="font-size:20px;margin:0 0 12px">${esc(entry.title.en)}</h1>
<p style="margin:0 0 12px">Push notifications: <b>${st.push}</b> phone${st.push === 1 ? "" : "s"}.</p>
<p style="margin:0 0 6px"><b>Emailed (${st.mailed.length})</b></p>${li(st.mailed)}
<p style="margin:14px 0 6px"><b>Skipped (${st.skipped.length})</b></p>${li(st.skipped)}
<p style="margin:14px 0 6px"><b>Failed (${st.failed.length})</b></p>${li(st.failed)}
<p style="margin:18px 0 0;font-size:12px;color:#6E6E73">The team received the email below this line in their inbox.</p></div>
<div style="margin-top:16px">${render(entry, "").html.replace(/^[\s\S]*?<body[^>]*>/, "").replace(/<\/body>[\s\S]*$/, "")}</div></div></body></html>`;
          await mail.send({ to: NEWS.copyTo, subject: `What's new sent to the team — ${entry.title.en}`, html, text: line }).catch((e) => { st.failed.push(`owner summary: ${(e && e.message) || "error"}`); });
        }
      }
      await setState(entry.id, st);
      return { id: entry.id, push: st.push, mailed: st.mailed.length, left: st.todo.length, done: st.done };
    } finally { await redis("DEL", `barlento:whatsnew:lock:${entry.id}`).catch(() => {}); }
  }
  return { skipped: "nothing" };
}

module.exports = { flush, render, recipients, pending, BATCH, MAX_AGE_DAYS };
