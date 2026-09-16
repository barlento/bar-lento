// Human-readable change summary between two schedule snapshots (for the audit log).
const { DAY_KEYS } = require("./store");

const DAY_LONG = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const STATUS_LABEL = { "": "Open", closed: "Closed", holiday: "Holiday", half: "Half day", event: "Private event" };

function fmt12(t) {
  if (!t) return "";
  let [h, m] = t.split(":").map(Number);
  if (t === "00:00") return "12:00 AM";
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

function dateOf(weekISO, dayKey) {
  const [y, mo, d] = weekISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + DAY_KEYS.indexOf(dayKey)));
  return `${DAY_LONG[dayKey]} ${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
}

function shiftLabel(s) {
  return `${s.name}${s.station ? ` (${s.station})` : ""} ${fmt12(s.start)}–${fmt12(s.end)}`;
}

// Returns { changes, resetKeys, notable, newWeeks }
// changes   = everything, for the audit log
// notable   = only what matters to an employee (shifts added/removed/time or name changed, day status changed)
// resetKeys = confirmations that must be cleared because the shift materially changed
// newWeeks  = week keys created in this save
function diffData(oldD, newD) {
  const changes = [];
  const notable = [];
  const newWeeks = [];
  const resetKeys = [];

  const oldStaff = new Set(oldD.staff || []);
  const newStaff = new Set(newD.staff || []);
  [...newStaff].filter((n) => !oldStaff.has(n)).forEach((n) => changes.push(`Staff: added ${n}`));
  [...oldStaff].filter((n) => !newStaff.has(n)).forEach((n) => changes.push(`Staff: removed ${n}`));

  const ob = oldD.birthdays || {}, nb = newD.birthdays || {};
  new Set([...Object.keys(ob), ...Object.keys(nb)]).forEach((n) => {
    if (ob[n] !== nb[n]) changes.push(nb[n] ? `Birthday: ${n} → ${nb[n]}` : `Birthday: removed for ${n}`);
  });

  const weeks = new Set([...Object.keys(oldD.weeks || {}), ...Object.keys(newD.weeks || {})]);
  [...weeks].sort().forEach((wk) => {
    const ow = (oldD.weeks || {})[wk];
    const nw = (newD.weeks || {})[wk];
    if (!ow) { changes.push(`Week of ${wk}: created`); newWeeks.push(wk); }
    if (!nw) { changes.push(`Week of ${wk}: deleted`); return; }
    DAY_KEYS.forEach((d) => {
      const when = dateOf(wk, d);
      const oldList = ow ? ow[d] || [] : [];
      const newList = nw[d] || [];
      const oldById = new Map(oldList.map((s) => [s.id, s]));
      const newById = new Map(newList.map((s) => [s.id, s]));
      newList.forEach((s) => {
        const prev = oldById.get(s.id);
        if (!prev) { const m = `${when}: added ${shiftLabel(s)}`; changes.push(m); if (!newWeeks.includes(wk)) notable.push(m); return; }
        const material = prev.name !== s.name || prev.start !== s.start || prev.end !== s.end;
        if (material || prev.station !== s.station) {
          const m = `${when}: changed ${shiftLabel(prev)} → ${shiftLabel(s)}`;
          changes.push(m);
          if (material) { resetKeys.push(`${wk}:${d}:${s.id}`); notable.push(m); }
        }
      });
      oldList.forEach((s) => { if (!newById.has(s.id)) { const m = `${when}: removed ${shiftLabel(s)}`; changes.push(m); notable.push(m); } });

      const on = (ow && ow.notes && ow.notes[d]) || null;
      const nn = (nw.notes && nw.notes[d]) || null;
      const os = on ? on.status : "", ns = nn ? nn.status : "";
      const ot = on ? on.text : "", nt = nn ? nn.text : "";
      const hoursOf = (x) => (x && x.status === "half" ? `${fmt12(x.open)}–${fmt12(x.close)}` : "");
      if (os !== ns || hoursOf(on) !== hoursOf(nn)) { const m = `${when}: day set to ${STATUS_LABEL[ns] || ns || "Open"}${hoursOf(nn) ? ` (${hoursOf(nn)})` : ""}${nt ? ` — ${nt}` : ""}`; changes.push(m); if (!newWeeks.includes(wk)) notable.push(m); }
      if (ot !== nt) changes.push(nt ? `${when}: note "${nt}"` : `${when}: note removed`);
    });
  });

  return { changes, resetKeys, notable, newWeeks };
}

module.exports = { diffData, fmt12 };
