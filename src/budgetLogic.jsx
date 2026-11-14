// Budget per categoria di Finbar: logica pura (nessuna interfaccia), così si può provare da sola.
//
// Dati salvati nel conto:  account.budget = {
//   period: { type: "month" | "week" | "custom", startDay: 1..28, days: 1..366, anchor: "YYYY-MM-DD" },
//   items:  { [idCategoria]: importo },          // il massimo che si vuole spendere nel periodo
//   periodKey: "YYYY-MM-DD",                     // inizio del periodo in corso (serve a capire quando ne parte uno nuovo)
//   fired:  { key, cats: { [idCategoria]: [25, 50, ...] } }   // soglie già segnalate in questo periodo
// }
// Tutte le date sono giorni di calendario (YYYY-MM-DD), calcolati senza fuso orario.

export const BUDGET_THRESHOLDS = [25, 50, 75, 85, 100];
export const BUDGET_MAX_SHARE = 0.9; // tetto di ogni budget: 90% dei soldi disponibili in quella categoria

const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const parts = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return { y, m, d }; };
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export function addDays(iso, n) {
  const { y, m, d } = parts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
export function daysBetween(a, b) {
  const pa = parts(a), pb = parts(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}
export function localToday() {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth() + 1, n.getDate());
}
const isISO = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const round2 = (x) => Math.round(x * 100) / 100;
const floor2 = (x) => Math.floor(x * 100 + 1e-6) / 100;
const normKey = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// ---------- Periodo ----------
export function defaultPeriod(today = localToday()) {
  return { type: "month", startDay: 1, days: 30, anchor: today };
}
export function normalizePeriod(p, today = localToday()) {
  const type = p && ["month", "week", "custom"].includes(p.type) ? p.type : "month";
  const startDay = Math.min(28, Math.max(1, Math.round(Number(p && p.startDay)) || 1));
  const days = Math.min(366, Math.max(1, Math.round(Number(p && p.days)) || 30));
  const anchor = p && isISO(p.anchor) ? p.anchor : today;
  return { type, startDay, days, anchor };
}
// Periodo che contiene `today`: { start, end (compreso), key }
export function periodFor(spec, today = localToday()) {
  const p = normalizePeriod(spec, today);
  let start, end;
  if (p.type === "week") {
    const { y, m, d } = parts(today);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domenica
    start = addDays(today, -((dow + 6) % 7)); // la settimana comincia di lunedì
    end = addDays(start, 6);
  } else if (p.type === "custom") {
    const k = Math.floor(daysBetween(p.anchor, today) / p.days);
    start = addDays(p.anchor, k * p.days);
    end = addDays(start, p.days - 1);
  } else {
    const { y, m, d } = parts(today);
    let sy = y, sm = m;
    if (d < p.startDay) { sm -= 1; if (sm < 1) { sm = 12; sy -= 1; } }
    start = toISO(sy, sm, p.startDay);
    let ny = sy, nm = sm + 1;
    if (nm > 12) { nm = 1; ny += 1; }
    end = addDays(toISO(ny, nm, p.startDay), -1);
  }
  return { start, end, key: start };
}

// ---------- Spesa nel periodo ----------
// { idCategoria: speso }. Conta le spese (non i trasferimenti tra conti). Usa il dettaglio per categoria
// salvato con ogni operazione; per le operazioni senza dettaglio ricade sul nome della categoria.
export function spentByCategory(account, start, end) {
  const spent = {};
  const cats = account.categories || {};
  const byLabel = {};
  Object.entries(cats).forEach(([id, c]) => { byLabel[normKey(c.label)] = id; });
  (account.transactions || []).forEach((tx) => {
    if (tx.type !== "spesa" || tx.transferId || !tx.date || tx.date < start || tx.date > end) return;
    if (tx.breakdown) {
      Object.entries(tx.breakdown).forEach(([id, v]) => { if (v < 0 && cats[id]) spent[id] = (spent[id] || 0) - v; });
    } else {
      const id = cats[tx.rawCategory] ? tx.rawCategory : byLabel[normKey(tx.category)];
      if (id) spent[id] = (spent[id] || 0) + tx.amount;
    }
  });
  Object.keys(spent).forEach((id) => { spent[id] = round2(spent[id]); });
  return spent;
}

// Soldi disponibili in una categoria nel periodo = saldo attuale + quanto già speso nel periodo.
export const availableFor = (cat, spent) => Math.max(0, (cat.balance || 0) + (spent || 0));
export const capFor = (cat, spent) => floor2(availableFor(cat, spent) * BUDGET_MAX_SHARE);

export function hasBudget(account) {
  const b = account && account.budget;
  if (!b || !b.items) return false;
  return Object.entries(b.items).some(([id, v]) => account.categories[id] && v > 0);
}

// Righe per la tabella: pianificato / speso / differenza
export function budgetRows(account, today = localToday()) {
  const b = account.budget || {};
  const per = periodFor(b.period, today);
  const spent = spentByCategory(account, per.start, per.end);
  const rows = Object.entries(account.categories || {}).map(([id, c]) => {
    const budget = b.items && b.items[id] > 0 ? b.items[id] : null;
    const s = spent[id] || 0;
    return {
      id, label: c.label, color: c.color, budget, spent: s,
      diff: budget === null ? null : round2(budget - s),
      ratio: budget === null ? null : (s / budget) * 100,
      cap: capFor(c, s),
    };
  });
  const withB = rows.filter((r) => r.budget !== null);
  const totals = {
    budget: round2(withB.reduce((t, r) => t + r.budget, 0)),
    spent: round2(withB.reduce((t, r) => t + r.spent, 0)),
  };
  totals.diff = round2(totals.budget - totals.spent);
  return { period: per, rows, totals };
}

// Controlla gli importi inseriti: ritorna { clean: {id: importo}, errors: {id: "over"|"nofunds"} }
export function validateItems(account, rawItems, today = localToday(), period) {
  const per = periodFor(period, today);
  const spent = spentByCategory(account, per.start, per.end);
  const clean = {}, errors = {};
  Object.entries(account.categories || {}).forEach(([id, c]) => {
    const raw = rawItems[id];
    if (raw === undefined || raw === null || String(raw).trim() === "") return;
    const n = round2(Number(String(raw).replace(",", ".")));
    if (!Number.isFinite(n) || n <= 0) return;
    const cap = capFor(c, spent[id] || 0);
    if (cap <= 0) { errors[id] = "nofunds"; return; }
    if (n > cap + 1e-9) { errors[id] = "over"; return; }
    clean[id] = n;
  });
  return { clean, errors };
}

// Soglie già superate con la spesa di adesso (si segnano come "già date" per non avvisare di cose già note)
function crossedMap(account, items, per) {
  const spent = spentByCategory(account, per.start, per.end);
  const cats = {};
  Object.entries(items).forEach(([id, v]) => {
    if (!(v > 0)) return;
    const ratio = ((spent[id] || 0) / v) * 100;
    const crossed = BUDGET_THRESHOLDS.filter((th) => ratio >= th - 1e-9);
    if (crossed.length) cats[id] = crossed;
  });
  return cats;
}

// Salvataggio dalla schermata: periodo + importi, con le soglie attuali segnate come già note.
export function buildBudget(account, period, items, today = localToday()) {
  const p = normalizePeriod(period, today);
  const per = periodFor(p, today);
  return { period: p, items, periodKey: per.key, fired: { key: per.key, cats: crossedMap(account, items, per) } };
}

// Dopo un cambio di categorie (es. si applica un modello): si riallinea il budget alle nuove categorie.
export function rebaselineBudget(account, today = localToday()) {
  const b = account.budget;
  if (!b) return b;
  const per = periodFor(b.period, today);
  const spent = spentByCategory(account, per.start, per.end);
  const items = {};
  Object.entries(b.items || {}).forEach(([id, v]) => {
    const c = account.categories[id];
    if (!c || !(v > 0)) return;
    const cap = capFor(c, spent[id] || 0);
    if (cap > 0) items[id] = Math.min(v, cap);
  });
  return { ...b, items, periodKey: per.key, fired: { key: per.key, cats: crossedMap(account, items, per) } };
}

// Da chiamare a ogni cambiamento dei dati. Fa due cose:
//  1) se è partito un nuovo periodo, azzera le soglie e abbassa i budget che superano il nuovo tetto del 90%;
//  2) se una spesa ha superato una nuova soglia (25/50/75/85/100%), prepara un avviso.
// Ritorna { account, alerts, changed }. Chiamandola due volte di fila la seconda non cambia nulla.
export function evaluateBudget(account, today = localToday()) {
  if (!hasBudget(account)) return { account, alerts: [], changed: false };
  const b = account.budget;
  const per = periodFor(b.period, today);
  const spent = spentByCategory(account, per.start, per.end);
  const items = { ...b.items };
  let fired = b.fired && b.fired.key === per.key ? { key: per.key, cats: { ...b.fired.cats } } : { key: per.key, cats: {} };
  const alerts = [];
  let changed = false;

  if (b.periodKey !== per.key || !b.fired || b.fired.key !== per.key) {
    changed = true;
    fired = { key: per.key, cats: {} };
    Object.entries(items).forEach(([id, v]) => {
      const c = account.categories[id];
      if (!c || !(v > 0)) return;
      const cap = capFor(c, spent[id] || 0);
      if (v > cap + 1e-9) {
        alerts.push({ kind: "clamp", id, label: c.label, color: c.color, oldAmount: v, newAmount: cap, avail: round2(availableFor(c, spent[id] || 0)) });
        if (cap > 0) items[id] = cap; else delete items[id];
      }
    });
  }

  Object.entries(items).forEach(([id, v]) => {
    const c = account.categories[id];
    if (!c || !(v > 0)) return;
    const s = spent[id] || 0;
    const ratio = (s / v) * 100;
    const crossed = BUDGET_THRESHOLDS.filter((th) => ratio >= th - 1e-9);
    const already = fired.cats[id] || [];
    const fresh = crossed.filter((th) => !already.includes(th));
    if (fresh.length) {
      fired.cats[id] = [...new Set([...already, ...crossed])].sort((a, b2) => a - b2);
      changed = true;
      alerts.push({ kind: "threshold", id, label: c.label, color: c.color, pct: Math.max(...fresh), spent: s, budget: v, left: round2(v - s) });
    }
  });

  if (!changed) return { account, alerts: [], changed: false };
  return { account: { ...account, budget: { ...b, items, periodKey: per.key, fired } }, alerts, changed: true };
}
