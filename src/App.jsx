import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus, Trash2, Wallet, Send, Mic, MicOff, Camera, X, Check, ArrowLeftRight,
  Settings, MessageCircle, LayoutGrid, History, ChevronDown, Palette, TrendingUp, TrendingDown, Volume2, Copy, Cloud, RefreshCw, KeyRound, Languages,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, LineChart, Line, ReferenceLine, CartesianGrid } from "recharts";
import { scanReceiptWithTesseract } from "./receiptOcr";

// Icona "tre fulmini" per l'header: un fulmine grande al centro affiancato da due più piccoli, stessa forma ripetuta in scala diversa.
function LightningIcon({ size = 18, color = "currentColor" }) {
  const bolt = "13,2 3,14 12,14 11,22 21,10 12,10 13,2";
  return (
    <svg width={size * (40 / 24)} height={size} viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0,6) scale(0.5)"><polygon points={bolt} fill={color} /></g>
      <g transform="translate(9.2,1.2) scale(0.9)"><polygon points={bolt} fill={color} /></g>
      <g transform="translate(28,6) scale(0.5)"><polygon points={bolt} fill={color} /></g>
    </svg>
  );
}

const ACCOUNTS_KEY = "finex:accounts";
const THEME_KEY = "finex:theme";
const CHAT_KEY = "finex:chat";
const SYNC_CODE_KEY = "finex:sync-code";
const LANGUAGE_KEY = "finex:language";
const ONBOARDING_KEY = "finex:onboarding-seen";

// ---- Supabase: sincronizzazione tra dispositivi tramite codice ----
const SUPABASE_URL = "https://vhlneufpkwzbuapwlmap.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_E3zzKC2RVcozmZunXXZ1Ow_nQRf6UOn";

function generateSyncCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // niente 0/O/1/I/L, per evitare ambiguità quando lo si trascrive
  const bytes = new Uint8Array(12);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  const part = (arr) => Array.from(arr, (b) => chars[b % chars.length]).join("");
  return `FNX-${part(bytes.slice(0, 4))}-${part(bytes.slice(4, 8))}-${part(bytes.slice(8, 12))}`;
}
async function supabaseGetWallet(code) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/finex_get_wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ p_code: code }),
  });
  if (!res.ok) throw new Error("sync fetch failed");
  return res.json();
}
async function supabaseSaveWallet(code, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/finex_save_wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ p_code: code, p_data: data }),
  });
  if (!res.ok) throw new Error("sync save failed");
}

const DEFAULT_CATEGORIES = [
  { id: "cibo", label: "Cibo", pct: 25, color: "#F0B429" },
  { id: "casa", label: "Casa", pct: 20, color: "#E85D4A" },
  { id: "trasporti", label: "Trasporti", pct: 15, color: "#4E7FFF" },
  { id: "svago", label: "Svago", pct: 15, color: "#B57EDC" },
  { id: "salute", label: "Salute", pct: 10, color: "#00C2A8" },
  { id: "risparmi", label: "Risparmi", pct: 10, color: "#2ECC71" },
  { id: "altro", label: "Altro", pct: 5, color: "#8891A5" },
];

const THEMES = {
  indaco: { name: "Indaco", accent: "#00C2A8", accent2: "#E8C77A", bg: "#10142A", bgGrad: "radial-gradient(ellipse 900px 500px at 50% -10%, rgba(0,194,168,0.10), transparent), #10142A" , isLight: false, surface: "#1B2035", surfaceBorder: "#262C42", surfaceAlt: "#20263D", surfaceAltBorder: "#2C3350", surfaceRow: "#161B30", surfaceDeep: "#0E1224", modalBg: "#12162A", modalBorder: "#232945", textStrong: "#E9ECF5", textPrimary: "#C6CCDB", textMuted: "#9AA3B8", onAccent: "#0A0D1A" },
  ambra: { name: "Ambra", accent: "#F0B429", accent2: "#B3261E", bg: "#1B140A", bgGrad: "radial-gradient(ellipse 900px 500px at 50% -10%, rgba(240,180,41,0.10), transparent), #1B140A" , isLight: false, surface: "#1B2035", surfaceBorder: "#262C42", surfaceAlt: "#20263D", surfaceAltBorder: "#2C3350", surfaceRow: "#161B30", surfaceDeep: "#0E1224", modalBg: "#12162A", modalBorder: "#232945", textStrong: "#E9ECF5", textPrimary: "#C6CCDB", textMuted: "#9AA3B8", onAccent: "#0A0D1A" },
  ametista: { name: "Ametista", accent: "#B57EDC", accent2: "#E0C3FF", bg: "#161029", bgGrad: "radial-gradient(ellipse 900px 500px at 50% -10%, rgba(181,126,220,0.10), transparent), #161029" , isLight: false, surface: "#1B2035", surfaceBorder: "#262C42", surfaceAlt: "#20263D", surfaceAltBorder: "#2C3350", surfaceRow: "#161B30", surfaceDeep: "#0E1224", modalBg: "#12162A", modalBorder: "#232945", textStrong: "#E9ECF5", textPrimary: "#C6CCDB", textMuted: "#9AA3B8", onAccent: "#0A0D1A" },
  oceano: { name: "Oceano", accent: "#4E9FFF", accent2: "#2ECC71", bg: "#0B1626", bgGrad: "radial-gradient(ellipse 900px 500px at 50% -10%, rgba(78,159,255,0.10), transparent), #0B1626" , isLight: false, surface: "#1B2035", surfaceBorder: "#262C42", surfaceAlt: "#20263D", surfaceAltBorder: "#2C3350", surfaceRow: "#161B30", surfaceDeep: "#0E1224", modalBg: "#12162A", modalBorder: "#232945", textStrong: "#E9ECF5", textPrimary: "#C6CCDB", textMuted: "#9AA3B8", onAccent: "#0A0D1A" },
  rubino: { name: "Rubino", accent: "#C81E4A", accent2: "#FF6FA5", bg: "#1A0B12", bgGrad: "radial-gradient(ellipse 900px 500px at 50% -10%, rgba(200,30,74,0.14), transparent), #1A0B12" , isLight: false, surface: "#1B2035", surfaceBorder: "#262C42", surfaceAlt: "#20263D", surfaceAltBorder: "#2C3350", surfaceRow: "#161B30", surfaceDeep: "#0E1224", modalBg: "#12162A", modalBorder: "#232945", textStrong: "#E9ECF5", textPrimary: "#C6CCDB", textMuted: "#9AA3B8", onAccent: "#0A0D1A" },
  arancione: { name: "Arancione", accent: "#FF8A3D", accent2: "#FFFFFF", bg: "#1E140A", bgGrad: "radial-gradient(ellipse 900px 500px at 50% -10%, rgba(255,138,61,0.14), transparent), #1E140A" , isLight: false, surface: "#1B2035", surfaceBorder: "#262C42", surfaceAlt: "#20263D", surfaceAltBorder: "#2C3350", surfaceRow: "#161B30", surfaceDeep: "#0E1224", modalBg: "#12162A", modalBorder: "#232945", textStrong: "#E9ECF5", textPrimary: "#C6CCDB", textMuted: "#9AA3B8", onAccent: "#0A0D1A" },
  smeraldo: { name: "Smeraldo", accent: "#1FA97E", accent2: "#A8E6C1", bg: "#081C16", bgGrad: "radial-gradient(ellipse 900px 500px at 50% -10%, rgba(31,169,126,0.14), transparent), #081C16" , isLight: false, surface: "#1B2035", surfaceBorder: "#262C42", surfaceAlt: "#20263D", surfaceAltBorder: "#2C3350", surfaceRow: "#161B30", surfaceDeep: "#0E1224", modalBg: "#12162A", modalBorder: "#232945", textStrong: "#E9ECF5", textPrimary: "#C6CCDB", textMuted: "#9AA3B8", onAccent: "#0A0D1A" },
  cobalto: { name: "Cobalto", accent: "#3D6BFF", accent2: "#D7E3FF", bg: "#0A1030", bgGrad: "radial-gradient(ellipse 900px 500px at 50% -10%, rgba(61,107,255,0.14), transparent), #0A1030" , isLight: false, surface: "#1B2035", surfaceBorder: "#262C42", surfaceAlt: "#20263D", surfaceAltBorder: "#2C3350", surfaceRow: "#161B30", surfaceDeep: "#0E1224", modalBg: "#12162A", modalBorder: "#232945", textStrong: "#E9ECF5", textPrimary: "#C6CCDB", textMuted: "#9AA3B8", onAccent: "#0A0D1A" },
  biancoenero: { name: "Bianco e Nero", isLight: true, accent: "#111111", accent2: "#5B5B5B", bg: "#FFFFFF", bgGrad: "radial-gradient(ellipse 900px 500px at 50% -10%, rgba(0,0,0,0.05), transparent), #FFFFFF", surface: "#F2F2F2", surfaceBorder: "#DCDCDC", surfaceAlt: "#EAEAEA", surfaceAltBorder: "#D0D0D0", surfaceRow: "#F5F5F5", surfaceDeep: "#EDEDED", modalBg: "#FFFFFF", modalBorder: "#E0E0E0", textStrong: "#111111", textPrimary: "#2B2B2B", textMuted: "#767676", onAccent: "#FFFFFF" },
  verdechiaro: { name: "Verde Chiaro", isLight: true, accent: "#3FAE73", accent2: "#8FD9AE", bg: "#FFFFFF", bgGrad: "radial-gradient(ellipse 900px 500px at 50% -10%, rgba(63,174,115,0.12), transparent), #FFFFFF", surface: "#F1FBF5", surfaceBorder: "#D3EEDD", surfaceAlt: "#E7F8EE", surfaceAltBorder: "#C9E9D4", surfaceRow: "#F5FCF8", surfaceDeep: "#E9F7EF", modalBg: "#FFFFFF", modalBorder: "#D8EFE0", textStrong: "#123322", textPrimary: "#294B3A", textMuted: "#6C8D7B", onAccent: "#FFFFFF" },
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const CURRENCIES = {
  EUR: { symbol: "€", locale: "it-IT", label: "Euro (€)" },
  USD: { symbol: "$", locale: "en-US", label: "US Dollar ($)" },
  GBP: { symbol: "£", locale: "en-GB", label: "British Pound (£)" },
  CNY: { symbol: "¥", locale: "zh-CN", label: "人民币 · Yuan (¥)" },
  RUB: { symbol: "₽", locale: "ru-RU", label: "Российский рубль (₽)" },
  MDL: { symbol: "lei", locale: "ro-MD", label: "Leu moldovenesc (lei)" },
};
const currency = (n, code = "EUR") => {
  const c = CURRENCIES[code] || CURRENCIES.EUR;
  try {
    return new Intl.NumberFormat(c.locale, { style: "currency", currency: code }).format(n || 0);
  } catch {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);
  }
};
const todayISO = () => new Date().toISOString().slice(0, 10);

// Spende da una categoria specifica. Se la categoria non ha abbastanza saldo,
// la porta esattamente a 0 e distribuisce il resto (l'eccedenza) sulle ALTRE
// categorie, in proporzione alle loro percentuali — così nessuna categoria
// va da sola in negativo, il "buco" viene condiviso da tutto il budget.
function spendFromCategory(acc, category, amount) {
  const cat = acc.categories[category];
  const available = cat.balance;
  if (available - amount >= 0) {
    cat.balance = available - amount;
    return;
  }
  const overflow = amount - available; // quanto manca, tenendo conto di un eventuale saldo già negativo
  cat.balance = 0;
  const others = Object.keys(acc.categories).filter((c) => c !== category);
  if (others.length === 0) {
    cat.balance -= overflow; // nessuna altra categoria: non c'è dove distribuirlo
    return;
  }
  const totalPct = others.reduce((s, c) => s + (acc.categories[c].pct || 0), 0);
  others.forEach((c) => {
    const weight = totalPct > 0 ? acc.categories[c].pct / totalPct : 1 / others.length;
    acc.categories[c].balance -= overflow * weight;
  });
}

function newAccount(name, initialBalance, currencyCode) {
  const cats = {};
  DEFAULT_CATEGORIES.forEach((c) => {
    cats[c.id] = { label: c.label, pct: c.pct, color: c.color, balance: (initialBalance * c.pct) / 100 };
  });
  return {
    id: uid(),
    name,
    currency: currencyCode || "EUR",
    totalBalance: initialBalance,
    categories: cats,
    recurring: [],
    learnedTerms: {}, // parole imparate dalle scelte manuali dell'utente: { parola: categoryId }
    customTypeWords: {}, // parole insegnate esplicitamente dall'utente (es. "vinto=guadagno"): { parola: "entrata"|"spesa" }
    transactions: initialBalance
      ? [{ id: uid(), type: "init", amount: initialBalance, category: "Saldo iniziale", note: "", date: todayISO() }]
      : [],
  };
}

function applyTransaction(account, { transactionType, amount, category, note }) {
  const acc = JSON.parse(JSON.stringify(account));
  const cats = category === "TUTTE" ? Object.keys(acc.categories) : [category];
  const validCats = cats.filter((c) => acc.categories[c]);
  if (validCats.length === 0) return { acc: account, ok: false };

  if (category === "TUTTE") {
    // Normalize by the ACTUAL sum of the percentages (not an assumed 100),
    // so the split across categories always adds up exactly to `amount`
    // even if the user's percentages don't total 100%.
    const totalPct = validCats.reduce((s, c) => s + (acc.categories[c].pct || 0), 0);
    validCats.forEach((c) => {
      const weight = totalPct > 0 ? acc.categories[c].pct / totalPct : 1 / validCats.length;
      const share = amount * weight;
      acc.categories[c].balance += transactionType === "spesa" ? -share : share;
    });
  } else if (transactionType === "spesa") {
    spendFromCategory(acc, category, amount);
  } else {
    acc.categories[category].balance += amount;
  }
  acc.totalBalance += transactionType === "spesa" ? -amount : amount;
  acc.transactions.unshift({
    id: uid(), type: transactionType, amount, category: category === "TUTTE" ? "Tutte le categorie" : acc.categories[category].label, note: note || "", date: todayISO(),
  });
  return { acc, ok: true };
}

