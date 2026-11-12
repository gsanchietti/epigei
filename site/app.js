"use strict";

const EXAM_SIZE = 30;
const EXAM_MINUTES = 30;
const MAX_ERRORS = 3;
const LETTERS = ["A", "B", "C", "D"];

const GROUPS = {
  A: "Biologia ed ecologia dei funghi",
  B: "Morfologia e riconoscimento delle specie",
  C: "Specie commestibili e tossiche, tossicologia, ispettorato",
  D: "Normativa sulla raccolta",
  E: "Tutela della flora e dell'ambiente",
};

const TOPICS = {
  Be: "Boletus edulis e gruppo",
  Am: "Armillaria mellea",
  Ac: "Amanita caesarea",
  Cc: "Cantharellus cibarius",
  Cr: "Craterellus cornucopioides",
  Hr: "Hydnum repandum",
  Mp: "Macrolepiota procera",
  RL: "Russula e Lactarius",
  Lg: "Leccinum e Leccinellum",
  Sg: "Suillus",
  Xb: "Xerocomus",
  Mo: "Marasmius oreades",
  Mg: "Morchella",
  Au: "Auricularia auricula-judae",
  Ca: "Calocybe gambosa",
  Ag: "Agaricus arvensis e altri",
  Bu: "Butyriboletus regius",
  Cu: "Cuphophyllus pratensis",
  Cl: "Cyclocybe aegerita",
  Hy: "Hygrophorus",
  Pl: "Pleurotus ostreatus",
  Tr: "Tricholoma terreum",
};

const app = document.getElementById("app");
let QUESTIONS = [];
let exam = null; // running or finished exam
let SPECIES = [];
let timerId = null;

/* ---------- helpers ---------- */

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Some questions appear twice in the PDF with different numbers (e.g. A1 and E4).
function sameKey(q) {
  return (q.text + "|" + q.options.join("|")).toLowerCase().replace(/[^a-z0-9àèéìòù|]/g, "");
}

function pickExamQuestions() {
  const seen = new Set();
  const picked = [];
  for (const q of shuffle(QUESTIONS)) {
    const key = sameKey(q);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(q);
    if (picked.length === EXAM_SIZE) break;
  }
  return picked;
}

function topicLabel(q) {
  const group = `Gruppo ${q.group}`;
  return TOPICS[q.topic] ? `${group} · ${TOPICS[q.topic]}` : `${group} · ${GROUPS[q.group]}`;
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function confirmDialog(text, okLabel) {
  const dialog = document.getElementById("confirm");
  document.getElementById("confirm-text").textContent = text;
  dialog.querySelector('button[value="ok"]').textContent = okLabel;
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
    dialog.returnValue = "cancel";
    dialog.showModal();
  });
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function examRunning() {
  return exam && !exam.finished;
}

function footer() {
  return el("footer", {},
    "Domande tratte dall'Allegato B (domande 2024) del test abilitativo per la raccolta dei funghi epigei spontanei. ",
    "Strumento non ufficiale.",
    el("br"),
    "Foto: ",
    el("a", { href: "https://www2.muse.it/bresadola/galleria.asp", target: "_blank", rel: "noopener" }, "Gruppo Micologico «G. Bresadola» – MUSE"),
    ", ",
    el("a", { href: "https://universoalpino.com/", target: "_blank", rel: "noopener" }, "Universo alpino"),
    " (per gentile concessione), ",
    el("a", { href: "https://commons.wikimedia.org/", target: "_blank", rel: "noopener" }, "Wikimedia Commons"),
    ".");
}

/* ---------- home ---------- */

// Static, trusted SVG markup only (never question data).
function svg(markup) {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content.firstChild;
}

