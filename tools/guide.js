// Builds welcome.pdf — the team's welcome guide, English part first, then the same guide in Italian, with real
// screenshots (tools/out/guide/*.png from guide-shots.js + guide-shots2.js) and simple vector drawings for the
// install steps. Run: node tools/guide.js  → writes ../welcome.pdf (served at /welcome.pdf).
const PDFDocument = require("pdfkit");
require("pdfkit/standard-fonts/Helvetica"); require("pdfkit/standard-fonts/HelveticaBold");
const fs = require("fs"); const path = require("path");

const INK = "#1D1D1F", MUTED = "#6E6E73", LINE = "#E5E5EA", ACCENT = "#0071E3", SOFT = "#F5F5F7", DARK = "#141311", GOOD = "#248A3D";
const SHOTS = path.join(__dirname, "out", "guide");
const OUT = path.join(__dirname, "..", "welcome.pdf");
const M = 44;

const doc = new PDFDocument({ size: "LETTER", margin: M, bufferPages: true, info: { Title: "Welcome to the Bar Lento app · Benvenuti nell'app di Bar Lento", Author: "Simone Viola", Creator: "Bar Lento staff app" } });
const W = doc.page.width - 2 * M, H = doc.page.height;
let y = M;
const out = fs.createWriteStream(OUT); doc.pipe(out);

