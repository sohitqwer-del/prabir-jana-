# -*- coding: utf-8 -*-
"""Build site/assets/data.js from Dr. Prabir Jana's real LinkedIn corpus."""
import json, re, datetime, os, html

SRC = r"C:/Users/Sohit/prabir_jana_research_db/data"
OUT = os.path.join(os.path.dirname(__file__), "assets", "data.js")

def load(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return json.load(f)

def decode_date(activity_id):
    try:
        ms = int(activity_id) >> 22
    except Exception:
        return None
    if not (1_000_000_000_000 < ms < 2_000_000_000_000):
        return None
    return datetime.datetime.utcfromtimestamp(ms / 1000)

# ---- categories (theme buckets) ----
CATS = [
    {"key": "IE",   "name": "Industrial Engineering", "color": "#2E6F6A"},
    {"key": "I40",  "name": "Industry 4.0 & AI",      "color": "#C99A2E"},
    {"key": "SUS",  "name": "Sustainability",         "color": "#6F8C6A"},
    {"key": "QUAL", "name": "Quality & Craft",        "color": "#4E7E94"},
    {"key": "IND",  "name": "Industry & India",       "color": "#9C7A55"},
    {"key": "PPL",  "name": "Skills & People",        "color": "#8A6E93"},
]
KEYWORDS = {
    "IE":  ["pmts", "industrial engineering", " ie ", "work study", "time study", "method", "smv", "productiv", "line balanc", "motion", "reboot", "lean"],
    "I40": ["industry 4", "ai ", "a.i", "algorithm", "robot", "humanoid", "automat", "smart", "iot", "digital", "chatgpt", "machine learning", "wearable"],
    "SUS": ["sustainab", "recycl", "greenwash", "circular", "solid waste", "mmf", "fibre", "fiber", "t-shirt", "shorts"],
    "QUAL":["quality", "sqi", "pucker", "stitchless", "stitch-free", "seam", "defect", "finishing"],
    "IND": ["india", "rural", "bengal", "sourcing", "d2c", "decathlon", "h&m", "domestic", "made in india", "tariff", "manufacturing scene"],
    "PPL": ["skill", "operator", "training", "student", "grad", "literacy", "nift", "team", "recruit", "people", "career", "inning"],
}

def categorize(text):
    t = text.lower()
    best, score = "IE", 0
    for k, words in KEYWORDS.items():
        s = sum(t.count(w) for w in words)
        if s > score:
            best, score = k, s
    return best

HASHTAG = re.compile(r"#(\w+)")
def extract_tags(text):
    raw = HASHTAG.findall(text)
    seen, tags = set(), []
    for r in raw:
        low = r.lower()
        if low in seen or len(r) < 3:
            continue
        seen.add(low)
        # split camel/lowercase compound a little for display
        tags.append(r)
    return tags[:4]

def clean_text(text):
    t = text
    t = re.sub(r"\|\s*\d+\s*comments?\s*on linkedin", "", t, flags=re.I)
    t = re.sub(r"\bon linkedin\b\s*$", "", t, flags=re.I)
    t = t.replace("\r", "")
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()

def make_excerpt(text, n=190):
    # drop leading hashtag-only lines / pure tag dumps
    body = clean_text(text)
    # if it starts with a wall of hashtags, take text after them
    lines = [l for l in body.split("\n") if l.strip()]
    if lines and lines[0].strip().startswith("#"):
        lines = lines[1:] or lines
    body = " ".join(lines)
    body = re.sub(r"#\w+", "", body)            # strip inline hashtags from excerpt
    body = re.sub(r"https?://\S+", "", body)    # strip urls
    body = re.sub(r"\s+", " ", body).strip()
    if len(body) <= n:
        return body
    cut = body[:n]
    if " " in cut:
        cut = cut[:cut.rfind(" ")]
    return cut + "…"

def read_time(length):
    mins = max(1, round(length / 850))
    return f"{mins} min"

def title_case_clean(title, text):
    t = (title or "").strip()
    if not t or t.startswith("#"):
        # derive from first sentence
        body = clean_text(text)
        body = re.sub(r"#\w+", "", body)
        body = re.sub(r"\s+", " ", body).strip()
        t = body[:64].strip()
        if len(body) > 64:
            t = t[:t.rfind(" ")] + "…"
    return t

posts = load("linkedin_all_posts_fulltext.json")
items = []
pid = 0
for p in posts:
    ft = (p.get("full_text") or "").strip()
    if len(ft) < 250:
        continue
    dt = decode_date(p.get("activity_id", ""))
    if not dt:
        continue
    pid += 1
    cat = categorize((p.get("title", "") + " " + ft))
    items.append({
        "id": pid,
        "cat": cat,
        "t": title_case_clean(p.get("title", ""), ft),
        "date": dt.strftime("%b %Y"),
        "ts": int(dt.timestamp()),
        "read": read_time(len(ft)),
        "excerpt": make_excerpt(ft),
        "body": clean_text(ft),
        "tags": extract_tags(ft) or [CATS_BY := next(c["name"] for c in CATS if c["key"] == cat)],
        "url": p.get("url", ""),
        "img": p.get("og_image") or "",
    })

items.sort(key=lambda x: x["ts"], reverse=True)
# reassign sequential ids after sort for stable graph
for i, it in enumerate(items, 1):
    it["id"] = i

# cross links: connect posts sharing a category (chain) + a few thematic bridges
by_cat = {}
for it in items:
    by_cat.setdefault(it["cat"], []).append(it["id"])
cross = []
for k, ids in by_cat.items():
    for i in range(1, len(ids)):
        cross.append([ids[0], ids[i]])
# thematic bridges between category anchors
anchors = [ids[0] for ids in by_cat.values() if ids]
for i in range(len(anchors)):
    cross.append([anchors[i], anchors[(i + 1) % len(anchors)]])

books = load("publications_articles.json") + load("additional_publications.json")
book_out = []
for b in books:
    if b.get("type", "").startswith("book") or "book" in b.get("type", "") or b.get("type") == "edited book":
        book_out.append({
            "title": b.get("title", ""),
            "year": str(b.get("year", "")).split(" ")[0],
            "publisher": b.get("publisher", b.get("journal", "")),
            "themes": (b.get("themes") or [])[:4],
        })
# dedupe by title
seen = set(); books_final = []
for b in book_out:
    if b["title"] in seen: continue
    seen.add(b["title"]); books_final.append(b)

achievements = load("achievements.json")
profile = load("person_profile.json")

timeline = [
    {"period": "Apr 2022 — Present", "span": "Now", "role": "Co-Founder", "org": "Apparel 4.0 Technologies Pvt. Ltd.", "note": "Building technology for the sewn-product industry, alongside teaching. New Delhi."},
    {"period": "2019 — Present", "span": "", "role": "Shahi Chair Professor, Industry 4.0", "org": "NIFT Delhi · Shahi Exports Industry Chair", "note": "Research into emerging technologies set to disrupt apparel manufacturing."},
    {"period": "2006 — Present", "span": "", "role": "Professor", "org": "National Institute of Fashion Technology, Delhi", "note": "Education, research, training and writing on technology and management for the sewn-product industry."},
    {"period": "1999 — 2006", "span": "7 yrs", "role": "Associate Professor", "org": "NIFT Delhi", "note": ""},
    {"period": "Nov 1993 — 1999", "span": "6 yrs", "role": "Assistant Professor", "org": "NIFT Delhi", "note": "The first NIFT alumnus to return as a faculty member."},
    {"period": "Oct 1992 — Oct 1993", "span": "1 yr", "role": "Manager — Technical", "org": "Shahi Exports House, Bengaluru", "note": "Where the floor experience began."},
]

metrics = profile.get("public_metrics", {})

data = {
    "cats": CATS,
    "posts": items,
    "cross": cross,
    "books": books_final,
    "achievements": achievements,
    "timeline": timeline,
    "expertise": [
        "Industrial Engineering", "Ergonomics", "ICT in Clothing",
        "Industry 4.0", "Lean Manufacturing", "Team Working",
        "PMTS / Work Study", "Sewing Automation",
    ],
    "metrics": {
        "publications": metrics.get("researchgate_publications", 46),
        "reads": metrics.get("researchgate_reads", 80050),
        "citations": metrics.get("researchgate_citations", 269),
    },
    "links": profile.get("academic_platforms", {}),
    "research_interests": profile.get("research_interests", []),
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.SITE_DATA = ")
    json.dump(data, f, ensure_ascii=False, indent=1)
    f.write(";\n")

print("posts:", len(items), "| books:", len(books_final), "| cross:", len(cross))
print("wrote", OUT, os.path.getsize(OUT), "bytes")
