// Testi legali di Finbar. L'italiano è la versione di riferimento (ufficiale);
// le altre lingue sono traduzioni di cortesia per comodità di lettura.
export const LEGAL_UPDATED = "7 settembre 2026";

export const LEGAL_TEXT = {
  it: {
    note: null,
    privacyTitle: "Informativa sulla Privacy — Finbar",
    updated: "Ultimo aggiornamento: 7 settembre 2026",
    privacy: [
      { h: "1. Titolare del trattamento e contatti", p: [
        "Il titolare del trattamento è Navzar Sobrab, con sede in Italia.",
        "Per qualsiasi domanda su questa informativa o per esercitare i diritti descritti nella sezione 9, è possibile contattare il titolare all'indirizzo: ns.spirituniversal@gmail.com.",
      ]},
      { h: "2. Come funziona Finbar", p: [
        "Finbar è un'applicazione per la gestione delle finanze personali (entrate, uscite, categorie di spesa), utilizzabile tramite chat testuale, comando vocale o scansione di scontrini. L'uso dell'app non richiede la creazione di un account con email o password.",
        "Per impostazione predefinita, i dati sono conservati localmente nel browser o nel dispositivo. La sincronizzazione tra dispositivi è una funzionalità facoltativa: se attivata, i dati vengono archiviati anche in un database cloud, associato a un codice di sincronizzazione.",
        "Finbar non è un istituto di credito, non accede a conti bancari e non fornisce consulenza finanziaria, fiscale o contabile.",
      ]},
      { h: "3. Categorie di dati trattati", p: [
        "3.1 Dati inseriti nell'app — Trattiamo i dati che inserisci volontariamente per usare Finbar: importi, date, categorie, descrizioni e note delle transazioni; nomi di conti/portafogli e relativi saldi; preferenze come lingua, valuta e tema grafico. Le note possono contenere informazioni personali: ti invitiamo a non inserire dati particolari (es. salute, opinioni politiche o religiose), tuoi o di terzi, che non siano necessari.",
        "3.2 Codice di sincronizzazione — Se attivi la sincronizzazione, Finbar genera un codice univoco che consente di accedere ai tuoi dati da altri dispositivi. Non è collegato al tuo nome o email — è salvato così come generato, senza hashing o cifratura aggiuntiva. Trattalo come una password: non esiste un sistema di recupero o reset, se lo perdi i dati sincronizzati restano inaccessibili. Ogni codice può contenere al massimo 300 KB di dati.",
        "3.3 Microfono (comando vocale) — L'audio viene elaborato dal motore di riconoscimento vocale del tuo browser/sistema operativo (es. Google o Apple). A seconda del browser, questo può comportare l'invio dell'audio ai server del fornitore. Non riceviamo né conserviamo noi le registrazioni.",
        "3.4 Fotocamera e scansione scontrini — L'immagine è analizzata interamente sul tuo dispositivo tramite Tesseract.js, senza essere mai inviata a server nostri o di terzi. Non viene salvata né trasmessa.",
        "3.5 Dati tecnici — Vercel (hosting) e, se sincronizzi, Supabase (database) possono raccogliere dati tecnici standard (IP, browser, orario) per sicurezza e funzionamento. Finbar non utilizza cookie di profilazione, analytics o tracciamento di terze parti, né effettua profilazione o pubblicità comportamentale.",
      ]},
      { h: "4. Finalità e basi giuridiche", p: [
        "Fornire le funzionalità dell'app (transazioni, saldi) — base giuridica: esecuzione di un servizio richiesto dall'utente (art. 6.1.b GDPR).",
        "Sincronizzazione facoltativa tra dispositivi — base giuridica: esecuzione di un servizio richiesto dall'utente (art. 6.1.b GDPR).",
        "Sicurezza e prevenzione abusi — base giuridica: legittimo interesse alla sicurezza del servizio (art. 6.1.f GDPR).",
        "Migliorare il riconoscimento di categorie/parole (\"parole imparate\") — solo dati locali sul dispositivo.",
        "Non usiamo i tuoi dati per pubblicità, non li vendiamo a terzi e non effettuiamo profilazione.",
      ]},
      { h: "5. Dove sono conservati i dati e con chi sono condivisi", p: [
        "In locale sul tuo dispositivo: la maggior parte dei dati è salvata nella memoria del browser. La cancellazione dei dati del sito o la disinstallazione possono renderli non recuperabili.",
        "Su Supabase (database cloud): se attivi la sincronizzazione, i dati sono ospitati nella regione eu-central-1 (Francoforte, Germania) — dentro lo Spazio Economico Europeo. Supabase agisce come responsabile del trattamento (supabase.com/legal/dpa, supabase.com/privacy).",
        "Su Vercel (hosting): società con sede negli Stati Uniti — trasferimento extra-SEE coperto dalle clausole contrattuali standard del loro DPA (vercel.com/legal/dpa, vercel.com/legal/privacy-policy).",
        "Non condividiamo i tuoi dati con terze parti per finalità di marketing.",
      ]},
      { h: "6. Cookie e tecnologie simili", p: [
        "Finbar usa la memoria locale del browser per dati e impostazioni. Non usiamo cookie di profilazione né tracciamento non tecnico. Eventuali introduzioni future comporteranno un aggiornamento di questa informativa.",
      ]},
      { h: "7. Per quanto tempo conserviamo i dati", p: [
        "I dati locali restano finché non li cancelli dall'app o dal browser, o disinstalli l'app. I dati sincronizzati restano su Supabase finché non li elimini attivamente o richiedi la cancellazione scrivendo a ns.spirituniversal@gmail.com. Nessuna cancellazione automatica per inattività.",
      ]},
      { h: "8. Sicurezza", p: [
        "Comunicazioni cifrate HTTPS/TLS e limite di 300 KB per codice di sincronizzazione, come misure contro usi anomali. Nessun sistema è sicuro al 100%: il codice di sincronizzazione è l'unica \"chiave\", trattalo come una password.",
      ]},
      { h: "9. I tuoi diritti", p: [
        "Se ti trovi nell'UE, hai diritto (GDPR) di: accedere ai tuoi dati; chiederne correzione o cancellazione; opporti al trattamento o chiederne la limitazione; ricevere i dati in formato portabile.",
        "Per esercitare questi diritti scrivi a: ns.spirituniversal@gmail.com. Rispondiamo di regola entro un mese.",
        "Hai diritto di proporre reclamo al Garante per la protezione dei dati personali (garanteprivacy.it) o all'autorità del tuo Paese.",
      ]},
      { h: "10. Minori", p: [
        "Finbar può essere utilizzata anche da minori. Poiché l'app non richiede un account e non ha alcun sistema di verifica dell'età, non siamo in grado di accertare tecnicamente l'età di chi la usa.",
        "Raccomandiamo che l'uso da parte di un minore avvenga con la supervisione di un genitore o di chi ne esercita la responsabilità genitoriale, che si assume la responsabilità delle scelte fatte nell'app.",
      ]},
      { h: "11. Modifiche a questa informativa", p: [
        "Potremo aggiornare questa informativa in futuro. Le modifiche rilevanti saranno segnalate nell'app.",
      ]},
      { h: "12. Contatti", p: ["Per domande: ns.spirituniversal@gmail.com."] },
    ],
    termsTitle: "Termini di Utilizzo — Finbar",
    terms: [
      { h: "1. Oggetto e accettazione", p: [
        "Questi Termini regolano l'accesso e l'uso di Finbar, sviluppata e gestita da Navzar Sobrab (\"Titolare\", \"noi\" o \"Finbar\"), con sede in Italia.",
        "Utilizzando Finbar, dichiari di aver letto e compreso i presenti Termini. Se non li accetti, non utilizzare l'app.",
        "L'Informativa sulla Privacy forma parte integrante di queste informazioni. Domande: ns.spirituniversal@gmail.com.",
      ]},
      { h: "2. Descrizione del servizio", p: [
        "Finbar è uno strumento di organizzazione personale (entrate, uscite, categorie, conti/portafogli e saldi), tramite chat, comando vocale e scansione scontrini.",
        "Finbar non è un istituto di credito, un prestatore di servizi di pagamento, un intermediario finanziario o un consulente finanziario/fiscale/contabile, e non sostituisce un professionista qualificato.",
        "Le informazioni mostrate hanno finalità organizzativa: verifica sempre i dati prima di decisioni finanziarie.",
      ]},
      { h: "3. Accesso e requisiti tecnici", p: [
        "Sei responsabile di dispositivo, browser e connessione internet necessari. Alcune funzioni richiedono l'autorizzazione a microfono/fotocamera. Riconoscimento vocale e lettura scontrini possono dare risultati incompleti.",
      ]},
      { h: "4. Uso locale, sincronizzazione e codice di sincronizzazione", p: [
        "Finbar conserva i dati localmente. Cancellazione dati/disinstallazione/perdita del dispositivo possono rendere i dati locali non recuperabili.",
        "La sincronizzazione è facoltativa e richiede un codice da trattare come credenziale riservata: non condividerlo. Non è recuperabile in caso di smarrimento. Non siamo responsabili per accessi non autorizzati derivanti dalla perdita/condivisione del codice.",
        "Sei responsabile di verificare l'accuratezza dei dati e di fare eventuali backup, dato che l'app si basa principalmente sul salvataggio locale.",
      ]},
      { h: "5. Natura gratuita e \"as-is\" del servizio", p: [
        "Finbar è attualmente gratuita, fornita \"as-is\" e \"as-available\", senza garanzie di accuratezza o continuità, nei limiti consentiti dalla legge. Calcoli, categorizzazione e lettura scontrini possono contenere errori.",
      ]},
      { h: "6. Licenza d'uso", p: [
        "Licenza personale, limitata, non esclusiva, non trasferibile e revocabile per uso personale e lecito. Nessun trasferimento di proprietà su app/codice/marchio/contenuti. Vietati copia, distribuzione, reverse engineering salvo consentito dalla legge.",
      ]},
      { h: "7. Uso consentito e divieti", p: [
        "È vietato: usare l'app per attività illecite/fraudolente; accedere senza autorizzazione al codice di un altro utente o ai sistemi dei fornitori; interferire con sicurezza/funzionamento; introdurre malware o richieste automatizzate abusive; aggirare limiti tecnici o di sicurezza.",
      ]},
      { h: "8. Minori", p: [
        "Finbar può essere utilizzata anche da minori. L'app non prevede verifica dell'età. Raccomandiamo la supervisione di un genitore/tutore, che accetta questi Termini per conto del minore e se ne assume la responsabilità.",
      ]},
      { h: "9. Servizi di terze parti", p: [
        "Finbar si appoggia a Supabase (database, solo se sincronizzi), Vercel (hosting) e ai motori di riconoscimento vocale del tuo browser/sistema. Non abbiamo controllo diretto su questi servizi.",
      ]},
      { h: "10. Limitazione di responsabilità", p: [
        "Nei limiti di legge, il Titolare non risponde di danni diretti/indiretti derivanti da perdita dati, errori di calcolo/categorizzazione/lettura scontrini, interruzioni del servizio (incluse quelle di terze parti), decisioni finanziarie basate sui dati dell'app.",
        "Questa limitazione non si applica dove la responsabilità non sia esclusa dalla legge (dolo, colpa grave, danno alla persona). Se agisci da consumatore, i tuoi diritti imperativi restano salvi.",
      ]},
      { h: "11. Modifiche al servizio", p: [
        "Possiamo modificare, sospendere o interrompere l'app quando necessario, con preavviso quando ragionevolmente possibile.",
      ]},
      { h: "12. Modifiche ai termini", p: [
        "Potremo aggiornare questi Termini in futuro, con avviso nell'app per modifiche rilevanti. L'uso continuato implica accettazione, nei limiti di legge.",
      ]},
      { h: "13. Legge applicabile e foro competente", p: [
        "Legge italiana. Se agisci da consumatore, resta fermo il foro del consumatore (Codice del Consumo, D.Lgs. 206/2005) e le norme UE, non derogabile da questa clausola. Per ogni altra controversia, foro secondo le norme ordinarie del Codice di procedura civile italiano.",
      ]},
      { h: "14. Disposizioni finali", p: [
        "Se una disposizione risultasse invalida, le restanti restano efficaci nella misura consentita dalla legge.",
      ]},
      { h: "15. Contatti", p: ["Domande: ns.spirituniversal@gmail.com. Titolare: Navzar Sobrab, Italia."] },
    ],
  },

  en: {
    note: "This English version is a courtesy translation. The Italian version is the authoritative reference; in case of discrepancy, the Italian version prevails.",
    privacyTitle: "Privacy Policy — Finbar",
    updated: "Last updated: September 7, 2026",
    privacy: [
      { h: "1. Data Controller and Contacts", p: [
        "The data controller is Navzar Sobrab, based in Italy.",
        "For any question about this policy, or to exercise the rights in section 9, contact: ns.spirituniversal@gmail.com.",
      ]},
      { h: "2. How Finbar Works", p: [
        "Finbar is a personal finance app (income, expenses, spending categories), usable via text chat, voice command, or receipt scanning. No account with email/password is required.",
        "By default data is stored locally in your browser/device. Syncing across devices is optional: if enabled, data is also stored in a cloud database linked to a sync code.",
        "Finbar is not a credit institution, does not access bank accounts, and does not give financial, tax or accounting advice.",
      ]},
      { h: "3. Categories of Data Processed", p: [
        "3.1 Data you enter — amounts, dates, categories, descriptions and notes of transactions; account/wallet names and balances; preferences like language, currency and theme. Notes may contain personal information — avoid entering special category data (health, political or religious views), yours or others', that isn't necessary.",
        "3.2 Sync code — a unique code that lets you access your data from other devices. Not linked to your name/email — stored as generated, without extra hashing or encryption. Treat it like a password: there is no recovery/reset system, if lost synced data stays inaccessible. Each code can hold up to 300 KB of data.",
        "3.3 Microphone (voice command) — audio is processed by your browser/OS's built-in speech engine (e.g. Google or Apple). Depending on the browser, this may send audio to that provider's servers. We do not receive or store recordings.",
        "3.4 Camera and receipt scanning — the image is analyzed entirely on your device via Tesseract.js, never sent to our servers or third parties. Not saved or transmitted.",
        "3.5 Technical data — Vercel (hosting) and, if you sync, Supabase (database) may collect standard technical data (IP, browser, time) for security and operation. Finbar uses no profiling cookies, analytics, or third-party tracking, and does not profile users or run behavioral ads.",
      ]},
      { h: "4. Purposes and Legal Bases", p: [
        "Providing app features (transactions, balances) — legal basis: performance of a service requested by the user (Art. 6.1.b GDPR).",
        "Optional cross-device syncing — legal basis: performance of a service requested by the user (Art. 6.1.b GDPR).",
        "Security and abuse prevention — legal basis: legitimate interest in service security (Art. 6.1.f GDPR).",
        "Improving category/word recognition (\"learned words\") — local device data only.",
        "We do not use your data for advertising, sell it to third parties, or profile you.",
      ]},
      { h: "5. Where Data Is Stored and Shared", p: [
        "Locally on your device: most data is stored in browser memory. Clearing site data or uninstalling may make it unrecoverable.",
        "On Supabase (cloud database): if you sync, data is hosted in region eu-central-1 (Frankfurt, Germany) — within the EEA. Supabase acts as processor (supabase.com/legal/dpa, supabase.com/privacy).",
        "On Vercel (hosting): a US-based company — transfer outside the EEA covered by standard contractual clauses in their DPA (vercel.com/legal/dpa, vercel.com/legal/privacy-policy).",
        "We do not share your data with third parties for marketing.",
      ]},
      { h: "6. Cookies and Similar Technologies", p: [
        "Finbar uses browser local storage for data and settings. We use no profiling cookies or non-technical tracking. Any future changes will update this policy.",
      ]},
      { h: "7. How Long We Keep Data", p: [
        "Local data stays until you delete it from the app/browser or uninstall. Synced data stays on Supabase until you actively delete it or request deletion at ns.spirituniversal@gmail.com. No automatic deletion for inactivity.",
      ]},
      { h: "8. Security", p: [
        "Encrypted HTTPS/TLS connections and a 300 KB limit per sync code, as safeguards. No system is 100% secure: the sync code is the only \"key\" — treat it like a password.",
      ]},
      { h: "9. Your Rights", p: [
        "If in the EU, under GDPR you may: access your data; request correction or deletion; object to or restrict processing; receive data in portable format.",
        "Exercise these rights at: ns.spirituniversal@gmail.com. We generally respond within one month.",
        "You may lodge a complaint with the Italian Data Protection Authority (garanteprivacy.it) or your country's authority.",
      ]},
      { h: "10. Minors", p: [
        "Finbar can also be used by minors. Since the app requires no account and has no age verification, we cannot technically confirm a user's age.",
        "We recommend use by a minor happen under a parent's/guardian's supervision, who takes responsibility for choices made in the app.",
      ]},
      { h: "11. Changes to This Policy", p: ["We may update this policy; material changes will be flagged in the app."] },
      { h: "12. Contact", p: ["Questions: ns.spirituniversal@gmail.com."] },
    ],
    termsTitle: "Terms of Use — Finbar",
    terms: [
      { h: "1. Purpose and Acceptance", p: [
        "These Terms govern access to and use of Finbar, developed and operated by Navzar Sobrab (\"Controller\", \"we\" or \"Finbar\"), based in Italy.",
        "By using Finbar you declare you have read and understood these Terms. If you do not accept them, do not use the app.",
        "The Privacy Policy is an integral part of this information. Questions: ns.spirituniversal@gmail.com.",
      ]},
      { h: "2. Description of the Service", p: [
        "Finbar is a personal organization tool (income, expenses, categories, accounts/wallets, balances) via chat, voice command and receipt scanning.",
        "Finbar is not a credit institution, payment provider, financial intermediary, or financial/tax/accounting advisor, and does not replace a qualified professional.",
        "Information shown is for organizational purposes only: always verify data before financial decisions.",
      ]},
      { h: "3. Access and Technical Requirements", p: [
        "You are responsible for a compatible device, browser and internet connection. Some features need microphone/camera permission. Voice recognition and receipt reading may be incomplete.",
      ]},
      { h: "4. Local Use, Syncing and Sync Code", p: [
        "Finbar stores data locally. Clearing data/uninstalling/losing your device may make local data unrecoverable.",
        "Syncing is optional and requires a code to be treated as confidential: do not share it. Not recoverable if lost. We are not liable for unauthorized access from your loss/sharing of the code.",
        "You are responsible for verifying data accuracy and backing up your data, since the app relies mainly on local storage.",
      ]},
      { h: "5. Free and \"As-Is\" Nature of the Service", p: [
        "Finbar is currently free, provided \"as-is\" and \"as-available\", without accuracy/continuity warranties, to the extent permitted by law. Calculations, categorization and receipt reading may contain errors.",
      ]},
      { h: "6. License to Use", p: [
        "Personal, limited, non-exclusive, non-transferable, revocable license for personal lawful use. No ownership transfer of app/code/trademark/content. Copying, distribution, reverse engineering prohibited except as allowed by law.",
      ]},
      { h: "7. Permitted Use and Prohibitions", p: [
        "Prohibited: unlawful/fraudulent use; unauthorized access to another user's code or provider systems; interfering with security/operation; introducing malware or abusive automated requests; bypassing technical/security limits.",
      ]},
      { h: "8. Minors", p: [
        "Finbar can also be used by minors. No age verification exists. We recommend supervision by a parent/guardian, who accepts these Terms on the minor's behalf and takes responsibility.",
      ]},
      { h: "9. Third-Party Services", p: [
        "Finbar relies on Supabase (database, only if syncing), Vercel (hosting), and your browser's/OS's speech recognition. We have no direct control over these services.",
      ]},
      { h: "10. Limitation of Liability", p: [
        "To the extent permitted by law, the Controller is not liable for damages from data loss, calculation/categorization/receipt-reading errors, service interruptions (including third-party ones), or financial decisions based on app data.",
        "This does not apply where liability cannot be excluded by law (willful misconduct, gross negligence, personal injury). If you act as a consumer, your mandatory rights remain fully in force.",
      ]},
      { h: "11. Changes to the Service", p: ["We may modify, suspend or discontinue the app when necessary, with notice when reasonably possible."] },
      { h: "12. Changes to These Terms", p: ["We may update these Terms, with in-app notice for material changes. Continued use implies acceptance, to the extent permitted by law."] },
      { h: "13. Governing Law and Jurisdiction", p: [
        "Italian law applies. If you act as a consumer, the consumer forum (Italian Consumer Code, Legislative Decree 206/2005) and applicable EU rules remain unaffected. For other disputes, jurisdiction follows the ordinary rules of the Italian Code of Civil Procedure.",
      ]},
      { h: "14. Final Provisions", p: ["If a provision is invalid, the remaining ones stay effective as permitted by law."] },
      { h: "15. Contact", p: ["Questions: ns.spirituniversal@gmail.com. Controller: Navzar Sobrab, Italy."] },
    ],
  },

  ro: {
    note: "Această versiune în limba română este o traducere de curtoazie. Versiunea în italiană este versiunea de referință; în caz de neconcordanță, prevalează versiunea în italiană.",
    privacyTitle: "Politica de Confidențialitate — Finbar",
    updated: "Ultima actualizare: 7 septembrie 2026",
    privacy: [
      { h: "1. Operatorul de date și contacte", p: [
        "Operatorul de date este Navzar Sobrab, cu sediul în Italia.",
        "Pentru întrebări sau pentru exercitarea drepturilor din secțiunea 9: ns.spirituniversal@gmail.com.",
      ]},
      { h: "2. Cum funcționează Finbar", p: [
        "Finbar este o aplicație pentru gestionarea finanțelor personale, utilizabilă prin chat text, comandă vocală sau scanarea bonurilor. Nu necesită cont cu e-mail/parolă.",
        "Implicit, datele sunt stocate local. Sincronizarea între dispozitive este opțională: dacă e activată, datele sunt stocate și într-o bază de date cloud, asociată unui cod de sincronizare.",
        "Finbar nu este instituție de credit, nu accesează conturi bancare și nu oferă consultanță financiară, fiscală sau contabilă.",
      ]},
      { h: "3. Categorii de date prelucrate", p: [
        "3.1 Date introduse — sume, date, categorii, descrieri și note ale tranzacțiilor; nume conturi/portofele și solduri; preferințe (limbă, monedă, temă). Notele pot conține informații personale — evită date speciale (sănătate, opinii politice/religioase) inutile.",
        "3.2 Codul de sincronizare — permite accesul de pe alte dispozitive. Nu e asociat numelui/e-mailului — salvat ca atare, fără hashing/criptare suplimentară. Tratează-l ca o parolă: nu există recuperare/resetare; dacă îl pierzi, datele rămân inaccesibile. Maximum 300 KB per cod.",
        "3.3 Microfonul — sunetul e procesat de motorul de recunoaștere vocală al browserului/SO (ex. Google/Apple), care poate trimite audio pe serverele proprii. Nu primim/stocăm noi înregistrările.",
        "3.4 Camera și scanarea bonurilor — imaginea e analizată integral pe dispozitiv (Tesseract.js), fără a fi trimisă vreodată. Nu e salvată.",
        "3.5 Date tehnice — Vercel (găzduire) și Supabase (dacă sincronizezi) pot colecta date tehnice standard. Finbar nu folosește cookie-uri de profilare, analytics sau urmărire terță, nu face profilare sau publicitate comportamentală.",
      ]},
      { h: "4. Scopuri și temeiuri juridice", p: [
        "Funcțiile aplicației — temei: executarea unui serviciu solicitat (art. 6.1.b GDPR).",
        "Sincronizare opțională — temei: executarea unui serviciu solicitat (art. 6.1.b GDPR).",
        "Securitate — temei: interesul legitim privind securitatea (art. 6.1.f GDPR).",
        "Nu folosim datele tale pentru publicitate, nu le vindem, nu facem profilare.",
      ]},
      { h: "5. Unde sunt păstrate și partajate datele", p: [
        "Local: majoritatea datelor sunt în memoria browserului.",
        "Pe Supabase: regiunea eu-central-1 (Frankfurt) — în SEE. Supabase e persoană împuternicită (supabase.com/legal/dpa).",
        "Pe Vercel: companie din SUA — transfer în afara SEE acoperit de clauzele contractuale standard (vercel.com/legal/dpa).",
        "Nu partajăm datele cu terți în scop de marketing.",
      ]},
      { h: "6. Cookie-uri", p: ["Folosim doar stocare locală, fără cookie-uri de profilare sau urmărire."] },
      { h: "7. Cât timp păstrăm datele", p: ["Local: până la ștergere/dezinstalare. Pe Supabase: până la ștergere activă sau cerere la ns.spirituniversal@gmail.com."] },
      { h: "8. Securitate", p: ["Conexiuni HTTPS/TLS și limită de 300 KB per cod. Codul de sincronizare e singura \"cheie\" — tratează-l ca o parolă."] },
      { h: "9. Drepturile tale", p: [
        "Conform GDPR: acces, corectare, ștergere, opoziție/restricționare, portabilitate.",
        "Scrie la: ns.spirituniversal@gmail.com. Poți depune plângere la Garante per la protezione dei dati personali sau autoritatea din țara ta.",
      ]},
      { h: "10. Minori", p: ["Finbar poate fi utilizată de minori. Nu există verificare tehnică a vârstei — recomandăm supravegherea unui părinte/tutore, care își asumă responsabilitatea."] },
      { h: "11. Modificări", p: ["Actualizările relevante vor fi semnalate în aplicație."] },
      { h: "12. Contact", p: ["ns.spirituniversal@gmail.com."] },
    ],
    termsTitle: "Termeni de Utilizare — Finbar",
    terms: [
      { h: "1. Obiect și acceptare", p: [
        "Acești Termeni reglementează utilizarea Finbar, dezvoltată de Navzar Sobrab (\"Operator\", \"noi\"), cu sediul în Italia.",
        "Folosind Finbar, accepți acești Termeni. Politica de Confidențialitate face parte integrantă. Întrebări: ns.spirituniversal@gmail.com.",
      ]},
      { h: "2. Descrierea serviciului", p: [
        "Finbar e un instrument de organizare personală (venituri, cheltuieli, categorii, conturi, solduri). Nu e instituție de credit, furnizor de plăți sau consultant financiar/fiscal/contabil.",
      ]},
      { h: "3. Acces și cerințe tehnice", p: ["Ești responsabil de dispozitiv/browser/conexiune. Recunoașterea vocală și citirea bonurilor pot fi incomplete."] },
      { h: "4. Utilizare locală, sincronizare și cod", p: [
        "Datele locale pot deveni irecuperabile la ștergere/dezinstalare. Codul de sincronizare e o credențială confidențială, nerecuperabilă dacă se pierde — nu suntem responsabili pentru accesul neautorizat rezultat.",
        "Ești responsabil de verificarea datelor și backup, aplicația bazându-se în principal pe stocarea locală.",
      ]},
      { h: "5. Natura gratuită și \"as-is\"", p: ["Finbar e gratuită, oferită \"ca atare\", fără garanții de acuratețe/continuitate, în limitele legii. Pot exista erori de calcul/citire."] },
      { h: "6. Licența de utilizare", p: ["Licență personală, limitată, revocabilă. Fără transfer de proprietate. Interzise copierea, distribuirea, ingineria inversă, cu excepțiile legale."] },
      { h: "7. Utilizare permisă și interdicții", p: ["Interzis: activități ilegale, acces neautorizat, interferență cu securitatea, malware, ocolirea măsurilor de securitate."] },
      { h: "8. Minori", p: ["Finbar poate fi utilizată de minori, fără verificare a vârstei. Recomandăm supravegherea unui părinte/tutore, care acceptă Termenii în numele minorului."] },
      { h: "9. Servicii terțe", p: ["Supabase, Vercel și motoarele de recunoaștere vocală ale browserului — fără control direct din partea noastră."] },
      { h: "10. Limitarea răspunderii", p: [
        "În limitele legii, Operatorul nu răspunde pentru pierderi de date, erori, întreruperi ale serviciului sau decizii financiare bazate pe date din aplicație.",
        "Limitarea nu se aplică unde răspunderea nu poate fi exclusă (dol, culpă gravă). Drepturile consumatorului rămân valabile.",
      ]},
      { h: "11. Modificări ale serviciului", p: ["Putem modifica/suspenda aplicația cu preaviz rezonabil."] },
      { h: "12. Modificări ale Termenilor", p: ["Actualizări posibile, cu notificare pentru schimbări relevante."] },
      { h: "13. Legea aplicabilă și instanța competentă", p: ["Legea italiană. Pentru consumatori, instanța competentă conform Codului Consumului italian rămâne valabilă. Alte litigii — conform Codului de procedură civilă italian."] },
      { h: "14. Dispoziții finale", p: ["Prevederile nevalide nu afectează valabilitatea celorlalte."] },
      { h: "15. Contact", p: ["ns.spirituniversal@gmail.com. Operator: Navzar Sobrab, Italia."] },
    ],
  },

  ru: {
    note: "Данная русская версия является переводом для удобства пользователей. Официальной версией является итальянская; в случае расхождений она имеет преимущественную силу.",
    privacyTitle: "Политика конфиденциальности — Finbar",
    updated: "Последнее обновление: 7 сентября 2026 г.",
    privacy: [
      { h: "1. Оператор данных и контакты", p: [
        "Оператор — Navzar Sobrab, Италия.",
        "Вопросы и реализация прав из раздела 9: ns.spirituniversal@gmail.com.",
      ]},
      { h: "2. Как работает Finbar", p: [
        "Finbar — приложение для управления личными финансами через чат, голос или сканирование чеков. Учётная запись не требуется.",
        "По умолчанию данные хранятся локально. Синхронизация необязательна: данные также сохраняются в облаке, связанные с кодом синхронизации.",
        "Finbar не является кредитной организацией и не даёт финансовых консультаций.",
      ]},
      { h: "3. Категории обрабатываемых данных", p: [
        "3.1 Вводимые данные — суммы, даты, категории, заметки; названия счетов и балансы; настройки. Не вводите ненужные особые категории данных.",
        "3.2 Код синхронизации — технический идентификатор, хранится как есть, без хеширования. Относитесь как к паролю: восстановления нет, максимум 300 КБ на код.",
        "3.3 Микрофон — обрабатывается движком браузера/ОС, может отправлять аудио поставщику. Мы не храним записи.",
        "3.4 Камера и сканирование чеков — обработка полностью на устройстве (Tesseract.js), без передачи изображений.",
        "3.5 Технические данные — Vercel и Supabase могут собирать стандартные технические данные. Аналитика и трекинг третьих сторон не используются.",
      ]},
      { h: "4. Цели и правовые основания", p: [
        "Функции приложения и синхронизация — исполнение услуги (ст. 6.1.b GDPR). Безопасность — законный интерес (ст. 6.1.f GDPR).",
        "Мы не используем данные для рекламы и не продаём их.",
      ]},
      { h: "5. Где хранятся и передаются данные", p: [
        "Локально: в памяти браузера. На Supabase: регион eu-central-1 (Франкфурт) — в ЕЭЗ. На Vercel: компания из США, передача по DPA со стандартными договорными положениями.",
        "Данные не передаются третьим лицам в маркетинговых целях.",
      ]},
      { h: "6. Файлы cookie", p: ["Используется только локальное хранилище, без профилирующих cookie."] },
      { h: "7. Сроки хранения", p: ["Локально — до удаления. На Supabase — до удаления или запроса на ns.spirituniversal@gmail.com."] },
      { h: "8. Безопасность", p: ["HTTPS/TLS и лимит 300 КБ на код. Код синхронизации — единственный «ключ», как пароль."] },
      { h: "9. Ваши права", p: ["По GDPR: доступ, исправление, удаление, возражение, переносимость. Пишите: ns.spirituniversal@gmail.com. Жалобы — в Garante per la protezione dei dati personali или орган вашей страны."] },
      { h: "10. Несовершеннолетние", p: ["Finbar доступна несовершеннолетним, без проверки возраста — рекомендуем присмотр родителя/опекуна."] },
      { h: "11. Изменения политики", p: ["Существенные изменения будут отмечены в приложении."] },
      { h: "12. Контакты", p: ["ns.spirituniversal@gmail.com."] },
    ],
    termsTitle: "Условия использования — Finbar",
    terms: [
      { h: "1. Предмет и принятие", p: [
        "Условия регулируют использование Finbar, разработанного Navzar Sobrab («Оператор», «мы»), Италия.",
        "Используя Finbar, вы принимаете Условия. Политика конфиденциальности — их часть. Вопросы: ns.spirituniversal@gmail.com.",
      ]},
      { h: "2. Описание сервиса", p: ["Finbar — инструмент личной организации финансов. Не является кредитной организацией или финансовым консультантом."] },
      { h: "3. Доступ и технические требования", p: ["Вы отвечаете за устройство/браузер/интернет. Распознавание речи и чтение чеков могут быть неполными."] },
      { h: "4. Локальное использование и код синхронизации", p: [
        "Локальные данные могут быть безвозвратно утеряны при удалении/переустановке. Код синхронизации невосстановим при утере — ответственность за его сохранность на вас.",
        "Вы отвечаете за проверку точности данных и резервное копирование.",
      ]},
      { h: "5. Бесплатность и предоставление «как есть»", p: ["Finbar бесплатна, предоставляется «как есть», без гарантий точности, в пределах закона."] },
      { h: "6. Лицензия", p: ["Личная, ограниченная, отзывная лицензия. Без прав собственности. Копирование и реверс-инжиниринг запрещены, кроме случаев, разрешённых законом."] },
      { h: "7. Разрешённое использование", p: ["Запрещены: незаконная деятельность, несанкционированный доступ, вмешательство в безопасность, вредоносное ПО, обход ограничений."] },
      { h: "8. Несовершеннолетние", p: ["Доступно несовершеннолетним без проверки возраста — рекомендуем надзор родителя/опекуна, принимающего Условия от их имени."] },
      { h: "9. Услуги третьих сторон", p: ["Supabase, Vercel и голосовые движки браузера — вне нашего прямого контроля."] },
      { h: "10. Ограничение ответственности", p: [
        "В пределах закона Оператор не отвечает за потерю данных, ошибки расчётов, сбои сервиса или финансовые решения на основе данных приложения.",
        "Ограничение не применяется там, где ответственность не может быть исключена законом. Права потребителя сохраняются.",
      ]},
      { h: "11. Изменения сервиса", p: ["Возможны изменения/приостановка с разумным уведомлением."] },
      { h: "12. Изменения условий", p: ["Возможны обновления с уведомлением о существенных изменениях."] },
      { h: "13. Применимое право и подсудность", p: ["Итальянское право. Для потребителей действует подсудность по Кодексу защиты прав потребителей Италии. Иные споры — по Гражданскому процессуальному кодексу Италии."] },
      { h: "14. Заключительные положения", p: ["Недействительность одного положения не влияет на остальные."] },
      { h: "15. Контакты", p: ["ns.spirituniversal@gmail.com. Оператор: Navzar Sobrab, Италия."] },
    ],
  },

  zh: {
    note: "本中文版本为便利用户提供的礼节性翻译。意大利文版本为正式参考版本；如有不一致之处，以意大利文版本为准。",
    privacyTitle: "隐私政策 — Finbar",
    updated: "最后更新：2026年9月7日",
    privacy: [
      { h: "1. 数据控制者及联系方式", p: [
        "数据控制者为 Navzar Sobrab，位于意大利。",
        "如有疑问或希望行使第9节权利，请联系：ns.spirituniversal@gmail.com。",
      ]},
      { h: "2. Finbar 如何运作", p: [
        "Finbar 是个人理财应用，可通过聊天、语音或扫描小票使用，无需账户。",
        "默认数据保存在本地；跨设备同步为可选功能，启用后数据也会保存在与同步代码关联的云数据库中。",
        "Finbar 不是信贷机构，不提供财务、税务或会计建议。",
      ]},
      { h: "3. 处理的数据类别", p: [
        "3.1 输入的数据——金额、日期、分类、备注；账户名称及余额；语言、货币等偏好设置。请勿输入不必要的特殊类别数据。",
        "3.2 同步代码——技术标识符，按原样保存，未额外加密。请像密码一样对待：无恢复机制，每个代码最多 300 KB。",
        "3.3 麦克风——由浏览器/系统的语音引擎处理，可能发送至相应提供商服务器。我们不存储录音。",
        "3.4 相机与小票扫描——完全在设备本地处理（Tesseract.js），图像不会被发送或保存。",
        "3.5 技术数据——Vercel 和（如同步）Supabase 可能收集标准技术数据。不使用第三方分析或跟踪工具。",
      ]},
      { h: "4. 处理目的及法律依据", p: [
        "应用功能与同步——履行用户请求的服务（GDPR第6.1.b条）。安全——合法利益（第6.1.f条）。",
        "我们不将数据用于广告，不出售给第三方，不进行画像分析。",
      ]},
      { h: "5. 数据存储位置及共享", p: [
        "本地：保存在浏览器内存中。Supabase：托管于 eu-central-1（法兰克福）——欧洲经济区内。Vercel：美国公司，传输受其标准合同条款保护。",
        "不会出于营销目的与第三方共享数据。",
      ]},
      { h: "6. Cookie", p: ["仅使用本地存储，不使用分析性 cookie。"] },
      { h: "7. 数据保存期限", p: ["本地数据保存至删除；同步数据保存至主动删除或写信至 ns.spirituniversal@gmail.com 要求删除。"] },
      { h: "8. 安全", p: ["HTTPS/TLS 加密及每代码 300 KB 限制。同步代码是唯一的「钥匙」，请像密码一样保管。"] },
      { h: "9. 你的权利", p: ["依据GDPR：访问、更正、删除、异议、可携带性。联系：ns.spirituniversal@gmail.com。可向意大利数据保护局或所在国机构投诉。"] },
      { h: "10. 未成年人", p: ["Finbar 可供未成年人使用，无年龄验证机制——建议在家长/监护人监督下使用，由其承担责任。"] },
      { h: "11. 政策变更", p: ["重大变更将在应用内提示。"] },
      { h: "12. 联系方式", p: ["ns.spirituniversal@gmail.com。"] },
    ],
    termsTitle: "使用条款 — Finbar",
    terms: [
      { h: "1. 目的及接受", p: [
        "本条款规范 Finbar 的使用，由 Navzar Sobrab（「控制者」、「我们」）开发运营，位于意大利。",
        "使用 Finbar 即表示接受本条款。隐私政策为其组成部分。疑问：ns.spirituniversal@gmail.com。",
      ]},
      { h: "2. 服务说明", p: ["Finbar 是个人财务组织工具，不是信贷机构或财务顾问，不能替代专业人士意见。"] },
      { h: "3. 访问及技术要求", p: ["你负责设备/浏览器/网络。语音识别和小票读取可能不完整。"] },
      { h: "4. 本地使用与同步代码", p: [
        "本地数据在删除/卸载后可能无法恢复。同步代码丢失后无法找回——因丢失或共享代码导致的未授权访问由你自行负责。",
        "你负责核实数据准确性并自行备份。",
      ]},
      { h: "5. 免费及「按现状」提供", p: ["Finbar 目前免费，按现状提供，在法律允许范围内不保证准确性或连续性。"] },
      { h: "6. 使用许可", p: ["个人、有限、可撤销许可，不涉及所有权转让。禁止复制、逆向工程，法律允许的情形除外。"] },
      { h: "7. 允许的使用与禁止行为", p: ["禁止：非法活动、未经授权访问、干扰安全、恶意软件、规避安全措施。"] },
      { h: "8. 未成年人", p: ["可供未成年人使用，无年龄验证——建议在家长/监护人监督下使用，由其代为接受条款并负责。"] },
      { h: "9. 第三方服务", p: ["Supabase、Vercel 及浏览器语音引擎——不受我们直接控制。"] },
      { h: "10. 责任限制", p: [
        "在法律允许范围内，控制者不对数据丢失、计算错误、服务中断或基于应用数据的财务决策负责。",
        "该限制不适用于法律不允许排除责任的情形。消费者权利予以保留。",
      ]},
      { h: "11. 服务变更", p: ["可能在必要时修改/暂停应用，并尽量提前通知。"] },
      { h: "12. 条款变更", p: ["可能更新条款，重大变更将在应用内通知。"] },
      { h: "13. 适用法律及管辖", p: ["适用意大利法律。消费者管辖法院依意大利消费者法典确定。其他争议依意大利民事诉讼法确定。"] },
      { h: "14. 最终条款", p: ["某条款无效不影响其余条款效力。"] },
      { h: "15. 联系方式", p: ["ns.spirituniversal@gmail.com。控制者：Navzar Sobrab，意大利。"] },
    ],
  },
};
