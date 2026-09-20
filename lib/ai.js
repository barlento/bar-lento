// In-app assistant (owner's request 2026-09-20): one signed-in person asks about the app, their own schedule and hours,
// the House Rules and policies, the menu, the venue. Claude API (Anthropic) from the server; the stable knowledge is one
// cached system block, the person's own data is a second block; only THAT person's data ever reaches the model.
// Read-only by design: the assistant never changes anything. Env: ANTHROPIC_API_KEY (AI_FAKE=1 = canned answers for the suites).
const store = require("./store");
const accounts = require("./accounts");
const punch = require("./punch");
const knowledge = require("./knowledge");
const DOCS = require("../documents.js");
const RULES = require("../rules.js");

const TZ = "America/New_York";
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const OPENS = ["myweek", "mystats", "docs", "clock", "staff", "ranking", "none"];
const MODEL = "claude-opus-5";
const DAILY_LIMIT = 80;

function enabled() { return Boolean(process.env.ANTHROPIC_API_KEY) || process.env.AI_FAKE === "1"; }
function todayNY() { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); }
function nowNY() { return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date()); }
function addDays(iso, n) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function mondayOf(iso) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
function h12(t) { const [h, m] = String(t || "").split(":").map(Number); if (isNaN(h)) return t; const s = h % 12 === 0 ? 12 : h % 12; return `${s}:${String(m || 0).padStart(2, "0")} ${h < 12 || h === 24 ? "AM" : "PM"}`; }

function weekLines(data, wk, name) {
  const w = (data.weeks || {})[wk]; if (!w) return [`Week of ${wk}: not published yet.`];
  const out = [`Week of ${wk} (Monday) to ${addDays(wk, 6)}:`];
  DAYS.forEach((d, i) => {
    const date = addDays(wk, i); const note = (w.notes || {})[d] || {}; const mine = (w[d] || []).filter((s) => s.name === name);
    const others = (w[d] || []).filter((s) => s.name !== name).map((s) => s.name);
    let line = `- ${DAY_NAMES[d]} ${date}`;
    if (note.status === "closed" || note.status === "holiday") line += ` — CLOSED${note.text ? " (" + note.text + ")" : ""}`;
    else { if (note.status === "half") line += ` — half day ${h12(note.open)}–${h12(note.close)}`; if (note.status === "event") line += " — private event"; if (note.text) line += ` — note: ${note.text}`; }
    line += mine.length ? " — YOUR shifts: " + mine.map((s) => `${h12(s.start)}–${h12(s.end)}${s.station ? " (" + s.station + ")" : ""}`).join(", ") : " — no shift for you";
    if (others.length) line += ` — also scheduled: ${[...new Set(others)].join(", ")}`;
    out.push(line);
  });
  return out;
}

async function personalContext(doc, name, role) {
  const data = doc.data; const today = todayNY(); const wk = mondayOf(today);
  const lines = [`# The person asking`, `Now in New York: ${nowNY()} (today is ${today}).`];
  if (!name) { lines.push(`A manager signed in with the shared password (no personal account). Role: manager. Answer about the manager tools; there is no personal schedule to show.`); return lines.join("\n"); }
  const dept = (data.dept || {})[name] || "floor";
  lines.push(`Name: ${name}. Department: ${dept}. Role in the app: ${role || "staff"} (${role === "owner" ? "owner: every manager tool plus View as and promotions" : role === "manager" ? "manager: full manager tools" : role === "chef" ? "chef: plans the kitchen, sees the floor read-only" : "staff: own schedule, hours, documents"}).`);
  const appClock = await punch.isAppClock(data, name).catch(() => false);
  lines.push(appClock ? `Clocks in from the app (Clock in / Clock out button in the strip); ${(await punch.openEntry(name).catch(() => null)) ? "currently CLOCKED IN" : "not clocked in right now"}.` : `Clocks in and out on the Toast POS terminal (no clock button in the app).`);
  lines.push(`Birthday in the app: ${(data.birthdays || {})[name] ? "set (" + data.birthdays[name] + ")" : "not set (My week → My birthday)"}.`);
  if (dept !== "owner") {
    const ack = await accounts.getRulesAck(name).catch(() => null);
    const acks = await accounts.docAcksFor(name, DOCS.list.map((d) => d.id)).catch(() => ({}));
    lines.push(`House Rules ${RULES.version}: ${ack && ack.version === RULES.version ? "signed on " + String(ack.at).slice(0, 10) : "NOT signed yet"}.`);
    lines.push("Policies: " + DOCS.list.map((d) => `${d.title}: ${acks[d.id] && acks[d.id].version === d.version ? "signed " + String(acks[d.id].at).slice(0, 10) : "not signed"}`).join("; ") + ".");
  } else lines.push("The owner does not sign the documents.");
  lines.push(""); lines.push("# Their schedule (only their own shifts are theirs; other names are just who else works that day)");
  lines.push(...weekLines(data, addDays(wk, -7), name), ...weekLines(data, wk, name), ...weekLines(data, addDays(wk, 7), name));
  const keys = Object.keys(data.weeks || {}).filter((k) => k > addDays(wk, 7)).sort(); if (keys.length) lines.push(`Later weeks published: ${keys.join(", ")}.`);
  return lines.join("\n");
}

