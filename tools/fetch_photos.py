#!/usr/bin/env python3
"""Download species photos and write site/species.json.

Sources, in order:
1. The gallery of the Gruppo Micologico "G. Bresadola" di Trento (hosted by MUSE,
   https://www2.muse.it/bresadola/galleria.asp): non-commercial use citing the author.
2. universoalpino.com species pages, used with the site owner's permission
   (up to UA_MAX photos per species, stock images skipped).
3. Wikimedia Commons (the Wikidata P18 image), only when 1 and 2 have nothing.

Usage: python3 tools/fetch_photos.py [--refresh]
Needs Pillow. Existing photos are kept unless --refresh is given.
"""
import csv
import html
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SPECIES_TSV = ROOT / "tools" / "species.tsv"
OUT_JSON = ROOT / "site" / "species.json"
PHOTO_DIR = ROOT / "site" / "photos"

MUSE_BASE = "https://www2.muse.it/bresadola/"
MUSE_LICENSE = "Uso non commerciale citando l'autore"
UA_BASE = "https://universoalpino.com/"
UA_LICENSE = "Per gentile concessione di universoalpino.com"
UA_MAX = 3
UA_MIN_SIZE = 350  # skip icons and small images
# Images that are not usable as photos: painted plates, scenes where the mushroom is hard to see.
UA_SKIP = {"tavolacaesarea.jpg", "tavolamuscaria.jpg", "tavolaphalloides.jpg", "cantharellus-lutescens_ng3.jpg"}
USER_AGENT = "quiz-photo-fetcher/1.0"
MAX_WIDTH = 900
DELAY = 1.0  # seconds between requests, to be polite

# Commons files to use instead of the Wikidata image (e.g. when that one is a
# drawing or a cultivated specimen).
COMMONS_OVERRIDES = {}

# Authors missing from the Commons metadata, taken from the file description.
COMMONS_AUTHORS = {"Tricholoma_equestre.jpg": "Matthias Renner"}


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    time.sleep(DELAY)
    return data if binary else data.decode("utf-8", "replace")


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def clean(text):
    text = re.sub(r"<[^>]+>", " ", html.unescape(text or ""))
    return " ".join(text.split())


def clean_author(text):
    """Shorten the boilerplate some Commons files carry in the Artist field."""
    text = clean(text)
    m = re.match(r"This image was created by user (.+?) at Mushroom Observer", text)
    if m:
        return f"{m.group(1)}, Mushroom Observer"
    m = re.match(r"No machine-readable author provided\. (.+?) assumed", text)
    if m:
        return m.group(1)
    return text


def read_species():
    lines = [l for l in SPECIES_TSV.read_text(encoding="utf-8").splitlines() if not l.startswith("#")]
    rows = list(csv.DictReader(lines, delimiter="\t"))
    names = {r["name"] for r in rows}
    out = []
    for r in rows:
        dash = lambda v: "" if v == "-" else v
        if r["edibility"] not in ("commestibile", "non commestibile", "sospetto", "tossico", "mortale"):
            raise SystemExit(f"{r['name']}: bad edibility {r['edibility']!r}")
        lookalikes = [n.strip() for n in r["lookalike"].split(",") if n.strip()]
        unknown = [n for n in lookalikes if n not in names]
        if unknown:
            raise SystemExit(f"{r['name']}: unknown look-alikes {unknown}")
        out.append({
            "id": slug(r["name"]),
            "name": r["name"],
            "topic": dash(r["topic"]),
            "common": dash(r["common"]),
            "muse": None if r["muse"] == "none" else (dash(r["muse"]) or r["name"]),
            "lookalikes": [slug(n) for n in lookalikes],
            "aliases": [a.strip() for a in dash(r["aliases"]).split(",") if a.strip()],
            "edibility": r["edibility"],
            "note": dash(r["note"]),
            "universoalpino": dash(r["universoalpino"]),
        })
    return out


def muse_index():
    page = get(MUSE_BASE + "galleria.asp")
    index = {}
    for sp, label in re.findall(r'<a href="galleria_sp\.asp\?sp=(\d+)"[^>]*>(.*?)</a>', page, re.S):
        name = clean(label)
        if name:
            index[name.lower()] = sp
    return index


def muse_photo(sp):
    url = f"{MUSE_BASE}galleria_sp.asp?sp={sp}"
    page = get(url)
    img = re.search(r"<img src='(foto_1200/[^']+)'", page)
    author = re.search(r"fa-camera'></i>(.*?)<i", page, re.S)
    if not img or not author:
        return None
    return {
        "image_url": MUSE_BASE + img.group(1),
        "author": clean(author.group(1)),
        "source": "Gruppo Micologico «G. Bresadola» – MUSE",
        "url": url,
        "license": MUSE_LICENSE,
    }


