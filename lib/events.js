// Private event kinds (the manager's request through the owner, 2026-10-27: "quando fa gli orari mette che c'è un evento, con un
// colore: happy hour, engagement party… e i ragazzi vedono l'evento della giornata"). The manager picks the kind in Day settings
// (status "event", notes[day].kind); everyone sees it on the day card (coloured badge), in the hero, the morning push, the calendar
// feed and the reports. The client's EVENT_KINDS / eventLabel() in index.html mirror this table.
const KINDS = {
  happy: { en: "Happy hour", it: "Happy hour" },
  engagement: { en: "Engagement party", it: "Festa di fidanzamento" },
  birthday: { en: "Birthday party", it: "Festa di compleanno" },
  corporate: { en: "Corporate event", it: "Evento aziendale" },
  wedding: { en: "Wedding", it: "Matrimonio" },
  other: { en: "Private event", it: "Evento privato" },
};
const KEYS = Object.keys(KINDS);
function label(note, lang) { const k = note && note.kind && KINDS[note.kind] ? note.kind : "other"; return KINDS[k][lang === "it" ? "it" : "en"]; }
module.exports = { KINDS, KEYS, label };
