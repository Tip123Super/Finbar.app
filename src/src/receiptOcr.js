// receiptOcr.js — lettura scontrini gratuita, interamente nel browser (Tesseract.js)
// Nessuna chiave API, nessun costo, nessun limite di richieste.
// Sostituisce la vecchia chiamata diretta a api.anthropic.com per la scansione scontrini.

import { createWorker } from "tesseract.js";

// stesso dizionario di sinonimi categoria usato dal parser testuale in App.jsx,
// duplicato qui per tenere questo file indipendente e facile da spostare/aggiornare.
const CATEGORY_SYNONYMS = {
  cibo: ["cibo", "alimentar", "spesa alimentare", "food", "grocer", "mancare", "restaurant", "ristorante", "supermerc", "еда", "продукты", "食物", "餐饮", "超市"],
  casa: ["casa", "affitto", "bollet", "house", "rent", "utilit", "bill", "chirie", "factur", "дом", "аренда", "счета", "房租", "账单"],
  trasporti: ["trasport", "benzina", "treno", "autobus", "transport", "bus", "train", "fuel", "gas", "tren", "combustibil", "metrou", "metro", "taxi", "uber", "транспорт", "бензин", "交通", "汽油", "公交"],
  svago: ["svago", "divertiment", "cinema", "shopping", "hobby", "fun", "entertainment", "distrac", "joc", "gioc", "развлечения", "娱乐"],
  salute: ["salute", "farmacia", "medico", "health", "pharmac", "doctor", "sanatate", "farmacie", "medic", "здоровье", "аптека", "健康", "药店"],
  risparmi: ["risparmi", "saving", "economii", "risparmio", "сбережения", "储蓄"],
  altro: ["altro", "varie", "other", "misc", "altele", "другое", "其他"],
};

const TOTAL_KEYWORDS = ["totale", "total", "importo", "suma", "subtotal", "итого", "总计", "合计", "tot."];
const NUM_REGEX = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/g;

// mappa lingua app -> pacchetto lingua Tesseract
const OCR_LANG_MAP = { it: "ita", en: "eng", ro: "ron", ru: "rus", zh: "chi_sim" };

function normalizeText(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseAmountString(s) {
  let clean = s.replace(/\s/g, "");
  if (clean.includes(",") && clean.includes(".")) {
    if (clean.lastIndexOf(",") > clean.lastIndexOf(".")) clean = clean.replace(/\./g, "").replace(",", ".");
    else clean = clean.replace(/,/g, "");
  } else if (clean.includes(",")) {
    clean = clean.replace(",", ".");
  }
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function extractAmount(rawText) {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  // 1) riga con "totale/total/..." -> prende l'ultimo numero su quella riga
  for (const line of lines) {
    const norm = normalizeText(line);
    if (TOTAL_KEYWORDS.some((k) => norm.includes(k))) {
      const nums = line.match(NUM_REGEX);
      if (nums && nums.length) {
        const val = parseAmountString(nums[nums.length - 1]);
        if (val > 0) return Math.round(val * 100) / 100;
      }
    }
  }
  // 2) fallback: il numero più alto trovato nello scontrino (di solito è il totale finale)
  const allNums = (rawText.match(NUM_REGEX) || []).map(parseAmountString).filter((n) => n > 0 && n < 100000);
  if (!allNums.length) return null;
  return Math.round(Math.max(...allNums) * 100) / 100;
}

function detectCategoryFromText(text, categories, learnedTerms) {
  const norm = normalizeText(text);
  for (const [id, c] of Object.entries(categories || {})) {
    if (norm.includes(normalizeText(c.label))) return id;
  }
  if (learnedTerms) {
    for (const [word, catId] of Object.entries(learnedTerms)) {
      if (categories[catId] && norm.includes(normalizeText(word))) return catId;
    }
  }
  for (const [defId, syns] of Object.entries(CATEGORY_SYNONYMS)) {
    if (syns.some((s) => norm.includes(normalizeText(s)))) {
      if (categories[defId]) return defId;
      const found = Object.entries(categories || {}).find(([, c]) => normalizeText(c.label).includes(defId));
      if (found) return found[0];
    }
  }
  return null;
}

function guessMerchantName(rawText) {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    const lettersOnly = line.replace(/[^a-zA-Z\u00C0-\u017F]/g, "");
    if (lettersOnly.length >= 3 && !/^\d+$/.test(line)) return line.slice(0, 60);
  }
  return "";
}

/**
 * Legge uno scontrino da immagine (File/Blob) e prova a estrarre importo, categoria e nota.
 * Ritorna { transactionType, amount, category, note } oppure { error }.
 */
export async function scanReceiptWithTesseract(file, account, lang) {
  let worker;
  try {
    const ocrLang = OCR_LANG_MAP[lang] || "ita";
    const langs = ocrLang === "eng" ? "eng" : `${ocrLang}+eng`;
    worker = await createWorker(langs);
    const { data } = await worker.recognize(file);
    const rawText = data?.text || "";
    if (!rawText.trim()) {
      return { error: "Immagine illeggibile: prova con più luce o inquadrando lo scontrino dritto." };
    }
    const amount = extractAmount(rawText);
    if (!amount) {
      return { error: "Non sono riuscito a trovare un importo leggibile sullo scontrino." };
    }
    let category = detectCategoryFromText(rawText, account.categories, account.learnedTerms);
    if (!category) {
      category = account.categories?.altro ? "altro" : Object.keys(account.categories || {})[0] || null;
    }
    const note = guessMerchantName(rawText);
    return { transactionType: "spesa", amount, category, note };
  } catch (err) {
    return { error: "Errore durante la lettura OCR: " + (err?.message || "sconosciuto") };
  } finally {
    if (worker) { try { await worker.terminate(); } catch { /* ignore */ } }
  }
}
