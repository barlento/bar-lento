// Builds welcome.pdf — the team's welcome guide to the Bar Lento app, with real screenshots (tools/out/guide/*.png
// from guide-shots.js). Run: node tools/guide.js  → writes ../welcome.pdf (served at /welcome.pdf).
const PDFDocument = require("pdfkit");
require("pdfkit/standard-fonts/Helvetica"); require("pdfkit/standard-fonts/HelveticaBold");
const fs = require("fs"); const path = require("path");

const INK = "#1D1D1F", MUTED = "#6E6E73", LINE = "#E5E5EA", ACCENT = "#0071E3", SOFT = "#F5F5F7", DARK = "#141311";
const SHOTS = path.join(__dirname, "out", "guide");
const OUT = path.join(__dirname, "..", "welcome.pdf");
const M = 44; // margin

const doc = new PDFDocument({ size: "LETTER", margin: M, bufferPages: true, info: { Title: "Welcome to the Bar Lento app", Author: "Simone Viola", Creator: "Bar Lento staff app" } });
const W = doc.page.width - 2 * M, H = doc.page.height;
let y = M;
const out = fs.createWriteStream(OUT); doc.pipe(out);

function ensure(h) { if (y + h > H - M - 30) { doc.addPage(); y = M; } }
function heading(txt) { ensure(60); y += 8; doc.font("Helvetica-Bold").fontSize(17).fillColor(INK).text(txt, M, y, { width: W }); y += 24; doc.moveTo(M, y).lineTo(M + W, y).lineWidth(1).strokeColor(ACCENT).stroke(); y += 12; }
function para(txt, opts) { opts = opts || {}; doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size || 10.5).fillColor(opts.color || INK); const h = doc.heightOfString(txt, { width: opts.width || W, lineGap: 3 }); ensure(h); doc.text(txt, opts.x || M, y, { width: opts.width || W, lineGap: 3 }); y += h + (opts.after == null ? 8 : opts.after); }
function bullets(items) { items.forEach((t) => { doc.font("Helvetica").fontSize(10.5).fillColor(INK); const h = doc.heightOfString(t, { width: W - 16, lineGap: 3 }); ensure(h); doc.circle(M + 4, y + 6, 1.8).fillColor(ACCENT).fill(); doc.fillColor(INK).text(t, M + 16, y, { width: W - 16, lineGap: 3 }); y += h + 5; }); y += 4; }
function callout(title, txt) { doc.font("Helvetica").fontSize(10); const h = doc.heightOfString(txt, { width: W - 32, lineGap: 3 }) + 34; ensure(h + 6); doc.roundedRect(M, y, W, h, 10).fillColor(SOFT).fill(); doc.font("Helvetica-Bold").fontSize(9).fillColor(ACCENT).text(title.toUpperCase(), M + 16, y + 10, { characterSpacing: 0.8 }); doc.font("Helvetica").fontSize(10).fillColor(INK).text(txt, M + 16, y + 24, { width: W - 32, lineGap: 3 }); y += h + 12; }
// phone screenshots in a row, each with a caption; images are 780x1688 (iPhone 13 @2x) or a strip
function shots(list) {
  const gap = 14; const n = list.length; const w = (W - gap * (n - 1)) / n;
  let maxH = 0; const dims = list.map((s) => { const ratio = s.ratio || 1688 / 780; const h = Math.min(w * ratio, 300); maxH = Math.max(maxH, h); return { w: h / ratio, h }; });
  ensure(maxH + 40);
  list.forEach((s, i) => {
    const x = M + i * (w + gap) + (w - dims[i].w) / 2; const file = path.join(SHOTS, s.file);
    doc.save(); doc.roundedRect(x, y, dims[i].w, dims[i].h, 14).clip(); doc.image(file, x, y, { width: dims[i].w, height: dims[i].h }); doc.restore();
    doc.roundedRect(x, y, dims[i].w, dims[i].h, 14).lineWidth(1).strokeColor(LINE).stroke();
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(s.caption, M + i * (w + gap), y + maxH + 6, { width: w, align: "center" });
  });
  y += maxH + 30;
}

