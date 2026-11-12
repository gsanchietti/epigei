---
name: reviewing-quiz-content
description: Use when checking the epigei quiz content before students see it - after regenerating questions.json or species.json, adding or replacing photos, editing tools/species.tsv or edibility, or when asked to review, verify or audit answers, photos, badges or credits.
---

# Reviewing quiz content

## Overview

Students memorise what the app shows. Every answer, photo, badge and credit must be checked against its source, **exhaustively**, and **reported, never fixed**. The reviewer is the last gate before wrong information reaches a student.

## Rules

- **Report only.** Don't edit anything in the repo. Scratch files go in the session scratchpad.
- **Sources of truth:**

| What | Truth | Never use as truth |
|---|---|---|
| Correct answer | PDF answer grids, pages 44–46 of `domande2024.pdf`, re-read by you | `site/questions.json`, `tools/extract_questions.py` |
| Photo species | the photo itself + its source page (`photo.url`) | the file name, the credit line |
| Edibility | PDF answers when they say it; else universoalpino lists or the MUSE species text | your memory alone |
| Credit | the watermark or author named in the image or on its source page | `photo.author` |

- **App ≠ PDF is a bug.** **PDF itself wrong** is an *official-key doubt*: the owner decides. Never call the app wrong for copying the PDF faithfully.
- A factual doubt needs an outside source link, not just your knowledge.
- **Coverage = total, or it's NOT DONE.** Compute totals from the files at run time. Anything sampled or skipped goes in the NOT DONE list. Exhaustive beats fast: if time runs short, report NOT DONE rather than sample silently.
- Outside sources are needed only for findings you raise, not for every question.

## Checklist (all required)

1. **Answer key.** Rebuild the key from the PDF yourself (`pdftotext -bbox` or rendered pages; the species grid on page 46 is rotated). Diff every id, text, option and answer against `questions.json`.
2. **Drive the real app** in headless Chrome:
   - `#rapido`: every question.
   - `#foto`: every question that gets a photo.
   - `#riconosci`: **every photo**, not every species. Force each photo at least once, e.g. by stubbing `Math.random` or reading `PRACTICE_MODES` in the page.
   - `#esame`: **play it**, don't just read the code. At least: 3 errors (passes), 4 errors (fails), blanks counted as errors, timer running out (fake `Date.now`).
   - Check: the option marked correct, the text shown, the revealed species and badge, zero console errors.
3. **Official-key sanity.** Read every question with its keyed answer. Flag statements that are false or contradict another question, with a source.
4. **Photos: open every file at full size yourself.** Contact sheets only help to compare photos with each other; they miss look-alikes. If helpers also looked, re-check **all** of their flags.

   For watermarks, look at a contrast-boosted copy (`magick in.jpg -normalize -level 20%,80% out.png`) and the four corners at 100 %. Tiled stock watermarks are invisible otherwise.

   For each photo:
   - it shows the labelled species, with the key features the PDF questions describe;
   - it is a real photo: not a painted plate, stock packshot or supermarket product;
   - the mushroom is clearly visible;
   - the source page is about that species (Wikimedia too: open the file page, not only its category);
   - the watermark or author matches the credit.
5. **Photo pairing (`#foto`).** For every paired question, the photo must be consistent with the keyed answer. A genus-level question ("i Suillus con anello…") must not show a species the statement isn't true for. List the pairing for every question in the report.
6. **Species data.**
   - Edibility vs the PDF answers and the sources. A toxic species marked edible is the worst error.
   - Common names vs the PDF.
   - Every look-alike exists in the list.
7. **Credits.** Every photo shows author, source and a link, and the link returns HTTP 200.

## Severity

- **BLOCKER** — any of these:
  - the app shows a wrong answer;
  - a photo shows the wrong species;
  - an edibility class **less cautious** than a source (e.g. toxic shown as edible);
  - a missing or wrong credit, including a photo carrying another photographer's or a stock watermark while credited to the site that hosts it.
- **MAJOR** — any of these:
  - a misleading photo (atypical form, key feature missing);
  - a question paired with a species the statement isn't true for;
  - an edibility class **more cautious** than a source, or two sources that disagree: report both;
  - an official-key doubt.
- **MINOR** — a weak but correct photo; cosmetic issues.

## Report

Write `review-YYYY-MM-DD.md` in the scratchpad with exactly these parts:

1. **Verdict:** `PUBLISHABLE` / `NOT PUBLISHABLE`, with one line explaining why. Any BLOCKER means NOT PUBLISHABLE.
2. **Coverage table:** check | done / total | method.
3. **Findings table**, BLOCKER first: severity | where (file or question id) | what | evidence (PDF page, photo path, URL) | suggested action.
4. **NOT DONE:** everything skipped or sampled, and why.

Reply with the verdict, the blockers and the report path.

## Common mistakes

| Shortcut | Why it fails |
|---|---|
| Reading the exam code instead of playing it | Scoring, the timer and the verdict break in the UI, not in the code |
| One recognition round per species | Most species have 2–4 photos; the extra ones are never seen |
| Judging species from a contact sheet | A Lactarius passed as a chanterelle at 340 px; open full size |
| Trusting helpers' "OK" photo verdicts | Helpers miss look-alikes; look at every photo yourself |
| "Photo is from MUSE, so it's right" | Sources mislabel too (var. *alba*, *H. capnoides* labelled *fasciculare*) |
| Crediting the site, not the watermark | Many site photos are by other photographers |
| Judging the official key from memory only | Give an outside source, or mark the finding as unverified |
