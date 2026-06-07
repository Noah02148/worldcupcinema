#!/usr/bin/env python3
"""Bake the Google Sheet + ESPN results + TMDB posters into the repo.

The live site reads these baked files from its own origin (github.io) instead
of fetching Google Sheets / TMDB at runtime — both are blocked in mainland
China, which left the page stuck on "加载中…". Run by .github/workflows/sync.yml
on a schedule (and can be run by hand).

Outputs:
  data/countries.csv data/films.csv data/fixtures.csv data/strings.csv
  data/results.json            (ESPN scoreboard snapshot)
  assets/posters/<file>.jpg    (every TMDB poster referenced by films)
"""
import csv, io, json, os, re, urllib.parse, urllib.request

# Posters are downsized on the way in: the wall shows them small, and smaller
# files load much faster where GitHub Pages is throttled (mainland China).
POSTER_SIZE = "w185"

FILE_ID = "1oMyg38c0hP450iMUUz5ctdXt1S0bs3sj53luddQd3vU"
TABS = ["countries", "films", "fixtures", "strings"]
GVIZ = "https://docs.google.com/spreadsheets/d/{id}/gviz/tq?tqx=out:csv&sheet={tab}"
ESPN = ("https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/"
        "scoreboard?dates=20260611-20260719&limit=300")
DATA_DIR = "data"
POSTER_DIR = os.path.join("assets", "posters")
UA = {"User-Agent": "Mozilla/5.0 (worldcupcinema-sync)"}


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def save_tabs():
    os.makedirs(DATA_DIR, exist_ok=True)
    for tab in TABS:
        url = GVIZ.format(id=FILE_ID, tab=urllib.parse.quote(tab))
        data = fetch(url)
        with open(os.path.join(DATA_DIR, tab + ".csv"), "wb") as f:
            f.write(data)
        print(f"saved data/{tab}.csv ({len(data)} bytes)")


def save_results():
    # Best-effort: keep the previous snapshot if ESPN is unreachable.
    try:
        data = fetch(ESPN, timeout=30)
        json.loads(data)  # validate
        with open(os.path.join(DATA_DIR, "results.json"), "wb") as f:
            f.write(data)
        print(f"saved data/results.json ({len(data)} bytes)")
    except Exception as e:
        print("! results fetch failed, keeping previous:", e)


def download_posters():
    os.makedirs(POSTER_DIR, exist_ok=True)
    text = open(os.path.join(DATA_DIR, "films.csv"), encoding="utf-8-sig").read()
    urls = set()
    for row in csv.DictReader(io.StringIO(text)):
        u = (row.get("poster_url") or "").strip()
        if "image.tmdb.org/t/p/" in u:
            urls.add(u)

    got = skip = miss = 0
    for u in sorted(urls):
        name = u.split("/")[-1]
        dest = os.path.join(POSTER_DIR, name)
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            skip += 1
            continue
        try:
            dl = re.sub(r"/t/p/[^/]+/", "/t/p/%s/" % POSTER_SIZE, u)  # normalize any size -> w185
            with open(dest, "wb") as f:
                f.write(fetch(dl, timeout=30))
            got += 1
        except Exception as e:
            miss += 1
            print("! poster failed:", u, e)
    print(f"posters: downloaded {got}, skipped {skip}, failed {miss}, total {len(urls)}")


if __name__ == "__main__":
    save_tabs()
    save_results()
    download_posters()
    print("done")