// ---------- cover ----------
doc.rect(0, 0, doc.page.width, 300).fillColor(DARK).fill();
doc.font("Helvetica-Bold").fontSize(11).fillColor("#8FB8F0").text("BAR LENTO · 158 8TH AVENUE, NEW YORK", M, 70, { characterSpacing: 1.2 });
doc.font("Helvetica-Bold").fontSize(34).fillColor("#FFFFFF").text("Welcome to the\nBar Lento app", M, 100, { width: W, lineGap: 2 });
doc.rect(M, 208, 60, 3).fillColor(ACCENT).fill();
doc.font("Helvetica").fontSize(12.5).fillColor("#D8D8DC").text("Your shifts, your hours, your documents — in one place, on your phone.", M, 226, { width: W });
y = 330;
para("This app was designed and built entirely by Simone Viola, owner of Bar Lento, for the team: to make work easier, to keep everything in one place and to make sure nothing gets lost — for the team and for each of you personally.", { size: 12, after: 12 });
para("Here you find the weekly schedule, who is working today, whether the bar is open, closed or hosting a private event, your clock-ins and hours, your weekly report, and every document you sign — all tracked, all yours to check whenever you want.", { size: 11.5, after: 14 });
callout("Important: what this app is not", "It does not replace Toast. Clock-ins and clock-outs are still done on the Toast terminal with your own account, and pay is handled through payroll as always. The app only shows you what has been recorded, so that you and Bar Lento always look at the same numbers.");
callout("One channel for everything", "Schedules, changes, closures, events, reports, documents: everything arrives here (and by email), not in scattered chats. WhatsApp is for talking; the app is where things stay on record.");
para("bar-lento.vercel.app", { bold: true, size: 13, color: ACCENT, after: 2 });
para("Open the link on your phone and add it to your Home Screen (Safari: Share, then Add to Home Screen; Chrome: menu, then Add to Home screen). It works like an app.", { size: 10.5, color: MUTED });

// ---------- 1. getting started ----------
doc.addPage(); y = M;
heading("1. Your first time: three taps");
bullets([
  "Tap your name. You are already there: the list comes from Toast.",
  "Choose a 4-digit PIN. Only you know it. You will need it on a new phone or computer; the one you use is remembered.",
  "Read the House Rules and the documents New York law asks every employer to give you. Your email is already filled in (the same one you use in Toast): tick the box, tap Sign, done. Your signed copies arrive by email.",
]);
shots([{ file: "01-who.png", caption: "Tap your name" }, { file: "02-pin.png", caption: "Choose your PIN" }, { file: "03-rules.png", caption: "Read, tick, sign" }, { file: "04-packet.png", caption: "One signature for all documents" }]);
callout("Use your Toast email, always", "The email in the app is the one Bar Lento has in Toast. Please keep it the same everywhere. If you ever change it in Toast, the app follows automatically; still, tell Simone so nothing gets lost.");

// ---------- 2. every week ----------
heading("2. Every week");
bullets([
  "Home shows today at a glance: open or closed, the hours, who is working. When the bar is closed for a holiday or a private event is on, it says so.",
  "The week below lists every shift. Your shifts are marked YOU. Tap yours and confirm: it tells the manager you have seen it.",
  "A new week is published on the app; you get one notification. Changes that affect you arrive as one summary, never spam, never at night.",
  "Time clock shows who is on the clock right now and past days, straight from Toast.",
]);
shots([{ file: "05-home.png", caption: "Home: today and the week" }, { file: "07-timeclock.png", caption: "Time clock, live from Toast" }]);