const MUSHROOM_SVG = `
<svg class="hero-art" viewBox="0 0 120 110" width="104" height="96" aria-hidden="true">
  <ellipse cx="60" cy="101" rx="42" ry="6" fill="rgba(0,0,0,.22)"/>
  <path d="M30 100 q4-10 8 0 M84 100 q3-12 7 0 M20 101 q2-7 5 0" stroke="#8fc07a" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M45 60 C41 80 38 94 46 100 L74 100 C82 94 79 80 75 60 Z" fill="#f3e7cd"/>
  <path d="M66 64 C68 78 70 90 66 99" stroke="#dccaa3" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M24 66 C40 61 80 61 96 66 C88 72 32 72 24 66 Z" fill="#e2c98e"/>
  <path d="M12 60 C12 28 36 12 60 12 C84 12 108 28 108 60 C108 66 102 68 96 66 C80 61 40 61 24 66 C18 68 12 66 12 60 Z" fill="#9a5530"/>
  <path d="M28 36 C36 25 48 20 60 20" stroke="#c98a5e" stroke-width="6" fill="none" stroke-linecap="round" opacity=".8"/>
</svg>`;

// Bucolic landscape drawn behind the home banner.
const LANDSCAPE_SVG = `
<svg class="hero-bg" viewBox="-200 0 800 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#bfe0ef"/><stop offset=".55" stop-color="#e9f3e6"/><stop offset="1" stop-color="#fbefd2"/>
    </linearGradient>
    <radialGradient id="sun"><stop offset="0" stop-color="#fff3b0"/><stop offset=".55" stop-color="#ffd76a"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient>
    <g id="pine"><rect x="-1.5" y="0" width="3" height="8" fill="#5b3a29"/><path d="M0-30 L11 0 H-11 Z" fill="#3f6b45"/><path d="M0-38 L8-16 H-8 Z" fill="#4a7b4f"/></g>
  </defs>
  <rect x="-200" width="800" height="320" fill="url(#sky)"/>
  <circle cx="330" cy="62" r="46" fill="url(#sun)"/>
  <circle cx="330" cy="62" r="18" fill="#ffe28a"/>
  <g fill="#fff" opacity=".85">
    <ellipse cx="70" cy="58" rx="30" ry="9"/><ellipse cx="88" cy="51" rx="18" ry="9"/>
    <ellipse cx="236" cy="38" rx="24" ry="7"/><ellipse cx="250" cy="32" rx="13" ry="7"/>
    <ellipse cx="-110" cy="74" rx="34" ry="9"/><ellipse cx="-92" cy="66" rx="18" ry="9"/>
    <ellipse cx="500" cy="46" rx="28" ry="8"/><ellipse cx="516" cy="40" rx="15" ry="8"/>
  </g>
  <path d="M-200 182 C-130 168 -60 204 0 196 C60 160 120 170 180 186 C250 204 300 160 400 172 C470 180 530 156 600 170 V320 H-200 Z" fill="#c4dcab"/>
  <g transform="translate(-150 184) scale(.8)"><use href="#pine"/></g>
  <g transform="translate(-128 182) scale(.65)"><use href="#pine"/></g>
  <g transform="translate(470 178) scale(.7)"><use href="#pine"/></g>
  <g transform="translate(540 166) scale(.85)"><use href="#pine"/></g>
  <g transform="translate(46 186) scale(.7)"><use href="#pine"/></g>
  <g transform="translate(64 182) scale(.85)"><use href="#pine"/></g>
  <g transform="translate(300 172) scale(.75)"><use href="#pine"/></g>
  <g transform="translate(318 176) scale(.6)"><use href="#pine"/></g>
  <g transform="translate(352 170) scale(.8)"><use href="#pine"/></g>
  <path d="M-200 230 C-130 220 -60 244 0 236 C80 206 160 214 230 228 C300 242 350 214 400 220 C470 226 530 206 600 218 V320 H-200 Z" fill="#9cc77f"/>
  <g transform="translate(-60 236) scale(.9)"><use href="#pine"/></g>
  <g transform="translate(470 226)"><use href="#pine"/></g>
  <g transform="translate(150 222)"><use href="#pine"/></g>
  <g transform="translate(172 226) scale(.8)"><use href="#pine"/></g>
  <path d="M-200 264 C-120 256 -60 276 0 270 C90 248 190 252 260 262 C320 270 360 256 400 258 C470 262 530 248 600 258 V320 H-200 Z" fill="#76ad5f"/>
  <g fill="#fff">
    <circle cx="40" cy="290" r="2.2"/><circle cx="96" cy="300" r="2"/><circle cx="300" cy="292" r="2.2"/><circle cx="356" cy="304" r="2"/><circle cx="250" cy="306" r="1.8"/><circle cx="-90" cy="296" r="2"/><circle cx="-160" cy="306" r="2.2"/><circle cx="460" cy="298" r="2"/><circle cx="560" cy="308" r="2.2"/>
  </g>
  <g fill="#f4c542"><circle cx="40" cy="290" r=".9"/><circle cx="300" cy="292" r=".9"/></g>
  <g fill="#e07a5f"><circle cx="128" cy="292" r="2"/><circle cx="330" cy="284" r="2"/></g>
</svg>`;