// ---- recurring income/expenses (stipendi, pagette, abbonamenti…) ----
const RECURRING_KINDS = { biglietto: "Biglietto/viaggio", abbonamento: "Abbonamento", altro: "Altro" };
function nextOccurrenceDate(rule, fromDate) {
  const d = new Date(fromDate + "T00:00:00");
  if (rule.frequency === "weekly") {
    d.setDate(d.getDate() + 7);
  } else if (rule.frequency === "yearly") {
    const anchor = new Date(rule.startDate + "T00:00:00");
    d.setFullYear(d.getFullYear() + 1);
    d.setMonth(anchor.getMonth());
    const lastDay = new Date(d.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(anchor.getDate(), lastDay));
  } else {
    const anchorDay = new Date(rule.startDate + "T00:00:00").getDate();
    d.setMonth(d.getMonth() + 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(anchorDay, lastDay));
  }
  return d.toISOString().slice(0, 10);
}
function dueOccurrences(rule, todayStr) {
  const dates = [];
  let cursor = rule.lastAppliedDate;
  let next = cursor ? nextOccurrenceDate(rule, cursor) : rule.startDate;
  let guard = 0;
  while (next <= todayStr && guard < 60) {
    dates.push(next);
    cursor = next;
    next = nextOccurrenceDate(rule, cursor);
    guard++;
  }
  return dates;
}
function processRecurringForAccount(account, todayStr) {
  let acc = JSON.parse(JSON.stringify(account));
  if (!acc.recurring) acc.recurring = [];
  let changed = false;
  acc.recurring = acc.recurring.map((rule) => {
    const dates = dueOccurrences(rule, todayStr);
    if (dates.length === 0) return rule;
    changed = true;
    const txType = rule.transactionType || "entrata";
    dates.forEach((d) => {
      const cats = rule.category === "TUTTE" ? Object.keys(acc.categories) : [rule.category];
      const validCats = cats.filter((c) => acc.categories[c]);
      if (validCats.length === 0) return;
      const signedAmount = txType === "spesa" ? -rule.amount : rule.amount;
      if (rule.category === "TUTTE") {
        const totalPct = validCats.reduce((s, c) => s + (acc.categories[c].pct || 0), 0);
        validCats.forEach((c) => {
          const weight = totalPct > 0 ? acc.categories[c].pct / totalPct : 1 / validCats.length;
          acc.categories[c].balance += signedAmount * weight;
        });
      } else if (txType === "spesa") {
        spendFromCategory(acc, rule.category, rule.amount);
      } else {
        acc.categories[rule.category].balance += rule.amount;
      }
      acc.totalBalance += signedAmount;
      acc.transactions.unshift({
        id: uid(), type: txType,
        category: rule.category === "TUTTE" ? "Tutte le categorie" : acc.categories[rule.category]?.label || rule.category,
        amount: rule.amount,
        note: `Automatico · ${rule.kind ? RECURRING_KINDS[rule.kind] + " · " : ""}${rule.label}`,
        date: d,
      });
    });
    return { ...rule, lastAppliedDate: dates[dates.length - 1] };
  });
  return { acc, changed };
}
function processAllRecurring(accounts) {
  const todayStr = todayISO();
  let changed = false;
  const next = {};
  Object.values(accounts).forEach((a) => {
    const { acc, changed: c } = processRecurringForAccount(a, todayStr);
    next[a.id] = acc;
    if (c) changed = true;
  });
  return { accounts: next, changed };
}

const LANGUAGES = { it: "Italiano", en: "English", ro: "Română", ru: "Русский", zh: "中文" };
const LANGUAGE_NAMES_FOR_AI = { it: "Italian", en: "English", ro: "Romanian", ru: "Russian", zh: "Chinese (Simplified)" };

function buildChatSystemPrompt(account, lang) {
  const catList = Object.entries(account.categories).map(([id, c]) => `${id} (${c.label}, ${c.pct}%)`).join(", ");
  return `IMPORTANT: Always write every user-facing text field ("text", "question", "note") in ${LANGUAGE_NAMES_FOR_AI[lang] || "Italian"}, regardless of what language the user writes in.

Sei l'assistente finanziario di Finbar. Account attivo: "${account.name}", saldo €${account.totalBalance.toFixed(2)}.
Categorie disponibili: ${catList}. Puoi usare "TUTTE" come categoria per dividere un importo su tutte in base alle percentuali.

Analizza il messaggio dell'utente e rispondi SEMPRE E SOLO con un JSON su una riga, in uno di questi 3 formati:
- Transazione riconosciuta: {"type":"transaction","amount":10,"category":"cibo","transactionType":"spesa","note":"breve nota opzionale"}
- Manca un dettaglio essenziale: {"type":"question","question":"testo della domanda"}
- Chiacchiera, domanda generica, richiesta di analisi: {"type":"response","text":"testo della risposta"}

Non inventare mai importi o categorie non menzionati dall'utente. "transactionType" è "spesa" o "entrata" (usa sempre questi due valori interni, indipendentemente dalla lingua di risposta).`;
}

function buildReceiptPrompt(account, lang) {
  const catList = Object.entries(account.categories).map(([id, c]) => `${id} (${c.label})`).join(", ");
  return `IMPORTANT: Write the "note" field in ${LANGUAGE_NAMES_FOR_AI[lang] || "Italian"}.

Analizza l'immagine di uno scontrino o ricevuta. Estrai UNA transazione. Categorie disponibili: ${catList}.
Rispondi SOLO con JSON su una riga: {"amount":12.5,"category":"cibo","note":"nome negozio o breve descrizione","transactionType":"spesa"}
Se non riesci a leggere un importo con certezza, rispondi {"error":"breve motivo"}. Non inventare mai dati che non vedi nell'immagine.`;
}

// ---- traduzioni per i messaggi generati localmente (senza AI) ----
const T = {
  it: {
    expense: "Uscita", income: "Entrata",
    txRegistered: (label, amt, note, cur) => `${label} registrata: ${currency(amt, cur)}${note ? " · " + note : ""}`,
    txFailed: "Non sono riuscito a registrarla, riprova.",
    needCategory: (label, amt, cur) => `Ho capito ${label === "Uscita" ? "un'uscita" : "un'entrata"} di ${currency(amt, cur)}, ma non la categoria. Scegline una qui sotto:`,
    balanceAnswer: (name, amt, cur) => `Il saldo di ${name} è ${currency(amt, cur)}.`,
    categoryBalanceAnswer: (amt, cat, cur) => `Hai ${currency(amt, cur)} nella categoria ${cat}.`,
    spentAnswer: (cat, amt, period, cur) => `Hai speso${cat ? " in " + cat : ""} ${currency(amt, cur)} ${period}.`,
    earnedAnswer: (cat, amt, period, cur) => `Hai guadagnato${cat ? " in " + cat : ""} ${currency(amt, cur)} ${period}.`,
    periods: { today: "oggi", week: "questa settimana", month: "questo mese", lastMonth: "il mese scorso", year: "quest'anno", total: "in totale" },
    chooseCategory: "Scegli una categoria", splitAll: "Dividi su tutte le categorie", dividedAll: "divisa su tutte le categorie", cancel: "Annulla",
    savedTx: (label, amt, cat, cur) => `${label} registrata: ${currency(amt, cur)} · ${cat}`,
    placeholder: "Scrivi o parla…", listening: "Ti ascolto…", thinking: "sto pensando…",
    receiptRead: "📷 Scontrino letto", confirm: "Conferma",
    wordTaughtType: (word, typeLabel) => `Fatto! D'ora in poi "${word}" lo tratterò come ${typeLabel.toLowerCase()}.`,
    wordTaughtCategory: (word, catLabel) => `Fatto! D'ora in poi "${word}" lo collegherò alla categoria ${catLabel}.`,
    wordTeachUnknown: (meaning) => `Non ho capito a cosa collegare "${meaning}". Prova con "entrata", "uscita" o il nome di una categoria esistente.`,
  },
  en: {
    expense: "Expense", income: "Income",
    txRegistered: (label, amt, note, cur) => `${label} recorded: ${currency(amt, cur)}${note ? " · " + note : ""}`,
    txFailed: "I couldn't record it, please try again.",
    needCategory: (label, amt, cur) => `I understood ${label === "Expense" ? "an expense" : "an income"} of ${currency(amt, cur)}, but not the category. Pick one below:`,
    balanceAnswer: (name, amt, cur) => `${name}'s balance is ${currency(amt, cur)}.`,
    categoryBalanceAnswer: (amt, cat, cur) => `You have ${currency(amt, cur)} in the ${cat} category.`,
    spentAnswer: (cat, amt, period, cur) => `You spent${cat ? " on " + cat : ""} ${currency(amt, cur)} ${period}.`,
    earnedAnswer: (cat, amt, period, cur) => `You earned${cat ? " from " + cat : ""} ${currency(amt, cur)} ${period}.`,
    periods: { today: "today", week: "this week", month: "this month", lastMonth: "last month", year: "this year", total: "in total" },
    chooseCategory: "Choose a category", splitAll: "Split across all categories", dividedAll: "split across all categories", cancel: "Cancel",
    savedTx: (label, amt, cat, cur) => `${label} recorded: ${currency(amt, cur)} · ${cat}`,
    placeholder: "Type or speak…", listening: "Listening…", thinking: "thinking…",
    receiptRead: "📷 Receipt read", confirm: "Confirm",
    wordTaughtType: (word, typeLabel) => `Got it! From now on I'll treat "${word}" as ${typeLabel.toLowerCase()}.`,
    wordTaughtCategory: (word, catLabel) => `Got it! From now on I'll link "${word}" to the ${catLabel} category.`,
    wordTeachUnknown: (meaning) => `I didn't understand what to link "${meaning}" to. Try "income", "expense" or an existing category name.`,
  },
  ro: {
    expense: "Cheltuială", income: "Venit",
    txRegistered: (label, amt, note, cur) => `${label} înregistrată: ${currency(amt, cur)}${note ? " · " + note : ""}`,
    txFailed: "Nu am putut înregistra, încearcă din nou.",
    needCategory: (label, amt, cur) => `Am înțeles ${label === "Cheltuială" ? "o cheltuială" : "un venit"} de ${currency(amt, cur)}, dar nu categoria. Alege una mai jos:`,
    balanceAnswer: (name, amt, cur) => `Soldul contului ${name} este ${currency(amt, cur)}.`,
    categoryBalanceAnswer: (amt, cat, cur) => `Ai ${currency(amt, cur)} în categoria ${cat}.`,
    spentAnswer: (cat, amt, period, cur) => `Ai cheltuit${cat ? " la " + cat : ""} ${currency(amt, cur)} ${period}.`,
    earnedAnswer: (cat, amt, period, cur) => `Ai câștigat${cat ? " din " + cat : ""} ${currency(amt, cur)} ${period}.`,
    periods: { today: "azi", week: "săptămâna aceasta", month: "luna aceasta", lastMonth: "luna trecută", year: "anul acesta", total: "în total" },
    chooseCategory: "Alege o categorie", splitAll: "Împarte pe toate categoriile", dividedAll: "împărțită pe toate categoriile", cancel: "Anulează",
    savedTx: (label, amt, cat, cur) => `${label} înregistrată: ${currency(amt, cur)} · ${cat}`,
    placeholder: "Scrie sau vorbește…", listening: "Te ascult…", thinking: "mă gândesc…",
    receiptRead: "📷 Bon citit", confirm: "Confirmă",
    wordTaughtType: (word, typeLabel) => `Am înțeles! De acum voi trata "${word}" ca ${typeLabel.toLowerCase()}.`,
    wordTaughtCategory: (word, catLabel) => `Am înțeles! De acum voi asocia "${word}" cu categoria ${catLabel}.`,
    wordTeachUnknown: (meaning) => `Nu am înțeles cu ce să asociez "${meaning}". Încearcă "venit", "cheltuială" sau numele unei categorii existente.`,
  },
  ru: {
    expense: "Расход", income: "Доход",
    txRegistered: (label, amt, note, cur) => `${label} записан: ${currency(amt, cur)}${note ? " · " + note : ""}`,
    txFailed: "Не удалось записать, попробуйте ещё раз.",
    needCategory: (label, amt, cur) => `Я понял ${label === "Расход" ? "расход" : "доход"} на ${currency(amt, cur)}, но не категорию. Выберите ниже:`,
    balanceAnswer: (name, amt, cur) => `Баланс «${name}»: ${currency(amt, cur)}.`,
    categoryBalanceAnswer: (amt, cat, cur) => `У вас ${currency(amt, cur)} в категории ${cat}.`,
    spentAnswer: (cat, amt, period, cur) => `Вы потратили${cat ? " на " + cat : ""} ${currency(amt, cur)} ${period}.`,
    earnedAnswer: (cat, amt, period, cur) => `Вы заработали${cat ? " с " + cat : ""} ${currency(amt, cur)} ${period}.`,
    periods: { today: "сегодня", week: "на этой неделе", month: "в этом месяце", lastMonth: "в прошлом месяце", year: "в этом году", total: "всего" },
    chooseCategory: "Выберите категорию", splitAll: "Разделить по всем категориям", dividedAll: "разделено по всем категориям", cancel: "Отмена",
    savedTx: (label, amt, cat, cur) => `${label} записан: ${currency(amt, cur)} · ${cat}`,
    placeholder: "Пишите или говорите…", listening: "Слушаю…", thinking: "думаю…",
    receiptRead: "📷 Чек прочитан", confirm: "Подтвердить",
    wordTaughtType: (word, typeLabel) => `明白了！从现在起我会把"${word}"当作${typeLabel}处理。`,
    wordTaughtCategory: (word, catLabel) => `明白了！从现在起我会把"${word}"关联到"${catLabel}"分类。`,
    wordTeachUnknown: (meaning) => `我不明白该把"${meaning}"关联到什么。请尝试"收入"、"支出"或一个已有的分类名称。`,
  },
  zh: {
    expense: "支出", income: "收入",
    txRegistered: (label, amt, note, cur) => `${label}已记录：${currency(amt, cur)}${note ? " · " + note : ""}`,
    txFailed: "记录失败，请重试。",
    needCategory: (label, amt, cur) => `我识别到一笔${label === "支出" ? "支出" : "收入"} ${currency(amt, cur)}，但不知道分类。请选择：`,
    balanceAnswer: (name, amt, cur) => `${name}的余额是 ${currency(amt, cur)}。`,
    categoryBalanceAnswer: (amt, cat, cur) => `你在"${cat}"分类中有 ${currency(amt, cur)}。`,
    spentAnswer: (cat, amt, period, cur) => `你${period}${cat ? "在" + cat : ""}花了 ${currency(amt, cur)}。`,
    earnedAnswer: (cat, amt, period, cur) => `你${period}${cat ? "从" + cat : ""}赚了 ${currency(amt, cur)}。`,
    periods: { today: "今天", week: "这周", month: "这个月", lastMonth: "上个月", year: "今年", total: "总共" },
    chooseCategory: "选择一个分类", splitAll: "平均分配到所有分类", dividedAll: "已分配到所有分类", cancel: "取消",
    savedTx: (label, amt, cat, cur) => `${label}已记录：${currency(amt, cur)} · ${cat}`,
    placeholder: "输入或说话…", listening: "正在聆听…", thinking: "思考中…",
    receiptRead: "📷 已读取小票", confirm: "确认",
  },
};

