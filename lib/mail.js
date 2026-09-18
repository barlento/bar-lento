// Outgoing email (used for the signed copy of the House Rules).
// Configure ONE of these on Vercel:
//   A) Google Workspace / any SMTP:  SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_USER=simoneviola@barlentony.com  SMTP_PASS=<app password>
//   B) Resend (https://resend.com):  RESEND_API_KEY=re_...   (domain barlentony.com must be verified in Resend)
// Optional: MAIL_FROM="Bar Lento <simoneviola@barlentony.com>" (defaults to SMTP_USER).
// Local tests: MAIL_WEBHOOK_URL=http://127.0.0.1:4173/__mail posts the message as JSON instead of sending it.
const RULES = require("../rules.js");

const SMTP = { host: process.env.SMTP_HOST || "", port: Number(process.env.SMTP_PORT || 465), user: process.env.SMTP_USER || "", pass: process.env.SMTP_PASS || "" };
const RESEND_KEY = process.env.RESEND_API_KEY || "";
const WEBHOOK = process.env.MAIL_WEBHOOK_URL || "";
const FROM = process.env.MAIL_FROM || (SMTP.user ? `Bar Lento <${SMTP.user}>` : "Bar Lento <info@barlentony.com>");

function enabled() { return Boolean(WEBHOOK || RESEND_KEY || (SMTP.host && SMTP.user && SMTP.pass)); }

async function send({ to, cc, subject, html, text }) {
  if (!enabled()) throw new Error("mail_not_configured");
  const msg = { from: FROM, to: [].concat(to), cc: cc ? [].concat(cc) : [], subject, html, text };
  if (WEBHOOK) {
    const r = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg) });
    if (!r.ok) throw new Error(`mail webhook ${r.status}`);
    return { provider: "webhook" };
  }
  if (RESEND_KEY) {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(msg) });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return { provider: "resend" };
  }
  const nodemailer = require("nodemailer");
  const transport = nodemailer.createTransport({ host: SMTP.host, port: SMTP.port, secure: SMTP.port === 465, auth: { user: SMTP.user, pass: SMTP.pass } });
  await transport.sendMail(msg);
  return { provider: "smtp" };
}

function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function nyDate(iso) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" }).format(new Date(iso)) + " (New York)";
}

function renderLi(x) { return typeof x === "string" ? `<li style="margin:4px 0">${esc(x)}</li>` : `<li style="margin:4px 0">${esc(x.t)}${x.sub && x.sub.length ? `<ul style="margin:2px 0 0;padding-left:18px">${x.sub.map(renderLi).join("")}</ul>` : ""}</li>`; }
function renderSectionsHtml(sections) {
  return sections.map((s) => {
    let body = "";
    if (s.items) body = `<ul style="margin:0;padding-left:20px">${s.items.map(renderLi).join("")}</ul>`;
    else (s.blocks || []).forEach((b) => { body += typeof b === "string" ? `<p style="margin:6px 0;font-size:14px">${esc(b)}</p>` : `<ul style="margin:0;padding-left:20px">${b.map(renderLi).join("")}</ul>`; });
    return `<h3 style="font-size:15px;margin:18px 0 4px;color:#3E2208">${esc(s.h)}</h3>${body}`;
  }).join("");
}
function liText(x, depth) { const pad = "  ".repeat(depth); return typeof x === "string" ? [`${pad}- ${x}`] : [`${pad}- ${x.t}`].concat((x.sub || []).flatMap((y) => liText(y, depth + 1))); }
function renderSectionsText(sections) {
  return sections.flatMap((s) => [s.h].concat(s.items ? s.items.flatMap((i) => liText(i, 0)) : (s.blocks || []).flatMap((b) => typeof b === "string" ? [b] : b.flatMap((i) => liText(i, 0)))).concat([""]));
}

