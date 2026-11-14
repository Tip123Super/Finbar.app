// Modelli di categorie di Finbar: copiare categorie e percentuali tra conti o condividerle con altre persone.
// Un "modello" contiene SOLO nome, percentuale e colore di ogni categoria: mai saldi, transazioni, codici di sincronizzazione.
// Tutto avviene nel dispositivo (nessun server). Il codice arriva da fuori, quindi viene sempre validato.

import { rebaselineBudget } from "./budgetLogic";

export const MODEL_PREFIX = "FB1.";
export const MODEL_PARAM = "modello";
const MAX_CATS = 20;
const MAX_LABEL = 30;
const MAX_INPUT = 8000;
export const PALETTE = ["#F0B429", "#E85D4A", "#4E7FFF", "#B57EDC", "#00C2A8", "#2ECC71", "#8891A5", "#FF7A6B", "#4EC9FF", "#D4A94E"];

const rand4 = () => Math.random().toString(36).slice(2, 6);

// confronto tra nomi: senza maiuscole, accenti e spazi ai bordi
export function labelKey(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function toB64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64Url(s) {
  let b = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  const bin = atob(b);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

// categories: { id: { label, pct, color, ... } } -> codice testuale "FB1...."
export function encodeModel(categories) {
  const c = Object.values(categories || {}).map((x) => [String(x.label), Number(x.pct) || 0, String(x.color || "").replace("#", "")]);
  return MODEL_PREFIX + toB64Url(JSON.stringify({ v: 1, c }));
}

// porta le percentuali a una somma di esattamente 100 (interi, metodo del resto più grande);
// se già sommano a 100 le lascia com'erano (anche con decimali)
function normalizePcts(items) {
  const sum = items.reduce((s, c) => s + c.pct, 0);
  if (Math.abs(sum - 100) < 0.01) return items;
  if (sum <= 0) {
    const base = Math.floor(100 / items.length);
    let extra = 100 - base * items.length;
    return items.map((c) => ({ ...c, pct: base + (extra-- > 0 ? 1 : 0) }));
  }
  const scaled = items.map((c) => (c.pct * 100) / sum);
  const floors = scaled.map(Math.floor);
  let rest = 100 - floors.reduce((s, x) => s + x, 0);
  const order = scaled.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < order.length && rest > 0; k++, rest--) floors[order[k][1]] += 1;
  return items.map((c, i) => ({ ...c, pct: floors[i] }));
}

// accetta il codice da solo, il link intero o un messaggio che contiene il codice.
// Ritorna { ok: true, items: [{label, pct, color}] } oppure { ok: false }
export function decodeModel(input) {
  try {
    const text = String(input || "");
    if (!text || text.length > MAX_INPUT) return { ok: false };
    const m = text.match(/FB1\.[A-Za-z0-9_-]+/);
    if (!m) return { ok: false };
    const obj = JSON.parse(fromB64Url(m[0].slice(MODEL_PREFIX.length)));
    if (!obj || obj.v !== 1 || !Array.isArray(obj.c) || obj.c.length < 1 || obj.c.length > MAX_CATS) return { ok: false };
    const byKey = new Map();
    const items = [];
    for (const row of obj.c) {
      if (!Array.isArray(row)) return { ok: false };
      const label = String(row[0] ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, MAX_LABEL);
      const pctRaw = Number(row[1]);
      if (!label || !Number.isFinite(pctRaw)) return { ok: false };
      const pct = Math.min(100, Math.max(0, Math.round(pctRaw * 100) / 100));
      const hex = String(row[2] ?? "").replace("#", "");
      const color = /^[0-9a-fA-F]{6}$/.test(hex) ? "#" + hex.toUpperCase() : PALETTE[items.length % PALETTE.length];
      const key = labelKey(label);
      if (byKey.has(key)) { byKey.get(key).pct += pct; continue; } // nome ripetuto: si sommano le percentuali
      const it = { label, pct, color };
      byKey.set(key, it);
      items.push(it);
    }
    return { ok: true, items: normalizePcts(items) };
  } catch {
    return { ok: false };
  }
}

// categorie di un conto -> elenco di voci copiabili (mantiene gli id di origine)
export function itemsFromAccount(account) {
  return Object.entries(account.categories || {}).map(([id, c]) => ({ id, label: c.label, pct: c.pct, color: c.color }));
}

function makeId(label, used) {
  let slug = String(label).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) slug = "cat";
  let id = slug;
  while (used.has(id) || id === "cat") id = slug + "-" + rand4();
  return id;
}

// Calcola cosa succederebbe applicando `items` al conto, senza modificare nulla (serve per l'anteprima e gli avvisi).
export function planApply(account, items) {
  const used = new Set();
  const list = items.map((it) => {
    const id = it.id && !used.has(it.id) ? it.id : makeId(it.label, used);
    used.add(id);
    return { id, label: it.label, pct: it.pct, color: it.color };
  });
  const byLabel = new Map(list.map((c) => [labelKey(c.label), c.id]));
  // vecchio id -> nuovo id, se esiste una categoria con lo stesso nome
  const idMap = {};
  Object.entries(account.categories || {}).forEach(([oldId, c]) => {
    const hit = byLabel.get(labelKey(c.label));
    if (hit) idMap[oldId] = hit;
  });
  let recurringLost = 0;
  const recurring = (account.recurring || []).map((r) => {
    if (!r.category || r.category === "TUTTE") return r;
    if (idMap[r.category]) return { ...r, category: idMap[r.category] };
    recurringLost++;
    return { ...r, category: "TUTTE" };
  });
  let duesLost = 0;
  const dues = (account.dues || []).map((d) => {
    if (!d.category || d.category === "TUTTE") return d;
    if (idMap[d.category]) return { ...d, category: idMap[d.category] };
    duesLost++;
    return { ...d, category: "" };
  });
  const learnedCount = Object.keys(account.learnedTerms || {}).length;
  const undoLost = (account.transactions || []).filter((tx) => tx.breakdown).length;
  return { list, idMap, recurring, dues, recurringLost, duesLost, learnedCount, undoLost };
}

// Applica il piano: nuove categorie con saldi ricalcolati dal saldo totale (come "Salva categorie"),
// parole imparate azzerate, ricorrenze e scadenze riallineate. Dalle operazioni già registrate si toglie il
// dettaglio per categoria (breakdown): riferirebbe categorie che non esistono più, quindi non si potranno annullare.
export function applyPlan(account, plan) {
  const categories = {};
  plan.list.forEach((c) => {
    categories[c.id] = { label: c.label, pct: c.pct, color: c.color, balance: (account.totalBalance * c.pct) / 100 };
  });
  const next = {
    ...account,
    categories,
    learnedTerms: {},
    recurring: plan.recurring,
    dues: plan.dues,
    transactions: (account.transactions || []).map((tx) => {
      if (!tx.breakdown && tx.rawCategory === undefined) return tx;
      const { breakdown, rawCategory, ...rest } = tx;
      return rest;
    }),
  };
  // il budget segue le categorie con lo stesso nome; le altre perdono il budget
  if (account.budget) {
    const items = {};
    Object.entries(account.budget.items || {}).forEach(([oldId, v]) => { if (plan.idMap[oldId]) items[plan.idMap[oldId]] = v; });
    next.budget = rebaselineBudget({ ...next, budget: { ...account.budget, items } });
  }
  return next;
}