// ---- traduzioni per tutta l'interfaccia fissa (tab, pulsanti, etichette, modali) ----
const UI = {
  it: {
    tabDashboard: "Dashboard", tabChat: "Chat", tabHistory: "Storico",
    totalBalance: "Saldo totale", byCategory: "Distribuzione per categoria", recentTx: "Ultime transazioni",
    btnEntry: "Voce", btnTransfer: "Trasferisci",
    chatEmpty1: "Prova:", chatEmptyExample: '"ho speso 15 euro in cibo"', chatEmpty2: "o scatta una foto a uno scontrino 📷",
    historyEmpty: "Nessuna transazione ancora.",
    yourAccounts: "I tuoi conti", newAccountBtn: "Nuovo conto",
    newAccountTitle: "Nuovo conto", restoreTitle: "Recupera i tuoi dati",
    accountName: "Nome conto", accountNamePh: "es. Personale", initialBalance: "Saldo iniziale", currencyLabel: "Valuta", createAccountBtn: "Crea conto",
    haveCode: "Hai già un codice di sincronizzazione?", recoverData: "Recupera i tuoi dati",
    restoreDesc: "Inserisci il codice che ti eri segnato da un altro dispositivo (es.", restoreBtn: "Recupera i miei dati", restoringBtn: "Recupero…",
    orCreateNew: "Oppure", createNewAccount: "crea un conto nuovo",
    transferTitle: "Trasferisci tra conti", from: "Da", to: "A", amount: "Importo", transferBtn: "Trasferisci",
    newEntryTitle: "Nuova voce", category: "Categoria", note: "Nota (opzionale)", notePh: "es. supermercato", save: "Salva", date: "Data",
    settingsTitle: "Impostazioni",
    syncCodeTitle: "Codice di sincronizzazione",
    syncCodeDesc: "Usa questo codice su un altro dispositivo per ritrovare gli stessi dati. Conservalo come una password: chi lo conosce può leggere e modificare questo portafoglio.",
    syncedLabel: "Sincronizzato su Supabase", syncingLabel: "Sincronizzazione…", syncErrorLabel: "Sincronizzazione non riuscita (dati salvi comunque in locale)", syncIdleLabel: "In attesa della prima sincronizzazione",
    copyFallback: 'Se il tasto non copia, tocca il campo, tieni premuto e scegli "Copia" dal menu del telefono.',
    haveCodeOtherDevice: "Hai già un codice da un altro dispositivo? Inseriscilo qui per recuperare i tuoi dati (sostituisce quelli locali).",
    recoverBtn: "Recupera",
    languageTitle: "Lingua", themeTitle: "Tema colore", currencyTitle: "Valuta del conto",
    monthlyTrend: "Andamento mensile", vsLastMonth: "vs mese scorso", netMonthly: "Netto mensile", threshold20: "Soglia +20%",
    categoriesTitle: "Categorie", total: "Totale", learnedWords: "Parole imparate", customWords: "Parole personalizzate",
    obNext: "Avanti", obSkip: "Salta", obStart: "Inizia",
    newCategoryPh: "Nuova categoria…",
    recurringTitle: "Entrate e uscite automatiche · stipendi, pagette, abbonamenti…", recurringEmpty: "Nessuna voce ricorrente impostata.",
    weekly: "Ogni settimana", monthly: "Ogni mese", yearly: "Ogni anno", lastRun: "ultima", notActiveYet: "non ancora attiva",
    expenseType: "Uscita", incomeType: "Entrata", kindSub: "Abbonamento", kindTicket: "Biglietto / viaggio (es. treno, bus giornaliero)", kindOther: "Altro",
    recurringNamePh: "es. Abbonamento Claude Pro, Netflix…", recurringNamePhIncome: "es. Stipendio, Pagetta",
    amountPh: "Importo", freqWeekly: "Settimanale", freqMonthly: "Mensile", freqYearly: "Annuale",
    allCategoriesSplit: "Tutte (dividi per %)", addRecurringBtn: "+ Aggiungi voce automatica",
    deleteAccount: "Elimina questo conto",
    scanning: "Scansiono lo scontrino…", errSave: "Non sono riuscito a salvare i dati.", errAI: "Non sono riuscito a contattare l'AI.",
  },
  en: {
    tabDashboard: "Dashboard", tabChat: "Chat", tabHistory: "History",
    totalBalance: "Total balance", byCategory: "Breakdown by category", recentTx: "Recent transactions",
    btnEntry: "Entry", btnTransfer: "Transfer",
    chatEmpty1: "Try:", chatEmptyExample: '"I spent $15 on food"', chatEmpty2: "or snap a photo of a receipt 📷",
    historyEmpty: "No transactions yet.",
    yourAccounts: "Your accounts", newAccountBtn: "New account",
    newAccountTitle: "New account", restoreTitle: "Recover your data",
    accountName: "Account name", accountNamePh: "e.g. Personal", initialBalance: "Initial balance", currencyLabel: "Currency", createAccountBtn: "Create account",
    haveCode: "Already have a sync code?", recoverData: "Recover your data",
    restoreDesc: "Enter the code you saved from another device (e.g.", restoreBtn: "Recover my data", restoringBtn: "Recovering…",
    orCreateNew: "Or", createNewAccount: "create a new account",
    transferTitle: "Transfer between accounts", from: "From", to: "To", amount: "Amount", transferBtn: "Transfer",
    newEntryTitle: "New entry", category: "Category", note: "Note (optional)", notePh: "e.g. supermarket", save: "Save", date: "Date",
    settingsTitle: "Settings",
    syncCodeTitle: "Sync code",
    syncCodeDesc: "Use this code on another device to find the same data. Keep it like a password: whoever knows it can read and edit this wallet.",
    syncedLabel: "Synced with Supabase", syncingLabel: "Syncing…", syncErrorLabel: "Sync failed (data is still saved locally)", syncIdleLabel: "Waiting for first sync",
    copyFallback: 'If the button doesn\'t copy, tap the field, hold, and choose "Copy" from your phone\'s menu.',
    haveCodeOtherDevice: "Already have a code from another device? Enter it here to recover your data (replaces local data).",
    recoverBtn: "Recover",
    languageTitle: "Language", themeTitle: "Color theme", currencyTitle: "Account currency",
    monthlyTrend: "Monthly trend", vsLastMonth: "vs last month", netMonthly: "Monthly net", threshold20: "+20% threshold",
    categoriesTitle: "Categories", total: "Total", learnedWords: "Learned words", customWords: "Custom words",
    obNext: "Next", obSkip: "Skip", obStart: "Get started",
    newCategoryPh: "New category…",
    recurringTitle: "Automatic income & expenses · salary, allowance, subscriptions…", recurringEmpty: "No recurring entries set.",
    weekly: "Every week", monthly: "Every month", yearly: "Every year", lastRun: "last", notActiveYet: "not active yet",
    expenseType: "Expense", incomeType: "Income", kindSub: "Subscription", kindTicket: "Ticket / travel (e.g. train, daily bus)", kindOther: "Other",
    recurringNamePh: "e.g. Claude Pro subscription, Netflix…", recurringNamePhIncome: "e.g. Salary, Allowance",
    amountPh: "Amount", freqWeekly: "Weekly", freqMonthly: "Monthly", freqYearly: "Yearly",
    allCategoriesSplit: "All (split by %)", addRecurringBtn: "+ Add automatic entry",
    deleteAccount: "Delete this account",
    scanning: "Scanning receipt…", errSave: "I couldn't save the data.", errAI: "I couldn't reach the AI.",
  },
  ro: {
    tabDashboard: "Panou", tabChat: "Chat", tabHistory: "Istoric",
    totalBalance: "Sold total", byCategory: "Distribuție pe categorii", recentTx: "Tranzacții recente",
    btnEntry: "Adaugă", btnTransfer: "Transferă",
    chatEmpty1: "Încearcă:", chatEmptyExample: '"am cheltuit 15 lei pe mâncare"', chatEmpty2: "sau fă o poză unui bon 📷",
    historyEmpty: "Nicio tranzacție încă.",
    yourAccounts: "Conturile tale", newAccountBtn: "Cont nou",
    newAccountTitle: "Cont nou", restoreTitle: "Recuperează-ți datele",
    accountName: "Numele contului", accountNamePh: "ex. Personal", initialBalance: "Sold inițial", currencyLabel: "Monedă", createAccountBtn: "Creează cont",
    haveCode: "Ai deja un cod de sincronizare?", recoverData: "Recuperează-ți datele",
    restoreDesc: "Introdu codul notat de pe alt dispozitiv (ex.", restoreBtn: "Recuperează datele", restoringBtn: "Se recuperează…",
    orCreateNew: "Sau", createNewAccount: "creează un cont nou",
    transferTitle: "Transferă între conturi", from: "Din", to: "În", amount: "Sumă", transferBtn: "Transferă",
    newEntryTitle: "Înregistrare nouă", category: "Categorie", note: "Notă (opțional)", notePh: "ex. supermarket", save: "Salvează", date: "Dată",
    settingsTitle: "Setări",
    syncCodeTitle: "Cod de sincronizare",
    syncCodeDesc: "Folosește acest cod pe alt dispozitiv pentru a regăsi aceleași date. Păstrează-l ca pe o parolă: oricine îl știe poate citi și modifica acest portofel.",
    syncedLabel: "Sincronizat cu Supabase", syncingLabel: "Se sincronizează…", syncErrorLabel: "Sincronizare eșuată (datele rămân salvate local)", syncIdleLabel: "În așteptarea primei sincronizări",
    copyFallback: 'Dacă butonul nu copiază, atinge câmpul, ține apăsat și alege "Copiază" din meniul telefonului.',
    haveCodeOtherDevice: "Ai deja un cod de pe alt dispozitiv? Introdu-l aici pentru a-ți recupera datele (înlocuiește datele locale).",
    recoverBtn: "Recuperează",
    languageTitle: "Limbă", themeTitle: "Temă de culoare", currencyTitle: "Moneda contului",
    monthlyTrend: "Evoluție lunară", vsLastMonth: "față de luna trecută", netMonthly: "Net lunar", threshold20: "Prag +20%",
    categoriesTitle: "Categorii", total: "Total", learnedWords: "Cuvinte învățate", customWords: "Cuvinte personalizate",
    obNext: "Înainte", obSkip: "Sari peste", obStart: "Începe",
    newCategoryPh: "Categorie nouă…",
    recurringTitle: "Venituri și cheltuieli automate · salariu, alocație, abonamente…", recurringEmpty: "Nicio înregistrare recurentă setată.",
    weekly: "În fiecare săptămână", monthly: "În fiecare lună", yearly: "În fiecare an", lastRun: "ultima", notActiveYet: "încă inactivă",
    expenseType: "Cheltuială", incomeType: "Venit", kindSub: "Abonament", kindTicket: "Bilet / călătorie (ex. tren, autobuz zilnic)", kindOther: "Altele",
    recurringNamePh: "ex. Abonament Claude Pro, Netflix…", recurringNamePhIncome: "ex. Salariu, Alocație",
    amountPh: "Sumă", freqWeekly: "Săptămânal", freqMonthly: "Lunar", freqYearly: "Anual",
    allCategoriesSplit: "Toate (împarte pe %)", addRecurringBtn: "+ Adaugă înregistrare automată",
    deleteAccount: "Șterge acest cont",
    scanning: "Se scanează bonul…", errSave: "Nu am putut salva datele.", errAI: "Nu am putut contacta AI-ul.",
  },
  ru: {
    tabDashboard: "Дашборд", tabChat: "Чат", tabHistory: "История",
    totalBalance: "Общий баланс", byCategory: "Распределение по категориям", recentTx: "Последние операции",
    btnEntry: "Запись", btnTransfer: "Перевод",
    chatEmpty1: "Попробуйте:", chatEmptyExample: '«потратил 15 евро на еду»', chatEmpty2: "или сфотографируйте чек 📷",
    historyEmpty: "Пока нет операций.",
    yourAccounts: "Ваши счета", newAccountBtn: "Новый счёт",
    newAccountTitle: "Новый счёт", restoreTitle: "Восстановить данные",
    accountName: "Название счёта", accountNamePh: "напр. Личный", initialBalance: "Начальный баланс", currencyLabel: "Валюта", createAccountBtn: "Создать счёт",
    haveCode: "Уже есть код синхронизации?", recoverData: "Восстановить данные",
    restoreDesc: "Введите код с другого устройства (напр.", restoreBtn: "Восстановить данные", restoringBtn: "Восстановление…",
    orCreateNew: "Или", createNewAccount: "создать новый счёт",
    transferTitle: "Перевод между счетами", from: "Откуда", to: "Куда", amount: "Сумма", transferBtn: "Перевести",
    newEntryTitle: "Новая запись", category: "Категория", note: "Заметка (необязательно)", notePh: "напр. супермаркет", save: "Сохранить", date: "Дата",
    settingsTitle: "Настройки",
    syncCodeTitle: "Код синхронизации",
    syncCodeDesc: "Используйте этот код на другом устройстве, чтобы найти те же данные. Храните его как пароль: тот, кто его знает, может читать и изменять этот кошелёк.",
    syncedLabel: "Синхронизировано с Supabase", syncingLabel: "Синхронизация…", syncErrorLabel: "Синхронизация не удалась (данные сохранены локально)", syncIdleLabel: "Ожидание первой синхронизации",
    copyFallback: 'Если кнопка не копирует, нажмите на поле, удерживайте и выберите «Копировать» в меню телефона.',
    haveCodeOtherDevice: "Уже есть код с другого устройства? Введите его здесь, чтобы восстановить данные (заменит локальные).",
    recoverBtn: "Восстановить",
    languageTitle: "Язык", themeTitle: "Цветовая тема", currencyTitle: "Валюта счёта",
    monthlyTrend: "Динамика по месяцам", vsLastMonth: "к прошлому месяцу", netMonthly: "Итог за месяц", threshold20: "Порог +20%",
    categoriesTitle: "Категории", total: "Всего", learnedWords: "Изученные слова", customWords: "Пользовательские слова",
    obNext: "Далее", obSkip: "Пропустить", obStart: "Начать",
    newCategoryPh: "Новая категория…",
    recurringTitle: "Автоматические доходы и расходы · зарплата, пособия, подписки…", recurringEmpty: "Нет повторяющихся записей.",
    weekly: "Каждую неделю", monthly: "Каждый месяц", yearly: "Каждый год", lastRun: "последний раз", notActiveYet: "ещё не активна",
    expenseType: "Расход", incomeType: "Доход", kindSub: "Подписка", kindTicket: "Билет / поездка (напр. поезд, автобус)", kindOther: "Другое",
    recurringNamePh: "напр. Подписка Claude Pro, Netflix…", recurringNamePhIncome: "напр. Зарплата, Пособие",
    amountPh: "Сумма", freqWeekly: "Еженедельно", freqMonthly: "Ежемесячно", freqYearly: "Ежегодно",
    allCategoriesSplit: "Все (по %)", addRecurringBtn: "+ Добавить автозапись",
    deleteAccount: "Удалить этот счёт",
    scanning: "Сканирую чек…", errSave: "Не удалось сохранить данные.", errAI: "Не удалось связаться с AI.",
  },
  zh: {
    tabDashboard: "仪表盘", tabChat: "聊天", tabHistory: "历史记录",
    totalBalance: "总余额", byCategory: "分类占比", recentTx: "最近交易",
    btnEntry: "记一笔", btnTransfer: "转账",
    chatEmpty1: "试试：", chatEmptyExample: "「我在食物上花了15欧元」", chatEmpty2: "或拍一张小票照片 📷",
    historyEmpty: "还没有交易记录。",
    yourAccounts: "你的账户", newAccountBtn: "新建账户",
    newAccountTitle: "新建账户", restoreTitle: "恢复数据",
    accountName: "账户名称", accountNamePh: "例如：个人", initialBalance: "初始余额", currencyLabel: "货币", createAccountBtn: "创建账户",
    haveCode: "已经有同步代码了？", recoverData: "恢复数据",
    restoreDesc: "输入你在其他设备上记下的代码（例如", restoreBtn: "恢复我的数据", restoringBtn: "恢复中…",
    orCreateNew: "或者", createNewAccount: "创建新账户",
    transferTitle: "账户间转账", from: "从", to: "到", amount: "金额", transferBtn: "转账",
    newEntryTitle: "新记录", category: "分类", note: "备注（可选）", notePh: "例如：超市", save: "保存", date: "日期",
    settingsTitle: "设置",
    syncCodeTitle: "同步代码",
    syncCodeDesc: "在其他设备上使用此代码找回相同的数据。请像密码一样保管好：知道它的人都能读取和修改这个钱包。",
    syncedLabel: "已与 Supabase 同步", syncingLabel: "同步中…", syncErrorLabel: "同步失败（数据仍保存在本地）", syncIdleLabel: "等待首次同步",
    copyFallback: "如果按钮无法复制，请点住该字段，然后从手机菜单中选择「复制」。",
    haveCodeOtherDevice: "已经有其他设备的代码？在此输入以恢复数据（将替换本地数据）。",
    recoverBtn: "恢复",
    languageTitle: "语言", themeTitle: "配色主题", currencyTitle: "账户货币",
    monthlyTrend: "月度趋势", vsLastMonth: "较上月", netMonthly: "月净额", threshold20: "+20% 阈值",
    categoriesTitle: "分类", total: "总计", learnedWords: "已学会的词", customWords: "自定义词汇",
    obNext: "下一步", obSkip: "跳过", obStart: "开始使用",
    newCategoryPh: "新分类…",
    recurringTitle: "自动收支 · 工资、零花钱、订阅…", recurringEmpty: "还没有设置自动记录。",
    weekly: "每周", monthly: "每月", yearly: "每年", lastRun: "上次", notActiveYet: "尚未生效",
    expenseType: "支出", incomeType: "收入", kindSub: "订阅", kindTicket: "票务 / 出行（如火车、公交）", kindOther: "其他",
    recurringNamePh: "例如：Claude Pro 订阅、Netflix…", recurringNamePhIncome: "例如：工资、零花钱",
    amountPh: "金额", freqWeekly: "每周", freqMonthly: "每月", freqYearly: "每年",
    allCategoriesSplit: "全部（按百分比分配）", addRecurringBtn: "+ 添加自动记录",
    deleteAccount: "删除此账户",
    scanning: "正在扫描小票…", errSave: "无法保存数据。", errAI: "无法连接 AI。",
  },
};