const TIMER_SVG = `
<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6M12 2v3"/>
</svg>`;

const BOLT_SVG = `
<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M13 2 4 14h7l-1 8 9-12h-7z"/>
</svg>`;

const CAMERA_SVG = `
<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>
</svg>`;

const EYE_SVG = `
<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>
</svg>`;

// Reading list on the home page. Always show the source site next to each link.
const RESOURCES = [
  ["Glossario dei funghi", "Universo alpino", "https://universoalpino.com/glossario-dei-funghi/",
    "I termini tecnici (lamelle, volva, anello, imenio…) che compaiono nelle domande."],
  ["Legge regionale Marche 18/2022", "Regione Marche", "https://contenuti.regione.marche.it/Portals/0/Agricoltura/Funghi/LR_2022_0018_Agg2024.pdf",
    "La legge in vigore su raccolta e vendita: limiti, orari, abilitazione, sanzioni."],
  ["Raccolta dei funghi", "Ministero della Salute", "https://www.salute.gov.it/new/it/tema/sistema-di-controllo-della-sicurezza-alimentare/raccolta-dei-funghi/",
    "Le regole nazionali: quantità, attrezzi vietati, fungo intero, cesto aerato."],
  ["Funghi, consumiamoli in sicurezza", "Ministero della Salute", "https://www.salute.gov.it/new/it/tema/sistema-di-controllo-della-sicurezza-alimentare/funghi-consumiamoli-sicurezza/",
    "Le regole per il consumo sicuro e il controllo gratuito del micologo ASL."],
  ["Funghi commestibili", "Universo alpino", "https://universoalpino.com/commestibili_one/",
    "Schede delle principali specie commestibili e dei loro sosia pericolosi."],
  ["Funghi tossici e velenosi", "Universo alpino", "https://universoalpino.com/i-tossici/",
    "Schede delle specie non commestibili, sospette, tossiche e mortali."],
  ["Sindromi a lunga latenza", "Associazione Micologica Bresadola", "https://ambbresadola.it/sindromi-a-lunga-latenza/",
    "Sindrome falloidea e altre intossicazioni gravi: specie, latenza, sintomi."],
  ["Galleria fotografica", "Gruppo Micologico «G. Bresadola» – MUSE", "https://www2.muse.it/bresadola/galleria.asp",
    "Foto e note di oltre 1000 specie, per allenare il riconoscimento."],
];

function modeCard(href, cls, icon, title, text) {
  return el("a", { class: "mode " + cls, href },
    el("span", { class: "mode-icon" }, svg(icon)),
    el("span", { class: "mode-body" },
      el("strong", {}, title),
      el("span", {}, text)),
    el("span", { class: "mode-chevron", "aria-hidden": "true" }, "›"));
}