// ---------- 3. your hours ----------
heading("3. Your hours and your report");
bullets([
  "My week shows your scheduled shifts next to your real clock-ins from Toast, day by day, with the hours worked.",
  "Week report downloads a PDF of your week: every clock-in and clock-out with the exact times, hours per day, weekly total. Times and hours only — nothing about pay.",
  "Every Sunday night the same report arrives by email, automatically. The owners see exactly the same numbers: if something does not match, say so right away.",
  "My stats shows your own numbers only. Nobody sees anybody else’s.",
]);
shots([{ file: "06-myweek.png", caption: "My week: shifts, clock-ins, hours" }, { file: "08-documents.png", caption: "Documents: everything you signed" }]);
heading("4. The documents you sign, explained");
para("New York State and New York City require every employer to give employees a set of written policies and to keep proof that each person received them. Bar Lento does this in the app: you read, tick and sign once; your signed copy arrives by email and the record is kept. Nothing to print, nothing to bring back.", { after: 8 });
bullets([
  "House Rules \u2014 how we work together at Bar Lento: schedule and confirmations, being on time, uniform, breaks, guests, safety, phones, tips, time off, who to talk to. Written for Bar Lento and checked against New York law.",
  "Sexual Harassment Prevention Policy \u2014 the official New York State model policy, adopted in full, with a complaint form. Required by NY Labor Law \u00a7201-g for every employer.",
  "Sexual Harassment Prevention Training \u2014 once a year, the free 30-minute video from New York State (in English, or English with Italian subtitles). Watch it, tick, sign. No test, nothing to hand in. Required every year by the same law.",
  "Protected Time Off (Safe and Sick Leave) Policy \u2014 how paid sick and safe time is earned and used under the New York City Earned Safe and Sick Time Act and New York State Paid Sick Leave Law, with the official NYC Notice of Employee Rights in English and Italian.",
  "Tips Policy \u2014 how tips work at Bar Lento (no tip pool; card tips through payroll; cash tips declared in Toast), under NY Labor Law \u00a7196-d.",
  "Lactation Policy \u2014 the New York State Department of Labor model policy on the right to express breast milk at work (NY Labor Law \u00a7206-c).",
]);
callout("What signing means", "Signing confirms that you received and read the document. It does not take away any right the law gives you: where a policy and the law differ, the law wins. Every version you sign is kept with the date, your email and a fingerprint of the exact text, so nobody can change it afterwards. You can reread or print any document at any time from My week, then Documents.");
heading("5. Your privacy");
bullets([
  "What is stored: your name, your PIN (only as a cryptographic hash, never the PIN itself), the phones you signed in from, the email you sign with, your shifts and confirmations, your clock-ins mirrored from Toast, your signed documents, your birthday if the manager entered it.",
  "Why: to organize shifts, verify hours and comply with New York labor law. Nothing else. No advertising, no tracking, no sale of data.",
  "Who sees it: you see your own data; the time clock is visible to signed-in colleagues because it is operational; the manager and the owners see what they need to run the business. Nobody else.",
  "Everything is written in plain words at bar-lento.vercel.app/legal.html. You can ask the owners for a copy of your records at any time.",
]);

// ---------- 6. good to know ----------
heading("6. Good to know");
bullets([
  "Records that the law requires (schedules, hours, signed policies) are kept as long as the law requires, also after someone leaves.",
  "Questions about the app, your hours or a document: ask the manager or an owner.",
]);
y += 6;
para("Bar Lento · 158 8th Avenue, New York, NY · simoneviola@barlentony.com", { size: 10, color: MUTED, after: 2 });
para("© 2026 Simone Viola · Bar Lento staff app · All rights reserved", { size: 9, color: MUTED });

// footers
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i); if (i === 0) continue;
  doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text("Welcome to the Bar Lento app", M, H - M - 12, { width: W - 60, lineBreak: false }).text(`${i + 1} / ${range.count}`, M + W - 60, H - M - 12, { width: 60, align: "right", lineBreak: false });
}
doc.end();
out.on("finish", () => console.log("welcome.pdf written:", fs.statSync(OUT).size, "bytes"));
