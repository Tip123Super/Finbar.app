import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus, Trash2, Wallet, Send, Mic, MicOff, Camera, X, Check, ArrowLeftRight,
  Settings, MessageCircle, LayoutGrid, History, ChevronDown, ChevronRight, ChevronLeft, Palette, TrendingUp, TrendingDown, Volume2, Copy, Cloud, RefreshCw, KeyRound, Languages, Tag, Repeat, Shield, Type, Maximize2, Download, Table, FileText, Bell, RotateCcw, Archive, ChevronUp, Calendar, Pencil,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, LineChart, Line, ReferenceLine, CartesianGrid } from "recharts";
import { scanReceiptWithTesseract } from "./receiptOcr";
import { LEGAL_TEXT } from "./legalText";
import { getDailyTip } from "./dailyTips";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
const LEGAL_ACCEPTED_KEY = "finex:legal-accepted";
const TEXT_SCALE_KEY = "finex:text-scale";
const TEXT_SCALE_OPTIONS = [1, 1.15, 1.3, 1.5, 1.75, 2];
const DAILY_RECAP_SEEN_KEY = "finex:daily-recap-seen";
const NOTIF_RECAP_ENABLED_KEY = "finex:notif-recap-enabled";
const NOTIF_RECAP_HOUR_KEY = "finex:notif-recap-hour";
const PUSH_HIDE_AMOUNTS_KEY = "finex:push-hide-amounts";
// Versione dell'app, mostrata in fondo al menu delle Impostazioni: serve a capire quale build gira sul telefono
// (l'app installata può tenere in cache una versione vecchia). Da aggiornare a ogni rilascio.
const APP_VERSION = "2026.10.26-d";
// Chiave pubblica VAPID per le notifiche push (non è segreta; la privata sta solo nei segreti di Supabase).
const VAPID_PUBLIC_KEY = "BKHQiTELxMKhcohPqrGfjcEOPtsbPu1Dp9-bkzEkNdJtoDl2MYebXYQZ9MEHvLK456oprllimPVV9jWIi5YMbCc";
const NOTIF_TIP_ENABLED_KEY = "finex:notif-tip-enabled";
const NOTIF_TIP_SEEN_KEY = "finex:notif-tip-seen";

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
async function supabaseRpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${fn} failed`);
}

// ---- Notifiche push ----
function urlBase64ToUint8Array(b64) {
  const padded = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
// "ok" | "ios-install" (iPhone: serve l'app aggiunta alla Home) | "unsupported"
function getPushSupport() {
  try {
    const ua = navigator.userAgent || "";
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    if (isIOS && !standalone) return "ios-install";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
    return "ok";
  } catch {
    return "unsupported";
  }
}
async function detectBrave() {
  try { return !!(navigator.brave && (await navigator.brave.isBrave())); } catch { return false; }
}
// Invia (o aggiorna) l'iscrizione di questo dispositivo sul server, con le preferenze correnti.
async function savePushSubscription(sub, prefs) {
  const j = sub.toJSON();
  await supabaseRpc("finex_push_subscribe", {
    p_endpoint: j.endpoint,
    p_p256dh: j.keys.p256dh,
    p_auth: j.keys.auth,
    p_sync_code: prefs.syncCode,
    p_language: prefs.language,
    p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome",
    p_send_hour: prefs.hour,
    p_daily_summary: prefs.recap,
    p_hide_amounts: prefs.hide,
  });
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

// Fallback AI: se il parser locale non capisce un messaggio, si poteva chiederlo all'AI.
// Per ora è DISATTIVATO: nessun testo dell'utente lascia il dispositivo verso servizi AI, e la
// Privacy Policy (che non cita servizi AI) resta coerente con il comportamento reale.
// Per riattivarlo un giorno: (1) mettere true; (2) NON chiamare api.anthropic.com direttamente dal
// browser con una chiave — serve prima una funzione server (es. Vercel) che custodisca la chiave
// e faccia da intermediario; (3) aggiornare Privacy Policy e Termini citando il fornitore AI.
const AI_FALLBACK_ENABLED = false;

// Spende da una categoria specifica. Se non ha abbastanza saldo, la porta esattamente
// a 0 (mai sotto) e distribuisce la parte mancante sulle ALTRE categorie che hanno ancora
// saldo positivo, in proporzione alle loro percentuali. Se anche una di queste non basta,
// si ferma a 0 a sua volta e il resto continua a scaricarsi su quelle ancora "in vita" —
// così nessuna categoria scende mai sotto zero singolarmente, il "buco" si condivide a
// cascata su tutto il budget rimasto. Il saldo TOTALE del conto (gestito altrove) scala
// sempre della cifra esatta spesa, indipendentemente da come si distribuisce qui dentro.
function spendFromCategory(acc, category, amount) {
  const cat = acc.categories[category];
  let remaining = amount;
  const breakdown = {}; // { categoryId: quanto è stato prelevato esattamente da lì }
  const take = (c, v) => { breakdown[c] = (breakdown[c] || 0) + v; };

  const useDirect = Math.min(Math.max(cat.balance, 0), remaining);
  cat.balance -= useDirect;
  remaining -= useDirect;
  if (useDirect > 0) take(category, useDirect);
  if (remaining <= 0.0001) return breakdown;

  let pool = Object.keys(acc.categories).filter((c) => c !== category && acc.categories[c].balance > 0);
  while (remaining > 0.0001 && pool.length > 0) {
    const totalPct = pool.reduce((s, c) => s + (acc.categories[c].pct || 0), 0);
    let absorbedThisRound = 0;
    const emptied = [];
    pool.forEach((c) => {
      const weight = totalPct > 0 ? acc.categories[c].pct / totalPct : 1 / pool.length;
      const share = remaining * weight;
      const target = acc.categories[c];
      if (target.balance >= share) {
        target.balance -= share;
        absorbedThisRound += share;
        take(c, share);
      } else {
        absorbedThisRound += target.balance;
        take(c, target.balance);
        target.balance = 0;
        emptied.push(c);
      }
    });
    remaining -= absorbedThisRound;
    if (emptied.length === 0) break; // tutto assorbito in questo giro, nessuno si è azzerato
    pool = pool.filter((c) => !emptied.includes(c));
  }
  // se resta ancora un'eccedenza dopo aver azzerato proprio tutte le categorie,
  // non c'è più nulla da fare a livello di suddivisione interna: il saldo totale
  // del conto (calcolato a parte) riflette comunque per intero la spesa reale.
  return breakdown;
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
    dues: [], // scadenze e debiti a rate (vedi "Scadenze e debiti")
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

  let breakdown; // { categoryId: variazione esatta applicata a quella categoria } - serve per annullare/correggere con precisione
  if (category === "TUTTE") {
    // Normalize by the ACTUAL sum of the percentages (not an assumed 100),
    // so the split across categories always adds up exactly to `amount`
    // even if the user's percentages don't total 100%.
    breakdown = {};
    const totalPct = validCats.reduce((s, c) => s + (acc.categories[c].pct || 0), 0);
    validCats.forEach((c) => {
      const weight = totalPct > 0 ? acc.categories[c].pct / totalPct : 1 / validCats.length;
      const share = amount * weight;
      const delta = transactionType === "spesa" ? -share : share;
      acc.categories[c].balance += delta;
      breakdown[c] = delta;
    });
  } else if (transactionType === "spesa") {
    const spent = spendFromCategory(acc, category, amount);
    breakdown = {};
    Object.entries(spent).forEach(([c, v]) => { breakdown[c] = -v; }); // negativo: è stato tolto
  } else {
    acc.categories[category].balance += amount;
    breakdown = { [category]: amount };
  }
  acc.totalBalance += transactionType === "spesa" ? -amount : amount;
  acc.transactions.unshift({
    id: uid(), type: transactionType, amount, category: category === "TUTTE" ? "Tutte le categorie" : acc.categories[category].label, note: note || "", date: todayISO(), currency: account.currency, breakdown,
    rawCategory: category, // "cibo", "TUTTE", ecc. - la chiave vera, non l'etichetta: serve per correggere/ripetere con la stessa categoria senza doverla indovinare dal breakdown (che ha più chiavi anche per una categoria sola, se è sfordata in cascata su altre)
  });
  return { acc, ok: true };
}

// Annulla con esattezza l'ULTIMA transazione registrata (deve essere la più recente,
// nulla deve essere successo dopo): usa il breakdown salvato per restituire esattamente
// quanto preso/dato a ogni categoria, invece di indovinare. Transazioni "init" non si annullano.
function undoLastTransaction(account) {
  const last = account.transactions[0];
  if (!last || last.type === "init") return { acc: account, ok: false, removed: null };
  const acc = JSON.parse(JSON.stringify(account));
  const [removed] = acc.transactions.splice(0, 1);
  if (removed.breakdown) {
    Object.entries(removed.breakdown).forEach(([c, delta]) => {
      if (acc.categories[c]) acc.categories[c].balance -= delta;
    });
  }
  acc.totalBalance -= removed.type === "spesa" ? -removed.amount : removed.amount;
  if (removed.dueRestore) {
    // il pagamento annullato apparteneva a una scadenza: la rimetto com'era prima di toccare "Pagato"
    const r = removed.dueRestore;
    acc.dues = (acc.dues || []).filter((d) => d.id !== r.id).concat([r]);
  }
  return { acc, ok: true, removed };
}

// Controllo leggero (nessuna copia dei dati) per sapere se l'ultima operazione del conto si può annullare:
// "ok" | "none" (niente da annullare) | "noDetails" (operazione vecchia, senza breakdown)
// | "pairBlocked" (trasferimento: nell'altro conto sono state registrate altre operazioni dopo).
function undoCheck(accounts, accountId) {
  const account = accounts[accountId];
  const last = account && account.transactions[0];
  if (!last || last.type === "init") return "none";
  if (!last.breakdown) return "noDetails";
  if (last.transferId) {
    const holder = Object.entries(accounts).find(([id, a]) => id !== accountId && a.transactions.some((tx) => tx.transferId === last.transferId));
    if (holder && holder[1].transactions[0].transferId !== last.transferId) return "pairBlocked";
  }
  return "ok";
}

// Annulla l'ultima operazione del conto attivo. Se è un trasferimento, annulla anche
// la transazione gemella nell'altro conto (stesso transferId), così i due conti restano coerenti.
function undoLastOperation(accounts, accountId) {
  const reason = undoCheck(accounts, accountId);
  if (reason !== "ok") return { ok: false, reason };
  const last = accounts[accountId].transactions[0];
  const { acc, ok, removed } = undoLastTransaction(accounts[accountId]);
  if (!ok) return { ok: false, reason: "none" };
  const next = { ...accounts, [accountId]: acc };
  if (last.transferId) {
    const holder = Object.entries(accounts).find(([id, a]) => id !== accountId && a.transactions.some((tx) => tx.transferId === last.transferId));
    if (holder) {
      const { acc: otherAcc, ok: ok2 } = undoLastTransaction(holder[1]);
      if (ok2) next[holder[0]] = otherAcc;
    }
  }
  return { ok: true, accounts: next, removed, account: acc };
}

// Corregge SOLO l'importo dell'ultima transazione (tipo, categoria e nota restano uguali):
// annulla con esattezza l'originale, poi ri-applica con il nuovo importo, così eventuali
// sforamenti/cascate sulle categorie si ricalcolano sempre in modo corretto da zero.
function correctLastTransactionAmount(account, newAmount) {
  const last0 = account.transactions[0];
  // senza breakdown (operazioni vecchie) o se è un trasferimento tra conti non si può correggere con precisione
  if (!last0 || !last0.breakdown || last0.transferId || last0.dueId) return { acc: account, ok: false, old: null };
  const { acc: undone, ok, removed } = undoLastTransaction(account);
  if (!ok || !(newAmount > 0)) return { acc: account, ok: false, old: null };
  const categoryKey = removed.rawCategory || "TUTTE";
  const { acc: redone, ok: ok2 } = applyTransaction(undone, {
    transactionType: removed.type, amount: newAmount, category: categoryKey, note: removed.note,
  });
  return ok2 ? { acc: redone, ok: true, old: removed } : { acc: account, ok: false, old: null };
}

// ---- Scadenze e debiti ----
// Una scadenza è un pagamento (o un incasso) da ricordare in una data. A differenza di una ricorrenza
// NON si registra da sola: quando l'utente tocca "Pagato" si registra la spesa e la scadenza avanza
// (o si chiude, se era l'ultima rata). Le date sono giorni di calendario "locali" in formato YYYY-MM-DD
// e i calcoli sono fatti in UTC puro, così il fuso orario non sposta mai il giorno di uno.
const pad2 = (n) => String(n).padStart(2, "0");
function localTodayISO(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
function isoParts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}
function partsISO(y, m, d) {
  return `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}`;
}
function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12
}
function isValidYMD(y, m, d) {
  return Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d) && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}
function addDaysISO(iso, n) {
  const { y, m, d } = isoParts(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return partsISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
function daysBetweenISO(a, b) {
  const pa = isoParts(a);
  const pb = isoParts(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}
// Prossima data di una scadenza ripetuta, ancorata al giorno originale (es. il 31 → ultimo giorno dei mesi più corti).
function nextDueDate(due, fromISO) {
  const { y, m } = isoParts(fromISO);
  const anchor = isoParts(due.anchor || due.date);
  if (due.repeat === "weekly") return addDaysISO(fromISO, 7);
  if (due.repeat === "yearly") {
    const ny = y + 1;
    return partsISO(ny, anchor.m, Math.min(anchor.d, daysInMonth(ny, anchor.m)));
  }
  let ny = y;
  let nm = m + 1;
  if (nm > 12) { nm = 1; ny += 1; }
  return partsISO(ny, nm, Math.min(anchor.d, daysInMonth(ny, nm)));
}

const DUE_LOCALES = { it: "it-IT", en: "en-GB", ro: "ro-RO", ru: "ru-RU", zh: "zh-CN" };
function formatDueDate(iso, lang, { weekday = false, year = false } = {}) {
  const { y, m, d } = isoParts(iso);
  try {
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(DUE_LOCALES[lang] || "it-IT", {
      timeZone: "UTC", weekday: weekday ? "long" : undefined, day: "numeric", month: "long", year: year ? "numeric" : undefined,
    });
  } catch {
    return iso;
  }
}
// "oggi" / "domani" / "tra 5 giorni" / "scaduta da 3 giorni"
function dueWhenText(days, tr) {
  if (days < 0) return tr.duesOverdue(-days);
  if (days === 0) return tr.duesToday;
  if (days === 1) return tr.duesTomorrow;
  return tr.duesInDays(days);
}
// Scadute + quelle entro la finestra indicata, in ordine di data.
function upcomingDues(account, todayISO, windowDays = 14) {
  return (account.dues || [])
    .filter((d) => daysBetweenISO(todayISO, d.date) <= windowDays)
    .sort((a, b) => a.date.localeCompare(b.date));
}
// Debito a rate: quante ne restano (compresa quella in corso) e il totale approssimato.
function dueRate(due) {
  if (!due.installments) return null;
  const { total, paid } = due.installments;
  const left = total - paid;
  return { k: paid + 1, total, left, leftAmount: Math.round(left * due.amount * 100) / 100 };
}
function makeDue(fields) {
  if (!fields || !fields.label || !(fields.amount > 0) || !fields.date) return null;
  const p = isoParts(fields.date);
  if (!isValidYMD(p.y, p.m, p.d)) return null;
  let inst = null;
  if (fields.installments && fields.installments.total > 0) {
    inst = { total: Math.floor(fields.installments.total), paid: Math.max(0, Math.floor(fields.installments.paid || 0)) };
    if (inst.paid >= inst.total) return null;
  }
  let repeat = ["weekly", "monthly", "yearly"].includes(fields.repeat) ? fields.repeat : "none";
  if (inst && repeat === "none") repeat = "monthly";
  return {
    id: fields.id || uid(),
    label: String(fields.label).trim().slice(0, 60),
    amount: Math.round(fields.amount * 100) / 100,
    type: fields.type === "entrata" ? "entrata" : "spesa",
    category: fields.category || "", // "" = si sceglie al momento di pagare
    date: fields.date,
    anchor: fields.date,
    repeat,
    installments: inst,
    remindDays: 1, // per le notifiche (passo successivo)
  };
}
// Registra il pagamento e fa avanzare (o chiude) la scadenza. La transazione porta con sé lo stato precedente
// della scadenza (dueRestore), così "annulla" può rimetterla esattamente com'era.
function payDue(account, dueId, categoryOverride) {
  const due = (account.dues || []).find((d) => d.id === dueId);
  if (!due) return { acc: account, ok: false };
  const ownCat = due.category && (due.category === "TUTTE" || account.categories[due.category]) ? due.category : "";
  const category = ownCat || categoryOverride;
  if (!category || (category !== "TUTTE" && !account.categories[category])) return { acc: account, ok: false, needCategory: true };
  const snapshot = JSON.parse(JSON.stringify(due));
  const res = applyTransaction(account, { transactionType: due.type, amount: due.amount, category, note: due.label });
  if (!res.ok) return { acc: account, ok: false };
  const acc = res.acc;
  acc.transactions[0].dueId = due.id;
  acc.transactions[0].dueRestore = snapshot;
  let next = null;
  let cleared = false;
  if (due.installments) {
    const paid = due.installments.paid + 1;
    if (paid < due.installments.total) {
      next = { ...due, installments: { total: due.installments.total, paid }, date: nextDueDate({ ...due, repeat: due.repeat === "none" ? "monthly" : due.repeat }, due.date) };
    } else {
      cleared = true;
    }
  } else if (due.repeat !== "none") {
    next = { ...due, date: nextDueDate(due, due.date) };
  }
  acc.dues = (acc.dues || []).filter((d) => d.id !== due.id).concat(next ? [next] : []);
  return { acc, ok: true, due, nextDate: next ? next.date : null, cleared };
}

// ---- Scadenze: riconoscimento dei comandi in chat (5 lingue) ----
// Mesi in italiano, inglese, rumeno e russo (testo già normalizzato: minuscolo, senza accenti; in russo "й" diventa "и").
const DUE_MONTH_SRC = [
  "gennaio|gen|january|jan|ianuarie|ian|январ[ьяюе]?",
  "febbraio|feb|february|februarie|феврал[ьяюе]?",
  "marzo|mar|march|martie|март[ае]?",
  "aprile|apr|april|aprilie|апрел[ьяюе]?",
  "maggio|mag|may|mai|ма[яиюе]",
  "giugno|giu|june|jun|iunie|iun|июн[ьяюе]?",
  "luglio|lug|july|jul|iulie|iul|июл[ьяюе]?",
  "agosto|ago|august|aug|август[ае]?",
  "settembre|set|september|sept|sep|septembrie|сентябр[ьяюе]?",
  "ottobre|ott|october|oct|octombrie|октябр[ьяюе]?",
  "novembre|nov|november|noiembrie|ноябр[ьяюе]?",
  "dicembre|dic|december|dec|decembrie|декабр[ьяюе]?",
];
const DUE_MONTH_RES = DUE_MONTH_SRC.map((s) => new RegExp(`^(?:${s})$`));
function dueMonthOf(token) {
  const i = DUE_MONTH_RES.findIndex((re) => re.test(token));
  return i < 0 ? 0 : i + 1;
}
// Come normalizeText ma carattere per carattere, così la lunghezza non cambia e le posizioni trovate
// nel testo normalizzato valgono anche nel testo originale (da cui ritagliamo il nome della scadenza).
function normalizeSameLength(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const n = s[i].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    out += n.length === 1 ? n : s[i];
  }
  return out;
}
const DUE_TRIGGER_RE = /(?<![a-zа-я])(?:ricordami|ricordati|promemoria|avvisami|remind\s+me|reminder|amintes[a-z]*[\s-]*mi|reamintes[a-z]*[\s-]*mi|memento|напомни(?:ть)?|напоминани[ея])(?![a-zа-я])|提醒/;
const DUE_REPEAT_RES = [
  ["weekly", /ogni\s+settimana|every\s+week|weekly|in\s+fiecare\s+saptamana|каждую\s+неделю|каждая\s+неделя|每周|每星期/],
  ["monthly", /ogni\s+mese|every\s+month|monthly|in\s+fiecare\s+luna|каждый\s+месяц|каждого\s+месяца|каждыи\s+месяц|每月|每个月/],
  ["yearly", /ogni\s+anno|every\s+year|yearly|annually|in\s+fiecare\s+an|каждый\s+год|каждого\s+года|каждыи\s+год|每年/],
];
const DUE_INCOME_RE = /(?<![a-zа-я])(?:incasso|incassare|incassero|riscuotere|ricevere|ricevo|mi\s+pagano|mi\s+devono|mi\s+arriva|stipendio|receive|get\s+paid|collect|income|salary|incasez|incasare|primesc|salariu|получить|получу|зарплат[а-я]*|поступлен[а-я]*)(?![a-zа-я])|收到|收入|工资|收款/;
const DUE_CURRENCY = "(?:€|eur(?:o|os)?|usd|dollar[ie]?|\\$|£|gbp|lei|ron|mdl|руб[а-я]*|₽|евро|元|块|塊|¥|欧元|欧)";

// Cerca la data nel testo normalizzato. Ritorna { iso, rolled, start, end } oppure null.
function dueFindDate(norm, todayISO) {
  const t = isoParts(todayISO);
  const yearOf = (s) => (!s ? null : s.length === 2 ? 2000 + parseInt(s, 10) : s.length === 4 ? parseInt(s, 10) : NaN);
  const resolve = (y, mo, d, start, end) => {
    let rolled = false;
    let year = y;
    if (year == null) {
      year = t.y;
      for (let k = 0; k < 5; k++) { // es. 29 febbraio: passa al primo anno in cui esiste
        if (isValidYMD(year, mo, d) && partsISO(year, mo, d) >= todayISO) break;
        year += 1;
        rolled = true;
      }
    }
    if (!isValidYMD(year, mo, d) || Number.isNaN(year)) return null;
    return { iso: partsISO(year, mo, d), rolled, start, end };
  };
  let m;
  // 1) 2026-11-23
  m = norm.match(/(?<![0-9])(20\d{2})-(\d{2})-(\d{2})(?![0-9])/);
  if (m) { const r = resolve(+m[1], +m[2], +m[3], m.index, m.index + m[0].length); if (r) return r; }
  // 2) cinese: 11月23日 / 2026年11月23日
  m = norm.match(/(?:(20\d{2})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号號]?/);
  if (m) { const r = resolve(m[1] ? +m[1] : null, +m[2], +m[3], m.index, m.index + m[0].length); if (r) return r; }
  // 3) 23/11 oppure 23/11/2026 (giorno/mese; se il primo numero è ≤12 e il secondo >12, è mese/giorno)
  for (const x of norm.matchAll(/(?<![0-9/.])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![0-9/])/g)) {
    let a = +x[1];
    let b = +x[2];
    let day = a;
    let mon = b;
    if (a <= 12 && b > 12) { mon = a; day = b; }
    const y = yearOf(x[3]);
    if (Number.isNaN(y)) continue;
    const r = resolve(y, mon, day, x.index, x.index + x[0].length);
    if (r) return r;
  }
  // 4) 23.11.2026 / 23-11-26 (solo con l'anno, per non confondere un importo come 12.5 con una data)
  m = norm.match(/(?<![0-9.\-])(\d{1,2})[.\-](\d{1,2})[.\-](\d{4}|\d{2})(?![0-9])/);
  if (m) { const r = resolve(yearOf(m[3]), +m[2], +m[1], m.index, m.index + m[0].length); if (r) return r; }
  // 5) 23 novembre / 23 di novembre / 23rd of November / 23 ноября (+ anno)
  for (const x of norm.matchAll(/(?<![0-9])(\d{1,2})(?:º|°|st|nd|rd|th)?\s*(?:(?:di|of|de)\s+|d['’]\s*)?([a-zа-яё]{3,})(?:\s*,?\s*(20\d{2})(?![0-9]))?/g)) {
    const mon = dueMonthOf(x[2]);
    if (!mon) continue;
    const r = resolve(x[3] ? +x[3] : null, mon, +x[1], x.index, x.index + x[0].length);
    if (r) return r;
  }
  // 6) November 23 / Nov 23rd, 2026
  for (const x of norm.matchAll(/(?<![a-zа-яё])([a-zа-яё]{3,})\s*(\d{1,2})(?:st|nd|rd|th)?(?![0-9a-zа-яё])(?:\s*,?\s*(20\d{2})(?![0-9]))?/g)) {
    const mon = dueMonthOf(x[1]);
    if (!mon) continue;
    const r = resolve(x[3] ? +x[3] : null, mon, +x[2], x.index, x.index + x[0].length);
    if (r) return r;
  }
  // 7) relative: dopodomani / domani / oggi / tra N giorni (anche nelle altre lingue)
  const rel = (re, days) => {
    const x = norm.match(re);
    return x ? { iso: addDaysISO(todayISO, days), rolled: false, start: x.index, end: x.index + x[0].length } : null;
  };
  m = norm.match(/(?<![a-zа-я])(?:tra|fra|in|peste|через)\s+(\d{1,3})\s*(?:giorni|giorno|days?|zile|zi|дней|днеи|дня|день)(?![a-zа-я])|(\d{1,3})\s*天[后後]/);
  if (m) return { iso: addDaysISO(todayISO, +(m[1] || m[2])), rolled: false, start: m.index, end: m.index + m[0].length };
  return (
    rel(/(?<![a-zа-я])(?:dopodomani|day\s+after\s+tomorrow|poimaine|послезавтра)(?![a-zа-я])|后天|後天/, 2) ||
    rel(/(?<![a-zа-я])(?:domani|tomorrow|maine|завтра)(?![a-zа-я])|明天|明日/, 1) ||
    rel(/(?<![a-zа-я])(?:oggi|today|azi|сегодня)(?![a-zа-я])|今天|今日/, 0)
  );
}
// Importo: preferisce il numero vicino a un simbolo/parola di valuta; gestisce 1.200,50 e 1,200.50.
function dueFindAmount(norm) {
  const cands = [];
  for (const x of norm.matchAll(/(\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d{1,2})?(?![0-9])|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g)) {
    const raw = x[1];
    const start = x.index;
    const end = start + raw.length;
    const after = norm.slice(end, end + 12);
    const before = norm.slice(Math.max(0, start - 8), start);
    const curAfter = after.match(new RegExp(`^\\s*${DUE_CURRENCY}`));
    const curBefore = before.match(new RegExp(`${DUE_CURRENCY}\\s*$`));
    let value;
    if (/^\d{1,3}([ \u00a0\u202f]\d{3})+([.,]\d{1,2})?$/.test(raw)) value = parseFloat(raw.replace(/[ \u00a0\u202f]/g, "").replace(",", "."));
    else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw)) value = parseFloat(raw.replace(/\./g, "").replace(",", "."));
    else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(raw)) value = parseFloat(raw.replace(/,/g, ""));
    else value = parseFloat(raw.replace(",", "."));
    if (!(value > 0) || value >= 1e9) continue;
    cands.push({
      value,
      near: !!(curAfter || curBefore),
      start: curBefore ? start - curBefore[0].length : start,
      end: curAfter ? end + curAfter[0].length : end,
    });
  }
  return cands.find((c) => c.near) || cands[0] || null;
}
const DUE_FILLER_ANY = new Set([
  "ricordami", "ricordati", "promemoria", "avvisami", "che", "devo", "dobbiamo", "dovro", "pagare", "pago", "euro", "eur", "euros",
  "remind", "me", "that", "need", "needs", "must", "have", "pay", "should", "usd", "ca", "sa", "trebuie", "platesc", "lei", "ron",
  "напомни", "мне", "надо", "нужно", "что", "заплатить", "оплатить",
]);
const DUE_FILLER_EDGE = new Set([
  "il", "lo", "la", "le", "i", "gli", "l", "un", "una", "uno", "di", "del", "dello", "della", "dei", "a", "al", "alla", "da", "per", "entro", "in", "su", "e",
  "the", "an", "to", "for", "on", "by", "of", "and", "pe", "de", "din", "pentru", "si", "за", "на", "в", "до", "к", "по", "и",
]);
const DUE_DEFAULT_LABEL = { it: "Scadenza", en: "Due payment", ro: "Scadență", ru: "Платёж", zh: "到期付款" };
function dueExtractLabel(rawWork, normWork, lang) {
  let text = rawWork;
  // dopo "per" / "for" / "pentru" / "за" c'è l'oggetto del pagamento
  const kw = normWork.match(/(?<![a-zа-я])(?:per|for|pentru|за)(?![a-zа-я])|[为為]|用于|关于/);
  if (kw) {
    const after = text.slice(kw.index + kw[0].length);
    if (after.trim().length >= 2) text = after;
  }
  const clean = (w) => normalizeText(w).replace(/[^a-zа-яё0-9']/g, "");
  let toks = text.split(/\s+/).filter(Boolean).filter((w) => !DUE_FILLER_ANY.has(clean(w)));
  while (toks.length && DUE_FILLER_EDGE.has(clean(toks[0]))) toks.shift();
  while (toks.length && DUE_FILLER_EDGE.has(clean(toks[toks.length - 1]))) toks.pop();
  let label = toks.join(" ");
  label = label.replace(/提醒我?|需要|我|要|得|付款|支付|付|请|把|块|塊|欧元|元|欧/g, "");
  label = label.replace(/^(?:l|un|dell|all|dall|sull|nell|d)['’]\s*/i, "").replace(/^[\s,.;:!?\-–]+|[\s,.;:!?\-–]+$/g, "");
  if (!label) return DUE_DEFAULT_LABEL[lang] || DUE_DEFAULT_LABEL.it;
  label = label.slice(0, 60);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
// Riconosce "ricordami che il 23 novembre devo pagare 200 per l'assicurazione" (e gli equivalenti in en/ro/ru/zh).
// Ritorna null se il messaggio non è un promemoria; { ok:false, reason } se lo è ma manca la data o l'importo;
// altrimenti { ok:true, due: {...campi}, rolled } (rolled = la data di quest'anno era passata: ho scelto l'anno dopo).
function parseDueCommand(rawText, todayISO, lang, account) {
  const raw = rawText.normalize("NFC");
  const norm = normalizeSameLength(raw);
  const trig = norm.match(DUE_TRIGGER_RE);
  if (!trig) return null;
  let work = norm;
  let rawWork = raw;
  const cut = (a, b) => {
    work = work.slice(0, a) + " ".repeat(b - a) + work.slice(b);
    rawWork = rawWork.slice(0, a) + " ".repeat(b - a) + rawWork.slice(b);
  };
  cut(trig.index, trig.index + trig[0].length);
  const found = dueFindDate(work, todayISO);
  if (!found) return { ok: false, reason: "date" };
  cut(found.start, found.end);
  let repeat = "none";
  for (const [key, re] of DUE_REPEAT_RES) {
    const x = work.match(re);
    if (x) { repeat = key; cut(x.index, x.index + x[0].length); break; }
  }
  const isIncome = DUE_INCOME_RE.test(work);
  const amt = dueFindAmount(work);
  if (!amt) return { ok: false, reason: "amount" };
  cut(amt.start, amt.end);
  const label = dueExtractLabel(rawWork, work, lang);
  let category = "";
  if (account && account.categories) category = detectCategory(normalizeText(label), account.categories, account.learnedTerms) || "";
  return { ok: true, rolled: found.rolled, due: { label, amount: amt.value, type: isIncome ? "entrata" : "spesa", category, date: found.iso, repeat } };
}
// "quali scadenze ho?" / "what's due" / "scadențe" / "мои платежи" / "到期款项": solo se è l'intero messaggio.
const DUE_LIST_PATTERNS = [
  /^(?:quali|che|mostrami|mostra|elenca|dimmi)?\s*(?:le\s+)?(?:mie\s+)?(?:prossime\s+)?scadenze(?:\s+ho)?\s*[?.!]*$/,
  /^(?:what(?:'s|\s+is)?\s+due|what\s+(?:deadlines|payments)\s+do\s+i\s+have|(?:show|list)\s+(?:me\s+)?(?:my\s+|the\s+)?(?:upcoming\s+)?(?:deadlines|dues|payments)|(?:my\s+|upcoming\s+)(?:deadlines|dues|payments)|deadlines)\s*[?.!]*$/,
  /^(?:ce\s+)?(?:arata(?:-mi)?\s+)?(?:urmatoarele\s+|scadentele\s+mele|scadentele|scadente)(?:\s+am)?\s*[?.!]*$/,
  /^(?:какие\s+)?(?:у\s+меня\s+)?(?:предстоящие\s+|ближайшие\s+|мои\s+)?(?:платежи|сроки|напоминания)(?:\s+у\s+меня)?\s*[?.!]*$/,
  /^(?:我的|查看|显示)?(?:近期|即将)?(?:到期|待付款|待付)(?:的)?(?:款项|付款|账单|事项|提醒)?(?:有哪些|是什么)?\s*[？?。.!！]*$/,
];
function matchDueListCommand(rawText) {
  const n = normalizeText(rawText).trim();
  return DUE_LIST_PATTERNS.some((re) => re.test(n));
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
  const last = account.transactions[0];
  const lastInfo = last && last.type !== "init"
    ? `L'ultima operazione registrata è: ${last.type} di ${last.amount} su "${last.category}"${last.note ? ` (nota: ${last.note})` : ""}. Se l'utente sta chiaramente correggendo SOLO L'IMPORTO di questa operazione appena fatta (es. "era 25 non 20", "mi sono sbagliato, erano 15€", "correggilo a 30"), usa il formato correct_last. Se invece vuole registrare una NUOVA transazione (anche se simile alla precedente), usa transaction come sempre.`
    : `Non c'è nessuna operazione recente da poter correggere (il conto non ha ancora transazioni, a parte eventualmente il saldo iniziale).`;

  return `IMPORTANT: Always write every user-facing text field ("text", "question", "note") in ${LANGUAGE_NAMES_FOR_AI[lang] || "Italian"}, regardless of what language the user writes in.

Sei l'assistente finanziario di Finbar. Account attivo: "${account.name}", saldo €${account.totalBalance.toFixed(2)}.
Categorie disponibili: ${catList}. Puoi usare "TUTTE" come categoria per dividere un importo su tutte in base alle percentuali.

${lastInfo}

Analizza il messaggio dell'utente e rispondi SEMPRE E SOLO con un JSON su una riga, in uno di questi 4 formati:
- Transazione riconosciuta: {"type":"transaction","amount":10,"category":"cibo","transactionType":"spesa","note":"breve nota opzionale"}
- Correzione SOLO dell'importo dell'ultima operazione (vedi sopra): {"type":"correct_last","amount":25}
- Manca un dettaglio essenziale: {"type":"question","question":"testo della domanda"}
- Chiacchiera, domanda generica, richiesta di analisi: {"type":"response","text":"testo della risposta"}

Non inventare mai importi o categorie non menzionati dall'utente. "transactionType" è "spesa" o "entrata" (usa sempre questi due valori interni, indipendentemente dalla lingua di risposta). Usa correct_last SOLO quando è chiarissimo che l'utente si riferisce all'ultima operazione appena fatta, non a transazioni più vecchie.`;
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
    balanceSet: (amt, cur) => `Fatto! Saldo totale impostato a ${currency(amt, cur)}, categorie ricalcolate in base alle percentuali.`,
    txCorrected: (label, oldAmt, newAmt, cur, bal) => `Corretto: ${label.toLowerCase()} era ${currency(oldAmt, cur)}, ora è ${currency(newAmt, cur)}. Saldo: ${currency(bal, cur)}.`,
    txCorrectFailed: "Non ho trovato nessuna operazione recente da correggere.",
    undoBtn: 'Annulla ultima', undoTitle: "Annullare l'ultima operazione?", undoAsk: (label, amt, cat, cur) => `${label}: ${currency(amt, cur)} · ${cat}. Saldo e categorie torneranno com'erano prima.`,
    txUndone: (label, amt, cur, bal) => `Annullata: ${label.toLowerCase()} da ${currency(amt, cur)}. Saldo: ${currency(bal, cur)}.`, txUndoFailed: "Non c'è nessuna operazione da annullare.", txUndoNoDetails: 'Questa operazione è precedente agli ultimi aggiornamenti e non si può annullare con precisione.', txUndoBlocked: "Questo trasferimento non si può annullare: nell'altro conto sono state registrate altre operazioni dopo.",
    archiveFromHere: "Archivia da qui in su", archivedBanner: (n) => `${n} ${n === 1 ? "messaggio archiviato" : "messaggi archiviati"}`, archivedShow: "Mostra", archivedHide: "Nascondi", archivedRestore: "Ripristina tutti", scrollUpAria: "Vai più su", scrollDownAria: "Vai più giù",
    dailyRecapBanner: (net, bal, cur) => `Ieri: ${net >= 0 ? "+" : ""}${currency(net, cur)} · Saldo: ${currency(bal, cur)} — tocca per i dettagli`,
    dailyRecapMessage: (net, bal, cur) => `📊 Riepilogo di ieri: hai ${net >= 0 ? "guadagnato" : "speso"} ${currency(Math.abs(net), cur)} netti. Il tuo saldo attuale è ${currency(bal, cur)}.`,
    txFailed: "Non sono riuscito a registrarla, riprova.",
    txNotUnderstood: "Non ho capito. Prova a scrivere importo e categoria, ad esempio «ho speso 15 euro per il cibo» o «ho guadagnato 200 euro».",
    pushLabel: "Ricevilo anche come notifica sul telefono", pushDesc: "Una notifica al giorno con il riepilogo di ieri, all’ora scelta qui sopra. Richiede la sincronizzazione.", pushIntro: "Per comporre la notifica, il nostro server legge il tuo wallet sincronizzato. Salviamo inoltre l’indirizzo di notifica di questo dispositivo, la lingua, l’ora e il fuso orario. Puoi disattivarla quando vuoi: l’iscrizione viene cancellata. Dettagli nella Privacy Policy.", pushActivate: "Attiva", pushCancel: "Annulla", pushHideLabel: "Nascondi gli importi nella notifica", pushHideDesc: "La notifica dirà solo che il riepilogo è pronto.", pushUnsupported: "Questo browser non supporta le notifiche push.", pushIosInstall: "Su iPhone le notifiche funzionano solo con l’app aggiunta alla schermata Home: tocca Condividi → «Aggiungi alla schermata Home», poi riapri Finbar da lì.", pushNeedSync: "Per ricevere la notifica serve la sincronizzazione: il riepilogo viene composto dal server a partire dal tuo wallet.", pushGoSync: "Vai alla sincronizzazione", pushDenied: "Hai bloccato le notifiche per questo sito: riattivale dalle impostazioni del browser o del telefono, poi torna qui.", pushBrave: "Stai usando Brave: per ricevere le notifiche attiva «Use Google services for push messaging» in brave://settings/privacy.", pushError: "Non sono riuscito ad attivare le notifiche. Riprova più tardi.", pushActiveNote: (h) => `Riceverai il riepilogo ogni giorno alle ${String(h).padStart(2, "0")}:00.`,
    duesMenu: "Scadenze e debiti", duesIntro: "Ricorda pagamenti e rate. Quando paghi tocca «Pagato»: la spesa viene registrata e la scadenza avanza.", duesEmpty: "Nessuna scadenza. Scrivi in chat «ricordami che il 23 novembre devo pagare 200» oppure aggiungila qui sotto.", duesCardTitle: "Prossime scadenze", duesSeeAll: "Vedi tutte", duesPaidBtn: "Pagato", duesReceivedBtn: "Incassato", duesToday: "oggi", duesTomorrow: "domani", duesNamePh: "es. Assicurazione auto", duesDateLabel: "Scade il", duesRepeatNone: "Una volta sola", duesWeekly: "Ogni settimana", duesMonthly: "Ogni mese", duesYearly: "Ogni anno", duesCategoryAsk: "Scelgo quando pago", duesInstTotalPh: "Rate in tutto", duesInstPaidPh: "Già pagate", duesInstHint: "Facoltativo, per un debito a rate: quante rate ci sono in tutto e quante ne hai già pagate.", duesAddBtn: "Aggiungi scadenza", duesSaveBtn: "Salva modifiche", duesCancelBtn: "Annulla", duesFormError: "Controlla nome, importo, data ed eventuali rate.", duesPickCategory: "In quale categoria registro il pagamento?", duesPayFailed: "Non sono riuscito a registrare il pagamento: controlla la categoria della scadenza.", dueHelp: "Non ho capito la data o l'importo. Prova così: «ricordami che il 23 novembre devo pagare 200 per l'assicurazione».", dueListHeader: "Prossime scadenze:", dueListEmpty: "Non hai scadenze in programma.", duesInDays: (n) => `tra ${n} giorni`, duesOverdue: (n) => `scaduta da ${n} ${n === 1 ? "giorno" : "giorni"}`, duesRateInfo: (k, total, left, amt) => `rata ${k} di ${total} · restano ${left} · ≈ ${amt}`, dueAdded: (label, when, amount, cur, isIncome, rep) => `Promemoria creato: ${when} · ${currency(amount, cur)} · ${label}${rep ? ` · ${rep}` : ""}. Quando ${isIncome ? "l'hai incassato" : "hai pagato"}, tocca «${isIncome ? "Incassato" : "Pagato"}» nella Dashboard. Per cambiarlo o toglierlo: Impostazioni → Scadenze e debiti.`, duePaidMsg: (label, amount, cur, bal, nextWhen, cleared, isIncome) => `${isIncome ? "Incassato" : "Pagato"}: ${label} · ${currency(amount, cur)}. Saldo: ${currency(bal, cur)}.${cleared ? " Era l'ultima rata: debito estinto." : nextWhen ? ` Prossima scadenza: ${nextWhen}.` : ""}`,
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
    balanceSet: (amt, cur) => `Done! Total balance set to ${currency(amt, cur)}, categories recalculated based on percentages.`,
    txCorrected: (label, oldAmt, newAmt, cur, bal) => `Corrected: the ${label.toLowerCase()} was ${currency(oldAmt, cur)}, now it's ${currency(newAmt, cur)}. Balance: ${currency(bal, cur)}.`,
    txCorrectFailed: "I couldn't find a recent transaction to correct.",
    undoBtn: 'Undo last', undoTitle: 'Undo the last transaction?', undoAsk: (label, amt, cat, cur) => `${label}: ${currency(amt, cur)} · ${cat}. Balance and categories will go back to how they were.`,
    txUndone: (label, amt, cur, bal) => `Undone: the ${label.toLowerCase()} of ${currency(amt, cur)}. Balance: ${currency(bal, cur)}.`, txUndoFailed: "There's no transaction to undo.", txUndoNoDetails: "This transaction predates the latest updates and can't be undone accurately.", txUndoBlocked: "This transfer can't be undone: other transactions were recorded in the other account afterwards.",
    archiveFromHere: "Archive from here up", archivedBanner: (n) => `${n} archived message${n === 1 ? "" : "s"}`, archivedShow: "Show", archivedHide: "Hide", archivedRestore: "Restore all", scrollUpAria: "Scroll up", scrollDownAria: "Scroll down",
    dailyRecapBanner: (net, bal, cur) => `Yesterday: ${net >= 0 ? "+" : ""}${currency(net, cur)} · Balance: ${currency(bal, cur)} — tap for details`,
    dailyRecapMessage: (net, bal, cur) => `📊 Yesterday's recap: you ${net >= 0 ? "earned" : "spent"} ${currency(Math.abs(net), cur)} net. Your current balance is ${currency(bal, cur)}.`,
    txFailed: "I couldn't record it, please try again.",
    txNotUnderstood: "I didn't get that. Try an amount and a category, for example “I spent 15 on food” or “I earned 200”.",
    pushLabel: "Also get it as a phone notification", pushDesc: "One notification a day with yesterday’s recap, at the time chosen above. Requires sync.", pushIntro: "To compose the notification, our server reads your synced wallet. We also store this device’s notification address, your language, the time and your time zone. You can turn it off any time: the registration is deleted. Details in the Privacy Policy.", pushActivate: "Turn on", pushCancel: "Cancel", pushHideLabel: "Hide amounts in the notification", pushHideDesc: "The notification will only say the recap is ready.", pushUnsupported: "This browser doesn’t support push notifications.", pushIosInstall: "On iPhone, notifications only work with the app added to the Home Screen: tap Share → “Add to Home Screen”, then reopen Finbar from there.", pushNeedSync: "To get the notification you need sync: the recap is composed by the server from your wallet.", pushGoSync: "Go to sync", pushDenied: "You’ve blocked notifications for this site: re-enable them in your browser or phone settings, then come back here.", pushBrave: "You’re using Brave: to receive notifications, turn on “Use Google services for push messaging” in brave://settings/privacy.", pushError: "I couldn’t turn on notifications. Please try again later.", pushActiveNote: (h) => `You’ll get the recap every day at ${String(h).padStart(2, "0")}:00.`,
    duesMenu: "Due dates & debts", duesIntro: "Reminders for payments and installments. When you pay, tap “Paid”: the expense is recorded and the due date moves on.", duesEmpty: "No due dates. Write in the chat “remind me on November 23 to pay 200” or add one below.", duesCardTitle: "Upcoming due dates", duesSeeAll: "See all", duesPaidBtn: "Paid", duesReceivedBtn: "Received", duesToday: "today", duesTomorrow: "tomorrow", duesNamePh: "e.g. Car insurance", duesDateLabel: "Due on", duesRepeatNone: "One time", duesWeekly: "Every week", duesMonthly: "Every month", duesYearly: "Every year", duesCategoryAsk: "I’ll choose when I pay", duesInstTotalPh: "Total installments", duesInstPaidPh: "Already paid", duesInstHint: "Optional, for a debt paid in installments: how many installments in total and how many you’ve already paid.", duesAddBtn: "Add due date", duesSaveBtn: "Save changes", duesCancelBtn: "Cancel", duesFormError: "Check the name, amount, date and any installments.", duesPickCategory: "Which category should I record the payment in?", duesPayFailed: "I couldn’t record the payment: check the due date’s category.", dueHelp: "I didn’t catch the date or the amount. Try: “remind me on November 23 to pay 200 for car insurance”.", dueListHeader: "Upcoming due dates:", dueListEmpty: "You have no upcoming due dates.", duesInDays: (n) => `in ${n} days`, duesOverdue: (n) => `${n} ${n === 1 ? "day" : "days"} overdue`, duesRateInfo: (k, total, left, amt) => `installment ${k} of ${total} · ${left} left · ≈ ${amt}`, dueAdded: (label, when, amount, cur, isIncome, rep) => `Reminder created: ${when} · ${currency(amount, cur)} · ${label}${rep ? ` · ${rep}` : ""}. When you’ve ${isIncome ? "received it" : "paid"}, tap “${isIncome ? "Received" : "Paid"}” on the Dashboard. To change or remove it: Settings → Due dates & debts.`, duePaidMsg: (label, amount, cur, bal, nextWhen, cleared, isIncome) => `${isIncome ? "Received" : "Paid"}: ${label} · ${currency(amount, cur)}. Balance: ${currency(bal, cur)}.${cleared ? " That was the last installment: debt paid off." : nextWhen ? ` Next due date: ${nextWhen}.` : ""}`,
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
    balanceSet: (amt, cur) => `Gata! Soldul total a fost setat la ${currency(amt, cur)}, categoriile au fost recalculate pe baza procentelor.`,
    txCorrected: (label, oldAmt, newAmt, cur, bal) => `Corectat: ${label.toLowerCase()} era ${currency(oldAmt, cur)}, acum este ${currency(newAmt, cur)}. Sold: ${currency(bal, cur)}.`,
    txCorrectFailed: "Nu am găsit nicio operațiune recentă de corectat.",
    undoBtn: 'Anulează ultima', undoTitle: 'Anulezi ultima operațiune?', undoAsk: (label, amt, cat, cur) => `${label}: ${currency(amt, cur)} · ${cat}. Soldul și categoriile vor reveni cum erau.`,
    txUndone: (label, amt, cur, bal) => `Anulat: ${label.toLowerCase()} de ${currency(amt, cur)}. Sold: ${currency(bal, cur)}.`, txUndoFailed: 'Nu există nicio operațiune de anulat.', txUndoNoDetails: 'Această operațiune este anterioară ultimelor actualizări și nu poate fi anulată cu precizie.', txUndoBlocked: 'Acest transfer nu poate fi anulat: în celălalt cont au fost înregistrate ulterior alte operațiuni.',
    archiveFromHere: "Arhivează de aici în sus", archivedBanner: (n) => `${n} ${n === 1 ? "mesaj arhivat" : "mesaje arhivate"}`, archivedShow: "Arată", archivedHide: "Ascunde", archivedRestore: "Restaurează tot", scrollUpAria: "Mai sus", scrollDownAria: "Mai jos",
    dailyRecapBanner: (net, bal, cur) => `Ieri: ${net >= 0 ? "+" : ""}${currency(net, cur)} · Sold: ${currency(bal, cur)} — atinge pentru detalii`,
    dailyRecapMessage: (net, bal, cur) => `📊 Rezumatul de ieri: ai ${net >= 0 ? "câștigat" : "cheltuit"} ${currency(Math.abs(net), cur)} net. Soldul tău actual este ${currency(bal, cur)}.`,
    txFailed: "Nu am putut înregistra, încearcă din nou.",
    txNotUnderstood: "Nu am înțeles. Încearcă cu o sumă și o categorie, de exemplu „am cheltuit 15 la mâncare” sau „am câștigat 200”.",
    pushLabel: "Primește-l și ca notificare pe telefon", pushDesc: "O notificare pe zi cu rezumatul de ieri, la ora aleasă mai sus. Necesită sincronizarea.", pushIntro: "Pentru a compune notificarea, serverul nostru citește portofelul tău sincronizat. Salvăm și adresa de notificare a acestui dispozitiv, limba, ora și fusul orar. O poți dezactiva oricând: înregistrarea este ștearsă. Detalii în Politica de confidențialitate.", pushActivate: "Activează", pushCancel: "Anulează", pushHideLabel: "Ascunde sumele în notificare", pushHideDesc: "Notificarea va spune doar că rezumatul este gata.", pushUnsupported: "Acest browser nu acceptă notificările push.", pushIosInstall: "Pe iPhone, notificările funcționează doar cu aplicația adăugată pe ecranul principal: atinge Partajează → „Adaugă pe ecranul principal”, apoi redeschide Finbar de acolo.", pushNeedSync: "Pentru a primi notificarea este necesară sincronizarea: rezumatul este compus de server pe baza portofelului tău.", pushGoSync: "Mergi la sincronizare", pushDenied: "Ai blocat notificările pentru acest site: reactivează-le din setările browserului sau ale telefonului, apoi revino aici.", pushBrave: "Folosești Brave: pentru a primi notificări, activează „Use Google services for push messaging” în brave://settings/privacy.", pushError: "Nu am reușit să activez notificările. Încearcă din nou mai târziu.", pushActiveNote: (h) => `Vei primi rezumatul în fiecare zi la ${String(h).padStart(2, "0")}:00.`,
    duesMenu: "Scadențe și datorii", duesIntro: "Îți amintește plăți și rate. Când plătești, atinge „Plătit”: cheltuiala este înregistrată, iar scadența avansează.", duesEmpty: "Nicio scadență. Scrie în chat „amintește-mi că pe 23 noiembrie trebuie să plătesc 200” sau adaug-o mai jos.", duesCardTitle: "Următoarele scadențe", duesSeeAll: "Vezi toate", duesPaidBtn: "Plătit", duesReceivedBtn: "Încasat", duesToday: "astăzi", duesTomorrow: "mâine", duesNamePh: "ex. Asigurare auto", duesDateLabel: "Scadentă la", duesRepeatNone: "O singură dată", duesWeekly: "În fiecare săptămână", duesMonthly: "În fiecare lună", duesYearly: "În fiecare an", duesCategoryAsk: "Aleg când plătesc", duesInstTotalPh: "Rate în total", duesInstPaidPh: "Deja plătite", duesInstHint: "Opțional, pentru o datorie în rate: câte rate sunt în total și câte ai plătit deja.", duesAddBtn: "Adaugă scadență", duesSaveBtn: "Salvează modificările", duesCancelBtn: "Anulează", duesFormError: "Verifică numele, suma, data și eventualele rate.", duesPickCategory: "În ce categorie înregistrez plata?", duesPayFailed: "Nu am reușit să înregistrez plata: verifică categoria scadenței.", dueHelp: "Nu am înțeles data sau suma. Încearcă așa: „amintește-mi că pe 23 noiembrie trebuie să plătesc 200 pentru asigurare”.", dueListHeader: "Următoarele scadențe:", dueListEmpty: "Nu ai scadențe programate.", duesInDays: (n) => `peste ${n} zile`, duesOverdue: (n) => `scadentă de ${n} ${n === 1 ? "zi" : "zile"}`, duesRateInfo: (k, total, left, amt) => `rata ${k} din ${total} · rămase ${left} · ≈ ${amt}`, dueAdded: (label, when, amount, cur, isIncome, rep) => `Memento creat: ${when} · ${currency(amount, cur)} · ${label}${rep ? ` · ${rep}` : ""}. Când ${isIncome ? "ai încasat" : "ai plătit"}, atinge „${isIncome ? "Încasat" : "Plătit"}” în Dashboard. Pentru a-l modifica sau șterge: Setări → Scadențe și datorii.`, duePaidMsg: (label, amount, cur, bal, nextWhen, cleared, isIncome) => `${isIncome ? "Încasat" : "Plătit"}: ${label} · ${currency(amount, cur)}. Sold: ${currency(bal, cur)}.${cleared ? " A fost ultima rată: datorie achitată." : nextWhen ? ` Următoarea scadență: ${nextWhen}.` : ""}`,
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
    balanceSet: (amt, cur) => `Готово! Общий баланс установлен на ${currency(amt, cur)}, категории пересчитаны по процентам.`,
    txCorrected: (label, oldAmt, newAmt, cur, bal) => `Исправлено: ${label.toLowerCase()} было ${currency(oldAmt, cur)}, теперь ${currency(newAmt, cur)}. Баланс: ${currency(bal, cur)}.`,
    txCorrectFailed: "Не нашёл недавней операции для исправления.",
    undoBtn: 'Отменить последнюю', undoTitle: 'Отменить последнюю операцию?', undoAsk: (label, amt, cat, cur) => `${label}: ${currency(amt, cur)} · ${cat}. Баланс и категории вернутся к прежним значениям.`,
    txUndone: (label, amt, cur, bal) => `Отменено: ${label.toLowerCase()} на ${currency(amt, cur)}. Баланс: ${currency(bal, cur)}.`, txUndoFailed: 'Нет операции для отмены.', txUndoNoDetails: 'Эта операция была до последних обновлений, и её нельзя точно отменить.', txUndoBlocked: 'Этот перевод нельзя отменить: в другом счёте после него были другие операции.',
    archiveFromHere: "Архивировать отсюда и выше", archivedBanner: (n) => `Архивировано сообщений: ${n}`, archivedShow: "Показать", archivedHide: "Скрыть", archivedRestore: "Восстановить все", scrollUpAria: "Выше", scrollDownAria: "Ниже",
    dailyRecapBanner: (net, bal, cur) => `Вчера: ${net >= 0 ? "+" : ""}${currency(net, cur)} · Баланс: ${currency(bal, cur)} — нажмите для подробностей`,
    dailyRecapMessage: (net, bal, cur) => `📊 Итоги вчерашнего дня: вы ${net >= 0 ? "заработали" : "потратили"} ${currency(Math.abs(net), cur)} нетто. Текущий баланс: ${currency(bal, cur)}.`,
    txFailed: "Не удалось записать, попробуйте ещё раз.",
    txNotUnderstood: "Не понял. Попробуйте указать сумму и категорию, например «потратил 15 на продукты» или «заработал 200».",
    pushLabel: "Получать также уведомлением на телефон", pushDesc: "Одно уведомление в день со сводкой за вчера, в выбранное выше время. Требуется синхронизация.", pushIntro: "Чтобы составить уведомление, наш сервер читает ваш синхронизированный кошелёк. Мы также сохраняем адрес уведомлений этого устройства, язык, время и часовой пояс. Отключить можно в любой момент: подписка удаляется. Подробности — в Политике конфиденциальности.", pushActivate: "Включить", pushCancel: "Отмена", pushHideLabel: "Скрывать суммы в уведомлении", pushHideDesc: "В уведомлении будет только сообщение, что сводка готова.", pushUnsupported: "Этот браузер не поддерживает push-уведомления.", pushIosInstall: "На iPhone уведомления работают только если приложение добавлено на экран «Домой»: нажмите «Поделиться» → «На экран „Домой“», затем откройте Finbar оттуда.", pushNeedSync: "Для уведомления нужна синхронизация: сводку составляет сервер на основе вашего кошелька.", pushGoSync: "Перейти к синхронизации", pushDenied: "Вы заблокировали уведомления для этого сайта: включите их в настройках браузера или телефона и вернитесь сюда.", pushBrave: "Вы используете Brave: чтобы получать уведомления, включите «Use Google services for push messaging» в brave://settings/privacy.", pushError: "Не удалось включить уведомления. Попробуйте позже.", pushActiveNote: (h) => `Вы будете получать сводку каждый день в ${String(h).padStart(2, "0")}:00.`,
    duesMenu: "Платежи и долги", duesIntro: "Напоминает о платежах и взносах. Когда заплатите, нажмите «Оплачено»: расход будет записан, а срок сдвинется.", duesEmpty: "Нет сроков. Напишите в чате «напомни 23 ноября оплатить 200» или добавьте ниже.", duesCardTitle: "Ближайшие платежи", duesSeeAll: "Все", duesPaidBtn: "Оплачено", duesReceivedBtn: "Получено", duesToday: "сегодня", duesTomorrow: "завтра", duesNamePh: "напр. Автострахование", duesDateLabel: "Срок", duesRepeatNone: "Один раз", duesWeekly: "Каждую неделю", duesMonthly: "Каждый месяц", duesYearly: "Каждый год", duesCategoryAsk: "Выберу при оплате", duesInstTotalPh: "Всего платежей", duesInstPaidPh: "Уже оплачено", duesInstHint: "Необязательно, для долга в рассрочку: сколько всего платежей и сколько уже оплачено.", duesAddBtn: "Добавить платёж", duesSaveBtn: "Сохранить", duesCancelBtn: "Отмена", duesFormError: "Проверьте название, сумму, дату и платежи.", duesPickCategory: "В какую категорию записать платёж?", duesPayFailed: "Не удалось записать платёж: проверьте категорию.", dueHelp: "Не удалось распознать дату или сумму. Попробуйте так: «напомни 23 ноября оплатить 200 за страховку».", dueListHeader: "Ближайшие платежи:", dueListEmpty: "Запланированных платежей нет.", duesInDays: (n) => `через ${n} дн.`, duesOverdue: (n) => `просрочено на ${n} дн.`, duesRateInfo: (k, total, left, amt) => `платёж ${k} из ${total} · осталось ${left} · ≈ ${amt}`, dueAdded: (label, when, amount, cur, isIncome, rep) => `Напоминание создано: ${when} · ${currency(amount, cur)} · ${label}${rep ? ` · ${rep}` : ""}. Когда ${isIncome ? "получите" : "оплатите"}, нажмите «${isIncome ? "Получено" : "Оплачено"}» на главном экране. Изменить или удалить: Настройки → Платежи и долги.`, duePaidMsg: (label, amount, cur, bal, nextWhen, cleared, isIncome) => `${isIncome ? "Получено" : "Оплачено"}: ${label} · ${currency(amount, cur)}. Баланс: ${currency(bal, cur)}.${cleared ? " Это был последний платёж: долг погашен." : nextWhen ? ` Следующий срок: ${nextWhen}.` : ""}`,
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
    balanceSet: (amt, cur) => `完成！总余额已设置为${currency(amt, cur)}，各分类已按百分比重新计算。`,
    txCorrected: (label, oldAmt, newAmt, cur, bal) => `已更正：${label}原本是${currency(oldAmt, cur)}，现在是${currency(newAmt, cur)}。余额：${currency(bal, cur)}。`,
    txCorrectFailed: "没有找到可以更正的最近操作。",
    undoBtn: '撤销上一笔', undoTitle: '撤销最后一笔操作？', undoAsk: (label, amt, cat, cur) => `${label}：${currency(amt, cur)} · ${cat}。余额和分类将恢复原状。`,
    txUndone: (label, amt, cur, bal) => `已撤销：${label}${currency(amt, cur)}。余额：${currency(bal, cur)}。`, txUndoFailed: '没有可以撤销的操作。', txUndoNoDetails: '这笔操作早于最近的更新，无法准确撤销。', txUndoBlocked: '无法撤销这笔转账：另一个账户之后又有新的操作。',
    archiveFromHere: "归档此处及以上", archivedBanner: (n) => `已归档 ${n} 条消息`, archivedShow: "显示", archivedHide: "隐藏", archivedRestore: "全部恢复", scrollUpAria: "向上滚动", scrollDownAria: "向下滚动",
    dailyRecapBanner: (net, bal, cur) => `昨天：${net >= 0 ? "+" : ""}${currency(net, cur)} · 余额：${currency(bal, cur)} — 点击查看详情`,
    dailyRecapMessage: (net, bal, cur) => `📊 昨日总结：你${net >= 0 ? "净收入" : "净支出"}了${currency(Math.abs(net), cur)}。当前余额为${currency(bal, cur)}。`,
    txFailed: "记录失败，请重试。",
    txNotUnderstood: "我没听懂。请试着写上金额和分类，例如“花了15买食物”或“赚了200”。",
    pushLabel: "同时以手机通知的形式接收", pushDesc: "每天一条通知，在上面选择的时间发送昨日总结。需要同步。", pushIntro: "为了生成通知，我们的服务器会读取你已同步的钱包。我们还会保存此设备的通知地址、语言、时间和时区。你可以随时关闭：订阅信息会被删除。详情见隐私政策。", pushActivate: "开启", pushCancel: "取消", pushHideLabel: "在通知中隐藏金额", pushHideDesc: "通知只会提示总结已准备好。", pushUnsupported: "此浏览器不支持推送通知。", pushIosInstall: "在 iPhone 上，只有将应用添加到主屏幕后通知才可用：点按“分享”→“添加到主屏幕”，然后从主屏幕重新打开 Finbar。", pushNeedSync: "接收通知需要开启同步：总结由服务器根据你的钱包生成。", pushGoSync: "前往同步", pushDenied: "你已阻止此网站的通知：请在浏览器或手机设置中重新开启，然后回到这里。", pushBrave: "你正在使用 Brave：要接收通知，请在 brave://settings/privacy 中开启“Use Google services for push messaging”。", pushError: "无法开启通知，请稍后再试。", pushActiveNote: (h) => `你每天 ${String(h).padStart(2, "0")}:00 会收到总结。`,
    duesMenu: "到期与债务", duesIntro: "提醒你付款和分期。付款后点按“已付”：支出会被记录，到期日顺延。", duesEmpty: "暂无到期事项。在聊天中输入“提醒我11月23日付200元”，或在下方添加。", duesCardTitle: "近期到期", duesSeeAll: "查看全部", duesPaidBtn: "已付", duesReceivedBtn: "已收", duesToday: "今天", duesTomorrow: "明天", duesNamePh: "例如 车险", duesDateLabel: "到期日", duesRepeatNone: "仅一次", duesWeekly: "每周", duesMonthly: "每月", duesYearly: "每年", duesCategoryAsk: "付款时选择", duesInstTotalPh: "总期数", duesInstPaidPh: "已付期数", duesInstHint: "可选，用于分期债务：一共几期，已经付了几期。", duesAddBtn: "添加到期事项", duesSaveBtn: "保存修改", duesCancelBtn: "取消", duesFormError: "请检查名称、金额、日期和分期设置。", duesPickCategory: "把这笔付款记入哪个分类？", duesPayFailed: "无法记录付款：请检查该事项的分类。", dueHelp: "没能识别日期或金额。可以这样写：“提醒我11月23日付200元保险费”。", dueListHeader: "近期到期：", dueListEmpty: "没有即将到期的事项。", duesInDays: (n) => `${n}天后`, duesOverdue: (n) => `已逾期${n}天`, duesRateInfo: (k, total, left, amt) => `第${k}期，共${total}期 · 剩余${left}期 · 约${amt}`, dueAdded: (label, when, amount, cur, isIncome, rep) => `提醒已创建：${when} · ${currency(amount, cur)} · ${label}${rep ? ` · ${rep}` : ""}。${isIncome ? "收到后" : "付款后"}，请在首页点按“${isIncome ? "已收" : "已付"}”。要修改或删除：设置 → 到期与债务。`, duePaidMsg: (label, amount, cur, bal, nextWhen, cleared, isIncome) => `${isIncome ? "已收" : "已付"}：${label} · ${currency(amount, cur)}。余额：${currency(bal, cur)}。${cleared ? "这是最后一期：债务已还清。" : nextWhen ? `下次到期：${nextWhen}。` : ""}`,
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
    chatEmptySetBalance: "Per cambiare il saldo totale:", chatEmptySetBalanceExample: '"modifica saldo a 500"',
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
    textSizeTitle: "Dimensione testo", textSizeDesc: "Ingrandisce solo il testo dell'app, lasciando invariati layout e icone.",
    monthlyTrend: "Andamento mensile", vsLastMonth: "vs mese scorso", netMonthly: "Netto mensile", threshold20: "Soglia +20%",
    expandYearly: "Vedi andamento annuale", growthDotLegend: "Crescita di almeno il 20% vs mese precedente",
    exportHistory: "Esporta storico", exportChooseFormat: "In che formato vuoi esportare lo storico?", exportedOn: "Esportato il",
    notificationsTitle: "Notifiche", notificationsRecapLabel: "Riepilogo giornaliero", notificationsRecapDesc: "Un breve avviso in Dashboard quando riapri l'app, con quanto speso/guadagnato il giorno prima. Tocca il messaggio per leggerlo per esteso in Chat.", notifOn: "Attivo", notifOff: "Disattivato", notifMinHourLabel: "Non mostrare prima delle", notificationsTipLabel: "Consiglio del giorno", notificationsTipDesc: "Un piccolo consiglio sulla gestione dei soldi (o su come usare Finbar) che appare in Chat una volta al giorno.", csvDate: "Data", csvType: "Tipo", csvCategory: "Categoria", csvAmount: "Importo", csvCurrency: "Valuta", csvNote: "Nota",
    categoriesTitle: "Categorie", total: "Totale", learnedWords: "Parole imparate", customWords: "Parole personalizzate",
    obNext: "Avanti", obSkip: "Salta", obStart: "Inizia",
    deleteConfirmTitle: "Eliminare questo conto?",     deleteConfirmWarning: "ATTENZIONE: eliminando questo conto verranno cancellati anche i dati salvati sul cloud collegati al tuo codice di sincronizzazione. Se è l'unico conto, il codice smetterà di funzionare per recuperare dati su altri dispositivi. L'operazione non si può annullare.",    deleteConfirmCancel: "Annulla", deleteConfirmBtn: "Elimina definitivamente",
    updateAvailable: "Nuova versione disponibile", updateBtn: "Aggiorna ora",
    saveCategoriesBtn: "Salva categorie", catErrorPrefix: "Impossibile completare l'operazione: le percentuali sommano al", catErrorSuffix: "%. Devono sommare esattamente al 100%.",
    recurringMenuShort: "Entrate/uscite automatiche", settingsMenuHint: "Tocca una sezione per aprirla",
    currencyConverting: "Conversione in corso, un attimo…", currencyConvertError: "Impossibile convertire: serve una connessione internet, oppure il cambio per questa valuta non è al momento disponibile.",
    legalMenuLabel: "Privacy e Termini", legalTabPrivacy: "Privacy", legalTabTerms: "Termini", legalCheckboxLabel: "Ho letto e accetto la Privacy Policy e i Termini di Utilizzo", legalContinueBtn: "Continua", legalCourtesyNote: "Traduzione di cortesia — fa fede la versione in italiano.",
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
    chatEmptySetBalance: "To change the total balance:", chatEmptySetBalanceExample: '"set balance to 500"',
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
    textSizeTitle: "Text size", textSizeDesc: "Enlarges only the app's text, leaving layout and icons unchanged.",
    monthlyTrend: "Monthly trend", vsLastMonth: "vs last month", netMonthly: "Monthly net", threshold20: "+20% threshold",
    expandYearly: "View yearly trend", growthDotLegend: "Grew by 20% or more vs previous month",
    exportHistory: "Export history", exportChooseFormat: "Which format do you want to export the history in?", exportedOn: "Exported on",
    notificationsTitle: "Notifications", notificationsRecapLabel: "Daily recap", notificationsRecapDesc: "A short banner on the Dashboard when you reopen the app, showing what you spent/earned the day before. Tap it to read the full message in Chat.", notifOn: "On", notifOff: "Off", notifMinHourLabel: "Don't show before", notificationsTipLabel: "Tip of the day", notificationsTipDesc: "A short money-management tip (or a Finbar how-to) that appears in Chat once a day.", csvDate: "Date", csvType: "Type", csvCategory: "Category", csvAmount: "Amount", csvCurrency: "Currency", csvNote: "Note",
    categoriesTitle: "Categories", total: "Total", learnedWords: "Learned words", customWords: "Custom words",
    obNext: "Next", obSkip: "Skip", obStart: "Get started",
    deleteConfirmTitle: "Delete this account?",     deleteConfirmWarning: "WARNING: deleting this account will also erase the cloud data linked to your sync code. If it's your only account, the code will stop working to recover data on other devices. This cannot be undone.",    deleteConfirmCancel: "Cancel", deleteConfirmBtn: "Delete permanently",
    updateAvailable: "New version available", updateBtn: "Update now",
    saveCategoriesBtn: "Save categories", catErrorPrefix: "Can't complete this: the percentages add up to", catErrorSuffix: "%. They must add up to exactly 100%.",
    recurringMenuShort: "Automatic income & expenses", settingsMenuHint: "Tap a section to open it",
    currencyConverting: "Converting, one moment…", currencyConvertError: "Couldn't convert: you need an internet connection, or the rate for this currency isn't available right now.",
    legalMenuLabel: "Privacy & Terms", legalTabPrivacy: "Privacy", legalTabTerms: "Terms", legalCheckboxLabel: "I have read and accept the Privacy Policy and Terms of Use", legalContinueBtn: "Continue", legalCourtesyNote: "Courtesy translation — the Italian version is authoritative.",
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
    chatEmptySetBalance: "Pentru a schimba soldul total:", chatEmptySetBalanceExample: '"modifică soldul la 500"',
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
    textSizeTitle: "Dimensiunea textului", textSizeDesc: "Mărește doar textul aplicației, fără să schimbe aspectul sau pictogramele.",
    monthlyTrend: "Evoluție lunară", vsLastMonth: "față de luna trecută", netMonthly: "Net lunar", threshold20: "Prag +20%",
    expandYearly: "Vezi evoluția anuală", growthDotLegend: "Creștere de cel puțin 20% față de luna precedentă",
    exportHistory: "Exportă istoricul", exportChooseFormat: "În ce format vrei să exporți istoricul?", exportedOn: "Exportat pe",
    notificationsTitle: "Notificări", notificationsRecapLabel: "Rezumat zilnic", notificationsRecapDesc: "Un mic banner pe Dashboard când redeschizi aplicația, cu ce ai cheltuit/câștigat ziua precedentă. Atinge-l pentru a citi mesajul complet în Chat.", notifOn: "Activ", notifOff: "Dezactivat", notifMinHourLabel: "Nu afișa înainte de", notificationsTipLabel: "Sfatul zilei", notificationsTipDesc: "Un mic sfat despre gestionarea banilor (sau despre cum să folosești Finbar) care apare în Chat o dată pe zi.", csvDate: "Data", csvType: "Tip", csvCategory: "Categorie", csvAmount: "Sumă", csvCurrency: "Monedă", csvNote: "Notă",
    categoriesTitle: "Categorii", total: "Total", learnedWords: "Cuvinte învățate", customWords: "Cuvinte personalizate",
    obNext: "Înainte", obSkip: "Sari peste", obStart: "Începe",
    deleteConfirmTitle: "Ștergi acest cont?",     deleteConfirmWarning: "ATENȚIE: ștergând acest cont vor fi șterse și datele din cloud asociate codului tău de sincronizare. Dacă este singurul cont, codul nu va mai putea recupera date pe alte dispozitive. Operația nu poate fi anulată.",    deleteConfirmCancel: "Anulează", deleteConfirmBtn: "Șterge definitiv",
    updateAvailable: "Versiune nouă disponibilă", updateBtn: "Actualizează acum",
    saveCategoriesBtn: "Salvează categoriile", catErrorPrefix: "Operațiune imposibilă: procentele însumează", catErrorSuffix: "%. Trebuie să însumeze exact 100%.",
    recurringMenuShort: "Venituri/cheltuieli automate", settingsMenuHint: "Atinge o secțiune pentru a o deschide",
    currencyConverting: "Conversie în curs, un moment…", currencyConvertError: "Conversie eșuată: ai nevoie de o conexiune la internet, sau cursul pentru această monedă nu este disponibil momentan.",
    legalMenuLabel: "Confidențialitate și Termeni", legalTabPrivacy: "Confidențialitate", legalTabTerms: "Termeni", legalCheckboxLabel: "Am citit și accept Politica de Confidențialitate și Termenii de Utilizare", legalContinueBtn: "Continuă", legalCourtesyNote: "Traducere de curtoazie — versiunea în italiană este de referință.",
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
    chatEmptySetBalance: "Чтобы изменить общий баланс:", chatEmptySetBalanceExample: '«изменить баланс на 500»',
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
    textSizeTitle: "Размер текста", textSizeDesc: "Увеличивает только текст приложения, не меняя расположение и иконки.",
    monthlyTrend: "Динамика по месяцам", vsLastMonth: "к прошлому месяцу", netMonthly: "Итог за месяц", threshold20: "Порог +20%",
    expandYearly: "Посмотреть годовую динамику", growthDotLegend: "Рост на 20% и более к прошлому месяцу",
    exportHistory: "Экспорт истории", exportChooseFormat: "В каком формате экспортировать историю?", exportedOn: "Экспортировано",
    notificationsTitle: "Уведомления", notificationsRecapLabel: "Ежедневная сводка", notificationsRecapDesc: "Небольшой баннер на главном экране при открытии приложения — сколько потрачено/заработано за прошлый день. Нажмите, чтобы прочитать полностью в чате.", notifOn: "Включено", notifOff: "Выключено", notifMinHourLabel: "Не показывать раньше", notificationsTipLabel: "Совет дня", notificationsTipDesc: "Небольшой совет по управлению деньгами (или как пользоваться Finbar), который появляется в чате раз в день.", csvDate: "Дата", csvType: "Тип", csvCategory: "Категория", csvAmount: "Сумма", csvCurrency: "Валюта", csvNote: "Заметка",
    categoriesTitle: "Категории", total: "Всего", learnedWords: "Изученные слова", customWords: "Пользовательские слова",
    obNext: "Далее", obSkip: "Пропустить", obStart: "Начать",
    deleteConfirmTitle: "Удалить этот счёт?",     deleteConfirmWarning: "ВНИМАНИЕ: удаление этого счёта также сотрёт данные в облаке, связанные с вашим кодом синхронизации. Если это ваш единственный счёт, код перестанет восстанавливать данные на других устройствах. Действие необратимо.",    deleteConfirmCancel: "Отмена", deleteConfirmBtn: "Удалить окончательно",
    updateAvailable: "Доступна новая версия", updateBtn: "Обновить сейчас",
    saveCategoriesBtn: "Сохранить категории", catErrorPrefix: "Невозможно выполнить: сумма процентов составляет", catErrorSuffix: "%. Сумма должна быть ровно 100%.",
    recurringMenuShort: "Автоматические доходы и расходы", settingsMenuHint: "Нажмите на раздел, чтобы открыть его",
    currencyConverting: "Конвертация, один момент…", currencyConvertError: "Не удалось выполнить конвертацию: нужно подключение к интернету, либо курс для этой валюты сейчас недоступен.",
    legalMenuLabel: "Конфиденциальность и Условия", legalTabPrivacy: "Конфиденциальность", legalTabTerms: "Условия", legalCheckboxLabel: "Я прочитал(а) и принимаю Политику конфиденциальности и Условия использования", legalContinueBtn: "Продолжить", legalCourtesyNote: "Перевод для удобства — официальной является итальянская версия.",
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
    chatEmptySetBalance: "要修改总余额：", chatEmptySetBalanceExample: "「修改余额为500」",
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
    textSizeTitle: "文字大小", textSizeDesc: "仅放大应用内的文字，不改变布局和图标。",
    monthlyTrend: "月度趋势", vsLastMonth: "较上月", netMonthly: "月净额", threshold20: "+20% 阈值",
    expandYearly: "查看年度趋势", growthDotLegend: "较上月增长20%及以上",
    exportHistory: "导出历史记录", exportChooseFormat: "选择导出格式：", exportedOn: "导出日期",
    notificationsTitle: "通知", notificationsRecapLabel: "每日总结", notificationsRecapDesc: "重新打开应用时，仪表盘会显示一条简短提示，说明前一天的收支情况。点击可在聊天中查看完整内容。", notifOn: "已开启", notifOff: "已关闭", notifMinHourLabel: "不早于以下时间显示：", notificationsTipLabel: "每日小贴士", notificationsTipDesc: "每天在聊天中出现一条关于理财（或如何使用 Finbar）的小提示。", csvDate: "日期", csvType: "类型", csvCategory: "类别", csvAmount: "金额", csvCurrency: "货币", csvNote: "备注",
    categoriesTitle: "分类", total: "总计", learnedWords: "已学会的词", customWords: "自定义词汇",
    obNext: "下一步", obSkip: "跳过", obStart: "开始使用",
    deleteConfirmTitle: "删除此账户？",     deleteConfirmWarning: "警告：删除此账户还会清除与你的同步代码关联的云端数据。如果这是你唯一的账户，该代码将无法再在其他设备上恢复数据。此操作无法撤销。",    deleteConfirmCancel: "取消", deleteConfirmBtn: "永久删除",
    updateAvailable: "有新版本可用", updateBtn: "立即更新",
    saveCategoriesBtn: "保存分类", catErrorPrefix: "无法完成：百分比总和为", catErrorSuffix: "%。总和必须正好是100%。",
    recurringMenuShort: "自动收支", settingsMenuHint: "点击某个部分即可打开",
    currencyConverting: "正在转换，请稍候…", currencyConvertError: "无法转换：需要网络连接，或该货币当前没有可用汇率。",
    legalMenuLabel: "隐私与条款", legalTabPrivacy: "隐私政策", legalTabTerms: "使用条款", legalCheckboxLabel: "我已阅读并接受隐私政策和使用条款", legalContinueBtn: "继续", legalCourtesyNote: "礼节性翻译——以意大利文版本为准。",
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
// Tour guidato: mostrato ad ogni creazione di un conto (nuovo o aggiuntivo).
// Ogni step "punta" a un elemento reale dello schermo (vedi TOUR_TARGETS in
// App per la mappatura target -> ref/schermata).
// ============================================================
const TOUR_STEPS = {
  it: [
    { target: "balance", title: "Il tuo saldo", text: "Qui vedi quanto hai in totale su questo conto, aggiornato automaticamente ad ogni transazione." },
    { target: "pie", title: "Spese per categoria", text: "Questo grafico mostra come si dividono le tue spese tra le varie categorie. Tocca una fetta per evidenziarla." },
    { target: "sync", title: "Codice di sincronizzazione", text: "Conservalo con cura, come una password: ti serve per ritrovare i tuoi dati su un altro dispositivo. Chi lo conosce può leggerli e modificarli." },
    { target: "pct", title: "Percentuali per categoria", text: "Ogni categoria ha una percentuale del saldo totale, e devono sempre sommare a 100%. Puoi modificarle qui in qualsiasi momento e salvare con l'apposito pulsante." },
    { target: "chat", title: "Scrivi le tue spese", text: "Scrivi qui in linguaggio naturale (es. \"speso 15 in cibo\") oppure usa il microfono: ci pensa Finbar a registrare tutto da solo." },
    { target: "history", title: "Storico", text: "Qui trovi tutte le entrate e le uscite che hai registrato, in ordine cronologico." },
  ],
  en: [
    { target: "balance", title: "Your balance", text: "Here you see your total for this account, updated automatically with every transaction." },
    { target: "pie", title: "Spending by category", text: "This chart shows how your expenses are split across categories. Tap a slice to highlight it." },
    { target: "sync", title: "Sync code", text: "Keep it safe, like a password: you'll need it to find your data on another device. Anyone who knows it can read and change it." },
    { target: "pct", title: "Category percentages", text: "Each category has a percentage of the total balance, and they must always add up to 100%. You can edit them here anytime and save with the dedicated button." },
    { target: "chat", title: "Log your expenses", text: "Type here in natural language (e.g. \"spent 15 on food\") or use the microphone: Finbar takes care of the rest." },
    { target: "history", title: "History", text: "Here you'll find every income and expense you've logged, in chronological order." },
  ],
  ro: [
    { target: "balance", title: "Soldul tău", text: "Aici vezi totalul acestui cont, actualizat automat la fiecare tranzacție." },
    { target: "pie", title: "Cheltuieli pe categorii", text: "Acest grafic arată cum se împart cheltuielile pe categorii. Atinge o felie pentru a o evidenția." },
    { target: "sync", title: "Codul de sincronizare", text: "Păstrează-l cu grijă, ca pe o parolă: îți trebuie pentru a-ți regăsi datele pe alt dispozitiv. Oricine îl cunoaște le poate citi și modifica." },
    { target: "pct", title: "Procentele categoriilor", text: "Fiecare categorie are un procent din soldul total, iar acestea trebuie să însumeze mereu 100%. Le poți modifica aici oricând și salva cu butonul dedicat." },
    { target: "chat", title: "Înregistrează-ți cheltuielile", text: "Scrie aici în limbaj natural (ex. \"am cheltuit 15 pe mâncare\") sau folosește microfonul: Finbar se ocupă de restul." },
    { target: "history", title: "Istoric", text: "Aici găsești toate veniturile și cheltuielile înregistrate, în ordine cronologică." },
  ],
  ru: [
    { target: "balance", title: "Ваш баланс", text: "Здесь вы видите общую сумму по этому счёту, автоматически обновляемую при каждой транзакции." },
    { target: "pie", title: "Расходы по категориям", text: "Эта диаграмма показывает, как распределяются ваши расходы по категориям. Нажмите на сектор, чтобы выделить его." },
    { target: "sync", title: "Код синхронизации", text: "Храните его как пароль: он нужен, чтобы найти ваши данные на другом устройстве. Любой, кто его знает, может их читать и изменять." },
    { target: "pct", title: "Проценты категорий", text: "У каждой категории есть процент от общего баланса, и в сумме они всегда должны составлять 100%. Их можно изменить здесь в любой момент и сохранить соответствующей кнопкой." },
    { target: "chat", title: "Записывайте расходы", text: "Пишите здесь обычным языком (например, «потратил 15 на еду») или используйте микрофон: Finbar сделает всё остальное." },
    { target: "history", title: "История", text: "Здесь вы найдёте все записанные доходы и расходы в хронологическом порядке." },
  ],
  zh: [
    { target: "balance", title: "你的余额", text: "在这里可以看到该账户的总额，每次交易后会自动更新。" },
    { target: "pie", title: "按分类查看支出", text: "此图表显示你的支出如何按分类划分。点击某个扇形即可高亮显示。" },
    { target: "sync", title: "同步代码", text: "请像保管密码一样保管好它：换设备找回数据时会用到。任何知道它的人都能读取和修改数据。" },
    { target: "pct", title: "分类百分比", text: "每个分类都占总余额的一定百分比，总和必须始终为100%。你可以随时在这里修改，并用专门的按钮保存。" },
    { target: "chat", title: "记录你的支出", text: "用自然语言在这里输入（例如「食品支出15」），或使用麦克风：剩下的交给 Finbar。" },
    { target: "history", title: "历史记录", text: "这里按时间顺序列出你记录的所有收入和支出。" },
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
  "earned", "received", "income", "add", "added", "deposit", "credited", "salary", "paid me", "got paid", "allowance", "won", "i won", "gain", "gained",
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


// Divide un messaggio in più comandi quando l'utente ne descrive più di uno nella stessa
// frase (es. "aggiungi €7 in trasporti e togli €2 da svago"). Ogni pezzo verrà poi
// interpretato separatamente come una transazione a sé stante.
function splitCompoundSegments(rawText) {
  const parts = rawText.split(/\s+(?:e|and|și|si|и|和)\s+/i).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : null;
}

// Riconosce una singola transazione (importo + categoria + tipo) da un pezzo di testo.
// Usata sia per i messaggi normali sia per ciascun pezzo di un messaggio composto.
function parseTransactionOnly(rawText, account) {
  const text = normalizeText(rawText.trim());
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

// Riconosce il comando "Modifica saldo a [cifra]" (e equivalenti nelle altre lingue)
// per impostare direttamente il saldo totale del conto, ricalcolando le categorie per percentuale.
const SET_BALANCE_PATTERNS = [
  /modifica\s+(?:il\s+)?saldo\s+a\s+([\d.,]+)/i,
  /set\s+balance\s+to\s+([\d.,]+)/i,
  /modific[ăa]\s+soldul\s+la\s+([\d.,]+)/i,
  /измени(?:ть)?\s+баланс\s+на\s+([\d.,]+)/i,
  /修改余额为\s*([\d.,]+)/i,
];
function matchSetBalanceCommand(rawText) {
  for (const re of SET_BALANCE_PATTERNS) {
    const m = rawText.match(re);
    if (m) {
      const val = parseFloat(m[1].replace(",", "."));
      if (!isNaN(val) && val >= 0) return val;
    }
  }
  return null;
}

// Riconosce frasi tipo "era 25 non 20" / "it was 25 not 20" / "correggi a 25" per correggere
// SOLO L'IMPORTO dell'ultima operazione registrata (tipo e categoria restano quelli originali).
// Come SET_BALANCE_PATTERNS: riconoscimento rigido di frasi comuni, non vera comprensione del
// linguaggio - frasi più creative passano comunque dal fallback AI (che conosce la stessa idea).
const CORRECT_LAST_PATTERNS = [
  // "era/erano X" da solo è troppo generico (es. "c'era 25 euro nel portafoglio"):
  // richiedo che vicino ci sia anche "non"/"invece di", come nell'esempio reale "erano 25 non 20".
  /\b(?:era|erano)\s+([\d.,]+)\s*(?:€|eur)?\s*(?:e\s+)?(?:non|invece\s+di)\b/i,
  /corregg\w*(?:\s+l['’]ultima)?(?:\s+(?:spesa|entrata|operazione|transazione))?\s*(?:a\s+)?([\d.,]+)/i,
  /\bit\s+was\s+([\d.,]+)\s*(?:€|eur|\$)?\s*,?\s*not\b/i,
  /\bcorrect\s+(?:that|it|the\s+last\s+(?:expense|income|transaction))?\s*to\s+([\d.,]+)/i,
  /\b(?:a\s+fost|era)\s+([\d.,]+).*?(?:^|\s)(?:nu|în\s+loc)(?:\s|$)/i,
  /corecteaz[ăa]\w*.*?([\d.,]+)/i,
  /(?:^|\s)было\s+([\d.,]+).*?(?:^|\s)а\s+не(?:\s|$)/i,
  /исправ\w*.*?([\d.,]+)/i,
  /应该是\s*([\d.,]+).*?不是/,
  /改成\s*([\d.,]+)/,
  /纠正.*?([\d.,]+)/,
];
// "annulla" / "undo" / "annulla l'ultima spesa" ...: SOLO se il messaggio intero è il comando
// (ancorato ^...$), così non scatta mai per sbaglio dentro una frase normale.
// Niente \w per russo (in JS non copre il cirillico): uso intervalli espliciti.
const UNDO_LAST_PATTERNS = [
  /^\s*annulla(?:\s+(?:l['’]\s*)?(?:ultima|ultimo))?(?:\s+(?:spesa|entrata|operazione|transazione|movimento))?\s*[.!]*\s*$/i,
  /^\s*(?:cancella|elimina|togli|rimuovi)\s+(?:l['’]\s*)?(?:ultima|ultimo)(?:\s+(?:spesa|entrata|operazione|transazione|movimento))?\s*[.!]*\s*$/i,
  /^\s*undo(?:\s+(?:that|it|last|the\s+last))?(?:\s+(?:expense|income|transaction|operation))?\s*[.!]*\s*$/i,
  /^\s*(?:cancel|delete|remove)\s+(?:the\s+)?last(?:\s+(?:expense|income|transaction|operation))?\s*[.!]*\s*$/i,
  /^\s*anuleaz[ăa](?:\s+ultima)?(?:\s+(?:cheltuial[ăa]|venit|opera[țt]iune|tranzac[țt]ie))?\s*[.!]*\s*$/i,
  /^\s*отмен[а-яё]*(?:\s+послед[а-яё]*)?(?:\s+(?:расход|доход|операци[а-яё]*|транзакци[а-яё]*))?\s*[.!]*\s*$/i,
  /^\s*(?:撤销|撤回|取消)(?:上一笔|最后一笔|上一次)?(?:操作|交易|支出|收入)?\s*[。.!！]*\s*$/,
];
function matchUndoLastCommand(rawText) {
  return UNDO_LAST_PATTERNS.some((re) => re.test(rawText));
}

function matchCorrectLastCommand(rawText) {
  for (const re of CORRECT_LAST_PATTERNS) {
    const m = rawText.match(re);
    if (m) {
      const val = parseFloat(m[1].replace(",", "."));
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
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
  return parseTransactionOnly(rawText, account);
}

export default function Finbar() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [themeKey, setThemeKey] = useState("indaco");
  const [textScale, setTextScale] = useState(1);
  const [recapSeen, setRecapSeen] = useState({});
  const [dailyRecap, setDailyRecap] = useState(null);
  const [recapEnabled, setRecapEnabled] = useState(true);
  const [recapMinHour, setRecapMinHour] = useState(8);
  const [tipEnabled, setTipEnabled] = useState(true);
  const [tipSeen, setTipSeen] = useState({});
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
  const [currencyConverting, setCurrencyConverting] = useState(false);
  const [currencyError, setCurrencyError] = useState(null);
  const [appLanguage, setAppLanguage] = useState("it");
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showLegalGate, setShowLegalGate] = useState(false);
  const [legalGateTab, setLegalGateTab] = useState("privacy");
  const [tourStep, setTourStep] = useState(null); // null = tour non attivo
  const [tourRect, setTourRect] = useState(null);
  const tourBalanceRef = useRef(null);
  const tourPieRef = useRef(null);
  const tourCategoriesRef = useRef(null);
  const tourChatInputRef = useRef(null);
  const tourHistoryRef = useRef(null);
  const [legalGateChecked, setLegalGateChecked] = useState(false);
  const [settingsLegalTab, setSettingsLegalTab] = useState("privacy");
  // (rimosso: onboardingSeenRef, non più necessario — il tour riparte ad ogni creazione di conto)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [catDraft, setCatDraft] = useState(null);
  const [catSaveError, setCatSaveError] = useState(null);
  const [settingsSection, setSettingsSection] = useState(null);
  const [highlightedCatId, setHighlightedCatId] = useState(null);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [showArchived, setShowArchived] = useState(false); // mostra i messaggi archiviati della chat
  const [pushSupport, setPushSupport] = useState("ok"); // "ok" | "ios-install" | "unsupported"
  const [pushPermission, setPushPermission] = useState("default"); // permesso del browser
  const [pushOn, setPushOn] = useState(false); // questo dispositivo è iscritto alle notifiche
  const [pushHide, setPushHide] = useState(false); // nascondi gli importi nella notifica
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState(null); // null | "brave" | "generic"
  const [showPushIntro, setShowPushIntro] = useState(false);
  const [braveBrowser, setBraveBrowser] = useState(false);
  const [showDiag, setShowDiag] = useState(false); // diagnostica delle freccette (tocca la versione in Impostazioni)
  const [editingDueId, setEditingDueId] = useState(null); // scadenza in modifica (Impostazioni → Scadenze)
  const [payDueTarget, setPayDueTarget] = useState(null); // scadenza che aspetta la scelta della categoria
  const [selectedMsgIdx, setSelectedMsgIdx] = useState(null); // indice (in messages) del messaggio toccato
  const [chatArrows, setChatArrows] = useState({ show: false, atTop: true, atBottom: true }); // freccette di scorrimento
  const arrowHideTimer = useRef(null);
  const chatScrollHandlerRef = useRef(null); // l'ultima versione di handleChatScroll, per gli ascolti globali
  const chatFindScrollerRef = useRef(null); // l'ultima versione di findChatScroller, per il controllo periodico
  const chatScrollElRef = useRef(null); // l'ultimo elemento visto scorrere nella chat
  const chatWrapRef = useRef(null); // contenitore della chat (messaggi + freccette)
  const arrowDiag = useRef({ scroll: 0, touch: 0, wheel: 0, poll: 0, ignored: 0, shown: 0, lastScroller: "-", lastPos: 0, lastMax: 0 }); // contatori per la diagnostica
  const arrowClickRef = useRef({ dir: null, timer: null });
  const ignoreScrollUntil = useRef(0); // scroll automatici (nuovo messaggio) non devono far apparire le freccette

  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  const t = THEMES[themeKey];
  const ui = UI[appLanguage] || UI.it;
  const trUI = T[appLanguage] || T.it; // stringhe di T usate direttamente nel JSX (undo)
  const account = accounts[activeId];
  // fs(px): applica il fattore di ingrandimento testo scelto in Impostazioni.
  // Tocca solo fontSize, mai spaziature/icone/layout, così la scala resta leggibile senza rompere la UI.
  const fs = (px) => Math.round(px * textScale * 10) / 10;

  // ---- load ----
  useEffect(() => {
    (async () => {
      try {
        const [a, th, c, sc, lg, la, ts, rs, ne, nh, te, tsn] = await Promise.allSettled([
          window.storage.get(ACCOUNTS_KEY, false),
          window.storage.get(THEME_KEY, false),
          window.storage.get(CHAT_KEY, false),
          window.storage.get(SYNC_CODE_KEY, false),
          window.storage.get(LANGUAGE_KEY, false),
          window.storage.get(LEGAL_ACCEPTED_KEY, false),
          window.storage.get(TEXT_SCALE_KEY, false),
          window.storage.get(DAILY_RECAP_SEEN_KEY, false),
          window.storage.get(NOTIF_RECAP_ENABLED_KEY, false),
          window.storage.get(NOTIF_RECAP_HOUR_KEY, false),
          window.storage.get(NOTIF_TIP_ENABLED_KEY, false),
          window.storage.get(NOTIF_TIP_SEEN_KEY, false),
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
        setTextScale(ts.status === "fulfilled" && ts.value ? Number(ts.value.value) : 1);
        try {
          setRecapSeen(rs.status === "fulfilled" && rs.value ? JSON.parse(rs.value.value) : {});
        } catch { setRecapSeen({}); }
        setRecapEnabled(ne.status === "fulfilled" && ne.value ? ne.value.value === "1" : true);
        setRecapMinHour(nh.status === "fulfilled" && nh.value ? Number(nh.value.value) : 8);
        setTipEnabled(te.status === "fulfilled" && te.value ? te.value.value === "1" : true);
        try {
          setTipSeen(tsn.status === "fulfilled" && tsn.value ? JSON.parse(tsn.value.value) : {});
        } catch { setTipSeen({}); }
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

        // ---- privacy/termini: mostrati solo finché non vengono accettati (il tour guidato
        // parte invece ad ogni creazione di conto, vedi createAccount) ----
        const legalAccepted = la.status === "fulfilled" && la.value;
        if (!legalAccepted) {
          setShowLegalGate(true);
        }
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
    const STT_LANG = { it: "it-IT", en: "en-US", ro: "ro-RO", ru: "ru-RU", zh: "zh-CN" };
    rec.lang = STT_LANG[appLanguage] || "it-IT";
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
  }, [appLanguage]);

  useEffect(() => {
    if (scrollRef.current) {
      ignoreScrollUntil.current = Date.now() + 200;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      // se il contenitore non scorre da solo (scorre la pagina intera), porto in fondo la pagina: messaggi più recenti e campo di testo
      if (tab === "chat" && scrollRef.current.scrollHeight <= scrollRef.current.clientHeight + 2) {
        ignoreScrollUntil.current = Date.now() + 900; // lo scorrimento della pagina arriva in ritardo e non deve far comparire le freccette
        window.scrollTo(0, document.documentElement.scrollHeight);
      }
    }
  }, [messages, tab, pendingReceipt]);

  // Le freccette non devono dipendere da un solo segnale: ascolto in fase di cattura gli scorrimenti di QUALSIASI
  // elemento legato alla chat (o della pagina), più tocco e rotella, più un controllo periodico della posizione.
  useEffect(() => {
    if (tab !== "chat") return;
    const call = (src) => { if (chatScrollHandlerRef.current) chatScrollHandlerRef.current(src); };
    const onScrollAny = (e) => {
      const tgt = e.target;
      const page = document.scrollingElement || document.documentElement;
      const el = tgt === document || tgt === document.documentElement || tgt === document.body ? page : tgt;
      const wrap = chatWrapRef.current;
      const related = el === page || (el && el.nodeType === 1 && wrap && (wrap.contains(el) || el.contains(wrap)));
      if (!related) return;
      if (el.scrollHeight > el.clientHeight + 2) chatScrollElRef.current = el;
      call("scroll");
    };
    const onTouch = () => call("touch");
    const onWheel = () => call("wheel");
    window.addEventListener("scroll", onScrollAny, true);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    let last = null;
    const timer = setInterval(() => {
      const find = chatFindScrollerRef.current;
      if (!find) return;
      const pos = find().scrollTop;
      if (last !== null && Math.abs(pos - last) > 1) call("poll");
      last = pos;
    }, 150);
    return () => {
      window.removeEventListener("scroll", onScrollAny, true);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("wheel", onWheel);
      clearInterval(timer);
    };
  }, [tab]);

  useEffect(() => {
    setShowArchived(false);
    setSelectedMsgIdx(null);
  }, [activeId]);

  useEffect(() => () => {
    clearTimeout(arrowHideTimer.current);
    clearTimeout(arrowClickRef.current.timer);
  }, []);

  // Notifiche push: stato iniziale (supporto, permesso, iscrizione esistente, preferenza "nascondi importi")
  useEffect(() => {
    setPushSupport(getPushSupport());
    if (typeof Notification !== "undefined") setPushPermission(Notification.permission);
    detectBrave().then(setBraveBrowser);
    (async () => {
      try {
        const r = await window.storage.get(PUSH_HIDE_AMOUNTS_KEY, false);
        if (r && r.value === "1") setPushHide(true);
      } catch {}
      try {
        if (getPushSupport() === "ok" && Notification.permission === "granted") {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          setPushOn(!!sub);
        }
      } catch {}
    })();
  }, []);

  // Se le notifiche sono attive, tiene aggiornata l'iscrizione sul server (all'avvio e quando cambiano
  // lingua, orario, interruttori o codice di sincronizzazione). Se la sincronizzazione viene tolta, le spegne.
  useEffect(() => {
    if (loading || !pushOn) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub || cancelled) return;
        if (!syncCode) {
          try { await supabaseRpc("finex_push_unsubscribe", { p_endpoint: sub.endpoint }); } catch {}
          await sub.unsubscribe();
          if (!cancelled) setPushOn(false);
          return;
        }
        await savePushSubscription(sub, { syncCode, language: appLanguage, hour: recapMinHour, recap: recapEnabled, hide: pushHide });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [loading, pushOn, syncCode, appLanguage, recapMinHour, recapEnabled, pushHide]);

  useEffect(() => {
    if (window.__finbarUpdateAvailable) setUpdateAvailable(true);
    const onNeedRefresh = () => setUpdateAvailable(true);
    window.addEventListener("finbar:need-refresh", onNeedRefresh);
    return () => window.removeEventListener("finbar:need-refresh", onNeedRefresh);
  }, []);
  useEffect(() => {
    if (showSettings && account) {
      setCatDraft(JSON.parse(JSON.stringify(account.categories)));
      setCatSaveError(null);
    }
    // non resettare alla schermata menu se è il tour guidato ad aver aperto le Impostazioni
    // su una sezione precisa (altrimenti la sezione target sparisce un istante dopo essere apparsa)
    if (showSettings && tourStep === null) setSettingsSection(null);
  }, [showSettings, account?.id]);
  const applyUpdate = () => {
    if (window.__finbarUpdateSW) window.__finbarUpdateSW(true);
    else window.location.reload();
  };

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
  const changeTextScale = async (scale) => {
    setTextScale(scale);
    try { await window.storage.set(TEXT_SCALE_KEY, String(scale), false); } catch {}
  };

  // ---- Riepilogo giornaliero (banner sulla Dashboard -> messaggio in Chat) ----
  // Calcolato per il conto attivo, una sola volta al giorno per conto (recapSeen[accountId] = data ISO
  // dell'ultima volta mostrato). Resta zitto se ieri non c'è stato nessun movimento, come richiesto.
  const changeRecapEnabled = async (val) => {
    setRecapEnabled(val);
    try { await window.storage.set(NOTIF_RECAP_ENABLED_KEY, val ? "1" : "0", false); } catch {}
  };
  const changeRecapMinHour = async (hour) => {
    setRecapMinHour(hour);
    try { await window.storage.set(NOTIF_RECAP_HOUR_KEY, String(hour), false); } catch {}
  };
  const changeTipEnabled = async (val) => {
    setTipEnabled(val);
    try { await window.storage.set(NOTIF_TIP_ENABLED_KEY, val ? "1" : "0", false); } catch {}
  };

  // ---- Consiglio del giorno (Impostazioni -> Notifiche) ----
  // Aspetta che il caricamento iniziale sia finito (loading === false) prima di controllare
  // se mostrarlo: altrimenti, siccome tipSeen parte vuoto prima di sapere il vero valore
  // salvato, rischieremmo di scrivere il messaggio in chat due volte (una con il valore
  // provvisorio, una con quello vero appena arriva) - lo stesso tipo di errore di ordine
  // incontrato con il riepilogo giornaliero, qui prevenuto invece di doverlo correggere dopo.
  useEffect(() => {
    if (loading || !tipEnabled || !account) return;
    const today = todayISO();
    if (tipSeen[account.id] === today) return;
    const accountOffset = Math.max(0, Object.keys(accounts).indexOf(account.id));
    const tipText = getDailyTip(appLanguage, new Date(), accountOffset);
    const msg = { role: "assistant", content: tipText, ts: Date.now(), accountId: account.id, kind: "tip" };
    persistChat([...messages, msg]);
    const nextSeen = { ...tipSeen, [account.id]: today };
    setTipSeen(nextSeen);
    window.storage.set(NOTIF_TIP_SEEN_KEY, JSON.stringify(nextSeen), false).catch(() => {});
  }, [loading, tipEnabled, account?.id, tipSeen, appLanguage, accounts]);

  useEffect(() => {
    if (!recapEnabled) { setDailyRecap(null); return; }
    if (new Date().getHours() < recapMinHour) { setDailyRecap(null); return; }
    if (!account) { setDailyRecap(null); return; }
    const today = todayISO();
    if (recapSeen[account.id] === today) { setDailyRecap(null); return; }
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const yesterdayTx = account.transactions.filter((tx) => tx.date === yesterday && tx.type !== "init");
    if (yesterdayTx.length === 0) { setDailyRecap(null); return; }
    const net = yesterdayTx.reduce((sum, tx) => sum + (tx.type === "entrata" ? tx.amount : -tx.amount), 0);
    setDailyRecap({ net: Math.round(net * 100) / 100, balance: account.totalBalance, accountId: account.id, currency: account.currency });
  }, [account?.id, account?.transactions, recapSeen, recapEnabled, recapMinHour]);

  const dismissDailyRecap = async (openInChat) => {
    if (!dailyRecap) return;
    const today = todayISO();
    const next = { ...recapSeen, [dailyRecap.accountId]: today };
    setRecapSeen(next);
    try { await window.storage.set(DAILY_RECAP_SEEN_KEY, JSON.stringify(next), false); } catch {}
    if (openInChat) {
      const tr = T[appLanguage] || T.it;
      const msg = { role: "assistant", content: tr.dailyRecapMessage(dailyRecap.net, dailyRecap.balance, dailyRecap.currency), ts: Date.now(), accountId: dailyRecap.accountId };
      await persistChat([...messages, msg]);
      setTab("chat");
    }
    setDailyRecap(null);
  };

  const changeLanguage = async (lang) => {
    setAppLanguage(lang);
    setShowLanguagePicker(false);
    try { await window.storage.set(LANGUAGE_KEY, lang, false); } catch {}
  };
  const acceptLegal = async () => {
    setShowLegalGate(false);
    setLegalGateChecked(false);
    try { await window.storage.set(LEGAL_ACCEPTED_KEY, "1", false); } catch {}
  };
  // ---- tour guidato: parte ad ogni creazione di conto (nuovo o aggiuntivo) ----
  const getTourRef = (target) => ({
    balance: tourBalanceRef,
    pie: tourPieRef,
    sync: codeInputRef,
    pct: tourCategoriesRef,
    chat: tourChatInputRef,
    history: tourHistoryRef,
  }[target]);
  const activateTourStep = (index) => {
    const steps = TOUR_STEPS[appLanguage] || TOUR_STEPS.it;
    const step = steps[index];
    if (!step) return;
    if (step.target === "balance" || step.target === "pie") {
      setShowSettings(false);
      setTab("dash");
    } else if (step.target === "sync") {
      setShowSettings(true);
      setSettingsSection("sync");
    } else if (step.target === "pct") {
      setShowSettings(true);
      setSettingsSection("categories");
    } else if (step.target === "chat") {
      setShowSettings(false);
      setTab("chat");
    } else if (step.target === "history") {
      setShowSettings(false);
      setTab("history");
    }
  };
  const startTour = () => {
    setTourStep(0);
    activateTourStep(0);
  };
  const tourNext = () => {
    const steps = TOUR_STEPS[appLanguage] || TOUR_STEPS.it;
    setTourStep((s) => {
      const next = (s ?? -1) + 1;
      if (next >= steps.length) {
        setTourRect(null);
        return null;
      }
      activateTourStep(next);
      return next;
    });
  };
  const tourSkip = () => {
    setTourStep(null);
    setTourRect(null);
    setShowSettings(false);
  };
  useEffect(() => {
    if (tourStep === null) return;
    const steps = TOUR_STEPS[appLanguage] || TOUR_STEPS.it;
    const step = steps[tourStep];
    if (!step) return;
    const measure = () => {
      const ref = getTourRef(step.target);
      if (ref && ref.current) {
        setTourRect(ref.current.getBoundingClientRect());
      } else {
        // l'elemento non esiste in questo momento (es. nessuna categoria con saldo > 0 da mostrare): salta lo step
        tourNext();
      }
    };
    const t1 = setTimeout(measure, 80);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t1); window.removeEventListener("resize", measure); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStep, appLanguage, tab, showSettings, settingsSection]);
  // Cambia valuta CONVERTENDO davvero i saldi al tasso di cambio reale del giorno.
  // Prova prima Frankfurter (tassi BCE), e se non risponde prova un secondo servizio
  // di riserva (open.er-api.com) — entrambi gratuiti, senza chiave API.
  // Lo storico delle transazioni NON viene toccato: ogni transazione resta nella
  // valuta in cui è stata fatta (già memorizzata su ciascuna al momento della registrazione).
  const fetchExchangeRate = async (from, to) => {
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates && data.rates[to]) return data.rates[to];
      }
    } catch (e) {
      console.warn("Servizio principale non raggiungibile, provo la riserva:", e);
    }
    try {
      const res2 = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.rates && data2.rates[to]) return data2.rates[to];
      }
    } catch (e) {
      console.warn("Anche il servizio di riserva non ha risposto:", e);
    }
    return null;
  };
  const changeCurrency = async (code) => {
    if (!account || code === account.currency) return;
    setCurrencyError(null);
    setCurrencyConverting(true);
    try {
      const from = account.currency || "EUR";
      const rate = await fetchExchangeRate(from, code);
      if (!rate) throw new Error("no rate available from either provider");
      const acc = JSON.parse(JSON.stringify(account));
      acc.currency = code;
      acc.totalBalance = acc.totalBalance * rate;
      Object.keys(acc.categories).forEach((cid) => {
        acc.categories[cid].balance = acc.categories[cid].balance * rate;
      });
      persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
    } catch (e) {
      console.error("Conversione valuta fallita:", e);
      setCurrencyError(ui.currencyConvertError);
    } finally {
      setCurrencyConverting(false);
    }
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
    startTour();
  };
  const deleteAccount = (id) => {
    const next = { ...accounts };
    delete next[id];
    const remaining = Object.keys(next);
    persistAccounts(next, remaining[0] || null);
    if (remaining.length === 0) setShowNewAccount(true);
  };
  const updateCategoryPctDraft = (catId, pct) => {
    setCatDraft((d) => ({ ...d, [catId]: { ...d[catId], pct } }));
  };
  const CAT_COLORS = ["#F0B429", "#E85D4A", "#4E7FFF", "#B57EDC", "#00C2A8", "#2ECC71", "#8891A5", "#FF7A6B", "#4EC9FF", "#D4A94E"];
  const addCategoryDraft = (label) => {
    const clean = label.trim();
    if (!clean || !catDraft) return;
    const id = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + uid().slice(0, 4);
    const usedColors = Object.values(catDraft).map((c) => c.color);
    const color = CAT_COLORS.find((c) => !usedColors.includes(c)) || CAT_COLORS[Object.keys(catDraft).length % CAT_COLORS.length];
    setCatDraft((d) => ({ ...d, [id]: { label: clean, pct: 0, color, balance: 0 } }));
    setCatSaveError(null);
  };
  const deleteCategoryDraft = (id) => {
    if (!catDraft || Object.keys(catDraft).length <= 1) return;
    const next = { ...catDraft };
    delete next[id];
    setCatDraft(next);
    setCatSaveError(null);
  };
  const renameCategoryDraft = (id, label) => {
    setCatDraft((d) => ({ ...d, [id]: { ...d[id], label } }));
  };
  // Salva le categorie SOLO se le percentuali sommano esattamente a 100%.
  // Al salvataggio, ricalcola anche il saldo di ogni categoria in base alle nuove
  // percentuali applicate al saldo totale del conto (correggendo eventuali scostamenti).
  const saveCategoriesDraft = () => {
    if (!catDraft) return;
    const totalPct = Math.round(Object.values(catDraft).reduce((s, c) => s + (Number(c.pct) || 0), 0));
    if (totalPct !== 100) {
      setCatSaveError(`${ui.catErrorPrefix} ${totalPct}${ui.catErrorSuffix}`);
      return;
    }
    const newCats = {};
    Object.entries(catDraft).forEach(([id, c]) => {
      newCats[id] = { ...c, label: c.label.trim() || c.label, balance: (account.totalBalance * (Number(c.pct) || 0)) / 100 };
    });
    const acc = { ...account, categories: newCats };
    persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
    setCatSaveError(null);
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
    const transferId = uid(); // collega le due transazioni: servono per annullarle insieme
    // Passa dalla stessa logica delle altre operazioni (breakdown + categorie), così saldo totale
    // e categorie restano allineati; se il conto non ha categorie, ripiega sul solo saldo totale.
    const build = (acc0, type, label) => {
      const r = applyTransaction(acc0, { transactionType: type, amount, category: "TUTTE", note: "" });
      if (r.ok) {
        r.acc.transactions[0].category = label;
        r.acc.transactions[0].transferId = transferId;
        return r.acc;
      }
      const c = JSON.parse(JSON.stringify(acc0));
      c.totalBalance += type === "spesa" ? -amount : amount;
      c.transactions.unshift({ id: uid(), type, amount, category: label, note: "", date: todayISO(), transferId });
      return c;
    };
    const fromName = accounts[fromId].name;
    const toName = accounts[toId].name;
    const from = build(accounts[fromId], "spesa", `Trasferito a ${toName}`);
    const to = build(accounts[toId], "entrata", `Ricevuto da ${fromName}`);
    persistAccounts({ ...accounts, [from.id]: from, [to.id]: to }, activeId);
    setShowTransfer(false);
  };

  // ---- Scadenze e debiti: azioni ----
  const saveDue = (fields, id) => {
    const d = makeDue({ ...fields, id: id || undefined });
    if (!d) return false;
    const acc = { ...account, dues: [...(account.dues || []).filter((x) => x.id !== d.id), d] };
    persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
    setEditingDueId(null);
    return true;
  };
  const deleteDue = (id) => {
    const acc = { ...account, dues: (account.dues || []).filter((x) => x.id !== id) };
    persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
    if (editingDueId === id) setEditingDueId(null);
  };
  // "Pagato": registra la spesa (o l'incasso) e fa avanzare o chiude la scadenza. Senza categoria chiede quale usare.
  const payDueNow = async (dueId, categoryOverride) => {
    const res = payDue(account, dueId, categoryOverride);
    if (res.needCategory) { setPayDueTarget(dueId); return; }
    setPayDueTarget(null);
    if (!res.ok) { setError(trUI.duesPayFailed); return; }
    persistAccounts({ ...accounts, [res.acc.id]: res.acc }, activeId);
    const nextWhen = res.nextDate ? formatDueDate(res.nextDate, appLanguage) : null;
    await persistChat([...messages, { role: "assistant", content: trUI.duePaidMsg(res.due.label, res.due.amount, account.currency, res.acc.totalBalance, nextWhen, res.cleared, res.due.type === "entrata"), ts: Date.now(), accountId: activeId, txOk: true }]);
  };

  // ---- Notifiche push: attivazione / disattivazione ----
  const enablePush = async () => {
    setPushError(null);
    setPushBusy(true);
    let createdSub = null;
    try {
      if (!syncCode) throw new Error("need-sync");
      const perm = await Notification.requestPermission(); // dentro il tocco dell'utente, altrimenti il browser lo ignora
      setPushPermission(perm);
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
        createdSub = sub;
      }
      await savePushSubscription(sub, { syncCode, language: appLanguage, hour: recapMinHour, recap: recapEnabled, hide: pushHide });
      setPushOn(true);
      setShowPushIntro(false);
    } catch (e) {
      // se il server non ha registrato l'iscrizione, non lascio il dispositivo iscritto a metà
      try { if (createdSub) await createdSub.unsubscribe(); } catch {}
      setPushError(braveBrowser ? "brave" : "generic");
    } finally {
      setPushBusy(false);
    }
  };
  const disablePush = async () => {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // se il server non è raggiungibile, l'iscrizione verrà comunque rimossa al primo invio (il servizio push risponde "scaduta")
        try { await supabaseRpc("finex_push_unsubscribe", { p_endpoint: sub.endpoint }); } catch {}
        await sub.unsubscribe();
      }
      setPushOn(false);
    } catch {}
    setPushBusy(false);
  };
  const handlePushToggle = () => {
    if (pushBusy) return;
    if (pushOn) disablePush();
    else { setPushError(null); setShowPushIntro(!showPushIntro); }
  };
  const changePushHide = async (val) => {
    setPushHide(val);
    try { await window.storage.set(PUSH_HIDE_AMOUNTS_KEY, val ? "1" : "0", false); } catch {}
  };
  // perché l'interruttore non si può usare (null = tutto a posto)
  const pushBlocked = pushSupport !== "ok" ? pushSupport : !syncCode ? "need-sync" : pushPermission === "denied" ? "denied" : null;
  const renderToggle = (on, onClick, label, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 13, border: "none", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, background: on ? t.accent : t.surfaceBorder, position: "relative", transition: "background 0.15s" }}
    >
      <div style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
    </button>
  );

  // Annulla l'ultima operazione del conto attivo (trasferimenti: entrambi i lati)
  const undoLast = () => {
    const res = undoLastOperation(accounts, activeId);
    if (res.ok) persistAccounts(res.accounts, activeId);
    return res;
  };

  // ---- transaction helpers ----
  const commitTransaction = (payload) => {
    const { acc, ok } = applyTransaction(account, payload);
    if (ok) persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
    return ok;
  };

  // ---- Esportazione cronologia in CSV ----
  // Delimitatore ";" (non ",") e virgola come separatore decimale per l'italiano:
  // così il file si apre già formattato correttamente in Excel IT senza bisogno
  // di "Testo in colonne". Ordine cronologico crescente (dal più vecchio), come
  // un normale estratto conto, diverso dall'elenco in app che è più recente-prima.
  const exportHistoryCSV = () => {
    if (!account || account.transactions.length === 0) return;
    const tr = T[appLanguage] || T.it;
    const useComma = appLanguage === "it" || appLanguage === "ro" || appLanguage === "ru";
    const headers = [ui.csvDate, ui.csvType, ui.csvCategory, ui.csvAmount, ui.csvCurrency, ui.csvNote];
    const escape = (v) => {
      const s = String(v ?? "");
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = [...account.transactions].reverse().map((tx) => {
      const typeLabel = tx.type === "entrata" ? tr.income : tx.type === "spesa" ? tr.expense : ui.initialBalance;
      const signedAmount = tx.type === "spesa" ? -tx.amount : tx.amount;
      const amountStr = useComma ? signedAmount.toFixed(2).replace(".", ",") : signedAmount.toFixed(2);
      return [tx.date, typeLabel, tx.category, amountStr, tx.currency || account.currency, tx.note || ""];
    });
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(escape).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (account.name || "conto").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.href = url;
    a.download = `finbar-storico-${safeName}-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ---- Esportazione cronologia in PDF ----
  // Stessa fonte dati e stesso ordine cronologico del CSV, ma già impaginata:
  // si apre su qualunque telefono senza bisogno di un'app di fogli di calcolo.
  const exportHistoryPDF = () => {
    if (!account || account.transactions.length === 0) return;
    const tr = T[appLanguage] || T.it;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Finbar — ${account.name}`, 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`${ui.exportedOn}: ${todayISO()}`, 14, 25);
    doc.text(`${ui.totalBalance}: ${currency(account.totalBalance, account.currency)}`, 14, 30);
    const rows = [...account.transactions].reverse().map((tx) => {
      const typeLabel = tx.type === "entrata" ? tr.income : tx.type === "spesa" ? tr.expense : ui.initialBalance;
      const signedAmount = tx.type === "spesa" ? -tx.amount : tx.amount;
      return [tx.date, typeLabel, tx.category, currency(signedAmount, tx.currency || account.currency), tx.note || ""];
    });
    autoTable(doc, {
      startY: 36,
      head: [[ui.csvDate, ui.csvType, ui.csvCategory, ui.csvAmount, ui.csvNote]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [50, 50, 60] },
      columnStyles: { 3: { halign: "right" } },
    });
    const safeName = (account.name || "conto").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    doc.save(`finbar-storico-${safeName}-${todayISO()}.pdf`);
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
    const TTS_LANG = { it: "it-IT", en: "en-US", ro: "ro-RO", ru: "ru-RU", zh: "zh-CN" };
    u.lang = TTS_LANG[appLanguage] || "it-IT";
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

    // ---- 1) comando "Modifica saldo a [cifra]": imposta il saldo totale e ricalcola le categorie ----
    const setBalanceValue = matchSetBalanceCommand(text);
    if (setBalanceValue !== null) {
      const acc = JSON.parse(JSON.stringify(account));
      acc.totalBalance = setBalanceValue;
      Object.keys(acc.categories).forEach((cid) => {
        acc.categories[cid].balance = (setBalanceValue * (acc.categories[cid].pct || 0)) / 100;
      });
      persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
      await persistChat([...next, { role: "assistant", content: tr.balanceSet(setBalanceValue, account.currency), ts: Date.now(), accountId: activeId }]);
      return;
    }

    // ---- 1b) correzione dell'ultima operazione (es. "erano 25 non 20"): cambia solo l'importo, tipo e categoria restano gli stessi ----
    const correctValue = matchCorrectLastCommand(text);
    if (correctValue !== null) {
      const last = account.transactions[0];
      if (last && last.type !== "init") {
        const { acc, ok, old } = correctLastTransactionAmount(account, correctValue);
        if (ok) {
          persistAccounts({ ...accounts, [acc.id]: acc }, activeId);
          const label = old.type === "spesa" ? tr.expense : tr.income;
          await persistChat([...next, { role: "assistant", content: tr.txCorrected(label, old.amount, correctValue, account.currency, acc.totalBalance), ts: Date.now(), accountId: activeId }]);
          return;
        }
      }
      await persistChat([...next, { role: "assistant", content: tr.txCorrectFailed, ts: Date.now(), accountId: activeId }]);
      return;
    }

    // ---- 1c) "annulla" / "undo": toglie l'ultima operazione registrata ----
    if (matchUndoLastCommand(text)) {
      const res = undoLast();
      let content;
      if (res.ok) {
        content = tr.txUndone(res.removed.type === "spesa" ? tr.expense : tr.income, res.removed.amount, account.currency, res.account.totalBalance);
      } else {
        content = res.reason === "pairBlocked" ? tr.txUndoBlocked : res.reason === "noDetails" ? tr.txUndoNoDetails : tr.txUndoFailed;
      }
      await persistChat([...next, { role: "assistant", content, ts: Date.now(), accountId: activeId, txOk: res.ok }]);
      return;
    }

    // ---- 1d) scadenze: "quali scadenze ho?" e "ricordami che il 23 novembre devo pagare 200" ----
    if (matchDueListCommand(text)) {
      const todayL = localTodayISO();
      const items = upcomingDues(account, todayL, 60).slice(0, 8);
      const lines = items.map((d) => `• ${formatDueDate(d.date, appLanguage)} — ${d.label} · ${currency(d.amount, account.currency)} (${dueWhenText(daysBetweenISO(todayL, d.date), tr)})`);
      const content = items.length === 0 ? tr.dueListEmpty : [tr.dueListHeader, ...lines].join("\n");
      await persistChat([...next, { role: "assistant", content, ts: Date.now(), accountId: activeId }]);
      return;
    }
    const dueCmd = parseDueCommand(text, localTodayISO(), appLanguage, account);
    if (dueCmd) {
      const nd = dueCmd.ok ? makeDue(dueCmd.due) : null;
      if (!nd) {
        await persistChat([...next, { role: "assistant", content: tr.dueHelp, ts: Date.now(), accountId: activeId }]);
        return;
      }
      const accWithDue = { ...account, dues: [...(account.dues || []), nd] };
      persistAccounts({ ...accounts, [accWithDue.id]: accWithDue }, activeId);
      const repLabel = nd.repeat === "weekly" ? tr.duesWeekly : nd.repeat === "monthly" ? tr.duesMonthly : nd.repeat === "yearly" ? tr.duesYearly : "";
      const whenText = formatDueDate(nd.date, appLanguage, { weekday: true, year: dueCmd.rolled });
      await persistChat([...next, { role: "assistant", content: tr.dueAdded(nd.label, whenText, nd.amount, account.currency, nd.type === "entrata", repLabel), ts: Date.now(), accountId: activeId, txOk: true }]);
      return;
    }

    // ---- 2) prova a dividere il messaggio in più comandi (es. "aggiungi €7 in trasporti e togli €2 da svago") ----
    const compoundSegments = splitCompoundSegments(text);
    if (compoundSegments) {
      const parsedSegments = compoundSegments.map((seg) => parseTransactionOnly(seg, account));
      if (parsedSegments.every((p) => p.kind === "transaction")) {
        let workingAccount = account;
        const results = [];
        for (const seg of parsedSegments) {
          const { acc, ok } = applyTransaction(workingAccount, { transactionType: seg.transactionType, amount: seg.amount, category: seg.category, note: seg.note });
          if (ok) workingAccount = acc;
          results.push({ ...seg, ok });
        }
        if (workingAccount !== account) {
          persistAccounts({ ...accounts, [workingAccount.id]: workingAccount }, activeId);
        }
        const lines = results.map((r) => {
          const label = r.transactionType === "spesa" ? tr.expense : tr.income;
          return r.ok ? tr.txRegistered(label, r.amount, r.note, account.currency) : tr.txFailed;
        });
        await persistChat([...next, {
          role: "assistant", content: lines.join("\n"), ts: Date.now(), accountId: activeId, txOk: results.every((r) => r.ok),
        }]);
        return;
      }
      // se anche solo un pezzo non è una transazione completa (es. categoria mancante),
      // rinuncio alla divisione e proseguo trattando il messaggio per intero, come prima
    }

    // ---- 3) prova il parser locale: gratis, istantaneo, niente chiamata AI ----
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

    // ---- 4) fallback: solo se il parser locale non ha capito ----
    if (!AI_FALLBACK_ENABLED) {
      await persistChat([...next, { role: "assistant", content: tr.txNotUnderstood, ts: Date.now(), accountId: activeId }]);
      return;
    }
    // (codice AI sotto: inattivo finché AI_FALLBACK_ENABLED è false — vedi nota in cima al file)
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
        } else if (parsed.type === "correct_last") {
          const last = account.transactions[0];
          const { acc: correctedAcc, ok: correctOk, old } = correctLastTransactionAmount(account, parsed.amount);
          txOk = correctOk;
          if (correctOk) {
            persistAccounts({ ...accounts, [correctedAcc.id]: correctedAcc }, activeId);
            const label = old.type === "spesa" ? tr.expense : tr.income;
            displayText = tr.txCorrected(label, old.amount, parsed.amount, account.currency, correctedAcc.totalBalance);
          } else {
            displayText = tr.txCorrectFailed;
          }
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
  const archivedCount = chatForAccount.filter((m) => m.archived).length;
  const visibleChat = showArchived ? chatForAccount : chatForAccount.filter((m) => !m.archived);

  const todayLocal = localTodayISO(); // giorno di calendario locale, per le scadenze
  const dueList = account ? upcomingDues(account, todayLocal, 14) : [];

  // Archivia (nasconde, ma non cancella) tutti i messaggi del conto attivo fino a quello scelto incluso.
  const archiveUpTo = (msgIdx) => {
    persistChat(messages.map((m, i) => (i <= msgIdx && m.accountId === activeId && !m.archived ? { ...m, archived: true } : m)));
    setSelectedMsgIdx(null);
  };
  const restoreArchived = () => {
    persistChat(messages.map((m) => {
      if (m.accountId !== activeId || !m.archived) return m;
      const { archived, ...rest } = m;
      return rest;
    }));
    setShowArchived(false);
  };

  // Freccette di scorrimento: visibili solo mentre si scorre (spariscono dopo ~1,6 s di inattività).
  const keepArrowsVisible = () => {
    clearTimeout(arrowHideTimer.current);
    arrowHideTimer.current = setTimeout(() => setChatArrows((a) => ({ ...a, show: false })), 1600);
  };
  // Elemento che scorre davvero la chat. In ordine: l'ultimo elemento visto scorrere, il contenitore dei messaggi,
  // un suo antenato che scorre, altrimenti la pagina intera (dipende dall'altezza del layout sul dispositivo).
  const pageScroller = () => document.scrollingElement || document.documentElement;
  const findChatScroller = () => {
    const remembered = chatScrollElRef.current;
    if (remembered && remembered.isConnected && remembered.scrollHeight > remembered.clientHeight + 2) return remembered;
    let el = scrollRef.current;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.scrollHeight > el.clientHeight + 2) {
        const oy = window.getComputedStyle(el).overflowY;
        if (oy === "auto" || oy === "scroll" || oy === "overlay") return el;
      }
      el = el.parentElement;
    }
    return pageScroller();
  };
  chatFindScrollerRef.current = findChatScroller;
  // Mostra le freccette. "source" dice chi ha chiamato: scorrimento, tocco, rotella o controllo periodico.
  const handleChatScroll = (source = "scroll") => {
    const d = arrowDiag.current;
    d[source] = (d[source] || 0) + 1;
    if (Date.now() < ignoreScrollUntil.current) { d.ignored += 1; return; }
    if (tab !== "chat") return;
    const el = findChatScroller();
    d.lastScroller = el === pageScroller() ? "pagina" : el === scrollRef.current ? "messaggi" : "altro";
    d.lastPos = Math.round(el.scrollTop);
    d.lastMax = Math.round(el.scrollHeight - el.clientHeight);
    const next = { show: true, atTop: el.scrollTop < 8, atBottom: el.scrollHeight - el.scrollTop - el.clientHeight < 8 };
    setChatArrows((a) => (a.show === next.show && a.atTop === next.atTop && a.atBottom === next.atBottom ? a : next));
    keepArrowsVisible();
    d.shown += 1;
  };
  chatScrollHandlerRef.current = handleChatScroll;
  // un tocco: scorre di circa una schermata; due tocchi ravvicinati: inizio / fine della chat.
  const chatArrowClick = (dir) => {
    const el = findChatScroller();
    if (!el) return;
    setChatArrows((a) => ({ ...a, show: true }));
    keepArrowsVisible();
    const pending = arrowClickRef.current;
    if (pending.timer && pending.dir === dir) {
      clearTimeout(pending.timer);
      arrowClickRef.current = { dir: null, timer: null };
      el.scrollTo({ top: dir === "up" ? 0 : el.scrollHeight, behavior: "smooth" });
      return;
    }
    clearTimeout(pending.timer);
    const timer = setTimeout(() => {
      arrowClickRef.current = { dir: null, timer: null };
      const step = Math.max(80, el.clientHeight * 0.8);
      el.scrollBy({ top: dir === "up" ? -step : step, behavior: "smooth" });
    }, 250);
    arrowClickRef.current = { dir, timer };
  };

  const pieData = useMemo(() => {
    if (!account) return [];
    return Object.entries(account.categories).map(([id, c]) => ({ id, name: c.label, value: Math.max(0, c.balance), color: c.color }));
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

  // ---- Vista annuale espansa (freccetta sul grafico "Andamento mensile") ----
  const yearlyByYear = useMemo(() => {
    const map = {};
    if (!account) return map;
    account.transactions.forEach((tx) => {
      if (tx.type === "init") return;
      const year = Number(tx.date.slice(0, 4));
      const monthIdx = Number(tx.date.slice(5, 7)) - 1;
      map[year] = map[year] || Array(12).fill(0);
      map[year][monthIdx] += tx.type === "entrata" ? tx.amount : -tx.amount;
    });
    return map;
  }, [account]);

  const currentCalendarYear = new Date().getFullYear();
  const yearlyMinYear = useMemo(() => {
    const years = Object.keys(yearlyByYear).map(Number);
    return years.length ? Math.min(...years, currentCalendarYear) : currentCalendarYear;
  }, [yearlyByYear, currentCalendarYear]);

  const [showYearlyView, setShowYearlyView] = useState(false);
  const [showExportChoice, setShowExportChoice] = useState(false);
  const [yearlyViewYear, setYearlyViewYear] = useState(currentCalendarYear);

  const yearlyRows = useMemo(() => {
    const year = yearlyViewYear;
    const monthsData = yearlyByYear[year] || Array(12).fill(0);
    const prevYearData = yearlyByYear[year - 1];
    const isCurrentYear = year === currentCalendarYear;
    const currentMonthIdx = new Date().getMonth();
    return Array.from({ length: 12 }, (_, m) => {
      const future = isCurrentYear && m > currentMonthIdx;
      const value = future ? null : Math.round(monthsData[m] * 100) / 100;
      const prevRaw = m > 0 ? monthsData[m - 1] : (prevYearData ? prevYearData[11] : null);
      const hasPrev = prevRaw !== null && prevRaw !== undefined && (m > 0 || !!prevYearData);
      const label = new Date(year, m, 1).toLocaleDateString("it-IT", { month: "short" });
      return { month: label, value, prev: hasPrev ? prevRaw : null, hasPrev };
    });
  }, [yearlyByYear, yearlyViewYear, currentCalendarYear]);

  const renderYearDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload.value === null || payload.value === undefined) return null;
    const grew = payload.hasPrev && !(payload.prev === 0 && payload.value === 0) && payload.value >= payload.prev * 1.2;
    return <circle key={`dot-${payload.month}`} cx={cx} cy={cy} r={4.5} fill={grew ? "#2ECC71" : t.accent} stroke={t.surfaceRow} strokeWidth={1.5} />;
  };

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

      {updateAvailable && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, display: "flex", justifyContent: "center", padding: "10px 12px", pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, background: t.accent, color: t.onAccent, borderRadius: 12, padding: "9px 10px 9px 14px", fontSize: fs(12.5), fontWeight: 600, boxShadow: "0 4px 14px rgba(0,0,0,0.35)" }}>
            <RefreshCw size={14} />
            <span>{ui.updateAvailable}</span>
            <button onClick={applyUpdate} style={{ background: "rgba(0,0,0,0.18)", border: "none", borderRadius: 8, padding: "6px 10px", color: t.onAccent, fontSize: fs(12), fontWeight: 700, cursor: "pointer" }}>
              {ui.updateBtn}
            </button>
          </div>
        </div>
      )}

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
            style={{ display: "flex", alignItems: "center", gap: 6, background: t.surface, border: `1px solid ${t.surfaceBorder}`, borderRadius: 20, padding: "6px 12px 6px 10px", color: t.textPrimary, fontSize: fs(13), cursor: "pointer" }}
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
              {dailyRecap && dailyRecap.accountId === account.id && (
                <div
                  onClick={() => dismissDailyRecap(true)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: `${t.accent}18`, border: `1px solid ${t.accent}55`, borderRadius: 12, padding: "10px 12px", marginTop: 14, marginBottom: 2, cursor: "pointer" }}
                >
                  <span style={{ fontSize: fs(12), color: t.textStrong, lineHeight: 1.4 }}>
                    {(T[appLanguage] || T.it).dailyRecapBanner(dailyRecap.net, dailyRecap.balance, dailyRecap.currency)}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); dismissDailyRecap(false); }}
                    className="icon-btn"
                    aria-label="Dismiss"
                    style={{ color: t.textMuted, flexShrink: 0 }}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              {account && dueList.length > 0 && (
                <div style={{ background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 14, padding: "10px 12px 6px", marginTop: 14, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: fs(12), color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}><Calendar size={13} /> {trUI.duesCardTitle}</span>
                    <button onClick={() => { setSettingsSection("dues"); setShowSettings(true); }} style={{ background: "none", border: "none", color: t.accent, cursor: "pointer", fontSize: fs(11.5), fontWeight: 600, padding: 0 }}>{trUI.duesSeeAll}</button>
                  </div>
                  {dueList.slice(0, 3).map((d) => {
                    const days = daysBetweenISO(todayLocal, d.date);
                    const rate = dueRate(d);
                    return (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: `1px solid ${t.surfaceBorder}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: fs(13), fontWeight: 600, color: t.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</div>
                          <div style={{ fontSize: fs(11), color: days < 0 ? "#FF7A6B" : t.textMuted }}>
                            {dueWhenText(days, trUI)}{rate ? ` · ${trUI.duesRateInfo(rate.k, rate.total, rate.left, currency(rate.leftAmount, account.currency))}` : ""}
                          </div>
                        </div>
                        <span className="num" style={{ fontSize: fs(13), fontWeight: 700, color: d.type === "entrata" ? "#2ECC71" : "#FF7A6B" }}>{d.type === "entrata" ? "+" : "−"}{currency(d.amount, account.currency)}</span>
                        <button onClick={() => payDueNow(d.id)} style={{ background: t.accent, color: t.onAccent, border: "none", borderRadius: 8, padding: "6px 10px", fontWeight: 700, fontSize: fs(11.5), cursor: "pointer", flexShrink: 0 }}>
                          {d.type === "entrata" ? trUI.duesReceivedBtn : trUI.duesPaidBtn}
                        </button>
                      </div>
                    );
                  })}
                  {dueList.length > 3 && <div style={{ fontSize: fs(11), color: t.textMuted, padding: "4px 0 6px" }}>+{dueList.length - 3}</div>}
                </div>
              )}
              <div ref={tourBalanceRef} style={{ background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 18, padding: "22px 20px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: `${t.accent}22`, filter: "blur(10px)" }} />
                <div style={{ fontSize: fs(12), color: t.textMuted, marginBottom: 6, position: "relative" }}>{ui.totalBalance} · {account.name}</div>
                <div className="num display" style={{ fontSize: fs(38), fontWeight: 700, color: account.totalBalance >= 0 ? t.textStrong : "#FF7A6B", position: "relative" }}>
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
                  <button onClick={() => setShowForm(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: t.accent, color: t.onAccent, border: "none", padding: "10px 0", borderRadius: 10, fontWeight: 700, fontSize: fs(13), cursor: "pointer" }}>
                    <Plus size={15} /> {ui.btnEntry}
                  </button>
                  <button onClick={() => setShowTransfer(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: t.surfaceAlt, color: t.textPrimary, border: `1px solid ${t.surfaceAltBorder}`, padding: "10px 0", borderRadius: 10, fontWeight: 600, fontSize: fs(13), cursor: "pointer" }}>
                    <ArrowLeftRight size={14} /> {ui.btnTransfer}
                  </button>
                </div>
              </div>

              {pieData.some((d) => d.value > 0) && (
                <div ref={tourPieRef} style={{ background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 18, padding: "18px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: fs(12), color: t.textMuted, marginBottom: 8 }}>{ui.byCategory}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 110, height: 110, flexShrink: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" innerRadius={32} outerRadius={52} paddingAngle={3}>
                            {pieData.map((d, i) => (
                              <Cell
                                key={i}
                                fill={d.color}
                                stroke="none"
                                style={{ cursor: "pointer", outline: "none" }}
                                onClick={() => setHighlightedCatId((prev) => (prev === d.id ? null : d.id))}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      {Object.entries(account.categories).map(([id, c]) => (
                        <div
                          key={id}
                          onClick={() => setHighlightedCatId((prev) => (prev === id ? null : id))}
                          style={{
                            display: "flex", alignItems: "center", gap: 7, fontSize: fs(12.5),
                            padding: "4px 7px", borderRadius: 8, cursor: "pointer",
                            border: `1.5px solid ${highlightedCatId === id ? c.color : "transparent"}`,
                            transition: "border-color 0.15s",
                          }}
                        >
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, color: t.textPrimary }}>{c.label}</span>
                          <span className="num" style={{ color: t.textMuted }}>{currency(c.balance, account.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: fs(12), color: t.textMuted, margin: "0 2px 8px" }}>{ui.recentTx}</div>
              {account.transactions.slice(0, 6).map((tx) => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px", borderBottom: `1px solid ${t.surfaceBorder}` }}>
                  {tx.type === "entrata" ? <TrendingUp size={15} color="#2ECC71" /> : tx.type === "spesa" ? <TrendingDown size={15} color="#FF7A6B" /> : <Wallet size={15} color={t.textMuted} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: fs(13.5), color: t.textStrong }}>{tx.category}</div>
                    {tx.note && <div style={{ fontSize: fs(11.5), color: t.textMuted }}>{tx.note}</div>}
                  </div>
                  <div className="num" style={{ fontSize: fs(13.5), fontWeight: 600, color: tx.type === "entrata" ? "#2ECC71" : tx.type === "spesa" ? "#FF7A6B" : t.textMuted }}>
                    {tx.type === "spesa" ? "−" : tx.type === "entrata" ? "+" : ""}{currency(tx.amount, tx.currency || account.currency)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== Chat tab ===== */}
          {tab === "chat" && (
            <>
              <div ref={chatWrapRef} style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div ref={scrollRef} onScroll={() => handleChatScroll("scroll")} onTouchMove={() => handleChatScroll("touch")} onWheel={() => handleChatScroll("wheel")} className="scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {archivedCount > 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: t.surfaceRow, border: `1px solid ${t.surfaceBorder}`, borderRadius: 12, padding: "8px 12px", fontSize: fs(12), color: t.textMuted }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Archive size={13} /> {trUI.archivedBanner(archivedCount)}</span>
                    <span style={{ display: "flex", gap: 14 }}>
                      {showArchived && (
                        <button onClick={restoreArchived} style={{ background: "none", border: "none", color: t.accent, cursor: "pointer", fontSize: fs(12), fontWeight: 600, padding: 0 }}>{trUI.archivedRestore}</button>
                      )}
                      <button onClick={() => setShowArchived(!showArchived)} style={{ background: "none", border: "none", color: t.accent, cursor: "pointer", fontSize: fs(12), fontWeight: 600, padding: 0 }}>{showArchived ? trUI.archivedHide : trUI.archivedShow}</button>
                    </span>
                  </div>
                )}
                {visibleChat.length === 0 && (
                  <div style={{ textAlign: "center", color: t.textMuted, fontSize: fs(13), marginTop: 30, lineHeight: 1.7 }}>
                    {ui.chatEmpty1} <span style={{ color: t.textMuted, fontStyle: "italic" }}>{ui.chatEmptyExample}</span><br />
                    {ui.chatEmpty2}<br />
                    <span style={{ fontSize: fs(12), opacity: 0.85 }}>{ui.chatEmptySetBalance} <span style={{ fontStyle: "italic" }}>{ui.chatEmptySetBalanceExample}</span></span>
                  </div>
                )}
                {visibleChat.map((m, i) => {
                  const msgIdx = messages.indexOf(m);
                  const selected = selectedMsgIdx === msgIdx;
                  return (
                  <div key={i} className="in" style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 5, opacity: m.archived ? 0.6 : 1 }}>
                    <div onClick={() => setSelectedMsgIdx(selected ? null : msgIdx)} style={{
                      outline: selected ? `1.5px dashed ${t.accent}` : "none", outlineOffset: 2,
                      whiteSpace: "pre-line",
                      maxWidth: "82%", padding: "9px 13px", borderRadius: 15,
                      borderBottomRightRadius: m.role === "user" ? 4 : 15,
                      borderBottomLeftRadius: m.role === "user" ? 15 : 4,
                      background: m.role === "user" ? t.surfaceAlt : (m.kind === "tip" ? `${t.accent}22` : `${t.accent}18`),
                      border: m.role === "assistant" ? (m.kind === "tip" ? `1.5px solid ${t.accent}` : `1px solid ${t.accent}40`) : "none",
                      boxShadow: m.kind === "tip" ? `0 0 8px ${t.accent}A0, 0 0 20px ${t.accent}50` : "none",
                      position: m.kind === "tip" ? "relative" : undefined,
                      fontSize: fs(14), lineHeight: 1.5,
                    }}>
                      {m.kind === "tip" && (
                        <>
                          <span style={{ position: "absolute", top: -14, left: -6, fontSize: fs(19), fontWeight: 800, color: t.accent, textShadow: `0 0 6px ${t.accent}` }}>!!!</span>
                          <span style={{ position: "absolute", bottom: -14, right: -6, fontSize: fs(19), fontWeight: 800, color: t.accent, textShadow: `0 0 6px ${t.accent}` }}>!!!</span>
                        </>
                      )}
                      {m.content}
                      {m.txOk && <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: fs(11), color: "#2ECC71" }}><Check size={11} /> Registrato</div>}
                      {m.role === "assistant" && (
                        <button onClick={(e) => { e.stopPropagation(); speak(m.content); }} className="icon-btn" style={{ marginTop: 5, color: t.textMuted }} aria-label="Ascolta">
                          <Volume2 size={12} />
                        </button>
                      )}
                    </div>
                    {selected && !m.archived && (
                      <button onClick={() => archiveUpTo(msgIdx)} style={{ display: "flex", alignItems: "center", gap: 6, background: t.surfaceAlt, border: `1px solid ${t.surfaceAltBorder}`, borderRadius: 14, padding: "5px 11px", color: t.textStrong, cursor: "pointer", fontSize: fs(11.5), fontWeight: 600 }}>
                        <Archive size={12} />
                        {trUI.archiveFromHere}
                      </button>
                    )}
                  </div>
                  );
                })}

                {pendingReceipt && (
                  <div className="in" style={{ alignSelf: "flex-start", maxWidth: "88%", background: t.surfaceRow, border: `1px solid ${t.accent}55`, borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: fs(12), color: t.textMuted, marginBottom: 6 }}>📷 Scontrino letto</div>
                    <div className="num" style={{ fontSize: fs(20), fontWeight: 700, marginBottom: 2 }}>{currency(pendingReceipt.amount, account.currency)}</div>
                    <div style={{ fontSize: fs(13), color: t.textPrimary, marginBottom: 12 }}>{pendingReceipt.note} · {account.categories[pendingReceipt.category]?.label || pendingReceipt.category}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={confirmReceipt} style={{ flex: 1, background: t.accent, color: t.onAccent, border: "none", borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: fs(12.5), cursor: "pointer" }}>{(T[appLanguage] || T.it).confirm}</button>
                      <button onClick={() => setPendingReceipt(null)} style={{ flex: 1, background: t.surfaceAlt, color: t.textPrimary, border: `1px solid ${t.surfaceAltBorder}`, borderRadius: 8, padding: "8px 0", fontWeight: 600, fontSize: fs(12.5), cursor: "pointer" }}>{(T[appLanguage] || T.it).cancel}</button>
                    </div>
                  </div>
                )}

                {pendingCategoryChoice && (
                  <div className="in" style={{ alignSelf: "flex-start", maxWidth: "88%", background: t.surfaceRow, border: `1px solid ${t.accent}55`, borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: fs(12), color: t.textMuted, marginBottom: 10 }}>{(T[appLanguage] || T.it).chooseCategory}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {Object.entries(account.categories).map(([id, c]) => (
                        <button key={id} onClick={() => resolveCategoryChoice(id)} style={{ display: "flex", alignItems: "center", gap: 5, background: t.surfaceAlt, border: `1px solid ${c.color}55`, borderRadius: 20, padding: "6px 12px", color: t.textStrong, fontSize: fs(12), cursor: "pointer" }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} /> {c.label}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => resolveCategoryChoice("TUTTE")} style={{ width: "100%", background: t.accent, color: t.onAccent, border: "none", borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: fs(12.5), cursor: "pointer", marginBottom: 6 }}>
                      {(T[appLanguage] || T.it).splitAll}
                    </button>
                    <button onClick={() => setPendingCategoryChoice(null)} style={{ width: "100%", background: "none", border: `1px solid ${t.surfaceAltBorder}`, borderRadius: 8, padding: "8px 0", color: t.textMuted, fontSize: fs(12), cursor: "pointer" }}>{(T[appLanguage] || T.it).cancel}</button>
                  </div>
                )}

                {sending && <div style={{ fontSize: fs(13), color: t.textMuted }}>{(T[appLanguage] || T.it).thinking}</div>}
              </div>

              {/* freccette di scorrimento: appaiono solo mentre scorri */}
              <div style={{ position: "fixed", zIndex: 30, right: 6, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 6, opacity: chatArrows.show ? 1 : 0, pointerEvents: chatArrows.show ? "auto" : "none", transition: "opacity .25s" }}>
                {[
                  { dir: "up", Icon: ChevronUp, hidden: chatArrows.atTop, label: trUI.scrollUpAria },
                  { dir: "down", Icon: ChevronDown, hidden: chatArrows.atBottom, label: trUI.scrollDownAria },
                ].map(({ dir, Icon, hidden, label }) => (
                  <button
                    key={dir}
                    aria-label={label}
                    onClick={() => chatArrowClick(dir)}
                    style={{ width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `${t.surface}E6`, border: `1px solid ${t.surfaceBorder}`, color: t.textMuted, cursor: "pointer", padding: 0, touchAction: "manipulation", opacity: hidden ? 0 : 0.9, pointerEvents: hidden ? "none" : "auto", transition: "opacity .2s" }}
                  >
                    <Icon size={18} />
                  </button>
                ))}
              </div>
              </div>

              {error && <div style={{ padding: "0 16px", color: "#FF7A6B", fontSize: fs(12), marginBottom: 4 }}>{error}</div>}

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
                  ref={tourChatInputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={listening ? (T[appLanguage] || T.it).listening : (T[appLanguage] || T.it).placeholder}
                  rows={1}
                  style={{ flex: 1, resize: "none", background: t.surface, border: `1px solid ${t.surfaceBorder}`, borderRadius: 10, padding: "10px 12px", color: t.textStrong, fontSize: fs(14) }}
                />
                <button onClick={send} disabled={sending || !input.trim()} className="icon-btn" aria-label="Invia" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: input.trim() && !sending ? t.accent : t.surface, color: input.trim() && !sending ? t.onAccent : t.textMuted }}>
                  <Send size={16} />
                </button>
              </div>
            </>
          )}

          {/* ===== History tab ===== */}
          {tab === "history" && (
            <div ref={tourHistoryRef} className="scrollbar" style={{ flex: 1, overflowY: "auto", padding: "6px 18px 18px" }}>
              {account.transactions.length === 0 && <div style={{ textAlign: "center", color: t.textMuted, fontSize: fs(13), marginTop: 40 }}>{ui.historyEmpty}</div>}
              {account.transactions.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  {undoCheck(accounts, activeId) === "ok" ? (
                    <button
                      onClick={() => setShowUndoConfirm(true)}
                      style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${t.surfaceBorder}`, borderRadius: 8, padding: "6px 10px", color: t.textMuted, cursor: "pointer", fontSize: fs(11.5) }}
                    >
                      <RotateCcw size={13} />
                      {trUI.undoBtn}
                    </button>
                  ) : <span />}
                  <button
                    onClick={() => setShowExportChoice(true)}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${t.surfaceBorder}`, borderRadius: 8, padding: "6px 10px", color: t.textMuted, cursor: "pointer", fontSize: fs(11.5) }}
                  >
                    <Download size={13} />
                    {ui.exportHistory}
                  </button>
                </div>
              )}
              {account.transactions.map((tx) => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 4px", borderBottom: `1px solid ${t.surfaceBorder}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: fs(13.5) }}>{tx.category}</div>
                    <div style={{ fontSize: fs(11.5), color: t.textMuted }}>{tx.date}{tx.note ? " · " + tx.note : ""}</div>
                  </div>
                  <div className="num" style={{ fontSize: fs(13.5), fontWeight: 600, color: tx.type === "entrata" ? "#2ECC71" : tx.type === "spesa" ? "#FF7A6B" : t.textMuted }}>
                    {tx.type === "spesa" ? "−" : tx.type === "entrata" ? "+" : ""}{currency(tx.amount, tx.currency || account.currency)}
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
                <span style={{ fontSize: fs(10.5), fontWeight: 600 }}>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ===== Account switcher modal ===== */}
      {showAccountSwitcher && (
        <Modal onClose={() => setShowAccountSwitcher(false)} title={ui.yourAccounts} t={t} fs={fs}>
          {Object.values(accounts).map((a) => (
            <button key={a.id} onClick={() => { persistAccounts(accounts, a.id); setShowAccountSwitcher(false); }}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: a.id === activeId ? `${t.accent}18` : t.surface, border: `1px solid ${a.id === activeId ? t.accent : t.surfaceBorder}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", color: t.textStrong }}>
              <span style={{ fontSize: fs(14), fontWeight: 600 }}>{a.name}</span>
              <span className="num" style={{ fontSize: fs(13), color: t.textMuted }}>{currency(a.totalBalance, a.currency)}</span>
            </button>
          ))}
          <button onClick={() => { setShowAccountSwitcher(false); setShowNewAccount(true); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: `1.5px dashed ${t.surfaceAltBorder}`, borderRadius: 10, padding: "12px 0", color: t.textMuted, fontSize: fs(13.5), fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
            <Plus size={14} /> {ui.newAccountBtn}
          </button>
        </Modal>
      )}

      {/* ===== New account modal ===== */}
      {showNewAccount && (
        <Modal onClose={() => Object.keys(accounts).length > 0 && setShowNewAccount(false)} title={newAccountMode === "create" ? ui.newAccountTitle : ui.restoreTitle} t={t} fs={fs}>
          {newAccountMode === "create" ? (
            <>
              <NewAccountForm accent={t.accent} t={t} onCreate={createAccount} ui={ui} fs={fs} />
              <button
                onClick={() => { setNewAccountMode("restore"); setRestoreError(null); }}
                style={{ width: "100%", background: "none", border: "none", color: t.textMuted, fontSize: fs(12.5), cursor: "pointer", textAlign: "center", padding: "6px 0" }}
              >
                {ui.haveCode} <span style={{ color: t.accent, fontWeight: 600 }}>{ui.recoverData}</span>
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: fs(12.5), color: t.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
                {ui.restoreDesc} <span className="num">FNX-XXXX-XXXX-XXXX</span>)
              </div>
              <input
                value={restoreInput}
                onChange={(e) => setRestoreInput(e.target.value)}
                placeholder="FNX-XXXX-XXXX-XXXX"
                style={{ ...inputStyle(t, fs), fontFamily: "'JetBrains Mono', monospace" }}
              />
              {restoreError && <div style={{ color: "#FF7A6B", fontSize: fs(12), marginTop: -8, marginBottom: 12 }}>{restoreError}</div>}
              <button
                onClick={restoreFromCode}
                disabled={restoring || !restoreInput.trim()}
                style={{ width: "100%", background: t.accent, color: t.onAccent, border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: fs(14), cursor: "pointer", marginBottom: 10 }}
              >
                {restoring ? ui.restoringBtn : ui.restoreBtn}
              </button>
              <button
                onClick={() => { setNewAccountMode("create"); setRestoreError(null); }}
                style={{ width: "100%", background: "none", border: "none", color: t.textMuted, fontSize: fs(12.5), cursor: "pointer", textAlign: "center", padding: "6px 0" }}
              >
                {ui.orCreateNew} <span style={{ color: t.accent, fontWeight: 600 }}>{ui.createNewAccount}</span>
              </button>
            </>
          )}
        </Modal>
      )}

      {/* ===== Transfer modal ===== */}
      {showTransfer && account && (
        <Modal onClose={() => setShowTransfer(false)} title={ui.transferTitle} t={t} fs={fs}>
          <TransferForm accounts={accounts} fromDefault={activeId} accent={t.accent} t={t} onSubmit={transferBetween} ui={ui} fs={fs} />
        </Modal>
      )}

      {/* ===== Manual transaction form ===== */}
      {showForm && account && (
        <Modal onClose={() => setShowForm(false)} title={ui.newEntryTitle} t={t} fs={fs}>
          <TxForm account={account} accent={t.accent} t={t} onSubmit={(payload) => { commitTransaction(payload); setShowForm(false); }} ui={ui} fs={fs} />
        </Modal>
      )}

      {/* ===== Settings modal ===== */}
      {/* ===== Language picker (primo avvio) ===== */}
      {showLanguagePicker && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,20,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, padding: 24 }}>
          <div style={{ background: t.modalBg, border: `1px solid ${t.modalBorder}`, borderRadius: 18, padding: 24, width: "100%", maxWidth: 380 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Languages size={18} color={t.accent} />
              <h2 className="display" style={{ fontSize: fs(17), fontWeight: 700, margin: 0, color: t.textStrong }}>Choose your language</h2>
            </div>
            <div style={{ fontSize: fs(12.5), color: t.textMuted, marginBottom: 16 }}>Puoi cambiarla in qualsiasi momento dalle Impostazioni.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(LANGUAGES).map(([key, name]) => (
                <button key={key} onClick={() => changeLanguage(key)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", borderRadius: 10, border: `1.5px solid ${t.surfaceBorder}`, background: t.surfaceRow, color: t.textStrong, fontSize: fs(14.5), fontWeight: 500, cursor: "pointer" }}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!showLanguagePicker && showLegalGate && (() => {
        const legal = LEGAL_TEXT[appLanguage] || LEGAL_TEXT.it;
        const sections = legalGateTab === "privacy" ? legal.privacy : legal.terms;
        const sectionTitle = legalGateTab === "privacy" ? legal.privacyTitle : legal.termsTitle;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,20,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, padding: 18 }}>
            <div style={{ background: t.modalBg, border: `1px solid ${t.modalBorder}`, borderRadius: 18, padding: 20, width: "100%", maxWidth: 440, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexShrink: 0 }}>
                <button onClick={() => setLegalGateTab("privacy")} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1.5px solid ${legalGateTab === "privacy" ? t.accent : t.surfaceBorder}`, background: legalGateTab === "privacy" ? t.surfaceRow : "transparent", color: legalGateTab === "privacy" ? t.accent : t.textMuted, fontSize: fs(12.5), fontWeight: 700, cursor: "pointer" }}>
                  {ui.legalTabPrivacy}
                </button>
                <button onClick={() => setLegalGateTab("terms")} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1.5px solid ${legalGateTab === "terms" ? t.accent : t.surfaceBorder}`, background: legalGateTab === "terms" ? t.surfaceRow : "transparent", color: legalGateTab === "terms" ? t.accent : t.textMuted, fontSize: fs(12.5), fontWeight: 700, cursor: "pointer" }}>
                  {ui.legalTabTerms}
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", paddingRight: 4, marginBottom: 12 }}>
                <h2 className="display" style={{ fontSize: fs(15), fontWeight: 700, margin: "0 0 4px", color: t.textStrong }}>{sectionTitle}</h2>
                <div style={{ fontSize: fs(10.5), color: t.textMuted, marginBottom: legal.note ? 4 : 12 }}>{legal.updated}</div>
                {legal.note && <div style={{ fontSize: fs(10.5), color: "#F0B429", marginBottom: 12, fontStyle: "italic" }}>{legal.note}</div>}
                {sections.map((s, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: fs(12.5), fontWeight: 700, color: t.textStrong, marginBottom: 5 }}>{s.h}</div>
                    {s.p.map((para, j) => (
                      <div key={j} style={{ fontSize: fs(11.5), color: t.textPrimary, lineHeight: 1.6, marginBottom: 6 }}>{para}</div>
                    ))}
                  </div>
                ))}
              </div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: fs(11.5), color: t.textPrimary, marginBottom: 12, cursor: "pointer", flexShrink: 0 }}>
                <input type="checkbox" checked={legalGateChecked} onChange={(e) => setLegalGateChecked(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{ui.legalCheckboxLabel}</span>
              </label>
              <button
                onClick={acceptLegal}
                disabled={!legalGateChecked}
                style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: legalGateChecked ? t.accent : t.surfaceBorder, color: legalGateChecked ? t.onAccent : t.textMuted, fontSize: fs(13.5), fontWeight: 700, cursor: legalGateChecked ? "pointer" : "not-allowed", flexShrink: 0 }}
              >
                {ui.legalContinueBtn}
              </button>
            </div>
          </div>
        );
      })()}

      {tourStep !== null && tourRect && (() => {
        const steps = TOUR_STEPS[appLanguage] || TOUR_STEPS.it;
        const step = steps[tourStep];
        if (!step) return null;
        const isLast = tourStep === steps.length - 1;
        const inSettingsCtx = step.target === "sync" || step.target === "pct";
        const r = tourRect;
        const pad = 6;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const tooltipWidth = Math.min(300, vw - 24);
        let tooltipTop = r.bottom + 14;
        if (tooltipTop + 170 > vh) tooltipTop = Math.max(12, r.top - 14 - 170);
        let tooltipLeft = r.left + r.width / 2 - tooltipWidth / 2;
        tooltipLeft = Math.min(Math.max(12, tooltipLeft), vw - tooltipWidth - 12);

        return (
          <>
            {inSettingsCtx ? (
              <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", inset: 0, zIndex: 41 }} />
            ) : (
              <>
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: Math.max(0, r.top - pad), background: "rgba(6,8,16,0.78)", zIndex: 40 }} />
                <div style={{ position: "fixed", top: r.bottom + pad, left: 0, right: 0, bottom: 0, background: "rgba(6,8,16,0.78)", zIndex: 40 }} />
                <div style={{ position: "fixed", top: r.top - pad, left: 0, width: Math.max(0, r.left - pad), height: r.height + pad * 2, background: "rgba(6,8,16,0.78)", zIndex: 40 }} />
                <div style={{ position: "fixed", top: r.top - pad, left: r.right + pad, right: 0, height: r.height + pad * 2, background: "rgba(6,8,16,0.78)", zIndex: 40 }} />
              </>
            )}
            <div style={{ position: "fixed", top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2, border: `2px solid ${t.accent}`, borderRadius: 14, boxShadow: `0 0 0 4px ${t.accent}40`, pointerEvents: "none", zIndex: 42, transition: "top 0.2s, left 0.2s, width 0.2s, height 0.2s" }} />
            <div style={{ position: "fixed", top: tooltipTop, left: tooltipLeft, width: tooltipWidth, background: t.modalBg, border: `1px solid ${t.modalBorder}`, borderRadius: 14, padding: 16, zIndex: 43, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
              <div style={{ fontSize: fs(10.5), color: t.textMuted, marginBottom: 6 }}>{tourStep + 1} / {steps.length}</div>
              <div style={{ fontSize: fs(14), fontWeight: 700, color: t.textStrong, marginBottom: 6 }}>{step.title}</div>
              <div style={{ fontSize: fs(12.5), color: t.textPrimary, lineHeight: 1.5, marginBottom: 14 }}>{step.text}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={tourSkip} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1.5px solid ${t.surfaceBorder}`, background: "transparent", color: t.textMuted, fontSize: fs(12.5), fontWeight: 600, cursor: "pointer" }}>
                  {ui.obSkip}
                </button>
                <button onClick={tourNext} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: t.accent, color: t.onAccent, fontSize: fs(12.5), fontWeight: 700, cursor: "pointer" }}>
                  {isLast ? ui.obStart : ui.obNext}
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {showSettings && confirmDeleteAccount && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,20,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40, padding: 24 }}>
          <div style={{ background: t.modalBg, border: "1.5px solid #4A2A2A", borderRadius: 18, padding: 24, width: "100%", maxWidth: 380 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Trash2 size={18} color="#FF7A6B" />
              <h2 className="display" style={{ fontSize: fs(16), fontWeight: 700, margin: 0, color: t.textStrong }}>{ui.deleteConfirmTitle}</h2>
            </div>
            <div style={{ fontSize: fs(12.5), color: "#FF9A8D", lineHeight: 1.6, marginBottom: 20, background: "rgba(255,122,107,0.08)", border: "1px solid #4A2A2A", borderRadius: 10, padding: 12 }}>
              {ui.deleteConfirmWarning}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDeleteAccount(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: `1.5px solid ${t.surfaceBorder}`, background: "transparent", color: t.textMuted, fontSize: fs(13.5), fontWeight: 500, cursor: "pointer" }}>
                {ui.deleteConfirmCancel}
              </button>
              <button
                onClick={() => { deleteAccount(account.id); setConfirmDeleteAccount(false); setShowSettings(false); }}
                style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: "#FF7A6B", color: "#1A0D0B", fontSize: fs(13.5), fontWeight: 700, cursor: "pointer" }}
              >
                {ui.deleteConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <Modal
          onClose={() => setShowSettings(false)}
          onBack={settingsSection ? () => setSettingsSection(null) : undefined}
          title={
            settingsSection === "sync" ? ui.syncCodeTitle :
            settingsSection === "language" ? ui.languageTitle :
            settingsSection === "theme" ? ui.themeTitle :
            settingsSection === "textSize" ? ui.textSizeTitle :
            settingsSection === "notifications" ? ui.notificationsTitle :
            settingsSection === "currency" ? ui.currencyTitle :
            settingsSection === "trend" ? ui.monthlyTrend :
            settingsSection === "categories" ? ui.categoriesTitle :
            settingsSection === "recurring" ? ui.recurringMenuShort :
            settingsSection === "dues" ? trUI.duesMenu :
            settingsSection === "legal" ? ui.legalMenuLabel :
            ui.settingsTitle
          }
          t={t}
          fs={fs}
        >
          {settingsSection === null && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: fs(11.5), color: t.textMuted, margin: "0 2px 4px" }}>{ui.settingsMenuHint}</div>
              {[
                { key: "sync", label: ui.syncCodeTitle, icon: KeyRound },
                { key: "language", label: ui.languageTitle, icon: Languages },
                { key: "theme", label: ui.themeTitle, icon: Palette },
                { key: "textSize", label: ui.textSizeTitle, icon: Type },
                { key: "notifications", label: ui.notificationsTitle, icon: Bell },
                ...(account ? [{ key: "currency", label: ui.currencyTitle, icon: Wallet }] : []),
                ...(account && monthlyData.length > 0 ? [{ key: "trend", label: ui.monthlyTrend, icon: TrendingUp }] : []),
                ...(account ? [{ key: "categories", label: ui.categoriesTitle, icon: Tag }] : []),
                ...(account ? [{ key: "recurring", label: ui.recurringMenuShort, icon: Repeat }] : []),
                ...(account ? [{ key: "dues", label: trUI.duesMenu, icon: Calendar }] : []),
                { key: "legal", label: ui.legalMenuLabel, icon: Shield },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setSettingsSection(item.key)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "13px 12px", borderRadius: 12, border: `1px solid ${t.surfaceBorder}`, background: t.surfaceRow, cursor: "pointer" }}
                >
                  <item.icon size={16} color={t.textMuted} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, textAlign: "left", fontSize: fs(13.5), color: t.textStrong, fontWeight: 600 }}>{item.label}</span>
                  <ChevronRight size={16} color={t.textMuted} />
                </button>
              ))}
              {account && (
                <button onClick={() => setConfirmDeleteAccount(true)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "13px 12px", borderRadius: 12, border: "1.5px solid #4A2A2A", background: "transparent", color: "#FF7A6B", cursor: "pointer", marginTop: 6 }}>
                  <Trash2 size={16} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, textAlign: "left", fontSize: fs(13.5), fontWeight: 600 }}>{ui.deleteAccount}</span>
                </button>
              )}
              <div onClick={() => setShowDiag(!showDiag)} style={{ fontSize: fs(10.5), color: t.textMuted, textAlign: "center", marginTop: 6, opacity: 0.75, cursor: "pointer" }}>Finbar · v{APP_VERSION}</div>
              {showDiag && (() => {
                const d = arrowDiag.current;
                return (
                  <div style={{ fontSize: fs(10.5), color: t.textMuted, textAlign: "center", lineHeight: 1.6, fontFamily: "monospace", background: t.surfaceRow, border: `1px solid ${t.surfaceBorder}`, borderRadius: 10, padding: "8px 10px" }}>
                    scroll {d.scroll} · tocco {d.touch} · rotella {d.wheel} · controllo {d.poll}<br />
                    ignorati {d.ignored} · mostrate {d.shown}<br />
                    scorre: {d.lastScroller} {d.lastPos}/{d.lastMax}
                  </div>
                );
              })()}
            </div>
          )}

          {settingsSection === "sync" && (
            <>
              <div style={{ background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: fs(11.5), color: t.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
                  {ui.syncCodeDesc}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    ref={codeInputRef}
                    readOnly
                    value={syncCode || "…"}
                    onFocus={(e) => e.target.select()}
                    className="num"
                    style={{ flex: 1, background: t.surfaceDeep, border: `1px solid ${t.surfaceBorder}`, borderRadius: 8, padding: "10px 12px", fontSize: fs(13.5), letterSpacing: "0.03em", color: t.textStrong }}
                  />
                  <button onClick={copySyncCode} className="icon-btn" aria-label="Copy code" style={{ width: 40, height: 40, borderRadius: 8, background: copied ? "#2ECC71" : t.surfaceAlt, border: `1px solid ${t.surfaceAltBorder}`, flexShrink: 0, color: copied ? t.onAccent : t.textPrimary }}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <div style={{ fontSize: fs(10.5), color: "#576073", marginTop: 6 }}>{ui.copyFallback}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: fs(11), color: syncStatus === "error" ? "#FF7A6B" : syncStatus === "syncing" ? "#F0B429" : t.textMuted }}>
                  {syncStatus === "syncing" ? <RefreshCw size={11} /> : <Cloud size={11} />}
                  {syncStatus === "synced" && ui.syncedLabel}
                  {syncStatus === "syncing" && ui.syncingLabel}
                  {syncStatus === "error" && ui.syncErrorLabel}
                  {syncStatus === "idle" && ui.syncIdleLabel}
                </div>
              </div>

              <div style={{ background: t.surfaceRow, border: `1.5px dashed ${t.surfaceAltBorder}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: fs(11.5), color: t.textMuted, marginBottom: 8 }}>{ui.haveCodeOtherDevice}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={restoreInput}
                    onChange={(e) => setRestoreInput(e.target.value)}
                    placeholder="FNX-XXXX-XXXX-XXXX"
                    style={{ flex: 1, background: t.surfaceDeep, border: `1px solid ${t.surfaceBorder}`, borderRadius: 8, padding: "9px 11px", color: t.textStrong, fontSize: fs(12.5), fontFamily: "'JetBrains Mono', monospace" }}
                  />
                  <button onClick={restoreFromCode} disabled={restoring || !restoreInput.trim()} style={{ background: t.accent, color: t.onAccent, border: "none", borderRadius: 8, padding: "0 16px", fontWeight: 700, fontSize: fs(12.5), cursor: "pointer" }}>
                    {restoring ? "…" : ui.recoverBtn}
                  </button>
                </div>
                {restoreError && <div style={{ color: "#FF7A6B", fontSize: fs(11.5), marginTop: 6 }}>{restoreError}</div>}
              </div>
            </>
          )}

          {settingsSection === "language" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Object.entries(LANGUAGES).map(([key, name]) => (
                <button key={key} onClick={() => changeLanguage(key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${appLanguage === key ? t.accent : t.surfaceBorder}`, background: t.surfaceRow, cursor: "pointer" }}>
                  <span style={{ fontSize: fs(12.5), color: appLanguage === key ? t.accent : t.textStrong }}>{name}</span>
                </button>
              ))}
            </div>
          )}

          {settingsSection === "theme" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Object.entries(THEMES).map(([key, th]) => (
                <button key={key} onClick={() => changeTheme(key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${themeKey === key ? th.accent : t.surfaceBorder}`, background: t.surfaceRow, cursor: "pointer" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: th.accent }} />
                  <span style={{ fontSize: fs(12.5), color: t.textStrong }}>{th.name}</span>
                </button>
              ))}
            </div>
          )}

          {settingsSection === "textSize" && (
            <div>
              <div style={{ fontSize: fs(11.5), color: t.textMuted, marginBottom: 12, lineHeight: 1.5 }}>{ui.textSizeDesc}</div>
              <div style={{ background: t.surfaceRow, border: `1px solid ${t.surfaceBorder}`, borderRadius: 12, padding: 14, marginBottom: 14, textAlign: "center" }}>
                <div style={{ fontSize: fs(12), color: t.textMuted }}>{ui.totalBalance}</div>
                <div className="num" style={{ fontSize: fs(24), fontWeight: 700, color: t.textStrong, marginTop: 4 }}>
                  {currency(1234.56, account?.currency || "EUR")}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {TEXT_SCALE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => changeTextScale(opt)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${textScale === opt ? t.accent : t.surfaceBorder}`, background: t.surfaceRow, cursor: "pointer" }}
                  >
                    <span style={{ fontSize: fs(12.5), color: textScale === opt ? t.accent : t.textStrong, fontWeight: textScale === opt ? 700 : 500 }}>
                      {Math.round(opt * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {settingsSection === "notifications" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: t.surfaceRow, border: `1px solid ${t.surfaceBorder}`, borderRadius: 12, padding: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: fs(13), fontWeight: 600, color: t.textStrong, marginBottom: 4 }}>{ui.notificationsRecapLabel}</div>
                  <div style={{ fontSize: fs(11.5), color: t.textMuted, lineHeight: 1.5 }}>{ui.notificationsRecapDesc}</div>
                </div>
                <button
                  onClick={() => changeRecapEnabled(!recapEnabled)}
                  aria-label={recapEnabled ? ui.notifOn : ui.notifOff}
                  style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", background: recapEnabled ? t.accent : t.surfaceBorder, position: "relative", transition: "background 0.15s" }}
                >
                  <div style={{ position: "absolute", top: 3, left: recapEnabled ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
                </button>
              </div>
              {recapEnabled && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 10, padding: "0 2px" }}>
                  <span style={{ fontSize: fs(12.5), color: t.textStrong }}>{ui.notifMinHourLabel}</span>
                  <select
                    value={recapMinHour}
                    onChange={(e) => changeRecapMinHour(Number(e.target.value))}
                    style={{ ...selectStyle(t, fs), width: "auto", marginBottom: 0, padding: "8px 10px" }}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>
              )}

              {recapEnabled && (
                <div style={{ marginTop: 10, background: t.surfaceRow, border: `1px solid ${t.surfaceBorder}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: fs(13), fontWeight: 600, color: t.textStrong, marginBottom: 4 }}>{trUI.pushLabel}</div>
                      <div style={{ fontSize: fs(11.5), color: t.textMuted, lineHeight: 1.5 }}>{pushOn ? trUI.pushActiveNote(recapMinHour) : trUI.pushDesc}</div>
                    </div>
                    {renderToggle(pushOn, handlePushToggle, pushOn ? ui.notifOn : ui.notifOff, pushBusy || (!pushOn && !!pushBlocked))}
                  </div>

                  {!pushOn && pushBlocked && (
                    <div style={{ marginTop: 10, fontSize: fs(11.5), color: t.textMuted, lineHeight: 1.55 }}>
                      {pushBlocked === "ios-install" ? trUI.pushIosInstall : pushBlocked === "unsupported" ? trUI.pushUnsupported : pushBlocked === "need-sync" ? trUI.pushNeedSync : trUI.pushDenied}
                      {pushBlocked === "need-sync" && (
                        <button onClick={() => setSettingsSection("sync")} style={{ display: "block", marginTop: 8, background: "none", border: "none", color: t.accent, cursor: "pointer", fontSize: fs(12), fontWeight: 600, padding: 0 }}>{trUI.pushGoSync}</button>
                      )}
                    </div>
                  )}

                  {showPushIntro && !pushOn && !pushBlocked && (
                    <div style={{ marginTop: 10, background: t.surfaceAlt, border: `1px solid ${t.surfaceAltBorder}`, borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: fs(11.5), color: t.textStrong, lineHeight: 1.55, marginBottom: braveBrowser ? 8 : 10 }}>{trUI.pushIntro}</div>
                      {braveBrowser && <div style={{ fontSize: fs(11.5), color: t.textMuted, lineHeight: 1.55, marginBottom: 10 }}>{trUI.pushBrave}</div>}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <button onClick={() => setShowPushIntro(false)} style={{ padding: "10px 8px", borderRadius: 10, border: `1px solid ${t.surfaceBorder}`, background: t.surfaceRow, color: t.textStrong, cursor: "pointer", fontSize: fs(12.5), fontWeight: 600 }}>{trUI.pushCancel}</button>
                        <button onClick={enablePush} disabled={pushBusy} style={{ padding: "10px 8px", borderRadius: 10, border: "none", background: t.accent, color: "#fff", cursor: pushBusy ? "default" : "pointer", opacity: pushBusy ? 0.6 : 1, fontSize: fs(12.5), fontWeight: 700 }}>{trUI.pushActivate}</button>
                      </div>
                    </div>
                  )}

                  {pushError && (
                    <div style={{ marginTop: 10, fontSize: fs(11.5), color: t.textMuted, lineHeight: 1.55 }}>{pushError === "brave" ? trUI.pushBrave : trUI.pushError}</div>
                  )}

                  {pushOn && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.surfaceBorder}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: fs(12.5), fontWeight: 600, color: t.textStrong, marginBottom: 3 }}>{trUI.pushHideLabel}</div>
                        <div style={{ fontSize: fs(11.5), color: t.textMuted, lineHeight: 1.5 }}>{trUI.pushHideDesc}</div>
                      </div>
                      {renderToggle(pushHide, () => changePushHide(!pushHide), pushHide ? ui.notifOn : ui.notifOff)}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: t.surfaceRow, border: `1px solid ${t.surfaceBorder}`, borderRadius: 12, padding: 14, marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: fs(13), fontWeight: 600, color: t.textStrong, marginBottom: 4 }}>{ui.notificationsTipLabel}</div>
                  <div style={{ fontSize: fs(11.5), color: t.textMuted, lineHeight: 1.5 }}>{ui.notificationsTipDesc}</div>
                </div>
                <button
                  onClick={() => changeTipEnabled(!tipEnabled)}
                  aria-label={tipEnabled ? ui.notifOn : ui.notifOff}
                  style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", background: tipEnabled ? t.accent : t.surfaceBorder, position: "relative", transition: "background 0.15s" }}
                >
                  <div style={{ position: "absolute", top: 3, left: tipEnabled ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
                </button>
              </div>
            </div>
          )}

          {settingsSection === "currency" && account && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {Object.entries(CURRENCIES).map(([code, c]) => (
                  <button key={code} disabled={currencyConverting} onClick={() => changeCurrency(code)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${(account.currency || "EUR") === code ? t.accent : t.surfaceBorder}`, background: t.surfaceRow, cursor: currencyConverting ? "wait" : "pointer", opacity: currencyConverting ? 0.6 : 1 }}>
                    <span style={{ fontSize: fs(12.5), color: (account.currency || "EUR") === code ? t.accent : t.textStrong }}>{c.label}</span>
                  </button>
                ))}
              </div>
              {currencyConverting && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fs(11.5), color: t.textMuted, marginTop: 10 }}>
                  <RefreshCw size={12} /> {ui.currencyConverting}
                </div>
              )}
              {currencyError && (
                <div style={{ fontSize: fs(12), color: "#FF7A6B", background: "rgba(255,122,107,0.08)", border: "1px solid #4A2A2A", borderRadius: 8, padding: "8px 10px", marginTop: 10 }}>
                  {currencyError}
                </div>
              )}
            </>
          )}

          {settingsSection === "trend" && account && monthlyData.length > 0 && (
            <>
              <div style={{ fontSize: fs(12), color: t.textMuted, margin: "0 0 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {account.name}
                  <button
                    onClick={() => { setYearlyViewYear(currentCalendarYear); setShowYearlyView(true); }}
                    className="icon-btn"
                    aria-label={ui.expandYearly}
                    title={ui.expandYearly}
                    style={{ color: t.textMuted, padding: 2 }}
                  >
                    <Maximize2 size={13} />
                  </button>
                </span>
                {monthlyChange !== null && (
                  <span style={{ color: monthlyChange >= 20 ? "#2ECC71" : monthlyChange >= 0 ? "#F0B429" : "#FF7A6B", fontWeight: 700 }}>
                    {monthlyChange >= 0 ? "+" : ""}{monthlyChange}% {ui.vsLastMonth}
                  </span>
                )}
              </div>
              <div style={{ background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 14, padding: "14px 10px 6px", marginBottom: 14, height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData} margin={{ top: 4, right: 10, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={t.modalBorder} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: t.textMuted, fontSize: 10 }} axisLine={{ stroke: t.modalBorder }} tickLine={false} />
                    <YAxis tick={{ fill: t.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: t.surfaceDeep, border: `1px solid ${t.surfaceBorder}`, borderRadius: 8, fontSize: fs(12) }} formatter={(v) => currency(v, account.currency)} />
                    <Line type="monotone" dataKey="net" stroke={t.accent} strokeWidth={2.5} dot={{ r: 3, fill: t.accent }} name={ui.netMonthly} />
                    <Line type="monotone" dataKey="target" stroke={t.accent2} strokeWidth={1.5} strokeDasharray="5 4" dot={false} name={ui.threshold20} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: fs(11), color: t.textMuted }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 12, height: 2, background: t.accent }} /> {ui.netMonthly}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 12, height: 2, background: t.accent2, opacity: 0.7 }} /> {ui.threshold20}</span>
              </div>
            </>
          )}

          {settingsSection === "categories" && account && (
            <>
              <div ref={tourCategoriesRef} style={{ fontSize: fs(12), color: t.textMuted, margin: "0 0 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{account.name}</span>
                {(() => {
                  const total = Math.round(Object.values(catDraft || account.categories).reduce((s, c) => s + (Number(c.pct) || 0), 0));
                  return <span style={{ fontWeight: 700, color: total === 100 ? "#2ECC71" : "#F0B429" }}>{ui.total}: {total}%</span>;
                })()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                {Object.entries(catDraft || account.categories).map(([id, c]) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                    <input
                      value={c.label}
                      onChange={(e) => renameCategoryDraft(id, e.target.value)}
                      style={{ flex: 1, background: t.surface, border: `1px solid ${t.surfaceBorder}`, borderRadius: 6, padding: "6px 8px", color: t.textStrong, fontSize: fs(12.5) }}
                    />
                    <input type="number" min="0" max="100" value={c.pct} onChange={(e) => updateCategoryPctDraft(id, parseFloat(e.target.value) || 0)} style={{ width: 52, background: t.surface, border: `1px solid ${t.surfaceBorder}`, borderRadius: 6, padding: "6px 6px", color: t.textStrong, fontSize: fs(12.5), textAlign: "right" }} />
                    <span style={{ fontSize: fs(11), color: t.textMuted }}>%</span>
                    <button onClick={() => deleteCategoryDraft(id)} className="icon-btn" aria-label="Delete category" style={{ color: t.textMuted }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <AddCategoryRow accent={t.accent} t={t} onAdd={addCategoryDraft} ui={ui} fs={fs} />
              {catSaveError && (
                <div style={{ fontSize: fs(12), color: "#FF7A6B", background: "rgba(255,122,107,0.08)", border: "1px solid #4A2A2A", borderRadius: 8, padding: "8px 10px", marginTop: 10 }}>
                  {catSaveError}
                </div>
              )}
              <button onClick={saveCategoriesDraft} style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: t.accent, color: t.onAccent, fontSize: fs(13), fontWeight: 700, cursor: "pointer", marginTop: 10 }}>
                {ui.saveCategoriesBtn}
              </button>

              {Object.keys(account.learnedTerms || {}).length > 0 && (
                <>
                  <div style={{ fontSize: fs(12), color: t.textMuted, margin: "18px 0 8px" }}>{ui.learnedWords}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {Object.entries(account.learnedTerms || {}).map(([word, catId]) => (
                      <span key={word} style={{ display: "flex", alignItems: "center", gap: 6, background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 16, padding: "5px 6px 5px 10px", fontSize: fs(11.5), color: t.textPrimary }}>
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
                  <div style={{ fontSize: fs(12), color: t.textMuted, margin: "18px 0 8px" }}>{ui.customWords}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {Object.entries(account.customTypeWords || {}).map(([word, type]) => (
                      <span key={word} style={{ display: "flex", alignItems: "center", gap: 6, background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 16, padding: "5px 6px 5px 10px", fontSize: fs(11.5), color: t.textPrimary }}>
                        "{word}" → {type === "entrata" ? (T[appLanguage] || T.it).income : (T[appLanguage] || T.it).expense}
                        <button onClick={() => forgetCustomTypeWord(word)} className="icon-btn" aria-label="Forget" style={{ color: t.textMuted }}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {settingsSection === "recurring" && account && (
            <>
              <div style={{ fontSize: fs(11.5), color: t.textMuted, marginBottom: 12 }}>{ui.recurringTitle}</div>
              {(account.recurring || []).length === 0 && (
                <div style={{ fontSize: fs(12), color: t.textMuted, marginBottom: 10 }}>{ui.recurringEmpty}</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                {(account.recurring || []).map((r) => {
                  const isSpesa = r.transactionType === "spesa";
                  const freqLabel = r.frequency === "weekly" ? ui.weekly : r.frequency === "yearly" ? ui.yearly : ui.monthly;
                  return (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 10, padding: "10px 12px" }}>
                      {isSpesa ? <TrendingDown size={15} color="#FF7A6B" style={{ flexShrink: 0 }} /> : <TrendingUp size={15} color="#2ECC71" style={{ flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: fs(13), fontWeight: 600 }}>{r.label}{r.kind ? ` · ${RECURRING_KINDS[r.kind]}` : ""}</div>
                        <div style={{ fontSize: fs(11), color: t.textMuted }}>
                          {freqLabel} · {r.category === "TUTTE" ? ui.allCategoriesSplit : account.categories[r.category]?.label || r.category}
                          {r.lastAppliedDate ? ` · ${ui.lastRun}: ${r.lastAppliedDate}` : ` · ${ui.notActiveYet}`}
                        </div>
                      </div>
                      <span className="num" style={{ fontSize: fs(13), fontWeight: 700, color: isSpesa ? "#FF7A6B" : "#2ECC71" }}>{isSpesa ? "−" : "+"}{currency(r.amount, account.currency)}</span>
                      <button onClick={() => deleteRecurring(r.id)} className="icon-btn" aria-label="Delete recurring entry" style={{ color: t.textMuted }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <RecurringForm accent={t.accent} t={t} categories={account.categories} onAdd={addRecurring} ui={ui} fs={fs} />
            </>
          )}

          {settingsSection === "dues" && account && (() => {
            const list = [...(account.dues || [])].sort((a, b) => a.date.localeCompare(b.date));
            const editing = editingDueId ? list.find((d) => d.id === editingDueId) : null;
            return (
              <>
                <div style={{ fontSize: fs(11.5), color: t.textMuted, marginBottom: 12, lineHeight: 1.5 }}>{trUI.duesIntro}</div>
                {list.length === 0 && <div style={{ fontSize: fs(12), color: t.textMuted, marginBottom: 10, lineHeight: 1.5 }}>{trUI.duesEmpty}</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                  {list.map((d) => {
                    const days = daysBetweenISO(todayLocal, d.date);
                    const rate = dueRate(d);
                    const isSpesa = d.type !== "entrata";
                    const repLabel = d.repeat === "weekly" ? trUI.duesWeekly : d.repeat === "monthly" ? trUI.duesMonthly : d.repeat === "yearly" ? trUI.duesYearly : "";
                    const catLabel = d.category === "TUTTE" ? ui.allCategoriesSplit : d.category && account.categories[d.category] ? account.categories[d.category].label : "";
                    return (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, background: t.surfaceRow, border: `1px solid ${editingDueId === d.id ? t.accent : t.modalBorder}`, borderRadius: 10, padding: "10px 12px" }}>
                        {isSpesa ? <TrendingDown size={15} color="#FF7A6B" style={{ flexShrink: 0 }} /> : <TrendingUp size={15} color="#2ECC71" style={{ flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: fs(13), fontWeight: 600 }}>{d.label}</div>
                          <div style={{ fontSize: fs(11), color: days < 0 ? "#FF7A6B" : t.textMuted, lineHeight: 1.45 }}>
                            {formatDueDate(d.date, appLanguage, { year: true })} · {dueWhenText(days, trUI)}
                            {repLabel && !rate ? ` · ${repLabel}` : ""}
                            {catLabel ? ` · ${catLabel}` : ""}
                            {rate ? ` · ${trUI.duesRateInfo(rate.k, rate.total, rate.left, currency(rate.leftAmount, account.currency))}` : ""}
                          </div>
                        </div>
                        <span className="num" style={{ fontSize: fs(13), fontWeight: 700, color: isSpesa ? "#FF7A6B" : "#2ECC71" }}>{isSpesa ? "−" : "+"}{currency(d.amount, account.currency)}</span>
                        <button onClick={() => setEditingDueId(d.id)} className="icon-btn" aria-label="Edit due date" style={{ color: t.textMuted }}><Pencil size={13} /></button>
                        <button onClick={() => deleteDue(d.id)} className="icon-btn" aria-label="Delete due date" style={{ color: t.textMuted }}><Trash2 size={13} /></button>
                      </div>
                    );
                  })}
                </div>
                <DueForm key={editing ? editing.id : "new"} accent={t.accent} t={t} categories={account.categories} initial={editing} onSave={saveDue} onCancel={() => setEditingDueId(null)} tr={trUI} ui={ui} fs={fs} />
              </>
            );
          })()}

          {settingsSection === "legal" && (() => {
            const legal = LEGAL_TEXT[appLanguage] || LEGAL_TEXT.it;
            const sections = settingsLegalTab === "privacy" ? legal.privacy : legal.terms;
            const sectionTitle = settingsLegalTab === "privacy" ? legal.privacyTitle : legal.termsTitle;
            return (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <button onClick={() => setSettingsLegalTab("privacy")} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1.5px solid ${settingsLegalTab === "privacy" ? t.accent : t.surfaceBorder}`, background: settingsLegalTab === "privacy" ? t.surfaceRow : "transparent", color: settingsLegalTab === "privacy" ? t.accent : t.textMuted, fontSize: fs(12.5), fontWeight: 700, cursor: "pointer" }}>
                    {ui.legalTabPrivacy}
                  </button>
                  <button onClick={() => setSettingsLegalTab("terms")} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1.5px solid ${settingsLegalTab === "terms" ? t.accent : t.surfaceBorder}`, background: settingsLegalTab === "terms" ? t.surfaceRow : "transparent", color: settingsLegalTab === "terms" ? t.accent : t.textMuted, fontSize: fs(12.5), fontWeight: 700, cursor: "pointer" }}>
                    {ui.legalTabTerms}
                  </button>
                </div>
                <h2 className="display" style={{ fontSize: fs(15), fontWeight: 700, margin: "0 0 4px", color: t.textStrong }}>{sectionTitle}</h2>
                <div style={{ fontSize: fs(10.5), color: t.textMuted, marginBottom: legal.note ? 4 : 12 }}>{legal.updated}</div>
                {legal.note && <div style={{ fontSize: fs(10.5), color: "#F0B429", marginBottom: 12, fontStyle: "italic" }}>{legal.note}</div>}
                {sections.map((s, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: fs(12.5), fontWeight: 700, color: t.textStrong, marginBottom: 5 }}>{s.h}</div>
                    {s.p.map((para, j) => (
                      <div key={j} style={{ fontSize: fs(11.5), color: t.textPrimary, lineHeight: 1.6, marginBottom: 6 }}>{para}</div>
                    ))}
                  </div>
                ))}
              </>
            );
          })()}
        </Modal>
      )}

      {payDueTarget && account && (() => {
        const d = (account.dues || []).find((x) => x.id === payDueTarget);
        if (!d) return null;
        const btn = { padding: "11px 12px", borderRadius: 10, border: `1px solid ${t.surfaceBorder}`, background: t.surfaceRow, color: t.textStrong, cursor: "pointer", fontSize: fs(13), fontWeight: 600, textAlign: "left" };
        return (
          <Modal onClose={() => setPayDueTarget(null)} title={trUI.duesPickCategory} t={t} fs={fs}>
            <div style={{ fontSize: fs(12.5), color: t.textMuted, marginBottom: 12 }}>{d.label} · {currency(d.amount, account.currency)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(account.categories).map(([id, c]) => (
                <button key={id} onClick={() => payDueNow(d.id, id)} style={btn}>{c.label}</button>
              ))}
              <button onClick={() => payDueNow(d.id, "TUTTE")} style={btn}>{ui.allCategoriesSplit}</button>
            </div>
          </Modal>
        );
      })()}

      {showUndoConfirm && account && undoCheck(accounts, activeId) === "ok" && (() => {
        const last = account.transactions[0];
        return (
          <Modal onClose={() => setShowUndoConfirm(false)} title={trUI.undoTitle} t={t} fs={fs}>
            <div style={{ fontSize: fs(13), color: t.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
              {trUI.undoAsk(last.type === "spesa" ? trUI.expense : trUI.income, last.amount, last.category, last.currency || account.currency)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                onClick={() => setShowUndoConfirm(false)}
                style={{ padding: "12px 10px", borderRadius: 10, border: `1px solid ${t.surfaceBorder}`, background: t.surfaceRow, color: t.textStrong, cursor: "pointer", fontSize: fs(13), fontWeight: 600 }}
              >
                {trUI.cancel}
              </button>
              <button
                onClick={() => { undoLast(); setShowUndoConfirm(false); }}
                style={{ padding: "12px 10px", borderRadius: 10, border: "none", background: t.accent, color: "#fff", cursor: "pointer", fontSize: fs(13), fontWeight: 700 }}
              >
                {trUI.confirm}
              </button>
            </div>
          </Modal>
        );
      })()}

      {showExportChoice && account && (
        <Modal onClose={() => setShowExportChoice(false)} title={ui.exportHistory} t={t} fs={fs}>
          <div style={{ fontSize: fs(12.5), color: t.textMuted, marginBottom: 14 }}>{ui.exportChooseFormat}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              onClick={() => { exportHistoryCSV(); setShowExportChoice(false); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "18px 10px", borderRadius: 12, border: `1.5px solid ${t.surfaceBorder}`, background: t.surfaceRow, cursor: "pointer", color: t.textStrong }}
            >
              <Table size={22} color={t.accent} />
              <span style={{ fontSize: fs(13), fontWeight: 600 }}>CSV</span>
            </button>
            <button
              onClick={() => { exportHistoryPDF(); setShowExportChoice(false); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "18px 10px", borderRadius: 12, border: `1.5px solid ${t.surfaceBorder}`, background: t.surfaceRow, cursor: "pointer", color: t.textStrong }}
            >
              <FileText size={22} color={t.accent} />
              <span style={{ fontSize: fs(13), fontWeight: 600 }}>PDF</span>
            </button>
          </div>
        </Modal>
      )}

      {showYearlyView && account && (
        <Modal
          onClose={() => setShowYearlyView(false)}
          t={t}
          fs={fs}
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => setYearlyViewYear((y) => Math.max(yearlyMinYear, y - 1))}
                disabled={yearlyViewYear <= yearlyMinYear}
                className="icon-btn"
                aria-label="Previous year"
                style={{ color: yearlyViewYear <= yearlyMinYear ? t.surfaceBorder : t.textStrong }}
              >
                <ChevronLeft size={20} />
              </button>
              <span className="num" style={{ minWidth: 52, textAlign: "center" }}>{yearlyViewYear}</span>
              <button
                onClick={() => setYearlyViewYear((y) => Math.min(currentCalendarYear, y + 1))}
                disabled={yearlyViewYear >= currentCalendarYear}
                className="icon-btn"
                aria-label="Next year"
                style={{ color: yearlyViewYear >= currentCalendarYear ? t.surfaceBorder : t.textStrong }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          }
        >
          <div style={{ background: t.surfaceRow, border: `1px solid ${t.modalBorder}`, borderRadius: 14, padding: "14px 10px 6px", height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearlyRows} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={t.modalBorder} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: t.textMuted, fontSize: 10 }} axisLine={{ stroke: t.modalBorder }} tickLine={false} />
                <YAxis tick={{ fill: t.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: t.surfaceDeep, border: `1px solid ${t.surfaceBorder}`, borderRadius: 8, fontSize: fs(12) }} formatter={(v) => (v === null ? "—" : currency(v, account.currency))} />
                <Line type="monotone" dataKey="value" stroke={t.accent} strokeWidth={2.5} dot={renderYearDot} connectNulls={false} name={ui.netMonthly} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: fs(11), color: t.textMuted }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#2ECC71", flexShrink: 0 }} />
            {ui.growthDotLegend}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ onClose, onBack, title, children, t, fs = (px) => px }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,20,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.modalBg, width: "100%", maxWidth: 480, borderRadius: "18px 18px 0 0", padding: "18px 18px 26px", maxHeight: "85vh", overflowY: "auto", border: `1px solid ${t.modalBorder}`, borderBottom: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {onBack && (
              <button onClick={onBack} className="icon-btn" aria-label="Back" style={{ color: t.textMuted, marginLeft: -6 }}>
                <ChevronLeft size={20} />
              </button>
            )}
            <h2 className="display" style={{ fontSize: fs(17), fontWeight: 700, margin: 0, color: t.textStrong }}>{title}</h2>
          </div>
          <button onClick={onClose} className="icon-btn" style={{ color: t.textMuted }}><X size={19} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NewAccountForm({ accent, t, onCreate, ui, fs = (px) => px }) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [currencyCode, setCurrencyCode] = useState("EUR");
  return (
    <div>
      <label style={{ display: "block", fontSize: fs(12), color: t.textMuted, marginBottom: 5 }}>{ui.accountName}</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={ui.accountNamePh} style={inputStyle(t, fs)} />
      <label style={{ display: "block", fontSize: fs(12), color: t.textMuted, marginBottom: 5 }}>{ui.currencyLabel}</label>
      <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} style={selectStyle(t, fs)}>
        {Object.entries(CURRENCIES).map(([code, c]) => <option key={code} value={code}>{c.label}</option>)}
      </select>
      <label style={{ display: "block", fontSize: fs(12), color: t.textMuted, marginBottom: 5 }}>{ui.initialBalance} ({CURRENCIES[currencyCode].symbol})</label>
      <input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0,00" style={{ ...inputStyle(t, fs), fontFamily: "'JetBrains Mono', monospace" }} />
      <button onClick={() => onCreate(name.trim() || "Conto", parseFloat(balance.replace(",", ".")) || 0, currencyCode)} style={{ width: "100%", background: accent, color: t.onAccent, border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: fs(14), cursor: "pointer" }}>
        {ui.createAccountBtn}
      </button>
    </div>
  );
}

function TransferForm({ accounts, fromDefault, accent, t, onSubmit, ui, fs = (px) => px }) {
  const ids = Object.keys(accounts);
  const [from, setFrom] = useState(fromDefault);
  const [to, setTo] = useState(ids.find((i) => i !== fromDefault) || "");
  const [amount, setAmount] = useState("");
  const fromCur = CURRENCIES[accounts[from]?.currency || "EUR"].symbol;
  return (
    <div>
      <label style={{ display: "block", fontSize: fs(12), color: t.textMuted, marginBottom: 5 }}>{ui.from}</label>
      <select value={from} onChange={(e) => setFrom(e.target.value)} style={selectStyle(t, fs)}>
        {ids.map((id) => <option key={id} value={id}>{accounts[id].name}</option>)}
      </select>
      <label style={{ display: "block", fontSize: fs(12), color: t.textMuted, marginBottom: 5 }}>{ui.to}</label>
      <select value={to} onChange={(e) => setTo(e.target.value)} style={selectStyle(t, fs)}>
        {ids.map((id) => <option key={id} value={id}>{accounts[id].name}</option>)}
      </select>
      <label style={{ display: "block", fontSize: fs(12), color: t.textMuted, marginBottom: 5 }}>{ui.amount} ({fromCur})</label>
      <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" style={{ ...inputStyle(t, fs), fontFamily: "'JetBrains Mono', monospace" }} />
      <button onClick={() => onSubmit(from, to, parseFloat(amount.replace(",", ".")) || 0)} style={{ width: "100%", background: accent, color: t.onAccent, border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: fs(14), cursor: "pointer" }}>
        {ui.transferBtn}
      </button>
    </div>
  );
}

function TxForm({ account, accent, t, onSubmit, ui, fs = (px) => px }) {
  const [type, setType] = useState("spesa");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(Object.keys(account.categories)[0]);
  const [note, setNote] = useState("");
  const sym = CURRENCIES[account.currency || "EUR"].symbol;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["spesa", "entrata"].map((tt) => (
          <button key={tt} onClick={() => setType(tt)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1.5px solid ${type === tt ? accent : t.surfaceBorder}`, background: type === tt ? `${accent}22` : "transparent", color: type === tt ? accent : t.textMuted, fontWeight: 600, fontSize: fs(13.5), cursor: "pointer" }}>
            {tt === "spesa" ? ui.expenseType : ui.incomeType}
          </button>
        ))}
      </div>
      <label style={{ display: "block", fontSize: fs(12), color: t.textMuted, marginBottom: 5 }}>{ui.amount} ({sym})</label>
      <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" style={{ ...inputStyle(t, fs), fontFamily: "'JetBrains Mono', monospace" }} />
      <label style={{ display: "block", fontSize: fs(12), color: t.textMuted, marginBottom: 5 }}>{ui.category}</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle(t, fs)}>
        {Object.entries(account.categories).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
      </select>
      <label style={{ display: "block", fontSize: fs(12), color: t.textMuted, marginBottom: 5 }}>{ui.note}</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ui.notePh} style={{ ...inputStyle(t, fs), marginBottom: 18 }} />
      <button onClick={() => onSubmit({ transactionType: type, amount: parseFloat(amount.replace(",", ".")) || 0, category, note })} style={{ width: "100%", background: accent, color: t.onAccent, border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: fs(14), cursor: "pointer" }}>
        {ui.save}
      </button>
    </div>
  );
}

const inputStyle = (t, fs = (px) => px) => ({ width: "100%", padding: "11px 13px", borderRadius: 9, border: `1px solid ${t.surfaceBorder}`, background: t.surface, color: t.textStrong, fontSize: fs(14), marginBottom: 14 });
const selectStyle = (t, fs = (px) => px) => ({ ...inputStyle(t, fs) });

function RecurringForm({ accent, t, categories, onAdd, ui, fs = (px) => px }) {
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
          <button key={tt} onClick={() => setTransactionType(tt)} style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: `1.5px solid ${transactionType === tt ? accent : t.surfaceBorder}`, background: transactionType === tt ? `${accent}22` : "transparent", color: transactionType === tt ? accent : t.textMuted, fontWeight: 600, fontSize: fs(12), cursor: "pointer" }}>
            {tt === "spesa" ? ui.expenseType : ui.incomeType}
          </button>
        ))}
      </div>
      {transactionType === "spesa" && (
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...selectStyle(t, fs), marginBottom: 8, fontSize: fs(12.5), padding: "9px 10px" }}>
          <option value="abbonamento">{ui.kindSub}</option>
          <option value="biglietto">{ui.kindTicket}</option>
          <option value="altro">{ui.kindOther}</option>
        </select>
      )}
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={transactionType === "spesa" ? ui.recurringNamePh : ui.recurringNamePhIncome} style={{ ...inputStyle(t, fs), marginBottom: 8, fontSize: fs(12.5), padding: "9px 10px" }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={ui.amountPh} style={{ ...inputStyle(t, fs), marginBottom: 0, fontSize: fs(12.5), padding: "9px 10px", fontFamily: "'JetBrains Mono', monospace" }} />
        <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={{ ...selectStyle(t, fs), marginBottom: 0, fontSize: fs(12.5), padding: "9px 10px", width: 120 }}>
          <option value="weekly">{ui.freqWeekly}</option>
          <option value="monthly">{ui.freqMonthly}</option>
          <option value="yearly">{ui.freqYearly}</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...selectStyle(t, fs), marginBottom: 0, fontSize: fs(12.5), padding: "9px 10px" }}>
          <option value="TUTTE">{ui.allCategoriesSplit}</option>
          {Object.entries(categories).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ ...inputStyle(t, fs), marginBottom: 0, fontSize: fs(12.5), padding: "9px 10px", width: 140 }} />
      </div>
      <button onClick={submit} style={{ width: "100%", background: accent, color: t.onAccent, border: "none", borderRadius: 8, padding: "9px 0", fontWeight: 700, fontSize: fs(12.5), cursor: "pointer" }}>
        {ui.addRecurringBtn}
      </button>
    </div>
  );
}

function DueForm({ accent, t, categories, onSave, onCancel, initial, tr, ui, fs = (px) => px }) {
  const [type, setType] = useState(initial ? initial.type : "spesa");
  const [label, setLabel] = useState(initial ? initial.label : "");
  const [amount, setAmount] = useState(initial ? String(initial.amount).replace(".", ",") : "");
  const [category, setCategory] = useState(initial ? initial.category : "");
  const [date, setDate] = useState(initial ? initial.date : localTodayISO());
  const [repeat, setRepeat] = useState(initial ? initial.repeat : "none");
  const [instTotal, setInstTotal] = useState(initial && initial.installments ? String(initial.installments.total) : "");
  const [instPaid, setInstPaid] = useState(initial && initial.installments ? String(initial.installments.paid) : "");
  const [err, setErr] = useState(false);

  const submit = () => {
    const amt = parseFloat(String(amount).replace(",", "."));
    const total = instTotal ? parseInt(instTotal, 10) : 0;
    const paid = instPaid ? parseInt(instPaid, 10) : 0;
    const p = /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? isoParts(date) : null;
    const okInst = !instTotal || (total >= 1 && paid >= 0 && paid < total);
    if (!label.trim() || !(amt > 0) || !p || !isValidYMD(p.y, p.m, p.d) || !okInst) { setErr(true); return; }
    setErr(false);
    const saved = onSave({ type, label: label.trim(), amount: amt, category, date, repeat, installments: total ? { total, paid } : null }, initial ? initial.id : null);
    if (saved && !initial) { setLabel(""); setAmount(""); setInstTotal(""); setInstPaid(""); setRepeat("none"); }
  };
  const small = { fontSize: fs(12.5), padding: "9px 10px" };

  return (
    <div style={{ background: t.surfaceRow, border: `1.5px dashed ${t.surfaceAltBorder}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {["spesa", "entrata"].map((tt) => (
          <button key={tt} onClick={() => setType(tt)} style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: `1.5px solid ${type === tt ? accent : t.surfaceBorder}`, background: type === tt ? `${accent}22` : "transparent", color: type === tt ? accent : t.textMuted, fontWeight: 600, fontSize: fs(12), cursor: "pointer" }}>
            {tt === "spesa" ? ui.expenseType : ui.incomeType}
          </button>
        ))}
      </div>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={tr.duesNamePh} style={{ ...inputStyle(t, fs), marginBottom: 8, ...small }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={ui.amountPh} style={{ ...inputStyle(t, fs), marginBottom: 0, ...small, fontFamily: "'JetBrains Mono', monospace" }} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={tr.duesDateLabel} style={{ ...inputStyle(t, fs), marginBottom: 0, ...small, width: 150 }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...selectStyle(t, fs), marginBottom: 0, ...small }}>
          <option value="">{tr.duesCategoryAsk}</option>
          <option value="TUTTE">{ui.allCategoriesSplit}</option>
          {Object.entries(categories).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
        </select>
        <select value={repeat} onChange={(e) => setRepeat(e.target.value)} style={{ ...selectStyle(t, fs), marginBottom: 0, ...small, width: 140 }}>
          <option value="none">{tr.duesRepeatNone}</option>
          <option value="weekly">{tr.duesWeekly}</option>
          <option value="monthly">{tr.duesMonthly}</option>
          <option value="yearly">{tr.duesYearly}</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        <input inputMode="numeric" value={instTotal} onChange={(e) => setInstTotal(e.target.value.replace(/\D/g, ""))} placeholder={tr.duesInstTotalPh} style={{ ...inputStyle(t, fs), marginBottom: 0, ...small }} />
        <input inputMode="numeric" value={instPaid} onChange={(e) => setInstPaid(e.target.value.replace(/\D/g, ""))} placeholder={tr.duesInstPaidPh} style={{ ...inputStyle(t, fs), marginBottom: 0, ...small }} />
      </div>
      <div style={{ fontSize: fs(11), color: t.textMuted, lineHeight: 1.45, marginBottom: 10 }}>{tr.duesInstHint}</div>
      {err && <div style={{ fontSize: fs(11.5), color: "#FF7A6B", marginBottom: 8 }}>{tr.duesFormError}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        {initial && (
          <button onClick={onCancel} style={{ flex: 1, background: "transparent", color: t.textMuted, border: `1px solid ${t.surfaceBorder}`, borderRadius: 8, padding: "9px 0", fontWeight: 600, fontSize: fs(12.5), cursor: "pointer" }}>
            {tr.duesCancelBtn}
          </button>
        )}
        <button onClick={submit} style={{ flex: 2, background: accent, color: t.onAccent, border: "none", borderRadius: 8, padding: "9px 0", fontWeight: 700, fontSize: fs(12.5), cursor: "pointer" }}>
          {initial ? tr.duesSaveBtn : tr.duesAddBtn}
        </button>
      </div>
    </div>
  );
}

function AddCategoryRow({ accent, t, onAdd, ui, fs = (px) => px }) {
  const [val, setVal] = useState("");
  const submit = () => { onAdd(val); setVal(""); };
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
      <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={ui.newCategoryPh} style={{ flex: 1, background: t.surface, border: `1.5px dashed ${t.surfaceAltBorder}`, borderRadius: 8, padding: "9px 11px", color: t.textStrong, fontSize: fs(12.5) }} />
      <button onClick={submit} style={{ background: accent, color: t.onAccent, border: "none", borderRadius: 8, padding: "0 14px", fontWeight: 700, fontSize: fs(12.5), cursor: "pointer" }}>
        <Plus size={14} />
      </button>
    </div>
  );
}