function renderHome() {
  stopTimer();
  app.replaceChildren(
    el("header", { class: "home-hero" },
      svg(LANDSCAPE_SVG),
      el("div", { class: "hero-content" },
        el("h1", {}, "Quiz funghi epigei"),
        el("p", {}, "Preparati al test di abilitazione per la raccolta dei funghi epigei spontanei."),
        el("ul", { class: "chips" },
          el("li", {}, el("strong", {}, String(QUESTIONS.length)), " domande"),
          el("li", {}, el("strong", {}, String(EXAM_MINUTES)), " minuti"),
          el("li", {}, el("strong", {}, `max ${MAX_ERRORS}`), " errori")),
        svg(MUSHROOM_SVG))),
    el("div", { class: "modes", role: "navigation", "aria-label": "Modalità" },
      modeCard("#esame", "mode-exam", TIMER_SVG, "Simulazione esame",
        `${EXAM_SIZE} domande a caso in ${EXAM_MINUTES} minuti, come il test vero.`),
      modeCard("#rapido", "mode-quick", BOLT_SVG, "Allenamento rapido",
        "Una domanda alla volta, senza tempo: vedi subito se è giusta."),
      modeCard("#foto", "mode-photo", CAMERA_SVG, "Allenamento rapido (con foto)",
        "Le domande ufficiali sulle singole specie, con la foto del fungo."),
      modeCard("#riconosci", "mode-recognize", EYE_SVG, "Riconosci il fungo",
        `Guarda la foto e scegli la specie giusta tra tre. ${SPECIES.length} specie citate nel PDF.`)),
    el("section", { class: "how" },
      el("h2", {}, "Come funziona il test"),
      el("ol", {},
        el("li", {}, el("span", {}, el("strong", {}, `${EXAM_SIZE} quiz`), " a risposta multipla, una sola risposta giusta su tre.")),
        el("li", {}, el("span", {}, el("strong", {}, `${EXAM_MINUTES} minuti`), " per completarli. Le risposte mancanti contano come errori.")),
        el("li", {}, el("span", {}, "Con ", el("strong", {}, `0–${MAX_ERRORS} errori`), " passi alla prova di riconoscimento delle specie.")))),
    el("section", { class: "how resources" },
      el("h2", {}, "Risorse da leggere"),
      el("ul", {}, RESOURCES.map(([title, site, url, text]) =>
        el("li", {},
          el("a", { href: url, target: "_blank", rel: "noopener" }, title + " ↗"),
          el("span", { class: "res-site" }, site),
          el("span", { class: "res-text" }, text))))),
    footer());
  window.scrollTo(0, 0);
}

/* ---------- exam ---------- */

function startExam() {
  const now = Date.now();
  exam = {
    questions: pickExamQuestions(),
    answers: new Array(EXAM_SIZE).fill(null),
    startedAt: now,
    deadline: now + EXAM_MINUTES * 60 * 1000,
    finished: false,
    endedAt: null,
    onlyErrors: false,
  };
  renderExam();
}

function answeredCount() {
  return exam.answers.filter((a) => a !== null).length;
}

function renderExam() {
  const timer = el("span", { class: "timer", role: "timer", "aria-label": "Tempo rimasto" });
  const progress = el("span", { class: "progress" });

  const updateTop = () => {
    const left = exam.deadline - Date.now();
    timer.textContent = formatTime(left);
    timer.className = "timer" + (left <= 60_000 ? " critical" : left <= 5 * 60_000 ? " low" : "");
    progress.textContent = `${answeredCount()}/${EXAM_SIZE} risposte`;
    if (left <= 0) finishExam(true);
  };

  const cards = exam.questions.map((q, qi) => {
    const buttons = q.options.map((opt, oi) =>
      el("button", {
        type: "button",
        class: "pseudo option" + (exam.answers[qi] === oi ? " selected" : ""),
        "aria-pressed": String(exam.answers[qi] === oi),
        onclick: () => {
          exam.answers[qi] = exam.answers[qi] === oi ? null : oi; // tap again to clear
          buttons.forEach((b, i) => {
            b.classList.toggle("selected", exam.answers[qi] === i);
            b.setAttribute("aria-pressed", String(exam.answers[qi] === i));
          });
          updateTop();
        },
      }, el("span", { class: "letter" }, LETTERS[oi]), el("span", {}, opt)));
    return el("article", { class: "card question" },
      el("section", {},
        el("div", { class: "meta" }, `Domanda ${qi + 1} di ${EXAM_SIZE} · ${topicLabel(q)}`),
        el("div", { class: "text" }, q.text),
        el("div", { class: "options" }, buttons)));
  });

  app.replaceChildren(
    el("div", { class: "topbar" },
      el("button", { type: "button", class: "pseudo", onclick: () => { location.hash = ""; } }, "← Esci"),
      progress,
      timer),
    ...cards,
    el("button", { type: "button", class: "block", onclick: submitExam }, "Consegna"),
    footer());

  stopTimer();
  updateTop();
  timerId = setInterval(updateTop, 250);
  window.scrollTo(0, 0);
}

async function submitExam() {
  const missing = EXAM_SIZE - answeredCount();
  const text = missing > 0
    ? `Hai ${missing} ${missing === 1 ? "domanda" : "domande"} senza risposta, che contano come errori. Vuoi consegnare?`
    : "Vuoi consegnare il test?";
  if (await confirmDialog(text, "Consegna")) finishExam(false);
}

