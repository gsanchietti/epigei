#!/usr/bin/env python3
"""Extract quiz questions and correct answers from domande2024.pdf.

Usage: python3 tools/extract_questions.py domande2024.pdf site/questions.json
Needs `pdftotext` (poppler-utils).
"""
import json
import re
import subprocess
import sys

PREFIXES = ["Be", "Am", "Ac", "Cc", "Cr", "Hr", "Mp", "RL", "Lg", "Sg", "Xb",
            "Mo", "Mg", "Au", "Ca", "Ag", "Bu", "Cu", "Cl", "Hy", "Pl", "Tr",
            "A", "B", "C", "D", "E"]

# Species groups belong to group B in the official count.
GROUP_OF = {p: ("B" if len(p) == 2 else p) for p in PREFIXES}

Q_RE = re.compile(r"^(" + "|".join(PREFIXES) + r")(\d+)\s*\.?\s*(.*)$", re.I)
CANON = {p.lower(): p for p in PREFIXES}
OPT_RE = re.compile(r"^([A-D])(?:\s*\.\s*|\s+)(.*)$")


def pdftotext(path, layout):
    args = ["pdftotext"] + (["-layout"] if layout else []) + [path, "-"]
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def parse_questions(text):
    # Questions end where the answer grid starts.
    text = text.split("GRIGLIA per la verifica")[0]
    questions = []
    cur = None
    last = None  # "q" or option letter currently being filled
    for raw in text.splitlines():
        line = raw.strip()
        if not line or re.fullmatch(r"\d+", line):
            continue  # blank line or page number
        if line.startswith("Gruppo ") or re.match(r"^[A-Za-z]{1,2}\s*:\s", line):
            # section heading
            if cur:
                questions.append(cur)
            cur, last = None, None
            continue
        m = Q_RE.match(line)
        if m and not (len(m.group(1)) == 1 and raw.startswith(m.group(1) + " ")):
            if cur:
                questions.append(cur)
            prefix, num, rest = m.groups()
            prefix = CANON[prefix.lower()]  # "PL3" -> "Pl3"
            cur = {"id": f"{prefix}{num}", "prefix": prefix, "num": int(num),
                   "text": rest, "options": {}}
            last = "q"
            # Option A may be glued at the end of the question line ("...: A")
            if re.search(r":\s+A$", rest):
                cur["text"] = rest[:-1].rstrip()
                cur["options"]["A"] = ""
                last = "A"
            continue
        if cur is None:
            continue
        m = OPT_RE.match(line)
        if m and (m.group(1) not in cur["options"]) and (
                m.group(1) == "A" or chr(ord(m.group(1)) - 1) in cur["options"]):
            cur["options"][m.group(1)] = m.group(2)
            last = m.group(1)
            continue
        # continuation line
        if last == "q":
            cur["text"] += " " + line
        elif last:
            cur["options"][last] += " " + line
    if cur:
        questions.append(cur)
    return questions


def grid_letters(line):
    return re.findall(r"(?<![A-Za-z])[ABC](?![A-Za-z])", line)


def parse_grids(text):
    text = text[text.index("GRIGLIA per la verifica"):]
    answers = {}
    lines = text.splitlines()

    # Groups A-E: "quiz n." rows followed by "Risposta" rows.
    group = None
    nums = None
    for line in lines:
        m = re.match(r"^\s+GRUPPO ([A-E])\s*$", line)
        if m:
            group = m.group(1)
            continue
        if group and line.strip().startswith("quiz n."):
            nums = [int(n) for n in re.findall(r"\d+", line)]
            continue
        if group and nums and line.strip().startswith("Risposta"):
            letters = grid_letters(line[len("Risposta") + line.index("Risposta"):])
            if len(letters) != len(nums):
                raise SystemExit(f"grid {group} {nums}: got {letters}")
            for n, l in zip(nums, letters):
                answers[f"{group}{n}"] = l
            nums = None

    # Species grid: rows of letters listed from the highest number down to 1,
    # right-aligned, each followed by a label line "Xx: name".
    species_part = text[text.index("Be: Boletus edulis"):]
    label_re = re.compile(r"\b(Be|Am|Ac|Cc|Cr|Hr|Mp|RL|Lg|Sg|Xb|Mg|Mo|Au|Ca|Ag|Bu|Cu|Cy|Hy|Pl|Tr)\s*:?\s?[A-Za-z]")
    pending = None
    for line in species_part.splitlines():
        # letters part is the left side of the line, before any label text
        lm = label_re.search(line)
        left = line[:lm.start()] if lm else line
        letters = grid_letters(left)
        if letters and pending:
            prefix = "Cl" if pending == "Cy" else pending
            for i, l in enumerate(reversed(letters), start=1):
                answers[f"{prefix}{i}"] = l
            pending = None
        if lm:
            pending = lm.group(1)
    return answers


def main(pdf, out):
    questions = parse_questions(pdftotext(pdf, layout=False))
    answers = parse_grids(pdftotext(pdf, layout=True))
    problems = []
    seen = set()
    result = []
    for q in questions:
        if q["id"] in seen:
            # The PDF prints Cc8 twice; the answer grid only covers the first.
            print(f"skipping duplicate {q['id']}: {q['text']}", file=sys.stderr)
            continue
        seen.add(q["id"])
        ans = answers.get(q["id"])
        if ans is None:
            problems.append(f"no answer for {q['id']}")
        elif ans not in q["options"]:
            problems.append(f"answer {ans} not among options of {q['id']}")
        if len(q["options"]) < 3:
            problems.append(f"{q['id']} has {len(q['options'])} options")
        result.append({
            "id": q["id"],
            "group": GROUP_OF[q["prefix"]],
            "topic": q["prefix"],
            "text": re.sub(r"\s+", " ", q["text"]).strip(),
            "options": [re.sub(r"\s+", " ", v).strip() for _, v in sorted(q["options"].items())],
            "answer": "ABCD".index(ans) if ans else None,
        })
    for k in answers:
        if k not in seen:
            problems.append(f"answer {k} has no question")
    counts = {}
    for q in result:
        counts[q["topic"]] = counts.get(q["topic"], 0) + 1
    print("total", len(result), counts, file=sys.stderr)
    for p in problems:
        print("PROBLEM", p, file=sys.stderr)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:3]))