// ============================================================
// Onboarding: brevi schermate mostrate solo al primissimo avvio
// ============================================================
const ONBOARDING_SLIDES = {
  it: [
    { icon: "⚡", title: "Benvenuto in Finbar", text: "Il tuo assistente per le finanze personali. Bastano pochi secondi per registrare ogni spesa o entrata." },
    { icon: "💬", title: "Scrivi o parla", text: "Scrivi in chat \"speso 15 in cibo\" oppure usa il microfono: Finbar capisce il linguaggio naturale e registra da solo." },
    { icon: "📷", title: "Scansiona gli scontrini", text: "Scatta una foto a uno scontrino: importo, negozio e categoria vengono letti automaticamente, con conferma prima di salvare." },
    { icon: "🧠", title: "Insegnagli nuove parole", text: "Scrivi \"vinto=guadagno\" o \"bolletta=casa\" per insegnare a Finbar termini nuovi o dialettali, una volta per tutte." },
    { icon: "🔑", title: "Conserva il tuo codice", text: "In Impostazioni trovi un codice di sincronizzazione unico: conservalo come una password, ti serve per ritrovare i tuoi dati su un altro dispositivo." },
  ],
  en: [
    { icon: "⚡", title: "Welcome to Finbar", text: "Your personal finance assistant. A few seconds is all it takes to log any expense or income." },
    { icon: "💬", title: "Type or talk", text: "Type \"spent 15 on food\" in chat, or use the microphone: Finbar understands natural language and logs it for you." },
    { icon: "📷", title: "Scan your receipts", text: "Snap a photo of a receipt: amount, merchant and category are read automatically, with confirmation before saving." },
    { icon: "🧠", title: "Teach it new words", text: "Type \"won=income\" or \"bill=home\" to teach Finbar new or regional terms, once and for good." },
    { icon: "🔑", title: "Keep your code safe", text: "Settings has a unique sync code: keep it like a password, you'll need it to find your data on another device." },
  ],
  ro: [
    { icon: "⚡", title: "Bine ai venit în Finbar", text: "Asistentul tău pentru finanțe personale. Câteva secunde sunt de ajuns pentru a înregistra orice cheltuială sau venit." },
    { icon: "💬", title: "Scrie sau vorbește", text: "Scrie în chat \"am cheltuit 15 pe mâncare\" sau folosește microfonul: Finbar înțelege limbajul natural și înregistrează singur." },
    { icon: "📷", title: "Scanează bonurile", text: "Fotografiază un bon: suma, magazinul și categoria sunt citite automat, cu confirmare înainte de salvare." },
    { icon: "🧠", title: "Învață-l cuvinte noi", text: "Scrie \"am câștigat=venit\" sau \"factura=casa\" pentru a învăța Finbar termeni noi sau regionali, o singură dată." },
    { icon: "🔑", title: "Păstrează-ți codul", text: "În Setări găsești un cod de sincronizare unic: păstrează-l ca pe o parolă, îți trebuie pentru a-ți regăsi datele pe alt dispozitiv." },
  ],
  ru: [
    { icon: "⚡", title: "Добро пожаловать в Finbar", text: "Ваш помощник по личным финансам. Несколько секунд — и любой расход или доход записан." },
    { icon: "💬", title: "Пишите или говорите", text: "Напишите в чате «потратил 15 на еду» или используйте микрофон: Finbar понимает естественный язык и сам всё запишет." },
    { icon: "📷", title: "Сканируйте чеки", text: "Сфотографируйте чек: сумма, магазин и категория считываются автоматически, с подтверждением перед сохранением." },
    { icon: "🧠", title: "Научите новым словам", text: "Напишите «выиграл=доход» или «счёт=дом», чтобы один раз научить Finbar новым или диалектным словам." },
    { icon: "🔑", title: "Сохраните свой код", text: "В настройках есть уникальный код синхронизации: храните его как пароль — он нужен, чтобы найти данные на другом устройстве." },
  ],
  zh: [
    { icon: "⚡", title: "欢迎使用 Finbar", text: "你的个人理财助手。只需几秒钟即可记录任何支出或收入。" },
    { icon: "💬", title: "打字或说话", text: "在聊天中输入\"食品支出15\"，或使用麦克风：Finbar能理解自然语言并自动记录。" },
    { icon: "📷", title: "扫描小票", text: "拍下小票照片：金额、商家和分类会被自动识别，保存前会先请你确认。" },
    { icon: "🧠", title: "教它新词汇", text: "输入\"赢了=收入\"或\"账单=家庭\"，一次性教会 Finbar 新词或方言说法。" },
    { icon: "🔑", title: "保管好你的代码", text: "设置中有一个唯一的同步代码：请像密码一样妥善保管，换设备找回数据时会用到。" },
  ],
};


// ============================================================
// Parser locale (IT / EN / RO / RU / ZH) — capisce le richieste più comuni
// SENZA chiamare l'AI: gratuito, istantaneo, funziona offline.
// L'AI resta solo come fallback per le frasi che questo non capisce.
// ============================================================
const NUM_REGEX = /(\d+(?:[.,]\d{1,2})?)/;

const INCOME_WORDS = [
  "guadagnat", "ricevut", "incassat", "stipendio", "entrata", "entrate", "aggiung", "deposit", "accredit", "reddito", "pagett", "vinto", "vinta",
  "earned", "received", "income", "add", "added", "deposit", "credited", "salary", "paid me", "got paid", "allowance", "won", "i won",
  "castigat", "primit", "venit", "adaug", "salariu", "depus", "depune", "am invins", "invins", "am castigat",
  "заработал", "заработала", "получил", "получила", "доход", "добав", "депозит", "зарплата", "выиграл", "выиграла",
  "赚了", "收到", "收入", "添加", "存入", "工资", "赢了",
];
const EXPENSE_WORDS = [
  "spes", "pagat", "tolt", "togli", "rimuov", "sottra", "uscita", "uscite", "comprat", "acquistat", "costat",
  "spent", "paid", "bought", "purchase", "remove", "subtract", "expense", "cost",
  "cheltuit", "platit", "cumparat", "scade", "scoate", "cheltuial",
  "потратил", "потратила", "заплатил", "заплатила", "купил", "купила", "убрать", "расход",
  "花了", "支付", "买了", "删除", "支出",
];
const CATEGORY_SYNONYMS = {
  cibo: ["cibo", "alimentar", "spesa alimentare", "food", "grocer", "mancare", "restaurant", "ristorante", "supermerc", "еда", "продукты", "食物", "餐饮", "超市"],
  casa: ["casa", "affitto", "bollet", "house", "rent", "utilit", "bill", "chirie", "factur", "дом", "аренда", "счета", "房租", "账单"],
  trasporti: ["trasport", "benzina", "treno", "autobus", "transport", "bus", "train", "fuel", "gas", "tren", "combustibil", "metrou", "metro", "taxi", "uber", "транспорт", "бензин", "交通", "汽油", "公交"],
  svago: ["svago", "divertiment", "cinema", "shopping", "hobby", "fun", "entertainment", "distrac", "joc", "gioc", "развлечения", "娱乐"],
  salute: ["salute", "farmacia", "medico", "health", "pharmac", "doctor", "sanatate", "farmacie", "medic", "здоровье", "аптека", "健康", "药店"],
  risparmi: ["risparmi", "saving", "economii", "risparmio", "сбережения", "储蓄"],
  altro: ["altro", "varie", "other", "misc", "altele", "другое", "其他"],
};
const BALANCE_WORDS = ["saldo", "balance", "sold", "баланс", "余额"];
const MONEY_WORDS = ["soldi", "money", "bani", "fondi", "funds", "деньги", "钱"];
const SPENT_QUERY_WORDS = ["quanto ho speso", "quanto ho pagato", "how much have i spent", "how much did i spend", "cat am cheltuit", "сколько я потратил", "我花了多少"];
const EARNED_QUERY_WORDS = ["quanto ho guadagnato", "quanto ho ricevuto", "how much have i earned", "how much did i earn", "cat am castigat", "сколько я заработал", "我赚了多少"];
const PERIOD_WORDS = {
  today: ["oggi", "today", "azi", "сегодня", "今天"],
  week: ["questa settimana", "this week", "saptamana", "на этой неделе", "这周"],
  month: ["questo mese", "this month", "luna aceasta", "в этом месяце", "这个月"],
  lastMonth: ["mese scorso", "last month", "luna trecuta", "в прошлом месяце", "上个月"],
  year: ["quest'anno", "questanno", "this year", "anul acesta", "в этом году", "今年"],
};