function finishExam(timeUp) {
  if (!examRunning()) return;
  stopTimer();
  const dialog = document.getElementById("confirm");
  if (dialog.open) dialog.close("cancel");
  exam.finished = true;
  exam.timeUp = timeUp;
  exam.endedAt = Math.min(Date.now(), exam.deadline);
  renderResult();
}

function renderResult() {
  const errors = exam.questions.filter((q, i) => exam.answers[i] !== q.answer).length;
  const unanswered = exam.answers.filter((a) => a === null).length;
  const passed = errors <= MAX_ERRORS;

  const list = el("div");
  const drawList = () => {
    list.replaceChildren(...exam.questions.map((q, qi) => {
      const given = exam.answers[qi];
      const right = given === q.answer;
      if (exam.onlyErrors && right) return null;
      return el("article", { class: "card question " + (right ? "is-right" : "is-wrong") },
        el("section", {},
          el("div", { class: "meta" },
            `Domanda ${qi + 1} · ${topicLabel(q)}`,
            given === null ? el("span", { class: "label error" }, "Nessuna risposta") : null),
          el("div", { class: "text" }, q.text),
          el("div", { class: "options" }, q.options.map((opt, oi) => {
            let cls = "pseudo option";
            if (oi === q.answer) cls += " correct";
            else if (oi === given) cls += " wrong";
            return el("button", { type: "button", class: cls, disabled: true },
              el("span", { class: "letter" }, LETTERS[oi]),
              el("span", {}, opt,
                oi === given ? " (la tua risposta)" : ""));
          }))));
    }));
  };
  drawList();

  const filter = el("label", { class: "filter" },
    el("input", {
      type: "checkbox",
      checked: exam.onlyErrors,
      onchange: (e) => { exam.onlyErrors = e.target.checked; drawList(); },
    }),
    el("span", { class: "checkable" }, "Mostra solo gli errori"));

  app.replaceChildren(
    el("div", { class: "topbar" },
      el("button", { type: "button", class: "pseudo", onclick: () => { location.hash = ""; } }, "← Home"),
      el("span", { class: "progress" }, "Risultato")),
    el("article", { class: "card result-head " + (passed ? "pass" : "fail") },
      el("section", {},
        exam.timeUp ? el("p", { class: "muted" }, "Tempo scaduto: il test è stato consegnato automaticamente.") : null,
        el("div", { class: "big" }, passed ? "Superato" : "Non superato"),
        el("p", { class: "muted" }, passed
          ? `Hai fatto ${MAX_ERRORS} errori o meno.`
          : `Servono al massimo ${MAX_ERRORS} errori per superare la prova.`),
        el("div", { class: "stats" },
          el("div", {}, el("strong", {}, String(errors)), "errori"),
          el("div", {}, el("strong", {}, String(EXAM_SIZE - errors)), "corrette"),
          el("div", {}, el("strong", {}, String(unanswered)), "senza risposta"),
          el("div", {}, el("strong", {}, formatTime(exam.endedAt - exam.startedAt)), "tempo")))),
    el("div", { class: "row" },
      el("button", { type: "button", class: "block", onclick: startExam }, "Nuova simulazione")),
    filter,
    list,
    el("button", { type: "button", class: "block", onclick: startExam }, "Nuova simulazione"),
    footer());
  window.scrollTo(0, 0);
}

/* ---------- practice modes (one question at a time, instant answer) ---------- */

const EDIBILITY_LABELS = {
  commestibile: "Commestibile",
  "non commestibile": "Non commestibile",
  sospetto: "Sospetto",
  tossico: "Tossico",
  mortale: "Velenoso mortale",
};

function edibilityBadge(sp) {
  return el("span", { class: "badge badge-" + sp.edibility.replace(" ", "-") }, EDIBILITY_LABELS[sp.edibility]);
}

function speciesLabel(sp) {
  return sp.common ? `${sp.name} (${sp.common})` : sp.name;
}

