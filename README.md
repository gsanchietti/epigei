# Quiz funghi epigei

Web app per esercitarsi al test di abilitazione alla raccolta e commercializzazione dei funghi epigei spontanei.
Le domande e le risposte corrette vengono dall'Allegato B, `domande2024.pdf`.

## Modalità

- **Simulazione esame**: 30 domande a caso, 30 minuti. Si supera con al massimo 3 errori; le domande senza risposta contano come errori. Alla fine mostra il risultato e la correzione.
- **Allenamento rapido**: una domanda a caso alla volta, con la risposta giusta mostrata subito. Dopo 3 secondi passa da sola alla domanda successiva (oppure tocca "Prossima"). Pensata per il telefono.
- **Riconosci il fungo**: una foto e tre nomi di specie, scegli quello giusto. Dopo la risposta mostra il nome, il nome comune e se la specie è commestibile, sospetta, tossica o mortale. Le specie sono quelle citate nel PDF, compresi i sosia tossici.
- **Allenamento rapido (con foto)**: le domande ufficiali che riguardano una specie precisa, con la foto di quella specie.

## Struttura

- `site/`: la web app statica (HTML, CSS con [Picnic CSS](https://picnicss.com), JavaScript senza dipendenze).
- `site/questions.json`: le domande estratte dal PDF.
- `site/species.json` e `site/photos/`: specie e foto, generate da `tools/fetch_photos.py` a partire da `tools/species.tsv`.
- `tools/extract_questions.py`: rigenera `site/questions.json` dal PDF.

## Foto e fonti

Ogni foto riporta l'autore e il link alla pagina originale. Le fonti sono:

- [Galleria del Gruppo Micologico «G. Bresadola» di Trento (MUSE)](https://www2.muse.it/bresadola/galleria.asp): fonte principale. Le foto possono essere usate per fini non commerciali citando l'autore.
- [Universo alpino](https://universoalpino.com/): altre foto, usate con il permesso del titolare del sito. Elenchi di [commestibili](https://universoalpino.com/commestibili_one/) e [tossici](https://universoalpino.com/i-tossici/) usati anche per controllare la commestibilità.
- [Wikimedia Commons](https://commons.wikimedia.org/): solo per le specie che mancano nelle due fonti precedenti, con licenze Creative Commons indicate su ogni foto.

Le foto mantengono la licenza della loro fonte, diversa da quella del codice.
L'elenco delle specie, con commestibilità e fonti, è in `tools/species.tsv`; autore, fonte e licenza di ogni foto sono in `site/species.json`.
La commestibilità viene dalle risposte del PDF quando ne parlano, altrimenti dalla classificazione italiana corrente. È solo un aiuto allo studio: non sostituisce l'ispettorato micologico.

Per riscaricare le foto (serve Pillow):

```sh
python3 tools/fetch_photos.py            # scarica solo le specie senza foto
python3 tools/fetch_photos.py --refresh  # riscarica tutto
```

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