function normalizeText(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function matchAny(text, words) {
  return words.some((w) => text.includes(normalizeText(w)));
}
// match esatto sulla parola intera (evita falsi positivi tipo "soldi" che contiene "sold")
function matchWholeWord(text, word) {
  return new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(text);
}
function matchAnyWhole(text, words) {
  return words.some((w) => matchWholeWord(text, normalizeText(w)));
}
// controlla se il testo contiene una delle parole insegnate esplicitamente dall'utente (es. "vinto" -> "entrata")
function matchesCustomType(text, customTypeWords, type) {
  if (!customTypeWords) return false;
  return Object.entries(customTypeWords).some(([word, t]) => t === type && matchWholeWord(text, normalizeText(word)));
}
// riconosce comandi del tipo "parola = significato" (es. "vinto=guadagno") per insegnare nuove parole
function parseTeachCommand(rawText) {
  const m = rawText.match(/^\s*([^=]{1,40})=([^=]{1,60})\s*$/);
  if (!m) return null;
  const rawWord = m[1].trim();
  const rawMeaning = m[2].trim();
  if (!rawWord || !rawMeaning) return null;
  const wordNorm = normalizeText(rawWord).trim();
  const meaningNorm = normalizeText(rawMeaning).trim();
  // la parola insegnata deve essere un termine semplice, senza numeri (max 3 parole)
  if (!/^[a-z\u00e0-\u017e\u0400-\u04FF\u4e00-\u9fff\s]+$/.test(wordNorm)) return null;
  if (wordNorm.split(/\s+/).length > 3) return null;
  return { word: wordNorm, meaningNorm, meaningRaw: rawMeaning };
}
function detectCategory(text, categories, learnedTerms) {
  for (const [id, c] of Object.entries(categories)) {
    if (text.includes(normalizeText(c.label))) return id;
  }
  // parole imparate dalle scelte manuali precedenti dell'utente: hanno priorità sul dizionario generico
  if (learnedTerms) {
    for (const [word, catId] of Object.entries(learnedTerms)) {
      if (categories[catId] && matchWholeWord(text, word)) return catId;
    }
  }
  for (const [defId, syns] of Object.entries(CATEGORY_SYNONYMS)) {
    if (syns.some((s) => text.includes(normalizeText(s)))) {
      if (categories[defId]) return defId;
      const found = Object.entries(categories).find(([id, c]) => normalizeText(c.label).includes(defId));
      if (found) return found[0];
    }
  }
  return null;
}
const GENERIC_STOP_WORDS = new Set([
  "a", "di", "in", "il", "la", "lo", "le", "gli", "un", "una", "per", "con", "e", "o", "al", "dal", "del", "della", "sul", "nel", "che",
  "the", "an", "to", "from", "of", "for", "and", "or", "on", "at",
  "de", "din", "cu", "pentru", "si", "un", "o", "la",
  "euro", "euros", "eur", "lei", "ron",
]);
function isKnownTriggerWord(word) {
  return INCOME_WORDS.some((w) => word.startsWith(normalizeText(w))) || EXPENSE_WORDS.some((w) => word.startsWith(normalizeText(w)));
}
// estrae le parole "insegnabili" da un messaggio: quelle che restano dopo aver tolto
// numeri, parole note (verbi entrata/uscita) e parole troppo generiche
function extractLearnableWords(rawText) {
  const norm = normalizeText(rawText).replace(NUM_REGEX, " ");
  const words = norm.split(/[^a-z\u00e0-\u017e\u0400-\u04FF\u4e00-\u9fff]+/).filter(Boolean);
  return words.filter((w) => w.length >= 2 && !GENERIC_STOP_WORDS.has(w) && !isKnownTriggerWord(w));
}
function detectPeriod(text) {
  for (const [key, words] of Object.entries(PERIOD_WORDS)) {
    if (matchAny(text, words)) return key;
  }
  return null;
}
function inPeriod(dateStr, period) {
  if (!period) return true;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  if (period === "today") return dateStr === todayISO();
  if (period === "week") {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    return d >= start;
  }
  if (period === "month") return dateStr.slice(0, 7) === todayISO().slice(0, 7);
  if (period === "lastMonth") {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return dateStr.slice(0, 7) === lm.toISOString().slice(0, 7);
  }
  if (period === "year") return dateStr.slice(0, 4) === todayISO().slice(0, 4);
  return true;
}


function localParseMessage(rawText, account, lang) {
  const tr = T[lang] || T.it;
  const text = normalizeText(rawText.trim());
  if (!text) return { kind: "unrecognized" };

  // 1) saldo (totale o di una categoria specifica)
  const hasBalanceWord = matchAnyWhole(text, BALANCE_WORDS) || matchAnyWhole(text, MONEY_WORDS);
  const asksHowMuch = text.includes("quant") || text.includes("what") || text.includes("care") || text.includes("qual") || matchWholeWord(text, "cat");
  if (hasBalanceWord && asksHowMuch) {
    const catId = detectCategory(text, account.categories, account.learnedTerms);
    if (catId) {
      return { kind: "answer", text: tr.categoryBalanceAnswer(account.categories[catId].balance, account.categories[catId].label, account.currency) };
    }
    return { kind: "answer", text: tr.balanceAnswer(account.name, account.totalBalance, account.currency) };
  }

  // 2) quanto ho speso/guadagnato...?
  const isSpentQuery = matchAny(text, SPENT_QUERY_WORDS);
  const isEarnedQuery = matchAny(text, EARNED_QUERY_WORDS);
  if (isSpentQuery || isEarnedQuery) {
    const period = detectPeriod(text);
    const catId = detectCategory(text, account.categories, account.learnedTerms);
    const type = isSpentQuery ? "spesa" : "entrata";
    const total = account.transactions
      .filter((tx) => tx.type === type)
      .filter((tx) => inPeriod(tx.date, period))
      .filter((tx) => !catId || normalizeText(tx.category) === normalizeText(account.categories[catId]?.label || ""))
      .reduce((s, tx) => s + tx.amount, 0);
    const periodLabel = period ? tr.periods[period] : tr.periods.total;
    const catLabel = catId ? account.categories[catId].label : "";
    return { kind: "answer", text: isSpentQuery ? tr.spentAnswer(catLabel, total, periodLabel, account.currency) : tr.earnedAnswer(catLabel, total, periodLabel, account.currency) };
  }

  // 3) registrazione transazione
  const numMatch = rawText.match(NUM_REGEX);
  if (!numMatch) return { kind: "unrecognized" };
  const amount = parseFloat(numMatch[1].replace(",", "."));
  if (!amount || amount <= 0) return { kind: "unrecognized" };

  let transactionType;
  if (matchAny(text, INCOME_WORDS) || matchesCustomType(text, account.customTypeWords, "entrata")) transactionType = "entrata";
  else if (matchAny(text, EXPENSE_WORDS) || matchesCustomType(text, account.customTypeWords, "spesa")) transactionType = "spesa";
  else transactionType = "spesa"; // un importo "nudo" (es. "20 cibo") è quasi sempre una spesa

  const catId = detectCategory(text, account.categories, account.learnedTerms);
  const note = rawText.replace(NUM_REGEX, "").trim().slice(0, 60);

  if (!catId) return { kind: "need_category", amount, transactionType, note };
  return { kind: "transaction", amount, transactionType, category: catId, note };
}

export default function Finbar() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [themeKey, setThemeKey] = useState("indaco");
  const [tab, setTab] = useState("dash");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [pendingReceipt, setPendingReceipt] = useState(null);
  const [pendingCategoryChoice, setPendingCategoryChoice] = useState(null);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [newAccountMode, setNewAccountMode] = useState("create"); // "create" | "restore"
  const [error, setError] = useState(null);
  const [syncCode, setSyncCode] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  const [copied, setCopied] = useState(false);
  const [restoreInput, setRestoreInput] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(null);
  const [appLanguage, setAppLanguage] = useState("it");
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  const t = THEMES[themeKey];
  const ui = UI[appLanguage] || UI.it;
  const account = accounts[activeId];

  // ---- load ----
  useEffect(() => {
    (async () => {
      try {
        const [a, th, c, sc, lg, ob] = await Promise.allSettled([
          window.storage.get(ACCOUNTS_KEY, false),
          window.storage.get(THEME_KEY, false),
          window.storage.get(CHAT_KEY, false),
          window.storage.get(SYNC_CODE_KEY, false),
          window.storage.get(LANGUAGE_KEY, false),
          window.storage.get(ONBOARDING_KEY, false),
        ]);
        let accs = {};
        let active = null;
        if (a.status === "fulfilled" && a.value) {
          const parsed = JSON.parse(a.value.value);
          accs = parsed.accounts || {};
          active = parsed.activeId || Object.keys(accs)[0] || null;
        }
        const { accounts: processed, changed } = processAllRecurring(accs);
        setAccounts(processed);
        setActiveId(active);
        if (changed) {
          try { await window.storage.set(ACCOUNTS_KEY, JSON.stringify({ accounts: processed, activeId: active }), false); } catch {}
        }
        setThemeKey(th.status === "fulfilled" && th.value ? th.value.value : "indaco");
        setMessages(c.status === "fulfilled" && c.value ? JSON.parse(c.value.value) : []);
        if (Object.keys(accs).length === 0) setShowNewAccount(true);

        // ---- lingua: se non è mai stata scelta, la chiediamo al primo avvio ----
        if (lg.status === "fulfilled" && lg.value) {
          setAppLanguage(lg.value.value);
        } else {
          setShowLanguagePicker(true);
        }

        // ---- codice di sincronizzazione: se non esiste, lo generiamo ora ----
        let code = sc.status === "fulfilled" && sc.value ? sc.value.value : null;
        if (!code) {
          code = generateSyncCode();
          try { await window.storage.set(SYNC_CODE_KEY, code, false); } catch {}
        }
        setSyncCode(code);
        // porta subito i dati su Supabase in background (non blocca l'interfaccia)
        supabaseSaveWallet(code, { accounts: processed, activeId: active }).then(
          () => setSyncStatus("synced"),
          () => setSyncStatus("error")
        );

        // ---- onboarding: se non è mai stato visto, lo mostriamo al primo avvio ----
        const onboardingSeen = ob.status === "fulfilled" && ob.value;
        if (!onboardingSeen) setShowOnboarding(true);
      } catch {
        setShowNewAccount(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceSupported(false); return; }
    const rec = new SR();
    rec.lang = "it-IT";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let text = "";
      for (let i = 0; i < ev.results.length; i++) text += ev.results[i][0].transcript;
      setInput(text);
    };
    rec.onstart = () => setListening(true);
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, tab, pendingReceipt]);

  // ---- persistence ----
  const persistAccounts = async (accs, active) => {
    setAccounts(accs);
    setActiveId(active);
    try {
      await window.storage.set(ACCOUNTS_KEY, JSON.stringify({ accounts: accs, activeId: active }), false);
    } catch {
      setError(ui.errSave);
    }
    // sincronizzazione su Supabase in background: non blocca mai l'interfaccia
    if (syncCode) {
      setSyncStatus("syncing");
      supabaseSaveWallet(syncCode, { accounts: accs, activeId: active }).then(
        () => setSyncStatus("synced"),
        () => setSyncStatus("error")
      );
    }
  };
  const persistChat = async (next) => {
    setMessages(next);
    try {
      await window.storage.set(CHAT_KEY, JSON.stringify(next), false);
    } catch {}
  };
  const changeTheme = async (key) => {
    setThemeKey(key);
    try { await window.storage.set(THEME_KEY, key, false); } catch {}
  };
  const changeLanguage = async (lang) => {
    setAppLanguage(lang);
    setShowLanguagePicker(false);
    try { await window.storage.set(LANGUAGE_KEY, lang, false); } catch {}
  };
  const finishOnboarding = async () => {
    setShowOnboarding(false);
    setOnboardingStep(0);
    try { await window.storage.set(ONBOARDING_KEY, "1", false); } catch {}
  };
  const changeCurrency = (code) => {
    const acc = { ...account, currency: code };
    persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
  };
  const codeInputRef = useRef(null);
  const copySyncCode = async () => {
    if (!syncCode) return;
    // 1) prova l'API moderna
    try {
      await navigator.clipboard.writeText(syncCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch {}
    // 2) fallback: seleziona il testo nel campo e prova execCommand (funziona anche in iframe più restrittivi)
    try {
      const el = codeInputRef.current;
      if (el) {
        el.focus();
        el.select();
        el.setSelectionRange(0, syncCode.length);
        const ok = document.execCommand("copy");
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          return;
        }
      }
    } catch {}
    // 3) niente ha funzionato: il testo resta comunque selezionato, l'utente può copiarlo a mano
    setError("Non sono riuscito a copiare in automatico: il codice è selezionato, usa \"copia\" dal menu del telefono.");
  };
  const restoreFromCode = async () => {
    const code = restoreInput.trim().toUpperCase();
    if (!code) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const data = await supabaseGetWallet(code);
      if (!data) {
        setRestoreError("Nessun dato trovato per questo codice.");
        return;
      }
      const accs = data.accounts || {};
      const active = data.activeId || Object.keys(accs)[0] || null;
      setAccounts(accs);
      setActiveId(active);
      try { await window.storage.set(ACCOUNTS_KEY, JSON.stringify({ accounts: accs, activeId: active }), false); } catch {}
      // da questo momento questo dispositivo "adotta" il codice recuperato
      setSyncCode(code);
      try { await window.storage.set(SYNC_CODE_KEY, code, false); } catch {}
      setSyncStatus("synced");
      setRestoreInput("");
      setShowNewAccount(false);
      setShowSettings(false);
    } catch {
      setRestoreError("Errore di connessione, riprova.");
    } finally {
      setRestoring(false);
    }
  };

  // ---- account actions ----
  const createAccount = (name, balance, currencyCode) => {
    const acc = newAccount(name || "Conto", isNaN(balance) ? 0 : balance, currencyCode);
    const next = { ...accounts, [acc.id]: acc };
    persistAccounts(next, acc.id);
    setShowNewAccount(false);
  };
  const deleteAccount = (id) => {
    const next = { ...accounts };
    delete next[id];
    const remaining = Object.keys(next);
    persistAccounts(next, remaining[0] || null);
    if (remaining.length === 0) setShowNewAccount(true);
  };
  const updateCategoryPct = (catId, pct) => {
    const acc = { ...account, categories: { ...account.categories, [catId]: { ...account.categories[catId], pct } } };
    persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
  };
  const CAT_COLORS = ["#F0B429", "#E85D4A", "#4E7FFF", "#B57EDC", "#00C2A8", "#2ECC71", "#8891A5", "#FF7A6B", "#4EC9FF", "#D4A94E"];
  const addCategory = (label) => {
    const clean = label.trim();
    if (!clean) return;
    const id = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + uid().slice(0, 4);
    const usedColors = Object.values(account.categories).map((c) => c.color);
    const color = CAT_COLORS.find((c) => !usedColors.includes(c)) || CAT_COLORS[Object.keys(account.categories).length % CAT_COLORS.length];
    const acc = { ...account, categories: { ...account.categories, [id]: { label: clean, pct: 0, color, balance: 0 } } };
    persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
  };
  const deleteCategory = (id) => {
    if (Object.keys(account.categories).length <= 1) return;
    const cats = { ...account.categories };
    delete cats[id];
    const acc = { ...account, categories: cats };
    persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
  };
  const renameCategory = (id, label) => {
    const acc = { ...account, categories: { ...account.categories, [id]: { ...account.categories[id], label } } };
    persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
  };
  const forgetLearnedTerm = (word) => {
    const next = { ...(account.learnedTerms || {}) };
    delete next[word];
    persistAccounts({ ...accounts, [account.id]: { ...account, learnedTerms: next } }, activeId);
  };
  const forgetCustomTypeWord = (word) => {
    const next = { ...(account.customTypeWords || {}) };
    delete next[word];
    persistAccounts({ ...accounts, [account.id]: { ...account, customTypeWords: next } }, activeId);
  };

  // ---- recurring income actions ----
  const addRecurring = (rule) => {
    const withRule = { ...account, recurring: [...(account.recurring || []), { ...rule, id: uid(), lastAppliedDate: null }] };
    const { acc: processed } = processRecurringForAccount(withRule, todayISO());
    persistAccounts({ ...accounts, [processed.id]: processed }, activeId);
  };
  const deleteRecurring = (id) => {
    const acc = { ...account, recurring: (account.recurring || []).filter((r) => r.id !== id) };
    persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
  };
  const transferBetween = (fromId, toId, amount) => {
    if (!fromId || !toId || fromId === toId || !amount || amount <= 0) return;
    const from = JSON.parse(JSON.stringify(accounts[fromId]));
    const to = JSON.parse(JSON.stringify(accounts[toId]));
    from.totalBalance -= amount;
    to.totalBalance += amount;
    from.transactions.unshift({ id: uid(), type: "spesa", amount, category: `Trasferito a ${to.name}`, note: "", date: todayISO() });
    to.transactions.unshift({ id: uid(), type: "entrata", amount, category: `Ricevuto da ${from.name}`, note: "", date: todayISO() });
    persistAccounts({ ...accounts, [from.id]: from, [to.id]: to }, activeId);
    setShowTransfer(false);
  };

  // ---- transaction helpers ----
  const commitTransaction = (payload) => {
    const { acc, ok } = applyTransaction(account, payload);
    if (ok) persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
    return ok;
  };

  const resolveCategoryChoice = (categoryId) => {
    if (!pendingCategoryChoice) return;
    const { amount, transactionType, note, rawText } = pendingCategoryChoice;

    // ---- self-learning: se ho scelto una categoria specifica (non "tutte"),
    // imparo le parole del messaggio che l'avevano suggerita, per la prossima volta ----
    let accForLearning = account;
    if (categoryId !== "TUTTE" && rawText) {
      const learnable = extractLearnableWords(rawText);
      if (learnable.length > 0) {
        const nextLearned = { ...(account.learnedTerms || {}) };
        learnable.forEach((w) => { nextLearned[w] = categoryId; });
        accForLearning = { ...account, learnedTerms: nextLearned };
      }
    }

    const { acc, ok } = applyTransaction(accForLearning, { transactionType, amount, category: categoryId, note });
    if (ok) persistAccounts({ ...accounts, [acc.id]: acc }, activeId);

    const tr = T[appLanguage] || T.it;
    const label = transactionType === "spesa" ? tr.expense : tr.income;
    const catLabel = categoryId === "TUTTE" ? tr.dividedAll : account.categories[categoryId]?.label || categoryId;
    persistChat([...messages, {
      role: "assistant",
      content: ok ? tr.savedTx(label, amount, catLabel, account.currency) : tr.txFailed,
      ts: Date.now(), accountId: activeId, txOk: ok,
    }]);
    setPendingCategoryChoice(null);
  };

  // ---- voice ----
  const toggleMic = () => {
    if (!voiceSupported || !recognitionRef.current) return;
    if (listening) { recognitionRef.current.stop(); setListening(false); }
    else { try { setInput(""); recognitionRef.current.start(); } catch { setListening(false); } }
  };
  const speak = (text) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[{}"[\]]/g, ""));
    u.lang = "it-IT";
    window.speechSynthesis.speak(u);
  };

  // ---- chat send ----
  const send = async () => {
    const text = input.trim();
    if (!text || sending || !account) return;
    setInput("");
    setError(null);
    if (listening) toggleMic();
    const userMsg = { role: "user", content: text, ts: Date.now(), accountId: activeId };
    const next = [...messages, userMsg];
    await persistChat(next);
    const tr = T[appLanguage] || T.it;

    // ---- 0) comando "parola = significato" per insegnare nuove parole (es. "vinto=guadagno") ----
    const teach = parseTeachCommand(text);
    if (teach) {
      const { word, meaningNorm, meaningRaw } = teach;
      const incomeHints = ["entrata", "guadagno", "reddito", "income", "venit", "castig", "доход", "заработ", "收入", "赚"];
      const expenseHints = ["spesa", "uscita", "expense", "cheltuial", "расход", "支出", "花"];
      let updatedAcc = null;
      let confirmMsg = null;

      if (matchAny(meaningNorm, INCOME_WORDS) || incomeHints.some((h) => meaningNorm.includes(normalizeText(h)))) {
        updatedAcc = { ...account, customTypeWords: { ...(account.customTypeWords || {}), [word]: "entrata" } };
        confirmMsg = tr.wordTaughtType(word, tr.income);
      } else if (matchAny(meaningNorm, EXPENSE_WORDS) || expenseHints.some((h) => meaningNorm.includes(normalizeText(h)))) {
        updatedAcc = { ...account, customTypeWords: { ...(account.customTypeWords || {}), [word]: "spesa" } };
        confirmMsg = tr.wordTaughtType(word, tr.expense);
      } else {
        const matchedCat = Object.entries(account.categories).find(([, c]) => {
          const catNorm = normalizeText(c.label);
          return meaningNorm.includes(catNorm) || catNorm.includes(meaningNorm);
        });
        if (matchedCat) {
          const [catId, cat] = matchedCat;
          updatedAcc = { ...account, learnedTerms: { ...(account.learnedTerms || {}), [word]: catId } };
          confirmMsg = tr.wordTaughtCategory(word, cat.label);
        }
      }

      if (updatedAcc) {
        persistAccounts({ ...accounts, [updatedAcc.id]: updatedAcc }, activeId);
        await persistChat([...next, { role: "assistant", content: confirmMsg, ts: Date.now(), accountId: activeId }]);
      } else {
        await persistChat([...next, { role: "assistant", content: tr.wordTeachUnknown(meaningRaw), ts: Date.now(), accountId: activeId }]);
      }
      return;
    }

    // ---- 1) prova il parser locale: gratis, istantaneo, niente chiamata AI ----
    const local = localParseMessage(text, account, appLanguage);

    if (local.kind === "answer") {
      await persistChat([...next, { role: "assistant", content: local.text, ts: Date.now(), accountId: activeId }]);
      return;
    }
    if (local.kind === "transaction") {
      const ok = commitTransaction({ transactionType: local.transactionType, amount: local.amount, category: local.category, note: local.note });
      const label = local.transactionType === "spesa" ? tr.expense : tr.income;
      await persistChat([...next, {
        role: "assistant",
        content: ok ? tr.txRegistered(label, local.amount, local.note, account.currency) : tr.txFailed,
        ts: Date.now(), accountId: activeId, txOk: ok,
      }]);
      return;
    }
    if (local.kind === "need_category") {
      setPendingCategoryChoice({ amount: local.amount, transactionType: local.transactionType, note: local.note, rawText: text });
      const label = local.transactionType === "spesa" ? tr.expense : tr.income;
      await persistChat([...next, {
        role: "assistant",
        content: tr.needCategory(label, local.amount, account.currency),
        ts: Date.now(), accountId: activeId,
      }]);
      return;
    }

    // ---- 2) fallback: solo se il parser locale non ha capito, chiedo all'AI ----
    setSending(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 400,
          system: buildChatSystemPrompt(account, appLanguage),
          messages: [{ role: "user", content: text }],
        }),
      });
      const data = await response.json();
      const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      let displayText = raw;
      let txOk = null;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.type === "transaction") {
          txOk = commitTransaction({ transactionType: parsed.transactionType, amount: parsed.amount, category: parsed.category, note: parsed.note });
          const label = parsed.transactionType === "spesa" ? tr.expense : tr.income;
          displayText = txOk ? tr.txRegistered(label, parsed.amount, parsed.note, account.currency) : tr.txFailed;
        } else if (parsed.type === "question" || parsed.type === "response") {
          displayText = parsed.question || parsed.text;
        }
      } catch {
        // not JSON, show raw text as-is
      }
      const assistantMsg = { role: "assistant", content: displayText, ts: Date.now(), accountId: activeId, txOk };
      await persistChat([...next, assistantMsg]);
    } catch {
      setError(ui.errAI);
    } finally {
      setSending(false);
    }
  };

  // ---- receipt scan ----
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !account) return;
    setSending(true);
    setError(null);
    try {
      const parsed = await scanReceiptWithTesseract(file, account, appLanguage);
      if (parsed.error) {
        await persistChat([...messages, { role: "assistant", content: `Non sono riuscito a leggere lo scontrino: ${parsed.error}`, ts: Date.now(), accountId: activeId }]);
      } else {
        setPendingReceipt(parsed);
      }
    } catch {
      setError("Non sono riuscito ad analizzare l'immagine.");
    } finally {
      setSending(false);
    }
  };
  const confirmReceipt = () => {
    if (!pendingReceipt) return;
    commitTransaction({ transactionType: pendingReceipt.transactionType, amount: pendingReceipt.amount, category: pendingReceipt.category, note: pendingReceipt.note });
    persistChat([...messages, { role: "assistant", content: `Scontrino registrato: ${currency(pendingReceipt.amount, account.currency)} · ${pendingReceipt.note || ""}`, ts: Date.now(), accountId: activeId, txOk: true }]);
    setPendingReceipt(null);
  };

  const chatForAccount = useMemo(() => messages.filter((m) => m.accountId === activeId), [messages, activeId]);

  const pieData = useMemo(() => {
    if (!account) return [];
    return Object.values(account.categories).map((c) => ({ name: c.label, value: Math.max(0, c.balance), color: c.color }));
  }, [account]);

  const trendData = useMemo(() => {
    if (!account) return [];
    const txs = [...account.transactions].reverse();
    let running = 0;
    const points = [];
    txs.forEach((tx) => {
      running += tx.type === "spesa" ? -tx.amount : tx.amount;
      points.push({ label: tx.date.slice(5), value: running });
    });
    return points.slice(-20);
  }, [account]);

  const monthlyData = useMemo(() => {
    if (!account) return [];
    const byMonth = {};
    account.transactions.forEach((tx) => {
      if (tx.type === "init") return;
      const key = tx.date.slice(0, 7);
      byMonth[key] = byMonth[key] || 0;
      byMonth[key] += tx.type === "entrata" ? tx.amount : -tx.amount;
    });
    const months = Object.keys(byMonth).sort();
    return months.map((m, i) => {
      const prev = i > 0 ? byMonth[months[i - 1]] : null;
      return {
        month: new Date(m + "-01").toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
        net: Math.round(byMonth[m] * 100) / 100,
        target: prev !== null ? Math.round(prev * 1.2 * 100) / 100 : null,
        prev,
      };
    });
  }, [account]);

  const monthlyChange = useMemo(() => {
    if (monthlyData.length < 2) return null;
    const last = monthlyData[monthlyData.length - 1];
    const prevVal = last.prev;
    if (!prevVal) return null;
    return Math.round(((last.net - prevVal) / Math.abs(prevVal)) * 1000) / 10;
  }, [monthlyData]);

  if (loading) {
    return <div style={{ minHeight: "100vh", background: "#10142A", display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted, fontFamily: "Inter, sans-serif" }}>caricamento di Finbar…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: t.bgGrad, color: t.textStrong, fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", transition: "background 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::placeholder { color: ${t.textMuted}; }
        button { font-family: inherit; }
        button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        .num { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
        .display { font-family: 'Sora', sans-serif; }
        .icon-btn { background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: inherit; }
        .scrollbar::-webkit-scrollbar { width: 6px; }
        .scrollbar::-webkit-scrollbar-thumb { background: ${t.surfaceBorder}; border-radius: 3px; }
        @keyframes pulseMic { 0%,100% { box-shadow: 0 0 0 0 ${t.accent}66; } 50% { box-shadow: 0 0 0 8px ${t.accent}00; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .in { animation: fadeUp 0.18s ease-out; }
        .tab-btn { display: flex; flex-direction: column; align-items: center; gap: 3px; flex: 1; padding: 10px 0 6px; background: none; border: none; cursor: pointer; }
      `}</style>

      {/* ===== Header ===== */}
      <div style={{ padding: "20px 18px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 24, fontWeight: 800, letterSpacing: "0.04em", fontFamily: "'Cinzel', serif", color: t.accent2, textShadow: `0 0 18px ${t.accent}40` }}>
            <LightningIcon size={18} color={t.accent} />
            FINBAR
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Impostazioni" style={{ width: 34, height: 34, borderRadius: 10, background: t.surface }}>
              <Settings size={16} color={t.textMuted} />
            </button>
          </div>
        </div>

        {account && (
          <button
            onClick={() => setShowAccountSwitcher(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: t.surface, border: `1px solid ${t.surfaceBorder}`, borderRadius: 20, padding: "6px 12px 6px 10px", color: t.textPrimary, fontSize: 13, cursor: "pointer" }}
          >
            <Wallet size={13} color={t.accent} />
            {account.name}
            <ChevronDown size={13} />
          </button>
        )}
      </div>

      {!account ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <button onClick={() => setShowNewAccount(true)} style={{ background: t.accent, color: t.onAccent, border: "none", padding: "14px 22px", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>
            + Crea il tuo primo conto
          </button>
        </div>
      ) : (
        <>
          {/* ===== Dashboard tab ===== */}
          {tab === "dash" && (
            <div className="scrollbar" style={{ flex: 1, overflowY: "auto", padding: "0 18px 18px" }}>
              <div style={{ background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 18, padding: "22px 20px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: `${t.accent}22`, filter: "blur(10px)" }} />
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 6, position: "relative" }}>{ui.totalBalance} · {account.name}</div>
                <div className="num display" style={{ fontSize: 38, fontWeight: 700, color: account.totalBalance >= 0 ? t.textStrong : "#FF7A6B", position: "relative" }}>
                  {currency(account.totalBalance, account.currency)}
                </div>
                {trendData.length > 1 && (
                  <div style={{ height: 60, marginTop: 10 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={t.accent} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={t.accent} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke={t.accent} strokeWidth={2} fill="url(#trendFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button onClick={() => setShowForm(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: t.accent, color: t.onAccent, border: "none", padding: "10px 0", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    <Plus size={15} /> {ui.btnEntry}
                  </button>
                  <button onClick={() => setShowTransfer(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: t.surfaceAlt, color: t.textPrimary, border: `1px solid ${t.surfaceAltBorder}`, padding: "10px 0", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    <ArrowLeftRight size={14} /> {ui.btnTransfer}
                  </button>
                </div>
              </div>

              {pieData.some((d) => d.value > 0) && (
                <div style={{ background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 18, padding: "18px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>{ui.byCategory}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 110, height: 110, flexShrink: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" innerRadius={32} outerRadius={52} paddingAngle={3}>
                            {pieData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      {Object.entries(account.categories).map(([id, c]) => (
                        <div key={id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5 }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, color: t.textPrimary }}>{c.label}</span>
                          <span className="num" style={{ color: t.textMuted }}>{currency(c.balance, account.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 12, color: t.textMuted, margin: "0 2px 8px" }}>{ui.recentTx}</div>
              {account.transactions.slice(0, 6).map((tx) => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px", borderBottom: `1px solid ${t.surfaceBorder}` }}>
                  {tx.type === "entrata" ? <TrendingUp size={15} color="#2ECC71" /> : tx.type === "spesa" ? <TrendingDown size={15} color="#FF7A6B" /> : <Wallet size={15} color={t.textMuted} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: t.textStrong }}>{tx.category}</div>
                    {tx.note && <div style={{ fontSize: 11.5, color: t.textMuted }}>{tx.note}</div>}
                  </div>
                  <div className="num" style={{ fontSize: 13.5, fontWeight: 600, color: tx.type === "entrata" ? "#2ECC71" : tx.type === "spesa" ? "#FF7A6B" : t.textMuted }}>
                    {tx.type === "spesa" ? "−" : tx.type === "entrata" ? "+" : ""}{currency(tx.amount, account.currency)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== Chat tab ===== */}
          {tab === "chat" && (
            <>
              <div ref={scrollRef} className="scrollbar" style={{ flex: 1, overflowY: "auto", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {chatForAccount.length === 0 && (
                  <div style={{ textAlign: "center", color: t.textMuted, fontSize: 13, marginTop: 30, lineHeight: 1.7 }}>
                    {ui.chatEmpty1} <span style={{ color: t.textMuted, fontStyle: "italic" }}>{ui.chatEmptyExample}</span><br />
                    {ui.chatEmpty2}
                  </div>
                )}
                {chatForAccount.map((m, i) => (
                  <div key={i} className="in" style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "82%", padding: "9px 13px", borderRadius: 15,
                      borderBottomRightRadius: m.role === "user" ? 4 : 15,
                      borderBottomLeftRadius: m.role === "user" ? 15 : 4,
                      background: m.role === "user" ? t.surfaceAlt : `${t.accent}18`,
                      border: m.role === "assistant" ? `1px solid ${t.accent}40` : "none",
                      fontSize: 14, lineHeight: 1.5,
                    }}>
                      {m.content}
                      {m.txOk && <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: 11, color: "#2ECC71" }}><Check size={11} /> Registrato</div>}
                      {m.role === "assistant" && (
                        <button onClick={() => speak(m.content)} className="icon-btn" style={{ marginTop: 5, color: t.textMuted }} aria-label="Ascolta">
                          <Volume2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {pendingReceipt && (
                  <div className="in" style={{ alignSelf: "flex-start", maxWidth: "88%", background: t.surfaceRow, border: `1px solid ${t.accent}55`, borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 6 }}>📷 Scontrino letto</div>
                    <div className="num" style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>{currency(pendingReceipt.amount, account.currency)}</div>
                    <div style={{ fontSize: 13, color: t.textPrimary, marginBottom: 12 }}>{pendingReceipt.note} · {account.categories[pendingReceipt.category]?.label || pendingReceipt.category}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={confirmReceipt} style={{ flex: 1, background: t.accent, color: t.onAccent, border: "none", borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Conferma</button>
                      <button onClick={() => setPendingReceipt(null)} style={{ flex: 1, background: t.surfaceAlt, color: t.textPrimary, border: `1px solid ${t.surfaceAltBorder}`, borderRadius: 8, padding: "8px 0", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>Annulla</button>
                    </div>
                  </div>
                )}

                {pendingCategoryChoice && (
                  <div className="in" style={{ alignSelf: "flex-start", maxWidth: "88%", background: t.surfaceRow, border: `1px solid ${t.accent}55`, borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>Scegli una categoria</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {Object.entries(account.categories).map(([id, c]) => (
                        <button key={id} onClick={() => resolveCategoryChoice(id)} style={{ display: "flex", alignItems: "center", gap: 5, background: t.surfaceAlt, border: `1px solid ${c.color}55`, borderRadius: 20, padding: "6px 12px", color: t.textStrong, fontSize: 12, cursor: "pointer" }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} /> {c.label}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => resolveCategoryChoice("TUTTE")} style={{ width: "100%", background: t.accent, color: t.onAccent, border: "none", borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer", marginBottom: 6 }}>
                      Dividi su tutte le categorie
                    </button>
                    <button onClick={() => setPendingCategoryChoice(null)} style={{ width: "100%", background: "none", border: `1px solid ${t.surfaceAltBorder}`, borderRadius: 8, padding: "8px 0", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>Annulla</button>
                  </div>
                )}

                {sending && <div style={{ fontSize: 13, color: t.textMuted }}>{(T[appLanguage] || T.it).thinking}</div>}
              </div>

              {error && <div style={{ padding: "0 16px", color: "#FF7A6B", fontSize: 12, marginBottom: 4 }}>{error}</div>}

              <div style={{ display: "flex", gap: 7, padding: "10px 14px 16px", borderTop: `1px solid ${t.surfaceBorder}`, alignItems: "flex-end" }}>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
                <button onClick={() => fileInputRef.current?.click()} className="icon-btn" aria-label="Scatta scontrino" style={{ width: 40, height: 40, borderRadius: 10, background: t.surface, flexShrink: 0 }}>
                  <Camera size={16} color={t.textMuted} />
                </button>
                {voiceSupported && (
                  <button
                    onClick={() => { if (!listening) toggleMic(); }}
                    disabled={listening}
                    aria-label="Parla"
                    className="icon-btn"
                    style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: listening ? t.surface : t.surface, color: listening ? t.textMuted : t.textMuted, opacity: listening ? 0.5 : 1 }}
                  >
                    <Mic size={16} />
                  </button>
                )}
                {voiceSupported && listening && (
                  <button
                    onClick={() => toggleMic()}
                    aria-label="Ferma registrazione"
                    className="icon-btn"
                    style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "#E85D4A", color: "#fff", animation: "pulseMic 1.4s infinite" }}
                  >
                    <MicOff size={16} />
                  </button>
                )}
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={listening ? (T[appLanguage] || T.it).listening : (T[appLanguage] || T.it).placeholder}
                  rows={1}
                  style={{ flex: 1, resize: "none", background: t.surface, border: `1px solid ${t.surfaceBorder}`, borderRadius: 10, padding: "10px 12px", color: t.textStrong, fontSize: 14 }}
                />
                <button onClick={send} disabled={sending || !input.trim()} className="icon-btn" aria-label="Invia" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: input.trim() && !sending ? t.accent : t.surface, color: input.trim() && !sending ? t.onAccent : t.textMuted }}>
                  <Send size={16} />
                </button>
              </div>
            </>
          )}

          {/* ===== History tab ===== */}
          {tab === "history" && (
            <div className="scrollbar" style={{ flex: 1, overflowY: "auto", padding: "6px 18px 18px" }}>
              {account.transactions.length === 0 && <div style={{ textAlign: "center", color: t.textMuted, fontSize: 13, marginTop: 40 }}>{ui.historyEmpty}</div>}
              {account.transactions.map((tx) => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 4px", borderBottom: `1px solid ${t.surfaceBorder}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5 }}>{tx.category}</div>
                    <div style={{ fontSize: 11.5, color: t.textMuted }}>{tx.date}{tx.note ? " · " + tx.note : ""}</div>
                  </div>
                  <div className="num" style={{ fontSize: 13.5, fontWeight: 600, color: tx.type === "entrata" ? "#2ECC71" : tx.type === "spesa" ? "#FF7A6B" : t.textMuted }}>
                    {tx.type === "spesa" ? "−" : tx.type === "entrata" ? "+" : ""}{currency(tx.amount, account.currency)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== Bottom nav ===== */}
          <div style={{ display: "flex", borderTop: `1px solid ${t.surfaceBorder}`, background: t.surfaceDeep }}>
            {[
              { id: "dash", label: ui.tabDashboard, icon: LayoutGrid },
              { id: "chat", label: ui.tabChat, icon: MessageCircle },
              { id: "history", label: ui.tabHistory, icon: History },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} className="tab-btn" onClick={() => setTab(id)} style={{ color: tab === id ? t.accent : t.textMuted }}>
                <Icon size={19} />
                <span style={{ fontSize: 10.5, fontWeight: 600 }}>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ===== Account switcher modal ===== */}
      {showAccountSwitcher && (
        <Modal onClose={() => setShowAccountSwitcher(false)} title={ui.yourAccounts} t={t}>
          {Object.values(accounts).map((a) => (
            <button key={a.id} onClick={() => { persistAccounts(accounts, a.id); setShowAccountSwitcher(false); }}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: a.id === activeId ? `${t.accent}18` : t.surface, border: `1px solid ${a.id === activeId ? t.accent : t.surfaceBorder}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", color: t.textStrong }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</span>
              <span className="num" style={{ fontSize: 13, color: t.textMuted }}>{currency(a.totalBalance, a.currency)}</span>
            </button>
          ))}
          <button onClick={() => { setShowAccountSwitcher(false); setShowNewAccount(true); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: `1.5px dashed ${t.surfaceAltBorder}`, borderRadius: 10, padding: "12px 0", color: t.textMuted, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
            <Plus size={14} /> {ui.newAccountBtn}
          </button>
        </Modal>
      )}

      {/* ===== New account modal ===== */}
      {showNewAccount && (
        <Modal onClose={() => Object.keys(accounts).length > 0 && setShowNewAccount(false)} title={newAccountMode === "create" ? ui.newAccountTitle : ui.restoreTitle} t={t}>
          {newAccountMode === "create" ? (
            <>
              <NewAccountForm accent={t.accent} t={t} onCreate={createAccount} ui={ui} />
              <button
                onClick={() => { setNewAccountMode("restore"); setRestoreError(null); }}
                style={{ width: "100%", background: "none", border: "none", color: t.textMuted, fontSize: 12.5, cursor: "pointer", textAlign: "center", padding: "6px 0" }}
              >
                {ui.haveCode} <span style={{ color: t.accent, fontWeight: 600 }}>{ui.recoverData}</span>
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: t.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
                {ui.restoreDesc} <span className="num">FNX-XXXX-XXXX-XXXX</span>)
              </div>
              <input
                value={restoreInput}
                onChange={(e) => setRestoreInput(e.target.value)}
                placeholder="FNX-XXXX-XXXX-XXXX"
                style={{ ...inputStyle(t), fontFamily: "'JetBrains Mono', monospace" }}
              />
              {restoreError && <div style={{ color: "#FF7A6B", fontSize: 12, marginTop: -8, marginBottom: 12 }}>{restoreError}</div>}
              <button
                onClick={restoreFromCode}
                disabled={restoring || !restoreInput.trim()}
                style={{ width: "100%", background: t.accent, color: t.onAccent, border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 10 }}
              >
                {restoring ? ui.restoringBtn : ui.restoreBtn}
              </button>
              <button
                onClick={() => { setNewAccountMode("create"); setRestoreError(null); }}
                style={{ width: "100%", background: "none", border: "none", color: t.textMuted, fontSize: 12.5, cursor: "pointer", textAlign: "center", padding: "6px 0" }}
              >
                {ui.orCreateNew} <span style={{ color: t.accent, fontWeight: 600 }}>{ui.createNewAccount}</span>
              </button>
            </>
          )}
        </Modal>
      )}

      {/* ===== Transfer modal ===== */}
      {showTransfer && account && (
        <Modal onClose={() => setShowTransfer(false)} title={ui.transferTitle} t={t}>
          <TransferForm accounts={accounts} fromDefault={activeId} accent={t.accent} t={t} onSubmit={transferBetween} ui={ui} />
        </Modal>
      )}

      {/* ===== Manual transaction form ===== */}
      {showForm && account && (
        <Modal onClose={() => setShowForm(false)} title={ui.newEntryTitle} t={t}>
          <TxForm account={account} accent={t.accent} t={t} onSubmit={(payload) => { commitTransaction(payload); setShowForm(false); }} ui={ui} />
        </Modal>
      )}

      {/* ===== Settings modal ===== */}
      {/* ===== Language picker (primo avvio) ===== */}
      {showLanguagePicker && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,20,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, padding: 24 }}>
          <div style={{ background: t.modalBg, border: `1px solid ${t.modalBorder}`, borderRadius: 18, padding: 24, width: "100%", maxWidth: 380 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Languages size={18} color={t.accent} />
              <h2 className="display" style={{ fontSize: 17, fontWeight: 700, margin: 0, color: t.textStrong }}>Choose your language</h2>
            </div>
            <div style={{ fontSize: 12.5, color: t.textMuted, marginBottom: 16 }}>Puoi cambiarla in qualsiasi momento dalle Impostazioni.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(LANGUAGES).map(([key, name]) => (
                <button key={key} onClick={() => changeLanguage(key)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", borderRadius: 10, border: `1.5px solid ${t.surfaceBorder}`, background: t.surfaceRow, color: t.textStrong, fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!showLanguagePicker && showOnboarding && (() => {
        const slides = ONBOARDING_SLIDES[appLanguage] || ONBOARDING_SLIDES.it;
        const slide = slides[onboardingStep];
        const isLast = onboardingStep === slides.length - 1;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,20,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, padding: 24 }}>
            <div style={{ background: t.modalBg, border: `1px solid ${t.modalBorder}`, borderRadius: 18, padding: 24, width: "100%", maxWidth: 380, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>{slide.icon}</div>
              <h2 className="display" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: t.textStrong }}>{slide.title}</h2>
              <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6, marginBottom: 20 }}>{slide.text}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
                {slides.map((_, i) => (
                  <div key={i} style={{ width: i === onboardingStep ? 18 : 6, height: 6, borderRadius: 3, background: i === onboardingStep ? t.accent : t.surfaceBorder, transition: "width 0.2s" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!isLast && (
                  <button onClick={finishOnboarding} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: `1.5px solid ${t.surfaceBorder}`, background: "transparent", color: t.textMuted, fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>
                    {ui.obSkip}
                  </button>
                )}
                <button
                  onClick={() => (isLast ? finishOnboarding() : setOnboardingStep((s) => s + 1))}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: t.accent, color: t.onAccent, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
                >
                  {isLast ? ui.obStart : ui.obNext}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} title={ui.settingsTitle} t={t}>
          <div style={{ fontSize: 12, color: t.textMuted, margin: "4px 0 10px", display: "flex", alignItems: "center", gap: 6 }}><KeyRound size={13} /> {ui.syncCodeTitle}</div>
          <div style={{ background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 11.5, color: t.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
              {ui.syncCodeDesc}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                ref={codeInputRef}
                readOnly
                value={syncCode || "…"}
                onFocus={(e) => e.target.select()}
                className="num"
                style={{ flex: 1, background: t.surfaceDeep, border: `1px solid ${t.surfaceBorder}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, letterSpacing: "0.03em", color: t.textStrong }}
              />
              <button onClick={copySyncCode} className="icon-btn" aria-label="Copy code" style={{ width: 40, height: 40, borderRadius: 8, background: copied ? "#2ECC71" : t.surfaceAlt, border: `1px solid ${t.surfaceAltBorder}`, flexShrink: 0, color: copied ? t.onAccent : t.textPrimary }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: "#576073", marginTop: 6 }}>{ui.copyFallback}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 11, color: syncStatus === "error" ? "#FF7A6B" : syncStatus === "syncing" ? "#F0B429" : t.textMuted }}>
              {syncStatus === "syncing" ? <RefreshCw size={11} /> : <Cloud size={11} />}
              {syncStatus === "synced" && ui.syncedLabel}
              {syncStatus === "syncing" && ui.syncingLabel}
              {syncStatus === "error" && ui.syncErrorLabel}
              {syncStatus === "idle" && ui.syncIdleLabel}
            </div>
          </div>

          <div style={{ background: t.surfaceRow, border: `1.5px dashed ${t.surfaceAltBorder}`, borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 11.5, color: t.textMuted, marginBottom: 8 }}>{ui.haveCodeOtherDevice}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={restoreInput}
                onChange={(e) => setRestoreInput(e.target.value)}
                placeholder="FNX-XXXX-XXXX-XXXX"
                style={{ flex: 1, background: t.surfaceDeep, border: `1px solid ${t.surfaceBorder}`, borderRadius: 8, padding: "9px 11px", color: t.textStrong, fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace" }}
              />
              <button onClick={restoreFromCode} disabled={restoring || !restoreInput.trim()} style={{ background: t.accent, color: t.onAccent, border: "none", borderRadius: 8, padding: "0 16px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                {restoring ? "…" : ui.recoverBtn}
              </button>
            </div>
            {restoreError && <div style={{ color: "#FF7A6B", fontSize: 11.5, marginTop: 6 }}>{restoreError}</div>}
          </div>

          <div style={{ fontSize: 12, color: t.textMuted, margin: "4px 0 10px", display: "flex", alignItems: "center", gap: 6 }}><Languages size={13} /> {ui.languageTitle}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            {Object.entries(LANGUAGES).map(([key, name]) => (
              <button key={key} onClick={() => changeLanguage(key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${appLanguage === key ? t.accent : t.surfaceBorder}`, background: t.surfaceRow, cursor: "pointer" }}>
                <span style={{ fontSize: 12.5, color: appLanguage === key ? t.accent : t.textStrong }}>{name}</span>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12, color: t.textMuted, margin: "4px 0 10px", display: "flex", alignItems: "center", gap: 6 }}><Palette size={13} /> {ui.themeTitle}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            {Object.entries(THEMES).map(([key, th]) => (
              <button key={key} onClick={() => changeTheme(key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${themeKey === key ? th.accent : t.surfaceBorder}`, background: t.surfaceRow, cursor: "pointer" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: th.accent }} />
                <span style={{ fontSize: 12.5, color: t.textStrong }}>{th.name}</span>
              </button>
            ))}
          </div>

          {account && (
            <>
              <div style={{ fontSize: 12, color: t.textMuted, margin: "4px 0 10px", display: "flex", alignItems: "center", gap: 6 }}><Wallet size={13} /> {ui.currencyTitle} · {account.name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                {Object.entries(CURRENCIES).map(([code, c]) => (
                  <button key={code} onClick={() => changeCurrency(code)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${(account.currency || "EUR") === code ? t.accent : t.surfaceBorder}`, background: t.surfaceRow, cursor: "pointer" }}>
                    <span style={{ fontSize: 12.5, color: (account.currency || "EUR") === code ? t.accent : t.textStrong }}>{c.label}</span>
                  </button>
                ))}
              </div>

              {monthlyData.length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: t.textMuted, margin: "4px 0 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>{ui.monthlyTrend} · {account.name}</span>
                    {monthlyChange !== null && (
                      <span style={{ color: monthlyChange >= 20 ? "#2ECC71" : monthlyChange >= 0 ? "#F0B429" : "#FF7A6B", fontWeight: 700 }}>
                        {monthlyChange >= 0 ? "+" : ""}{monthlyChange}% {ui.vsLastMonth}
                      </span>
                    )}
                  </div>
                  <div style={{ background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 14, padding: "14px 10px 6px", marginBottom: 20, height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData} margin={{ top: 4, right: 10, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke={t.modalBorder} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: t.textMuted, fontSize: 10 }} axisLine={{ stroke: t.modalBorder }} tickLine={false} />
                        <YAxis tick={{ fill: t.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: t.surfaceDeep, border: `1px solid ${t.surfaceBorder}`, borderRadius: 8, fontSize: 12 }} formatter={(v) => currency(v, account.currency)} />
                        <Line type="monotone" dataKey="net" stroke={t.accent} strokeWidth={2.5} dot={{ r: 3, fill: t.accent }} name={ui.netMonthly} />
                        <Line type="monotone" dataKey="target" stroke={t.accent2} strokeWidth={1.5} strokeDasharray="5 4" dot={false} name={ui.threshold20} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: "flex", gap: 14, marginBottom: 20, fontSize: 11, color: t.textMuted }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 12, height: 2, background: t.accent }} /> {ui.netMonthly}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 12, height: 2, background: t.accent2, opacity: 0.7 }} /> {ui.threshold20}</span>
                  </div>
                </>
              )}

              <div style={{ fontSize: 12, color: t.textMuted, margin: "4px 0 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{ui.categoriesTitle} · {account.name}</span>
                {(() => {
                  const total = Math.round(Object.values(account.categories).reduce((s, c) => s + (c.pct || 0), 0));
                  return <span style={{ fontWeight: 700, color: total === 100 ? "#2ECC71" : "#F0B429" }}>{ui.total}: {total}%</span>;
                })()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                {Object.entries(account.categories).map(([id, c]) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                    <input
                      value={c.label}
                      onChange={(e) => renameCategory(id, e.target.value)}
                      style={{ flex: 1, background: t.surface, border: `1px solid ${t.surfaceBorder}`, borderRadius: 6, padding: "6px 8px", color: t.textStrong, fontSize: 12.5 }}
                    />
                    <input type="number" min="0" max="100" value={c.pct} onChange={(e) => updateCategoryPct(id, parseFloat(e.target.value) || 0)} style={{ width: 52, background: t.surface, border: `1px solid ${t.surfaceBorder}`, borderRadius: 6, padding: "6px 6px", color: t.textStrong, fontSize: 12.5, textAlign: "right" }} />
                    <span style={{ fontSize: 11, color: t.textMuted }}>%</span>
                    <button onClick={() => deleteCategory(id)} className="icon-btn" aria-label="Delete category" style={{ color: t.textMuted }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <AddCategoryRow accent={t.accent} t={t} onAdd={addCategory} ui={ui} />

              {Object.keys(account.learnedTerms || {}).length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: t.textMuted, margin: "18px 0 8px" }}>{ui.learnedWords}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {Object.entries(account.learnedTerms || {}).map(([word, catId]) => (
                      <span key={word} style={{ display: "flex", alignItems: "center", gap: 6, background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 16, padding: "5px 6px 5px 10px", fontSize: 11.5, color: t.textPrimary }}>
                        "{word}" → {account.categories[catId]?.label || "—"}
                        <button onClick={() => forgetLearnedTerm(word)} className="icon-btn" aria-label="Forget" style={{ color: t.textMuted }}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </>
              )}

              {Object.keys(account.customTypeWords || {}).length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: t.textMuted, margin: "18px 0 8px" }}>{ui.customWords}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {Object.entries(account.customTypeWords || {}).map(([word, type]) => (
                      <span key={word} style={{ display: "flex", alignItems: "center", gap: 6, background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 16, padding: "5px 6px 5px 10px", fontSize: 11.5, color: t.textPrimary }}>
                        "{word}" → {type === "entrata" ? (T[appLanguage] || T.it).income : (T[appLanguage] || T.it).expense}
                        <button onClick={() => forgetCustomTypeWord(word)} className="icon-btn" aria-label="Forget" style={{ color: t.textMuted }}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </>
              )}

              <div style={{ fontSize: 12, color: t.textMuted, margin: "18px 0 10px" }}>{ui.recurringTitle}</div>
              {(account.recurring || []).length === 0 && (
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>{ui.recurringEmpty}</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                {(account.recurring || []).map((r) => {
                  const isSpesa = r.transactionType === "spesa";
                  const freqLabel = r.frequency === "weekly" ? ui.weekly : r.frequency === "yearly" ? ui.yearly : ui.monthly;
                  return (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 10, padding: "10px 12px" }}>
                      {isSpesa ? <TrendingDown size={15} color="#FF7A6B" style={{ flexShrink: 0 }} /> : <TrendingUp size={15} color="#2ECC71" style={{ flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.label}{r.kind ? ` · ${RECURRING_KINDS[r.kind]}` : ""}</div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>
                          {freqLabel} · {r.category === "TUTTE" ? ui.allCategoriesSplit : account.categories[r.category]?.label || r.category}
                          {r.lastAppliedDate ? ` · ${ui.lastRun}: ${r.lastAppliedDate}` : ` · ${ui.notActiveYet}`}
                        </div>
                      </div>
                      <span className="num" style={{ fontSize: 13, fontWeight: 700, color: isSpesa ? "#FF7A6B" : "#2ECC71" }}>{isSpesa ? "−" : "+"}{currency(r.amount, account.currency)}</span>
                      <button onClick={() => deleteRecurring(r.id)} className="icon-btn" aria-label="Delete recurring entry" style={{ color: t.textMuted }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <RecurringForm accent={t.accent} t={t} categories={account.categories} onAdd={addRecurring} ui={ui} />

              <button onClick={() => { deleteAccount(account.id); setShowSettings(false); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: "1.5px solid #4A2A2A", borderRadius: 10, padding: "11px 0", color: "#FF7A6B", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 20 }}>
                <Trash2 size={14} /> {ui.deleteAccount}
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ onClose, title, children, t }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,20,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.modalBg, width: "100%", maxWidth: 480, borderRadius: "18px 18px 0 0", padding: "18px 18px 26px", maxHeight: "85vh", overflowY: "auto", border: `1px solid ${t.modalBorder}`, borderBottom: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 className="display" style={{ fontSize: 17, fontWeight: 700, margin: 0, color: t.textStrong }}>{title}</h2>
          <button onClick={onClose} className="icon-btn" style={{ color: t.textMuted }}><X size={19} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NewAccountForm({ accent, t, onCreate, ui }) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [currencyCode, setCurrencyCode] = useState("EUR");
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 5 }}>{ui.accountName}</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={ui.accountNamePh} style={inputStyle(t)} />
      <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 5 }}>{ui.currencyLabel}</label>
      <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} style={selectStyle(t)}>
        {Object.entries(CURRENCIES).map(([code, c]) => <option key={code} value={code}>{c.label}</option>)}
      </select>
      <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 5 }}>{ui.initialBalance} ({CURRENCIES[currencyCode].symbol})</label>
      <input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0,00" style={{ ...inputStyle(t), fontFamily: "'JetBrains Mono', monospace" }} />
      <button onClick={() => onCreate(name.trim() || "Conto", parseFloat(balance.replace(",", ".")) || 0, currencyCode)} style={{ width: "100%", background: accent, color: t.onAccent, border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        {ui.createAccountBtn}
      </button>
    </div>
  );
}

function TransferForm({ accounts, fromDefault, accent, t, onSubmit, ui }) {
  const ids = Object.keys(accounts);
  const [from, setFrom] = useState(fromDefault);
  const [to, setTo] = useState(ids.find((i) => i !== fromDefault) || "");
  const [amount, setAmount] = useState("");
  const fromCur = CURRENCIES[accounts[from]?.currency || "EUR"].symbol;
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 5 }}>{ui.from}</label>
      <select value={from} onChange={(e) => setFrom(e.target.value)} style={selectStyle(t)}>
        {ids.map((id) => <option key={id} value={id}>{accounts[id].name}</option>)}
      </select>
      <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 5 }}>{ui.to}</label>
      <select value={to} onChange={(e) => setTo(e.target.value)} style={selectStyle(t)}>
        {ids.map((id) => <option key={id} value={id}>{accounts[id].name}</option>)}
      </select>
      <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 5 }}>{ui.amount} ({fromCur})</label>
      <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" style={{ ...inputStyle(t), fontFamily: "'JetBrains Mono', monospace" }} />
      <button onClick={() => onSubmit(from, to, parseFloat(amount.replace(",", ".")) || 0)} style={{ width: "100%", background: accent, color: t.onAccent, border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        {ui.transferBtn}
      </button>
    </div>
  );
}

function TxForm({ account, accent, t, onSubmit, ui }) {
  const [type, setType] = useState("spesa");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(Object.keys(account.categories)[0]);
  const [note, setNote] = useState("");
  const sym = CURRENCIES[account.currency || "EUR"].symbol;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["spesa", "entrata"].map((tt) => (
          <button key={tt} onClick={() => setType(tt)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1.5px solid ${type === tt ? accent : t.surfaceBorder}`, background: type === tt ? `${accent}22` : "transparent", color: type === tt ? accent : t.textMuted, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>
            {tt === "spesa" ? ui.expenseType : ui.incomeType}
          </button>
        ))}
      </div>
      <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 5 }}>{ui.amount} ({sym})</label>
      <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" style={{ ...inputStyle(t), fontFamily: "'JetBrains Mono', monospace" }} />
      <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 5 }}>{ui.category}</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle(t)}>
        {Object.entries(account.categories).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
      </select>
      <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 5 }}>{ui.note}</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ui.notePh} style={{ ...inputStyle(t), marginBottom: 18 }} />
      <button onClick={() => onSubmit({ transactionType: type, amount: parseFloat(amount.replace(",", ".")) || 0, category, note })} style={{ width: "100%", background: accent, color: t.onAccent, border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        {ui.save}
      </button>
    </div>
  );
}

const inputStyle = (t) => ({ width: "100%", padding: "11px 13px", borderRadius: 9, border: `1px solid ${t.surfaceBorder}`, background: t.surface, color: t.textStrong, fontSize: 14, marginBottom: 14 });
const selectStyle = (t) => ({ ...inputStyle(t) });

function RecurringForm({ accent, t, categories, onAdd, ui }) {
  const [transactionType, setTransactionType] = useState("entrata");
  const [kind, setKind] = useState("abbonamento");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [category, setCategory] = useState("TUTTE");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const submit = () => {
    const amt = parseFloat(amount.replace(",", "."));
    if (!label.trim() || !amt || amt <= 0) return;
    onAdd({ transactionType, kind: transactionType === "spesa" ? kind : null, label: label.trim(), amount: amt, frequency, category, startDate });
    setLabel(""); setAmount("");
  };

  return (
    <div style={{ background: t.surfaceRow, border: `1.5px dashed ${t.surfaceAltBorder}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {["entrata", "spesa"].map((tt) => (
          <button key={tt} onClick={() => setTransactionType(tt)} style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: `1.5px solid ${transactionType === tt ? accent : t.surfaceBorder}`, background: transactionType === tt ? `${accent}22` : "transparent", color: transactionType === tt ? accent : t.textMuted, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            {tt === "spesa" ? ui.expenseType : ui.incomeType}
          </button>
        ))}
      </div>
      {transactionType === "spesa" && (
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...selectStyle(t), marginBottom: 8, fontSize: 12.5, padding: "9px 10px" }}>
          <option value="abbonamento">{ui.kindSub}</option>
          <option value="biglietto">{ui.kindTicket}</option>
          <option value="altro">{ui.kindOther}</option>
        </select>
      )}
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={transactionType === "spesa" ? ui.recurringNamePh : ui.recurringNamePhIncome} style={{ ...inputStyle(t), marginBottom: 8, fontSize: 12.5, padding: "9px 10px" }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={ui.amountPh} style={{ ...inputStyle(t), marginBottom: 0, fontSize: 12.5, padding: "9px 10px", fontFamily: "'JetBrains Mono', monospace" }} />
        <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={{ ...selectStyle(t), marginBottom: 0, fontSize: 12.5, padding: "9px 10px", width: 120 }}>
          <option value="weekly">{ui.freqWeekly}</option>
          <option value="monthly">{ui.freqMonthly}</option>
          <option value="yearly">{ui.freqYearly}</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...selectStyle(t), marginBottom: 0, fontSize: 12.5, padding: "9px 10px" }}>
          <option value="TUTTE">{ui.allCategoriesSplit}</option>
          {Object.entries(categories).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ ...inputStyle(t), marginBottom: 0, fontSize: 12.5, padding: "9px 10px", width: 140 }} />
      </div>
      <button onClick={submit} style={{ width: "100%", background: accent, color: t.onAccent, border: "none", borderRadius: 8, padding: "9px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
        {ui.addRecurringBtn}
      </button>
    </div>
  );
}

function AddCategoryRow({ accent, t, onAdd, ui }) {
  const [val, setVal] = useState("");
  const submit = () => { onAdd(val); setVal(""); };
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
      <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={ui.newCategoryPh} style={{ flex: 1, background: t.surface, border: `1.5px dashed ${t.surfaceAltBorder}`, borderRadius: 8, padding: "9px 11px", color: t.textStrong, fontSize: 12.5 }} />
      <button onClick={submit} style={{ background: accent, color: t.onAccent, border: "none", borderRadius: 8, padding: "0 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
        <Plus size={14} />
      </button>
    </div>
  );
}