// Find the species a question is about: a species named in the question text
// (scientific or common name), otherwise the species of a single-species section.
// Sections about a whole genus get no default photo: a photo of one species can
// contradict a statement about others (e.g. a Suillus with a ring).
const GENUS_SECTIONS = new Set(["RL", "Lg", "Sg", "Xb", "Ag", "Hy"]);
let SPECIES_BY_NAME = [];
const TOPIC_SPECIES = {};
function indexSpecies() {
  SPECIES_BY_NAME = [];
  for (const sp of SPECIES) {
    const common = sp.common ? sp.common.split(",").map((c) => c.trim()) : [];
    for (const n of [sp.name, ...sp.aliases, ...common]) SPECIES_BY_NAME.push([n.toLowerCase(), sp]);
    if (sp.topic && !TOPIC_SPECIES[sp.topic]) TOPIC_SPECIES[sp.topic] = sp;
  }
  SPECIES_BY_NAME.sort((a, b) => b[0].length - a[0].length);
}
function speciesForQuestion(q) {
  const text = q.text.toLowerCase();
  if (text.includes("var.")) return null; // about a variety we have no photo of
  for (const [n, sp] of SPECIES_BY_NAME) if (text.includes(n)) return sp;
  return GENUS_SECTIONS.has(q.topic) ? null : TOPIC_SPECIES[q.topic] || null;
}

function questionItem(q) {
  const sp = speciesForQuestion(q);
  return {
    key: q.id,
    meta: `${q.id} · ${topicLabel(q)}`,
    text: q.text,
    options: q.options,
    answer: q.answer,
    species: sp,
    photo: sp ? pickOne(sp.photos) : null,
  };
}

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function recognitionItem(sp) {
  const byId = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
  const wrong = shuffle(sp.lookalikes).map((id) => byId[id]).filter(Boolean).slice(0, 2);
  for (const other of shuffle(SPECIES)) {
    if (wrong.length >= 2) break;
    if (other !== sp && !wrong.includes(other)) wrong.push(other);
  }
  const choices = shuffle([sp, ...wrong]);
  return {
    key: sp.id,
    meta: "Riconosci la specie",
    text: "Che fungo è questo?",
    options: choices.map(speciesLabel),
    answer: choices.indexOf(sp),
    species: sp,
    photo: pickOne(sp.photos),
  };
}

const PRACTICE_MODES = {
  rapido: {
    title: "Allenamento rapido",
    nextSeconds: 3,
    deck: () => shuffle(QUESTIONS).map(questionItem).map((it) => ({ ...it, photo: null, species: null })),
  },
  foto: {
    title: "Allenamento rapido (con foto)",
    nextSeconds: 5,
    deck: () => shuffle(QUESTIONS.filter((q) => speciesForQuestion(q))).map(questionItem),
  },
  riconosci: {
    title: "Riconosci il fungo",
    nextSeconds: 0, // no auto-advance: take the time to look at the photo and the badge
    deck: () => shuffle(SPECIES).map(recognitionItem),
  },
};
const practice = {}; // session state per mode

function startPractice(mode) {
  practice[mode] = { deck: PRACTICE_MODES[mode].deck(), index: 0, correct: 0, done: 0, answeredIndex: -1 };
  renderPractice(mode);
}

function photoFigure(photo) {
  return el("figure", { class: "photo" },
    el("img", { src: photo.file, alt: "Foto del fungo da riconoscere", loading: "eager", decoding: "async" }),
    el("figcaption", {},
      "Foto: ", photo.author, " · ",
      el("a", { href: photo.url, target: "_blank", rel: "noopener" }, photo.source + " ↗")));
}

function speciesReveal(sp, photo) {
  return el("div", { class: "reveal" },
    el("div", { class: "reveal-name" }, "Nella foto: ", el("em", {}, sp.name), sp.common ? ` · ${sp.common}` : ""),
    el("div", { class: "reveal-badge" }, edibilityBadge(sp), sp.note ? el("span", { class: "muted" }, sp.note) : null),
    el("a", { href: photo.url, target: "_blank", rel: "noopener" }, `Scheda sul sito ${photo.source} ↗`));
}

function preload(item) {
  if (item && item.photo) new Image().src = item.photo.file;
}

