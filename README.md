# Finex — progetto pronto per StackBlitz / GitHub / Vercel

## Cosa funziona già così com'è
- Conti multipli, categorie, percentuali, transazioni, ricorrenti, grafici, temi, lingue, valute
- Parser locale (IT/EN/RO/RU/ZH): registra spese/entrate e risponde a domande senza bisogno di AI
- Sincronizzazione via Supabase (dovrebbe funzionare per davvero qui, a differenza della sandbox di Claude)
- Voce (microfono/altoparlante) e fotocamera: dovrebbero funzionare, dato che qui il browser concede i permessi normalmente

## Cosa NON funziona ancora
- La chat AI di riserva e la scansione scontrini: chiamano `api.anthropic.com` senza chiave, cosa che Anthropic autorizza solo dentro claude.ai. Qui daranno errore finché non aggiungi una tua chiave API personale dietro una funzione server (prossimo passo del piano, non ancora costruito).

## Come aprirlo su StackBlitz (il modo più veloce)
1. Vai su [github.com](https://github.com) → crea un nuovo repository (es. `finex-app`), pubblico o privato, **senza** README (ce l'hai già qui)
2. Nella pagina del repository appena creato, usa "Add file → Upload files" e trascina dentro **tutti** i file e le cartelle di questo progetto (mantenendo la struttura: `src/` deve restare una cartella)
3. Fai commit
4. Apri: `https://stackblitz.com/github/TUO-USERNAME/finex-app` (sostituisci con il tuo nome utente e nome repo)
5. StackBlitz installa le dipendenze da solo e apre l'anteprima live

## Come provarlo in locale sul tuo computer (alternativa)
```
npm install
npm run dev
```
poi apri l'indirizzo che compare nel terminale (di solito `http://localhost:5173`)

## Prossimo passo naturale
Lo stesso repository GitHub che crei ora si collega direttamente a **Vercel** o **Netlify** per pubblicarlo online sul serio — nessun altro passaggio di "esportazione" richiesto.
