// WhatsApp alerts to the owner and the manager (owner 2026-09-30: "avvisa me e Marta su WhatsApp"), through Meta's WhatsApp
// Business Cloud API. Business-initiated messages MUST use an approved template, so the message is one template with a single
// body parameter ({{1}} = the text). Off unless every env variable is set on Vercel:
//   WHATSAPP_TOKEN      permanent system-user token of the Meta app
//   WHATSAPP_PHONE_ID   the "Phone number ID" of the sending number (Meta → WhatsApp → API setup)
//   WHATSAPP_TO         recipients, comma-separated, international format without "+" (e.g. 1917…,39333…)
//   WHATSAPP_TEMPLATE   template name (default bar_lento_alert), one body parameter, language WHATSAPP_LANG (default en)
// Never throws: {sent, skipped|failed}. Nothing is logged but counts.
const TOKEN = process.env.WHATSAPP_TOKEN || "", PHONE_ID = process.env.WHATSAPP_PHONE_ID || "";
const TO = String(process.env.WHATSAPP_TO || "").split(/[,\s]+/).map((s) => s.replace(/[^\d]/g, "")).filter(Boolean);
const TEMPLATE = process.env.WHATSAPP_TEMPLATE || "bar_lento_alert", LANG = process.env.WHATSAPP_LANG || "en";
function enabled() { return Boolean(TOKEN && PHONE_ID && TO.length); }
async function send(text) {
  if (!enabled()) return { sent: 0, skipped: "not configured" };
  const body = String(text || "").replace(/\s+/g, " ").trim().slice(0, 1000); // template parameters allow no newlines
  let sent = 0, failed = 0;
  for (const to of TO) {
    try {
      const r = await fetch(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: TEMPLATE, language: { code: LANG }, components: [{ type: "body", parameters: [{ type: "text", text: body }] }] } }) });
      if (r.ok) sent++; else { failed++; console.warn("whatsapp", r.status, (await r.text().catch(() => "")).slice(0, 160)); }
    } catch (e) { failed++; console.warn("whatsapp", e && e.message); }
  }
  return { sent, failed };
}
module.exports = { enabled, send };