// The signed copy of any document (House Rules or a policy from documents.js): full text + electronic signature block.
// `doc` = {title, subtitle, intro, sections, contacts, ack, links?, kind?}; `ack` = {version, email, at, ua, hash, fullName, name}
// `forOwner` = the copy that goes to the owner (copyTo): same signed text, but addressed to the owner as proof
// ("X acknowledged…") instead of "here is your copy".
function docCopy(doc, ack, forOwner) {
  const R = doc;
  const signer = ack.fullName || ack.name;
  const training = doc.kind === "training";
  const verb = training ? "completed" : "acknowledged";
  const what = training ? `the ${R.title} (${ack.version})` : `${R.title}, version ${ack.version}`;
  const sig = [
    [training ? "Completed by" : "Electronically acknowledged by", `${signer}${ack.fullName && ack.fullName !== ack.name ? ` (schedule name: ${ack.name})` : ""}`],
    ["Email", ack.email],
    ["Date and time", nyDate(ack.at)],
    ["Document", `${R.title} — version ${ack.version}`],
    ["Text fingerprint (SHA-256)", ack.hash ? ack.hash.slice(0, 16) + "…" : "—"],
    ["Device", ack.ua || "—"],
  ];
  const lead = forOwner
    ? `<b>${esc(signer)}</b>${ack.fullName && ack.fullName !== ack.name ? ` (schedule name: ${esc(ack.name)})` : ""} ${verb} ${esc(what)} on ${esc(nyDate(ack.at))}. Their signed copy was sent to <a href="mailto:${esc(ack.email)}">${esc(ack.email)}</a>. Below is the exact text they ${verb}, with the electronic signature block. Keep this email: it is Bar Lento's record.`
    : (training ? `Hi ${esc(signer.split(/\s+/)[0])}, this confirms that you completed the ${esc(R.title)} for ${esc(ack.version)}. Keep this email: it is your training record.`
                : `Hi ${esc(signer.split(/\s+/)[0])}, here is your copy of the ${esc(R.title)} you acknowledged. Keep this email: it is your signed copy.`);
  const contacts = (R.contacts || []).map((c) => `${esc(c.name)} · <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`).join("<br>");
  const links = (R.links || []).length ? `<div style="margin-top:14px;font-size:13px"><b>Links</b><br>${R.links.map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join("<br>")}</div>` : "";
  const printUrl = R.printUrl || "https://bar-lento.vercel.app/rules.html";
  const html = `<!doctype html><html><body style="margin:0;background:#F3EDE1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1F150C;line-height:1.5">
<div style="max-width:680px;margin:0 auto;padding:24px 16px">
<div style="background:#FFFCF6;border:1px solid #D6C6A6;border-radius:14px;padding:24px">
<p style="margin:0 0 14px;font-size:15px">${lead}</p>
<h1 style="font-size:22px;margin:0 0 4px">${esc(R.title)}</h1>
<p style="margin:0 0 12px;color:#5A4A39;font-size:14px">${esc(R.subtitle || "")} · Version ${esc(ack.version)}</p>
<p style="font-size:14px">${esc(R.intro || "")}</p>
${renderSectionsHtml(R.sections || [])}
${links}
${contacts ? `<div style="margin-top:18px;padding:12px 14px;border-radius:10px;background:#ECE3D2;font-size:14px"><b>Contacts</b><br>${contacts}</div>` : ""}
<div style="margin-top:18px;padding:14px 16px;border-left:4px solid #C9701E;background:#FFF7EA;font-size:14px"><p style="margin:0 0 10px;font-style:italic">${esc(R.ack)}</p>
<table style="font-size:13px;border-collapse:collapse">${sig.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#5A4A39;white-space:nowrap">${esc(k)}</td><td style="padding:2px 0"><b>${esc(v)}</b></td></tr>`).join("")}</table>
<p style="margin:10px 0 0;font-size:12px;color:#5A4A39">This ${training ? "confirmation" : "acknowledgment"} was given electronically in the Bar Lento schedule app after signing in with a personal PIN, and is recorded by Bar Lento with the date, time and device shown above.</p></div>
<p style="margin:16px 0 0;font-size:12px;color:#5A4A39">You can read or print this document at any time: <a href="${esc(printUrl)}">${esc(printUrl.replace(/^https?:\/\//, ""))}</a></p>
</div></div></body></html>`;
  const text = [forOwner ? `${signer} ${verb} ${what} on ${nyDate(ack.at)}. Signed copy sent to ${ack.email}.` : (training ? `Your training record — ${R.title} (${ack.version}).` : `Your signed copy of the ${R.title}.`), "", `${R.title} — version ${ack.version}`, R.subtitle || "", "", R.intro || "", ""]
    .concat(renderSectionsText(R.sections || []))
    .concat((R.links || []).map((l) => `${l.label}: ${l.url}`))
    .concat(contacts ? ["", "Contacts: " + R.contacts.map((c) => `${c.name} <${c.email}>`).join("; ")] : [])
    .concat(["", R.ack, ""])
    .concat(sig.map(([k, v]) => `${k}: ${v}`)).join("\n");
  const subject = forOwner
    ? `✓ ${signer} ${verb} ${training ? `the ${R.title} (${ack.version})` : `the ${R.title} (version ${ack.version})`}`
    : (training ? `Bar Lento — ${R.title} (${ack.version}) — your training record` : `Bar Lento — ${R.title} (version ${ack.version}) — your signed copy`);
  return { subject, html, text };
}
// The House Rules keep their historical wording ("House Rules" instead of the full title).
function rulesCopy(ack, forOwner) {
  return docCopy(Object.assign({}, RULES, { title: RULES.title.replace(/^Bar Lento — /, ""), printUrl: "https://bar-lento.vercel.app/rules.html" }), ack, forOwner);
}

module.exports = { enabled, send, rulesCopy, docCopy };
