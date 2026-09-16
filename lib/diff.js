// Human-readable change summary between two schedule snapshots (for the audit log).
const { DAY_KEYS } = require("./store");

const DAY_LONG = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const STATUS_LABEL = { "": "Open", closed: "Closed", holiday: "Holiday", event: "Private event" };

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

// Returns { changes: string[], resetKeys: string[] }
// resetKeys = confirmations that must be cleared because the shift materially changed.
function diffData(oldD, newD) {
  const changes = [];
  const resetKeys = [];

  const oldStaff = new Set(oldD.staff || []);
  const newStaff = new Set(newD.staff || []);
  [...newStaff].filter((n) => !oldStaff.has(n)).forEach((n) => changes.push(`Staff: added ${n}`));
  [...oldStaff].filter((n) => !newStaff.has(n)).forEach((n) => changes.push(`Staff: removed ${n}`));

  const weeks = new Set([...Object.keys(oldD.weeks || {}), ...Object.keys(newD.weeks || {})]);
  [...weeks].sort().forEach((wk) => {
    const ow = (oldD.weeks || {})[wk];
    const nw = (newD.weeks || {})[wk];
    if (!ow) { changes.push(`Week of ${wk}: created`); }
    if (!nw) { changes.push(`Week of ${wk}: deleted`); return; }
    DAY_KEYS.forEach((d) => {
      const when = dateOf(wk, d);
      const oldList = ow ? ow[d] || [] : [];
      const newList = nw[d] || [];
      const oldById = new Map(oldList.map((s) => [s.id, s]));
      const newById = new Map(newList.map((s) => [s.id, s]));
      newList.forEach((s) => {
        const prev = oldById.get(s.id);
        if (!prev) { changes.push(`${when}: added ${shiftLabel(s)}`); return; }
        const material = prev.name !== s.name || prev.start !== s.start || prev.end !== s.end;
        if (material || prev.station !== s.station) {
          changes.push(`${when}: changed ${shiftLabel(prev)} → ${shiftLabel(s)}`);
          if (material) resetKeys.push(`${wk}:${d}:${s.id}`);
        }
      });
      oldList.forEach((s) => { if (!newById.has(s.id)) changes.push(`${when}: removed ${shiftLabel(s)}`); });

      const on = (ow && ow.notes && ow.notes[d]) || null;
      const nn = (nw.notes && nw.notes[d]) || null;
      const os = on ? on.status : "", ns = nn ? nn.status : "";
      const ot = on ? on.text : "", nt = nn ? nn.text : "";
      if (os !== ns) changes.push(`${when}: day set to ${STATUS_LABEL[ns] || ns || "Open"}`);
      if (ot !== nt) changes.push(nt ? `${when}: note "${nt}"` : `${when}: note removed`);
    });
  });

  return { changes, resetKeys };
}

module.exports = { diffData, fmt12 };