def commons_photo(name):
    filename = COMMONS_OVERRIDES.get(name)
    if not filename:
        query = f'SELECT ?img WHERE {{ ?item wdt:P225 "{name}"; wdt:P18 ?img }} LIMIT 1'
        data = json.loads(get("https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(query)))
        hits = data["results"]["bindings"]
        if not hits:
            return None
        filename = urllib.parse.unquote(hits[0]["img"]["value"].rsplit("/", 1)[1])
    api = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo"
           f"&iiprop=url|extmetadata&iiurlwidth={MAX_WIDTH}&titles=" + urllib.parse.quote("File:" + filename))
    pages = json.loads(get(api))["query"]["pages"]
    info = next(iter(pages.values()))["imageinfo"][0]
    meta = info["extmetadata"]
    author = COMMONS_AUTHORS.get(filename.replace(" ", "_")) or clean_author(meta.get("Artist", {}).get("value"))
    return {
        "image_url": info.get("thumburl") or info["url"],
        "author": author or "autore sconosciuto",
        "source": "Wikimedia Commons",
        "url": info["descriptionurl"],
        "license": clean(meta.get("LicenseShortName", {}).get("value")),
    }


def ua_photos(slug_):
    """Own photos from a universoalpino.com species page (no stock images, no icons)."""
    url = f"{UA_BASE}{slug_}/"
    page = get(url)
    start = page.find('class="entry-content')
    end = page.find("NOTA BENE", start)
    body = page[start:end if end > 0 else None]
    photos = []
    for tag in re.findall(r"<img[^>]*>", body):
        orig = re.search(r'data-orig-file="([^"]+\.jpe?g)"', tag, re.I)
        size = re.search(r'data-orig-size="(\d+),(\d+)"', tag)
        if not orig or not size or min(int(size.group(1)), int(size.group(2))) < UA_MIN_SIZE:
            continue
        if re.search(r"-\d{5,}_(?:640|960|1280|1920)", orig.group(1)):  # stock photo (e.g. Pixabay)
            continue
        if orig.group(1).rsplit("/", 1)[1] in UA_SKIP:
            continue
        if any(p["image_url"] == orig.group(1) for p in photos):
            continue
        photos.append({
            "image_url": orig.group(1),
            "author": "universoalpino.com",
            "source": "Universo alpino",
            "url": url,
            "license": UA_LICENSE,
        })
    return photos[:UA_MAX]


def save_image(url, path):
    img = Image.open(io.BytesIO(get(url, binary=True)))
    img = ImageOps.exif_transpose(img).convert("RGB")
    if img.width > MAX_WIDTH:
        img = img.resize((MAX_WIDTH, round(img.height * MAX_WIDTH / img.width)), Image.LANCZOS)
    img.save(path, "JPEG", quality=78, optimize=True, progressive=True)


def find_photos(s, index_getter):
    found = []
    if s["muse"]:
        sp = index_getter().get(s["muse"].lower())
        photo = muse_photo(sp) if sp else None
        if photo:
            found.append(photo)
    if s["universoalpino"]:
        found += ua_photos(s["universoalpino"])
    if not found:
        photo = commons_photo(s["name"])
        if photo:
            found.append(photo)
    return found


def main():
    refresh = "--refresh" in sys.argv
    species = read_species()
    previous = {}
    if OUT_JSON.exists():
        previous = {s["id"]: s.get("photos") for s in json.loads(OUT_JSON.read_text(encoding="utf-8"))}
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    cache = {}

    def index_getter():
        if "index" not in cache:
            cache["index"] = muse_index()
        return cache["index"]

    missing = []
    for s in species:
        old = previous.get(s["id"])
        if old and not refresh and all((ROOT / "site" / p["file"]).exists() for p in old):
            s["photos"] = old
            continue
        photos = find_photos(s, index_getter)
        for n, photo in enumerate(photos):
            name = f"{s['id']}.jpg" if n == 0 else f"{s['id']}-{n + 1}.jpg"
            save_image(photo.pop("image_url"), PHOTO_DIR / name)
            photo["file"] = f"photos/{name}"
        s["photos"] = photos
        if not photos:
            missing.append(s["name"])
        print(f"{s['name']}: " + ", ".join(f"{p['source']} ({p['author']})" for p in photos), file=sys.stderr)
    for s in species:
        del s["muse"], s["universoalpino"]
    OUT_JSON.write_text(json.dumps(species, ensure_ascii=False, indent=1), encoding="utf-8")
    for name in missing:
        print("NO PHOTO", name, file=sys.stderr)
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
