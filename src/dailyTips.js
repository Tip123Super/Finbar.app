// 30 frasi per il "Consiglio del giorno" (Impostazioni → Notifiche).
// Strutturato per lingua fin da subito: per ora solo "it" è compilato,
// le altre lingue si aggiungono qui senza toccare App.jsx. Se una lingua
// non ha (ancora) le 30 frasi, getDailyTip usa l'italiano come riserva.
export const DAILY_TIPS = {
  it: [
    "Un caffè al bar ogni giorno sono più di 400€ in un anno — un weekend fuori porta che se ne va in tazzine.",
    "Prima di un acquisto non necessario, aspetta 24 ore: se lo vuoi ancora il giorno dopo, probabilmente ha senso farlo.",
    "Metti da parte i risparmi appena arriva lo stipendio, non quello che resta a fine mese: capovolgi l'ordine.",
    "Un piccolo fondo di emergenza, anche solo 200-300€, ti evita di indebitarti per un imprevisto.",
    "Le spese impulsive nascono spesso dalla noia, non dal bisogno: un giro a piedi costa meno di uno shopping online.",
    "Rivedere le tue spese anche solo 5 minuti a settimana (magari proprio qui su Finbar) cambia le abitudini più di qualsiasi buon proposito di Capodanno.",
    "Due lavori part-time e zero risparmi di solito significano una falla da qualche parte, non sfortuna.",
    "Sapere dove vanno i tuoi soldi fa meno paura di non saperlo — anche se il numero non ti piace.",
    "Guarda sempre il prezzo al chilo o al litro (è scritto piccolo vicino al prezzo): a volte la confezione \"grande\" costa di più per unità di quella normale.",
    "Il risparmio automatico funziona perché non ti dà il tempo di ripensarci.",
    "Quella email con scritto \"offerta solo per te\" è arrivata identica a migliaia di altre persone — non è un'occasione da cogliere al volo, è solo marketing.",
    "\"Tanto è in saldo\" ha rovinato più bilanci di quante te ne accorgi.",
    "Se l'app di consegne cibo ti saluta per nome, forse è ora di rivedere qualche categoria.",
    "La carta di credito non aumenta lo stipendio, aumenta solo la fantasia.",
    "Un abbonamento dimenticato costa uguale sia che lo usi sia che non lo apri da 8 mesi.",
    "Andare al supermercato affamati è statisticamente il modo più veloce per spendere il doppio.",
    "I mercati salgono e scendono, ma la bolletta della luce sale e basta.",
    "Quando aumenta lo stipendio, prova ad aumentare anche il risparmio nella stessa proporzione — non solo lo stile di vita.",
    "Tre notifiche di \"offerta lampo\" in un giorno non sono un caso: è marketing, non un segno del destino.",
    "I regali più intelligenti spesso sono quelli che non hai comprato d'impulso alla cassa.",
    "Sai che puoi vedere l'andamento di un intero anno, mese per mese? Trovi la freccetta ⤢ accanto al grafico mensile in Impostazioni.",
    "Le percentuali delle tue categorie non sono scolpite nella pietra: se le abitudini cambiano, aggiornale quando vuoi.",
    "A fine anno, esporta lo storico in PDF: comodo da avere sottomano o da passare al commercialista.",
    "Puoi usare lo stesso codice su più dispositivi, senza bisogno di nessun account o password.",
    "Nella chat puoi registrare una spesa anche solo parlando: prova il microfono invece di scrivere.",
    "Hai uno scontrino in mano? Scansionalo dalla chat invece di ricopiare i numeri a mano.",
    "Le spese che si ripetono ogni mese (affitto, abbonamenti) puoi automatizzarle: le registri una volta sola.",
    "Se il tema colore attuale non ti convince più, ne trovi altri 7 in Impostazioni.",
    "Testo troppo piccolo o troppo grande? In Impostazioni → Dimensione testo trovi 6 livelli diversi.",
    "Puoi sempre chiedere in chat \"quanto ho speso in [categoria] questo mese\" invece di andarlo a cercare nello storico.",
  ],
  en: [],
  ro: [],
  ru: [],
  zh: [],
};

// Mescolamento deterministico (stesso mese+anno = stesso ordine, sempre riproducibile,
// non serve salvare nessuno storico di "quali hai già visto").
function seededShuffle(seed, arr) {
  const a = [...arr];
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Una frase diversa per ogni giorno del mese (1-30), zero ripetizioni.
// Il giorno 31 (nei mesi che lo hanno) ripete la frase del giorno 1 dello stesso mese:
// è l'unica eccezione prevista, dato che le frasi sono 30 e non 31.
export function getDailyTip(lang, date = new Date()) {
  const tips = DAILY_TIPS[lang] && DAILY_TIPS[lang].length === 30 ? DAILY_TIPS[lang] : DAILY_TIPS.it;
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const day = date.getDate(); // 1-31
  const seed = year * 12 + month + 1;
  const order = seededShuffle(seed, tips.map((_, i) => i));
  const idx = day <= order.length ? order[day - 1] : order[0];
  return tips[idx];
}
