# Quiz funghi epigei

Web app per esercitarsi al test di abilitazione alla raccolta e commercializzazione dei funghi epigei spontanei.
Le domande e le risposte corrette vengono dall'Allegato B, `domande2024.pdf`.

## Modalità

- **Simulazione esame**: 30 domande a caso, 30 minuti. Si supera con al massimo 3 errori; le domande senza risposta contano come errori. Alla fine mostra il risultato e la correzione.
- **Allenamento rapido**: una domanda a caso alla volta, con la risposta giusta mostrata subito. Dopo 3 secondi passa da sola alla domanda successiva (oppure tocca "Prossima"). Pensata per il telefono.

## Struttura

- `site/`: la web app statica (HTML, CSS con [Picnic CSS](https://picnicss.com), JavaScript senza dipendenze).
- `site/questions.json`: le domande estratte dal PDF.
- `tools/extract_questions.py`: rigenera `site/questions.json` dal PDF.

## Rigenerare le domande

Serve `pdftotext` (pacchetto `poppler-utils`).

```sh
python3 tools/extract_questions.py domande2024.pdf site/questions.json
```

Lo script si ferma con un errore se una domanda non ha 3 risposte o non ha la risposta corretta nella griglia.
Nel PDF la domanda Cc8 compare due volte: la seconda non ha una risposta nella griglia e viene scartata.

## Provare in locale

```sh
python3 -m http.server -d site 8000
```

Poi apri http://localhost:8000.

## Pubblicazione

Ogni push su `main` pubblica `site/` su GitHub Pages tramite `.github/workflows/pages.yml`.
Nelle impostazioni del repository, in **Settings → Pages**, imposta **Source** su **GitHub Actions**.