function renderPractice(mode) {
  stopTimer();
  const cfg = PRACTICE_MODES[mode];
  const state = practice[mode];
  // Never show an already answered question again (e.g. after going home and back).
  if (state.answeredIndex === state.index) state.index++;
  if (state.index >= state.deck.length) {
    state.deck = cfg.deck();
    state.index = 0;
  }
  const item = state.deck[state.index];
  preload(state.deck[state.index + 1]);

  const score = el("span", { class: "progress" });
  const updateScore = () => {
    score.textContent = state.done ? `${state.correct} / ${state.done} corrette` : cfg.title;
  };
  const feedback = el("div", { class: "feedback", role: "status" });
  const revealSlot = el("div");
  const next = el("button", { type: "button", class: "block", hidden: true, onclick: () => renderPractice(mode) }, "Prossima →");

  const buttons = item.options.map((opt, oi) =>
    el("button", {
      type: "button",
      class: "pseudo option",
      onclick: () => {
        const right = oi === item.answer;
        state.answeredIndex = state.index;
        state.done++;
        if (right) state.correct++;
        buttons.forEach((b, i) => {
          b.disabled = true;
          if (i === item.answer) b.classList.add("correct");
          else if (i === oi) b.classList.add("wrong");
        });
        feedback.className = "feedback " + (right ? "ok" : "ko");
        feedback.textContent = right ? "Giusto!" : `Sbagliato. La risposta corretta è la ${LETTERS[item.answer]}.`;
        if (item.species && item.photo) revealSlot.replaceChildren(speciesReveal(item.species, item.photo));
        next.hidden = false;
        next.focus({ preventScroll: true });
        next.scrollIntoView({ behavior: "smooth", block: "nearest" });
        updateScore();
        // Auto-advance (when enabled); the button still skips the wait.
        // stopTimer() on any navigation cancels it.
        if (!cfg.nextSeconds) return;
        const nextAt = Date.now() + cfg.nextSeconds * 1000;
        const tick = () => {
          const left = nextAt - Date.now();
          if (left <= 0) renderPractice(mode);
          else next.textContent = `Prossima → (${Math.ceil(left / 1000)})`;
        };
        tick();
        timerId = setInterval(tick, 200);
      },
    }, el("span", { class: "letter" }, LETTERS[oi]), el("span", {}, opt)));

  app.replaceChildren(
    el("div", { class: "topbar" },
      el("button", { type: "button", class: "pseudo", onclick: () => { location.hash = ""; } }, "← Home"),
      score),
    el("article", { class: "card question" },
      item.photo ? photoFigure(item.photo) : null,
      el("section", {},
        el("div", { class: "meta" }, item.meta),
        el("div", { class: "text" }, item.text),
        el("div", { class: "options" }, buttons),
        feedback,
        revealSlot)),
    next,
    item.photo ? el("p", { class: "disclaimer" },
      "Foto e indicazioni di commestibilità servono solo per lo studio: non sostituiscono il controllo dell'ispettorato micologico.") : null,
    footer());
  updateScore();
  window.scrollTo(0, 0);
}

/* ---------- routing ---------- */

let currentRoute = null;

async function route() {
  const target = location.hash.replace(/^#\/?/, "");
  if (currentRoute === "esame" && target !== "esame" && examRunning()) {
    const leave = await confirmDialog("Vuoi uscire? Il test in corso andrà perso.", "Esci");
    if (!leave) {
      history.pushState(null, "", "#esame");
      return;
    }
    stopTimer();
    exam = null;
  }
  currentRoute = target;
  if (target === "esame") {
    if (!exam || exam.finished) startExam();
    else renderExam();
  } else if (PRACTICE_MODES[target]) {
    if (!practice[target]) startPractice(target);
    else renderPractice(target);
  } else {
    renderHome();
  }
}

window.addEventListener("hashchange", route);
window.addEventListener("beforeunload", (e) => {
  if (examRunning()) {
    e.preventDefault();
    e.returnValue = "";
  }
});

function getJSON(url) {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });
}

Promise.all([getJSON("questions.json"), getJSON("species.json")])
  .then(([questions, species]) => {
    QUESTIONS = questions;
    SPECIES = species.filter((sp) => sp.photos && sp.photos.length);
    indexSpecies();
    route();
  })
  .catch(() => {
    app.replaceChildren(el("p", { class: "loading" }, "Impossibile caricare le domande. Ricarica la pagina."));
  });