// ---------- layout helpers ----------
function ensure(h) { if (y + h > H - M - 30) { doc.addPage(); y = M; } }
function heading(txt) { ensure(70); y += 8; doc.font("Helvetica-Bold").fontSize(17).fillColor(INK).text(txt, M, y, { width: W }); y += 24; doc.moveTo(M, y).lineTo(M + W, y).lineWidth(1).strokeColor(ACCENT).stroke(); y += 12; }
function para(txt, opts) { opts = opts || {}; doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size || 10.5).fillColor(opts.color || INK); const h = doc.heightOfString(txt, { width: opts.width || W, lineGap: 3 }); ensure(h); doc.text(txt, opts.x || M, y, { width: opts.width || W, lineGap: 3 }); y += h + (opts.after == null ? 8 : opts.after); }
function bullets(items) { items.forEach((t) => { doc.font("Helvetica").fontSize(10.5).fillColor(INK); const h = doc.heightOfString(t, { width: W - 16, lineGap: 3 }); ensure(h); doc.circle(M + 4, y + 6, 1.8).fillColor(ACCENT).fill(); doc.fillColor(INK).text(t, M + 16, y, { width: W - 16, lineGap: 3 }); y += h + 5; }); y += 4; }
function steps(items) { // numbered steps with big blue numbers
  items.forEach((t, i) => { doc.font("Helvetica").fontSize(11).fillColor(INK); const h = Math.max(22, doc.heightOfString(t, { width: W - 34, lineGap: 3 })); ensure(h + 6); doc.circle(M + 10, y + 8, 10).fillColor(ACCENT).fill(); doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF").text(String(i + 1), M + 2, y + 3, { width: 16, align: "center" }); doc.font("Helvetica").fontSize(11).fillColor(INK).text(t, M + 34, y + 1, { width: W - 34, lineGap: 3 }); y += h + 8; }); y += 4;
}
function callout(title, txt) { doc.font("Helvetica").fontSize(10); const h = doc.heightOfString(txt, { width: W - 32, lineGap: 3 }) + 34; ensure(h + 6); doc.roundedRect(M, y, W, h, 10).fillColor(SOFT).fill(); doc.font("Helvetica-Bold").fontSize(9).fillColor(ACCENT).text(title.toUpperCase(), M + 16, y + 10, { characterSpacing: 0.8 }); doc.font("Helvetica").fontSize(10).fillColor(INK).text(txt, M + 16, y + 24, { width: W - 32, lineGap: 3 }); y += h + 12; }
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

// ---------- stylized drawings (vector, one accent color) ----------
function phone(x, y0, w, h, screenFn) {
  doc.roundedRect(x, y0, w, h, 12).lineWidth(1.6).strokeColor(INK).stroke();
  doc.roundedRect(x + 5, y0 + 10, w - 10, h - 20, 6).fillColor("#FFFFFF").fill();
  doc.roundedRect(x + 5, y0 + 10, w - 10, h - 20, 6).lineWidth(0.8).strokeColor(LINE).stroke();
  doc.roundedRect(x + w / 2 - 12, y0 + 3, 24, 4, 2).fillColor(INK).fill();
  if (screenFn) screenFn(x + 5, y0 + 10, w - 10, h - 20);
}
function shareIcon(cx, cy, s, color) { // iOS Share: a box with an arrow going up
  doc.lineWidth(1.6).strokeColor(color || ACCENT);
  doc.moveTo(cx - s * 0.4, cy - s * 0.05).lineTo(cx - s * 0.4, cy + s * 0.5).lineTo(cx + s * 0.4, cy + s * 0.5).lineTo(cx + s * 0.4, cy - s * 0.05).stroke();
  doc.moveTo(cx, cy + s * 0.2).lineTo(cx, cy - s * 0.5).stroke();
  doc.moveTo(cx - s * 0.2, cy - s * 0.3).lineTo(cx, cy - s * 0.5).lineTo(cx + s * 0.2, cy - s * 0.3).stroke();
}
function plusSquare(cx, cy, s, color) { doc.roundedRect(cx - s / 2, cy - s / 2, s, s, 3).lineWidth(1.6).strokeColor(color || ACCENT).stroke(); doc.moveTo(cx - s * 0.28, cy).lineTo(cx + s * 0.28, cy).stroke(); doc.moveTo(cx, cy - s * 0.28).lineTo(cx, cy + s * 0.28).stroke(); }
function dotsIcon(cx, cy, s, color) { [-1, 0, 1].forEach((k) => doc.circle(cx, cy + k * s * 0.35, s * 0.09).fillColor(color || ACCENT).fill()); }
function bellIcon(cx, cy, s, color) { doc.lineWidth(1.6).strokeColor(color || ACCENT); doc.moveTo(cx - s * 0.35, cy + s * 0.2).lineTo(cx - s * 0.3, cy - s * 0.15).bezierCurveTo(cx - s * 0.3, cy - s * 0.45, cx + s * 0.3, cy - s * 0.45, cx + s * 0.3, cy - s * 0.15).lineTo(cx + s * 0.35, cy + s * 0.2).lineTo(cx - s * 0.35, cy + s * 0.2).stroke(); doc.moveTo(cx - s * 0.1, cy + s * 0.32).lineTo(cx + s * 0.1, cy + s * 0.32).stroke(); }
function appIcon(cx, cy, s) { doc.roundedRect(cx - s / 2, cy - s / 2, s, s, s * 0.22).fillColor(DARK).fill(); doc.font("Helvetica-Bold").fontSize(s * 0.3).fillColor("#FFFFFF").text("BL", cx - s / 2, cy - s * 0.18, { width: s, align: "center" }); }
function checkIcon(cx, cy, s) { doc.lineWidth(2).strokeColor(GOOD); doc.moveTo(cx - s * 0.35, cy).lineTo(cx - s * 0.1, cy + s * 0.28).lineTo(cx + s * 0.38, cy - s * 0.3).stroke(); }
function menuSheet(cx, cy, rows, active) {
  const w = 128;
  doc.roundedRect(cx - w / 2, cy - 32, w, 64, 8).fillColor("#FFFFFF").fill(); doc.roundedRect(cx - w / 2, cy - 32, w, 64, 8).lineWidth(1).strokeColor(LINE).stroke();
  doc.font("Helvetica").fontSize(7).fillColor(MUTED); rows.forEach((r, i) => doc.text(r, cx - w / 2 + 8, cy - 24 + i * 13, { lineBreak: false }));
  doc.rect(cx - w / 2, cy + 6, w, 20).fillColor("#EAF2FD").fill(); doc.font("Helvetica-Bold").fontSize(6.5).fillColor(ACCENT).text(active, cx - w / 2 + 8, cy + 12, { lineBreak: false }); plusSquare(cx + w / 2 - 12, cy + 16, 10);
}
function cards(items) { // row of illustrated cards: {draw(cx,cy), text}
  const gap = 12; const n = items.length; const w = (W - gap * (n - 1)) / n; const hImg = 100;
  doc.font("Helvetica").fontSize(9.5);
  const hTxt = Math.max(...items.map((it) => doc.heightOfString(it.text, { width: w - 20, lineGap: 2 })));
  const h = hImg + hTxt + 26; ensure(h + 10);
  items.forEach((it, i) => {
    const x = M + i * (w + gap);
    doc.roundedRect(x, y, w, h, 12).fillColor(SOFT).fill();
    it.draw(x + w / 2, y + 14 + hImg / 2);
    doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(it.text, x + 10, y + hImg + 18, { width: w - 20, lineGap: 2, align: "center" });
  });
  y += h + 14;
}
const drawIphoneShare = (cx, cy) => phone(cx - 28, cy - 48, 56, 96, (sx, sy, sw, sh) => { doc.font("Helvetica").fontSize(5).fillColor(MUTED).text("bar-lento.vercel.app", sx, sy + 4, { width: sw, align: "center" }); doc.rect(sx, sy + sh - 16, sw, 16).fillColor(SOFT).fill(); shareIcon(sx + sw / 2, sy + sh - 8, 12); doc.circle(sx + sw / 2, sy + sh - 8, 11).lineWidth(1).strokeColor(ACCENT).stroke(); });
const drawAndroidMenu = (cx, cy) => phone(cx - 28, cy - 48, 56, 96, (sx, sy, sw, sh) => { doc.rect(sx, sy, sw, 14).fillColor(SOFT).fill(); doc.font("Helvetica").fontSize(4.5).fillColor(MUTED).text("bar-lento.vercel.app", sx, sy + 18, { width: sw, align: "center", lineBreak: false }); dotsIcon(sx + sw - 7, sy + 7, 10); doc.circle(sx + sw - 7, sy + 7, 6).lineWidth(1).strokeColor(ACCENT).stroke(); });
const drawHomeIcon = (cx, cy) => phone(cx - 28, cy - 48, 56, 96, (sx, sy) => { for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const ix = sx + 8 + c * 14, iy = sy + 8 + r * 15; if (r === 1 && c === 1) { appIcon(ix + 5, iy + 5, 12); doc.circle(ix + 5, iy + 5, 9).lineWidth(1).strokeColor(ACCENT).stroke(); } else doc.roundedRect(ix, iy, 10, 10, 3).fillColor(LINE).fill(); } });
const drawBell = (cx, cy) => { doc.roundedRect(cx - 44, cy - 30, 88, 24, 12).fillColor("#FFFFFF").fill(); doc.roundedRect(cx - 44, cy - 30, 88, 24, 12).lineWidth(1).strokeColor(LINE).stroke(); bellIcon(cx - 26, cy - 18, 14); doc.font("Helvetica-Bold").fontSize(8).fillColor(INK).text("Notify me", cx - 14, cy - 22); doc.roundedRect(cx - 44, cy + 4, 88, 24, 12).fillColor(GOOD).fill(); checkIcon(cx - 32, cy + 16, 11); doc.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF").text("Notifications on", cx - 22, cy + 12, { lineBreak: false }); };
const drawLaptop = (cx, cy) => { const w = 110, h = 60, x = cx - 55, y0 = cy - 30; doc.roundedRect(x + 8, y0, w - 16, h * 0.8, 6).lineWidth(1.6).strokeColor(INK).stroke(); doc.roundedRect(x, y0 + h * 0.82, w, h * 0.12, 3).fillColor(INK).fill(); doc.font("Helvetica-Bold").fontSize(7.5).fillColor(ACCENT).text("bar-lento.vercel.app", x + 8, y0 + h * 0.34, { width: w - 16, align: "center" }); };

// ---------- content in two languages ----------
const T = {
  en: {
    kicker: "BAR LENTO · 158 8TH AVENUE, NEW YORK", title: "Welcome to the\nBar Lento app", tagline: "Your shifts, your hours, your documents — in one place, on your phone.",
    lang: (p) => `English · la versione italiana inizia a pagina ${p}`,
    intro1: "This app was designed and built entirely by Simone Viola, owner of Bar Lento, for the team: to make work easier, to keep everything in one place and to make sure nothing gets lost — for the team and for each of you personally.",
    intro2: "Here you find the weekly schedule, who is working today, whether the bar is open, closed or hosting a private event, your clock-ins and hours, your weekly report, and every document you sign — all tracked, all yours to check whenever you want.",
    notTitle: "Important: what this app is not", notTxt: "It does not replace Toast. Clock-ins and clock-outs are still done on the Toast terminal with your own account, and pay is handled through payroll as always. The app only shows you what has been recorded, so that you and Bar Lento always look at the same numbers.",
    chanTitle: "One channel for everything", chanTxt: "Schedules, changes, closures, events, reports, documents: everything arrives here (and by email), not in scattered chats. WhatsApp is for talking; the app is where things stay on record.",
    link: "bar-lento.vercel.app", linkSub: "This is the address. It works on your phone and on a computer. The next page shows, step by step, how to turn it into an app on your phone.",
    s1: "1. Put the app on your phone", s1intro: "The app lives at the address bar-lento.vercel.app. You do not download it from the App Store or Google Play: you open the address once and add it to your Home Screen. From then on it opens like any other app, with its own icon. It takes one minute. Follow the steps for your phone.",
    iphone: "iPhone (Safari)", iphoneSteps: ["Open Safari (the blue compass icon). Tap the bar at the top, type bar-lento.vercel.app and tap Go.", "Look at the bottom of the screen. Tap the Share button: a square with an arrow pointing up.", "A menu slides up. Scroll it down a little until you see “Add to Home Screen”. Tap it. Then tap “Add” at the top right.", "Done. Close Safari. On your Home Screen there is now a “Bar Lento” icon. From now on, always open the app from that icon."],
    iphoneCards: ["Safari: tap the Share button at the bottom", "Tap “Add to Home Screen”, then “Add”", "The Bar Lento icon is on your Home Screen"],
    android: "Android (Chrome)", androidSteps: ["Open Chrome. Tap the bar at the top, type bar-lento.vercel.app and tap Go.", "Look at the top right corner. Tap the three little dots.", "A menu opens. Tap “Add to Home screen” (on some phones it says “Install app”). Then tap “Add” or “Install”.", "Done. On your Home Screen there is now a “Bar Lento” icon. From now on, always open the app from that icon."],
    androidCards: ["Chrome: tap the three dots at the top right", "Tap “Add to Home screen”, then “Add”", "The Bar Lento icon is on your Home Screen"],
    notif: "Turn on notifications", notifSteps: ["Open the app from the Bar Lento icon on your Home Screen. On iPhone, notifications work only from the icon, not from Safari.", "At the top of the screen tap the button “Notify me”.", "Your phone asks “Allow notifications?”. Tap “Allow”. The button turns green and says “Notifications on”.", "That is all. You get one notification when a new week is published and one summary when something that concerns you changes. Never spam, never at night."],
    pc: "On a computer", pcTxt: "Open any browser (Safari, Chrome, Edge) and go to bar-lento.vercel.app. It is the same app with the same PIN, just on a bigger screen. Nothing to install. Phone and computer show the same things.",
    notifCards: ["Tap “Notify me”, then “Allow”", "On a computer: same address, nothing to install"],
    menuIphone: [["Copy", "Add to Reading List"], "Add to Home Screen"], menuAndroid: [["New tab", "Bookmarks"], "Add to Home screen"],
    s2: "2. Your first time: three taps", s2steps: ["Tap your name. You are already in the list: the names come from Toast.", "Choose a 4-digit PIN and type it twice. Only you know it. You will need it on a new phone or computer; the one you use is remembered.", "Read the House Rules and the documents New York law asks every employer to give you (section 6 explains each one). Your email is already filled in, the same one you use in Toast: tick the box, tap Sign, done. Your signed copies arrive by email."],
    s2shots: ["Tap your name", "Choose your PIN", "Read, tick, sign", "One signature for all documents"],
    mailTitle: "Use your Toast email, always", mailTxt: "The email in the app is the one Bar Lento has in Toast. Please keep it the same everywhere. If you ever change it in Toast, the app follows automatically; still, tell Simone so nothing gets lost.",
    s3: "3. The home screen, top to bottom", s3b: ["Your name (top left): you are signed in. Tap it to open My week.", "Time clock: who is on the clock right now and on past days, live from Toast. Green dot = somebody is clocked in.", "Notify me / Notifications on: your notifications (see section 1).", "Hi … / Next shift: your next shift at a glance, with the buttons My week and My stats.", "Today: Open now or Closed now with the hours, who is working today, and the reason when the bar is closed (a holiday, a private event, a half day).", "This week / Archive: the week tabs. Archive shows past weeks; they are kept and never change.", "The days: every shift of the week with name, station and times. Yours carry the YOU tag.", "Tap your shift, then Confirm shift: it tells the manager you have seen it. Only you can confirm your own shifts.", "Copy as text (bottom): the week as plain text, handy to paste anywhere."],
    s3shots: ["Home: today and the week", "Tap your shift, then Confirm shift", "Time clock, live from Toast"],
    s4: "4. My week: your shifts, your hours", s4b: ["Three tiles: hours scheduled, hours worked so far (from your Toast clock-ins) and the difference.", "One row per shift: scheduled times, station, and under it your real clock-in and clock-out with the hours. Tap a row to confirm it.", "‹ ›: move to the previous or next week.", "Documents: the House Rules and every policy you signed, with the date (section 6).", "My stats: your own numbers only — hours, punctuality, streaks. Nobody sees anybody else’s.", "Week report: downloads a PDF of the week shown: every clock-in and clock-out with the exact times, hours per day, weekly total. Times and hours only, nothing about pay. The same PDF arrives by email every Sunday night, automatically.", "Switch: on a shared phone, go back to the name list and let a colleague sign in. Log out: forget this phone."],
    s4shots: ["My week", "My stats: only yours", "Documents: everything you signed"],
    sameTitle: "Same numbers on both sides", sameTxt: "Your Week report and the record the owners see are built from the same clock-ins. If a time or an hour does not look right, say so right away: records are checked together, never rewritten.",
    s5: "5. Once in a while", s5b: ["Week in review: after a week of work you get a short recap of your week — for you only, always encouraging.", "New week: when the manager publishes the schedule, the app shows it once and sends the notification.", "New version of a document: when a policy changes, the app asks you to read and sign the new version once. Every January the State training video is asked again (free, 30 minutes, nothing to hand in).", "New phone: open the address, add the app to the Home Screen (section 1), tap your name, enter your PIN. Forgot it? The manager can reset it from Staff."],
    s6: "6. The documents you sign, explained", s6intro: "New York State and New York City require every employer to give employees a set of written policies and to keep proof that each person received them. Bar Lento does this in the app: you read, tick and sign once; your signed copy arrives by email and the record is kept. Nothing to print, nothing to bring back.",
    s6b: ["House Rules — how we work together at Bar Lento: schedule and confirmations, being on time, uniform, breaks, guests, safety, phones, tips, time off, who to talk to. Written for Bar Lento and checked against New York law.", "Sexual Harassment Prevention Policy — the official New York State model policy, adopted in full, with a complaint form. Required by NY Labor Law §201-g for every employer.", "Sexual Harassment Prevention Training — once a year, the free 30-minute video from New York State (in English, or English with Italian subtitles). Watch it, tick, sign. No test, nothing to hand in. Required every year by the same law.", "Protected Time Off (Safe and Sick Leave) Policy — how paid sick and safe time is earned and used under the New York City Earned Safe and Sick Time Act and the New York State Paid Sick Leave Law, with the official NYC Notice of Employee Rights in English and Italian.", "Tips Policy — how tips work at Bar Lento (no tip pool; card tips through payroll; cash tips declared in Toast), under NY Labor Law §196-d.", "Lactation Policy — the New York State Department of Labor model policy on the right to express breast milk at work (NY Labor Law §206-c)."],
    signTitle: "What signing means", signTxt: "Signing confirms that you received and read the document. It does not take away any right the law gives you: where a policy and the law differ, the law wins. Every version you sign is kept with the date, your email and a fingerprint of the exact text, so nobody can change it afterwards. You can reread or print any document at any time from My week, then Documents.",
    s7: "7. Your privacy", s7b: ["What is stored: your name, your PIN (only as a cryptographic hash, never the PIN itself), the phones you signed in from, the email you sign with, your shifts and confirmations, your clock-ins mirrored from Toast, your signed documents, your birthday if the manager entered it.", "Why: to organize shifts, verify hours and comply with New York labor law. Nothing else. No advertising, no tracking, no sale of data.", "Who sees it: you see your own data; the time clock is visible to signed-in colleagues because it is operational; the manager and the owners see what they need to run the business. Nobody else.", "Everything is written in plain words at bar-lento.vercel.app/legal.html. You can ask the owners for a copy of your records at any time."],
    s8: "8. Good to know", s8b: ["Records that the law requires (schedules, hours, signed policies) are kept as long as the law requires, also after someone leaves.", "Questions about the app, your hours or a document: ask the manager or an owner. Their emails are in the Contacts at the end of the House Rules (My week, then Documents)."],
    footer: "Welcome to the Bar Lento app", contact: "Bar Lento · 158 8th Avenue, New York, NY · The owners’ and manager’s contacts are at the end of the House Rules, in the app.", rights: "© 2026 Simone Viola · Bar Lento staff app · All rights reserved",
  },
  it: {
    kicker: "BAR LENTO · 158 8TH AVENUE, NEW YORK", title: "Benvenuti nell’app\ndi Bar Lento", tagline: "I tuoi turni, le tue ore, i tuoi documenti: tutto in un posto, sul tuo telefono.",
    lang: () => "Italiano · the English version starts on page 1",
    intro1: "Questa app è stata ideata e realizzata interamente da Simone Viola, titolare di Bar Lento, per la squadra: per rendere il lavoro più semplice, tenere tutto in un posto solo e non perdere nulla, né per il team né per ognuno di voi personalmente.",
    intro2: "Qui trovi i turni della settimana, chi lavora oggi, se il locale è aperto, chiuso o ospita un evento privato, le tue timbrature e le tue ore, il tuo report settimanale e ogni documento che firmi: tutto registrato, tutto tuo da controllare quando vuoi.",
    notTitle: "Importante: cosa NON è questa app", notTxt: "Non sostituisce Toast. Entrata e uscita si timbrano sempre sul terminale Toast con il proprio account, e la paga passa dalla busta paga come sempre. L’app mostra soltanto quello che è stato registrato, così tu e Bar Lento guardate sempre gli stessi numeri.",
    chanTitle: "Un solo canale per tutto", chanTxt: "Turni, modifiche, chiusure, eventi, report, documenti: tutto arriva qui (e via email), non in mille chat. WhatsApp serve per parlare; l’app è dove le cose restano registrate.",
    link: "bar-lento.vercel.app", linkSub: "Questo è l’indirizzo. Funziona sul telefono e sul computer. Nella pagina seguente c’è, passo per passo, come trasformarlo in un’app sul telefono.",
    s1: "1. Metti l’app sul telefono", s1intro: "L’app si trova all’indirizzo bar-lento.vercel.app. Non si scarica dall’App Store o da Google Play: apri l’indirizzo una volta e lo aggiungi alla schermata Home. Da quel momento si apre come qualsiasi altra app, con la sua icona. Ci vuole un minuto. Segui i passi per il tuo telefono.",
    iphone: "iPhone (Safari)", iphoneSteps: ["Apri Safari (l’icona con la bussola blu). Tocca la barra in alto, scrivi bar-lento.vercel.app e tocca Vai.", "Guarda in basso nello schermo. Tocca il tasto Condividi: un quadrato con una freccia verso l’alto.", "Si apre un menu dal basso. Scorrilo un po’ verso il basso finché vedi “Aggiungi alla schermata Home”. Toccalo. Poi tocca “Aggiungi” in alto a destra.", "Fatto. Chiudi Safari. Sulla schermata Home ora c’è l’icona “Bar Lento”. Da adesso apri sempre l’app da quell’icona."],
    iphoneCards: ["Safari: tocca il tasto Condividi in basso", "Tocca “Aggiungi alla schermata Home”, poi “Aggiungi”", "L’icona Bar Lento è sulla tua schermata Home"],
    android: "Android (Chrome)", androidSteps: ["Apri Chrome. Tocca la barra in alto, scrivi bar-lento.vercel.app e tocca Vai.", "Guarda in alto a destra. Tocca i tre puntini.", "Si apre un menu. Tocca “Aggiungi a schermata Home” (su alcuni telefoni dice “Installa app”). Poi tocca “Aggiungi” o “Installa”.", "Fatto. Sulla schermata Home ora c’è l’icona “Bar Lento”. Da adesso apri sempre l’app da quell’icona."],
    androidCards: ["Chrome: tocca i tre puntini in alto a destra", "Tocca “Aggiungi a schermata Home”, poi “Aggiungi”", "L’icona Bar Lento è sulla tua schermata Home"],
    notif: "Attiva le notifiche", notifSteps: ["Apri l’app dall’icona Bar Lento sulla schermata Home. Su iPhone le notifiche funzionano solo dall’icona, non da Safari.", "In alto nello schermo tocca il tasto “Notify me”.", "Il telefono chiede “Consentire le notifiche?”. Tocca “Consenti”. Il tasto diventa verde e dice “Notifications on”.", "Tutto qui. Ricevi una notifica quando esce una nuova settimana e un solo riepilogo quando cambia qualcosa che ti riguarda. Mai spam, mai di notte."],
    pc: "Sul computer", pcTxt: "Apri un browser qualsiasi (Safari, Chrome, Edge) e vai su bar-lento.vercel.app. È la stessa app con lo stesso PIN, solo su uno schermo più grande. Niente da installare. Telefono e computer mostrano le stesse cose.",
    notifCards: ["Tocca “Notify me”, poi “Consenti”", "Sul computer: stesso indirizzo, niente da installare"],
    menuIphone: [["Copia", "Aggiungi a elenco di lettura"], "Aggiungi alla schermata Home"], menuAndroid: [["Nuova scheda", "Preferiti"], "Aggiungi a schermata Home"],
    s2: "2. La prima volta: tre tocchi", s2steps: ["Tocca il tuo nome. Sei già in lista: i nomi arrivano da Toast.", "Scegli un PIN di 4 cifre e scrivilo due volte. Lo conosci solo tu. Ti servirà su un telefono o computer nuovo; quello che usi viene ricordato.", "Leggi le House Rules (il regolamento) e i documenti che la legge di New York obbliga ogni datore di lavoro a consegnare (la sezione 6 li spiega uno per uno). La tua email è già inserita, la stessa che usi su Toast: spunta la casella, tocca Sign, fatto. Le copie firmate ti arrivano via email."],
    s2shots: ["Tocca il tuo nome", "Scegli il PIN", "Leggi, spunta, firma", "Una firma per tutti i documenti"],
    mailTitle: "Usa sempre la tua email di Toast", mailTxt: "L’email nell’app è quella che Bar Lento ha su Toast. Tienila uguale ovunque. Se un giorno la cambi su Toast, l’app la segue da sola; dillo comunque a Simone, così non si perde nulla.",
    s3: "3. La schermata principale, dall’alto in basso", s3b: ["Il tuo nome (in alto a sinistra): sei dentro. Toccalo per aprire My week.", "Time clock: chi è in servizio adesso e nei giorni passati, in diretta da Toast. Pallino verde = qualcuno ha timbrato l’entrata.", "Notify me / Notifications on: le tue notifiche (vedi sezione 1).", "Hi … / Next shift: il tuo prossimo turno a colpo d’occhio, con i tasti My week e My stats.", "Oggi: Open now o Closed now con gli orari, chi lavora oggi, e il motivo se il locale è chiuso (festività, evento privato, mezza giornata).", "This week / Archive: le settimane. Archive mostra quelle passate: restano e non cambiano mai.", "I giorni: ogni turno della settimana con nome, postazione e orari. I tuoi hanno l’etichetta YOU.", "Tocca il tuo turno, poi Confirm shift: dici alla manager che l’hai visto. Solo tu puoi confermare i tuoi turni.", "Copy as text (in fondo): la settimana in testo semplice, comoda da incollare ovunque."],
    s3shots: ["Home: oggi e la settimana", "Tocca il turno, poi Confirm shift", "Time clock, in diretta da Toast"],
    s4: "4. My week: i tuoi turni, le tue ore", s4b: ["Tre riquadri: ore programmate, ore lavorate finora (dalle tue timbrature Toast) e differenza.", "Una riga per turno: orari programmati, postazione, e sotto la tua vera entrata e uscita con le ore. Tocca la riga per confermare.", "‹ ›: settimana precedente o successiva.", "Documents: il regolamento e ogni documento che hai firmato, con la data (sezione 6).", "My stats: solo i tuoi numeri: ore, puntualità, serie. Nessuno vede quelli degli altri.", "Week report: scarica il PDF della settimana che stai guardando: ogni entrata e uscita con l’orario esatto, ore per giorno, totale settimanale. Solo orari e ore, niente sulla paga. Lo stesso PDF ti arriva via email ogni domenica sera, in automatico.", "Switch: su un telefono condiviso, torna alla lista dei nomi per far entrare un collega. Log out: dimentica questo telefono."],
    s4shots: ["My week", "My stats: solo i tuoi", "Documents: tutto quello che hai firmato"],
    sameTitle: "Gli stessi numeri da tutte e due le parti", sameTxt: "Il tuo Week report e il fascicolo che vedono i titolari nascono dalle stesse timbrature. Se un orario o un’ora non ti torna, dillo subito: i dati si controllano insieme, non si riscrivono mai.",
    s5: "5. Ogni tanto", s5b: ["Week in review: dopo una settimana di lavoro ricevi un breve riepilogo della tua settimana, solo per te, sempre incoraggiante.", "Nuova settimana: quando la manager pubblica i turni, l’app te la mostra una volta e manda la notifica.", "Nuova versione di un documento: quando una policy cambia, l’app ti chiede di leggere e firmare la nuova versione, una volta. Ogni gennaio viene richiesto di nuovo il video di formazione dello Stato (gratuito, 30 minuti, niente da consegnare).", "Telefono nuovo: apri l’indirizzo, aggiungi l’app alla schermata Home (sezione 1), tocca il tuo nome, inserisci il PIN. L’hai dimenticato? La manager può azzerarlo da Staff."],
    s6: "6. I documenti che firmi, spiegati", s6intro: "Lo Stato e la Città di New York obbligano ogni datore di lavoro a consegnare ai dipendenti alcune policy scritte e a conservare la prova che ognuno le ha ricevute. Bar Lento lo fa nell’app: leggi, spunti e firmi una volta; la copia firmata ti arriva via email e la registrazione viene conservata. Niente da stampare, niente da riportare.",
    s6b: ["House Rules (regolamento) — come lavoriamo insieme a Bar Lento: turni e conferme, puntualità, divisa, pause, clienti, sicurezza, telefoni, mance, assenze, a chi rivolgersi. Scritto per Bar Lento e verificato sulla legge di New York.", "Sexual Harassment Prevention Policy — la policy modello ufficiale dello Stato di New York contro le molestie, adottata integralmente, con il modulo di segnalazione. Obbligatoria per ogni datore di lavoro (NY Labor Law §201-g).", "Sexual Harassment Prevention Training — una volta l’anno, il video gratuito dello Stato di New York di 30 minuti (in inglese, o in inglese con sottotitoli in italiano). Lo guardi, spunti, firmi. Niente test, niente da consegnare. Obbligatorio ogni anno per la stessa legge.", "Protected Time Off (Safe and Sick Leave) Policy — come si maturano e si usano le ore pagate di malattia e sicurezza secondo la legge della Città di New York (Earned Safe and Sick Time Act) e dello Stato (Paid Sick Leave Law), con l’avviso ufficiale dei diritti in inglese e in italiano.", "Tips Policy — come funzionano le mance a Bar Lento (niente pool; mance su carta tramite busta paga; mance in contanti dichiarate su Toast), secondo la NY Labor Law §196-d.", "Lactation Policy — la policy modello del Dipartimento del Lavoro dello Stato di New York sul diritto di estrarre il latte materno al lavoro (NY Labor Law §206-c)."],
    signTitle: "Cosa vuol dire firmare", signTxt: "Firmare conferma che hai ricevuto e letto il documento. Non ti toglie nessun diritto che la legge ti dà: dove una policy e la legge dicono cose diverse, vince la legge. Ogni versione che firmi viene conservata con data, la tua email e un’impronta del testo esatto, così nessuno può cambiarla dopo. Puoi rileggere o stampare ogni documento quando vuoi da My week, poi Documents.",
    s7: "7. La tua privacy", s7b: ["Cosa viene salvato: il tuo nome, il tuo PIN (solo in forma cifrata, mai il PIN vero), i telefoni da cui sei entrato, l’email con cui firmi, i tuoi turni e le conferme, le tue timbrature copiate da Toast, i documenti firmati, il tuo compleanno se la manager lo ha inserito.", "Perché: per organizzare i turni, verificare le ore e rispettare la legge del lavoro di New York. Nient’altro. Niente pubblicità, niente tracciamento, nessuna vendita di dati.", "Chi li vede: tu vedi i tuoi dati; il Time clock è visibile ai colleghi che sono entrati perché è informazione operativa; la manager e i titolari vedono ciò che serve a gestire il locale. Nessun altro.", "È tutto scritto in parole semplici su bar-lento.vercel.app/legal.html. Puoi chiedere ai titolari una copia dei tuoi dati in qualsiasi momento."],
    s8: "8. Buono a sapersi", s8b: ["I dati richiesti dalla legge (turni, ore, policy firmate) restano conservati per tutto il tempo che la legge richiede, anche dopo che una persona se ne va.", "Domande sull’app, sulle tue ore o su un documento: chiedi alla manager o a un titolare. Le loro email sono nei Contatti in fondo alle House Rules (My week, poi Documents)."],
    footer: "Benvenuti nell’app di Bar Lento", contact: "Bar Lento · 158 8th Avenue, New York, NY · I contatti dei titolari e della manager sono in fondo alle House Rules, nell’app.", rights: "© 2026 Simone Viola · Bar Lento staff app · Tutti i diritti riservati",
  },
};

function part(L, first) {
  if (!first) doc.addPage();
  // cover
  doc.rect(0, 0, doc.page.width, 300).fillColor(DARK).fill();
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#8FB8F0").text(L.kicker, M, 70, { characterSpacing: 1.2 });
  doc.font("Helvetica-Bold").fontSize(34).fillColor("#FFFFFF").text(L.title, M, 100, { width: W, lineGap: 2 });
  doc.rect(M, 208, 60, 3).fillColor(ACCENT).fill();
  doc.font("Helvetica").fontSize(12.5).fillColor("#D8D8DC").text(L.tagline, M, 226, { width: W });
  if (!first) doc.font("Helvetica").fontSize(9).fillColor("#8E8E93").text(L.lang(), M, 268, { width: W });
  y = 330;
  para(L.intro1, { size: 12, after: 12 }); para(L.intro2, { size: 11.5, after: 14 });
  callout(L.notTitle, L.notTxt); callout(L.chanTitle, L.chanTxt);
  para(L.link, { bold: true, size: 13, color: ACCENT, after: 2 }); para(L.linkSub, { size: 10.5, color: MUTED });

  // 1. install (its own page)
  doc.addPage(); y = M;
  heading(L.s1); para(L.s1intro, { after: 10 });
  para(L.iphone, { bold: true, size: 12.5, after: 6 }); steps(L.iphoneSteps);
  cards([{ draw: drawIphoneShare, text: L.iphoneCards[0] }, { draw: (cx, cy) => menuSheet(cx, cy, L.menuIphone[0], L.menuIphone[1]), text: L.iphoneCards[1] }, { draw: drawHomeIcon, text: L.iphoneCards[2] }]);
  para(L.android, { bold: true, size: 12.5, after: 6 }); steps(L.androidSteps);
  cards([{ draw: drawAndroidMenu, text: L.androidCards[0] }, { draw: (cx, cy) => menuSheet(cx, cy, L.menuAndroid[0], L.menuAndroid[1]), text: L.androidCards[1] }, { draw: drawHomeIcon, text: L.androidCards[2] }]);
  para(L.notif, { bold: true, size: 12.5, after: 6 }); steps(L.notifSteps);
  para(L.pc, { bold: true, size: 12.5, after: 6 }); para(L.pcTxt, { after: 10 });
  cards([{ draw: drawBell, text: L.notifCards[0] }, { draw: drawLaptop, text: L.notifCards[1] }]);

  // 2. first time
  heading(L.s2); steps(L.s2steps);
  shots([{ file: "01-who.png", caption: L.s2shots[0] }, { file: "02-pin.png", caption: L.s2shots[1] }, { file: "03-rules.png", caption: L.s2shots[2] }, { file: "04-packet.png", caption: L.s2shots[3] }]);
  callout(L.mailTitle, L.mailTxt);
  // 3. home
  heading(L.s3); bullets(L.s3b);
  shots([{ file: "05-home.png", caption: L.s3shots[0] }, { file: "10-confirm.png", caption: L.s3shots[1] }, { file: "07-timeclock.png", caption: L.s3shots[2] }]);
  // 4. my week
  heading(L.s4); bullets(L.s4b);
  shots([{ file: "06-myweek.png", caption: L.s4shots[0] }, { file: "11-stats.png", caption: L.s4shots[1] }, { file: "08-documents.png", caption: L.s4shots[2] }]);
  callout(L.sameTitle, L.sameTxt);
  // 5..8
  heading(L.s5); bullets(L.s5b);
  heading(L.s6); para(L.s6intro, { after: 8 }); bullets(L.s6b); callout(L.signTitle, L.signTxt);
  heading(L.s7); bullets(L.s7b);
  heading(L.s8); bullets(L.s8b);
  y += 6; para(L.contact, { size: 10, color: MUTED, after: 2 }); para(L.rights, { size: 9, color: MUTED });
}

part(T.en, true);
const itStart = doc.bufferedPageRange().count; // 0-based index of the Italian cover
part(T.it, false);

// footers + the cross-reference on the English cover (needs the final page number)
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  const L = i < itStart ? T.en : T.it;
  if (i === 0) { doc.font("Helvetica").fontSize(9).fillColor("#8E8E93").text(L.lang(itStart + 1), M, 268, { width: W }); continue; }
  if (i === itStart) continue;
  doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(L.footer, M, H - M - 12, { width: W - 60, lineBreak: false }).text(`${i + 1} / ${range.count}`, M + W - 60, H - M - 12, { width: 60, align: "right", lineBreak: false });
}
doc.end();
out.on("finish", () => console.log("welcome.pdf written:", fs.statSync(OUT).size, "bytes, pages", range.count, "Italian from page", itStart + 1));