function sanitize(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const out = list.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()).slice(-12).map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1200) }));
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}
function parseAnswer(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try { const j = JSON.parse(raw); if (j && typeof j.answer === "string") return { answer: j.answer.trim(), open: OPENS.includes(j.open) ? j.open : "none" }; } catch (e) {}
  const m = raw.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/); if (m) { try { return { answer: JSON.parse('"' + m[1] + '"'), open: "none" }; } catch (e) {} }
  return { answer: raw.replace(/^\{|\}$/g, "").trim(), open: "none" };
}

async function limit(name) {
  if (!store.hasStorage()) return true;
  const key = `barlento:ai:count:${name || "manager"}:${todayNY()}`;
  const n = await store._redis("INCR", key).catch(() => 0); if (n === 1) await store._redis("EXPIRE", key, 60 * 60 * 30).catch(() => {});
  return n <= DAILY_LIMIT;
}
async function log(entry) { if (!store.hasStorage()) return; await store._redis("LPUSH", "barlento:ai:log", JSON.stringify(entry)).catch(() => {}); await store._redis("LTRIM", "barlento:ai:log", 0, 499).catch(() => {}); }

async function ask({ doc, name, role, messages }) {
  const msgs = sanitize(messages); if (!msgs.length) return { status: 400, body: { error: "empty" } };
  if (!(await limit(name))) return { status: 429, body: { error: "too_many" } };
  const question = msgs[msgs.length - 1].content;
  let out;
  if (process.env.AI_FAKE === "1" && !process.env.ANTHROPIC_API_KEY) {
    const q = question.toLowerCase();
    out = { answer: `(test) You asked: ${question}`, open: /week|turn|shift/.test(q) ? "myweek" : /clock|timbr/.test(q) ? "clock" : "none" };
  } else {
    const Anthropic = require("@anthropic-ai/sdk"); const client = new Anthropic();
    const personal = await personalContext(doc, name, role);
    // Server-side fallback: if the model declines for a safety category, the same request is re-run on a fallback model automatically.
    const res = await client.beta.messages.create({
      model: MODEL, max_tokens: 900, output_config: { effort: "low" }, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      system: [{ type: "text", text: knowledge.staticKnowledge(), cache_control: { type: "ephemeral", ttl: "1h" } }, { type: "text", text: personal }],
      messages: msgs,
    });
    if (res.stop_reason === "refusal") return { status: 200, body: { answer: "I can't help with that one. Ask the manager or the owner.", open: "none" } };
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    out = parseAnswer(text);
    if (!["owner", "manager", "chef"].includes(role) && (out.open === "staff" || out.open === "ranking")) out.open = "none";
  }
  await log({ at: new Date().toISOString(), dept: name ? ((doc.data.dept || {})[name] || "floor") : "manager", q: question.slice(0, 140), open: out.open });
  return { status: 200, body: out };
}

module.exports = { enabled, ask, personalContext, parseAnswer, sanitize };
