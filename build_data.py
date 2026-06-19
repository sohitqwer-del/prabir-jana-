# -*- coding: utf-8 -*-
"""Build site/assets/data.js — merges ALL 171 LinkedIn posts."""
import json, re, datetime, os

SRC = r"C:/Users/Sohit/prabir_jana_research_db/data"
OUT = os.path.join(os.path.dirname(__file__), "assets", "data.js")

def load(name, encoding="utf-8"):
    with open(os.path.join(SRC, name), encoding=encoding, errors="ignore") as f:
        return json.load(f)

def load_jsonl(name):
    out = []
    with open(os.path.join(SRC, name), encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out

# ── date decode from LinkedIn activity ID (bit-shift trick) ──────────────────
def decode_date(activity_id):
    try:
        ms = int(str(activity_id).strip()) >> 22
    except Exception:
        return None
    if not (1_000_000_000_000 < ms < 2_000_000_000_000):
        return None
    return datetime.datetime.utcfromtimestamp(ms / 1000)

# ── categories ────────────────────────────────────────────────────────────────
CATS = [
    {"key": "IE",   "name": "Industrial Engineering", "color": "#2E6F6A"},
    {"key": "I40",  "name": "Industry 4.0 & AI",      "color": "#C99A2E"},
    {"key": "SUS",  "name": "Sustainability",         "color": "#6F8C6A"},
    {"key": "QUAL", "name": "Quality & Craft",        "color": "#4E7E94"},
    {"key": "IND",  "name": "Industry & India",       "color": "#9C7A55"},
    {"key": "PPL",  "name": "Skills & People",        "color": "#8A6E93"},
]
KEYWORDS = {
    "IE":  ["pmts", "industrial engineering", " ie ", "work study", "time study", "method", "smv",
            "productiv", "line balanc", "motion", "reboot", "lean", "sewing operation"],
    "I40": ["industry 4", "ai ", "a.i", "algorithm", "robot", "humanoid", "automat", "smart",
            "iot", "digital", "chatgpt", "machine learning", "wearable", "3d print", "leapfrog"],
    "SUS": ["sustainab", "recycl", "greenwash", "circular", "solid waste", "mmf", "fibre",
            "fiber", "t-shirt", "shorts", "polyester", "technosport", "technoworld"],
    "QUAL":["quality", "sqi", "pucker", "stitchless", "stitch-free", "seam", "defect",
            "finishing", "airstream", "standard"],
    "IND": ["india", "rural", "bengal", "sourcing", "d2c", "decathlon", "h&m", "domestic",
            "made in india", "tariff", "manufacturing scene", "apparel scene", "mmf challenge",
            "fibre mission"],
    "PPL": ["skill", "operator", "training", "student", "grad", "literacy", "nift", "team",
            "recruit", "people", "career", "inning", "farewell", "inauguration", "matrix"],
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
        tags.append(r)
    return tags[:4]

# ── text cleaning ─────────────────────────────────────────────────────────────
PDF_JUNK = re.compile(
    r"(About Accessibility Help Center.*|LinkedIn Corporation.*|"
    r"Stand out for.*|Sohit.*signing up.*|Ad Privacy.*|"
    r"Home My Network.*|Try Prem.*|---\s*PAGE BREAK\s*---|"
    r"\d+/\d+/\d+,\s*\d+:\d+\s*(AM|PM).*)",
    re.IGNORECASE | re.DOTALL,
)
def clean_text(text):
    t = text or ""
    # strip PDF boilerplate that appears at end
    t = PDF_JUNK.sub("", t)
    # strip leading "Xh •" timestamps from PDF
    t = re.sub(r"^\s*\d+[hd]\s*[•·]\s*", "", t)
    # fix common PDF split-word artifact: "T echno" → "Techno" etc.
    t = re.sub(r"\b([A-Z])\s([a-z])", lambda m: m.group(1) + m.group(2), t)
    # fix curly chars
    t = t.replace("", '"').replace("", '"').replace("", "'").replace("�", "'")
    t = re.sub(r"\|\s*\d+\s*comments?\s*on linkedin", "", t, flags=re.I)
    t = re.sub(r"\bon linkedin\b\s*$", "", t, flags=re.I)
    t = t.replace("\r", "")
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()

def make_excerpt(text, n=190):
    body = clean_text(text)
    lines = [l for l in body.split("\n") if l.strip()]
    if lines and lines[0].strip().startswith("#"):
        lines = lines[1:] or lines
    body = " ".join(lines)
    body = re.sub(r"#\w+", "", body)
    body = re.sub(r"https?://\S+", "", body)
    body = re.sub(r"\s+", " ", body).strip()
    if len(body) <= n:
        return body
    cut = body[:n]
    if " " in cut:
        cut = cut[:cut.rfind(" ")]
    return cut + "…"

def read_time(length):
    return f"{max(1, round(length / 850))} min"

def title_case_clean(title, text):
    t = (title or "").strip()
    if not t or t.startswith("#"):
        body = clean_text(text)
        body = re.sub(r"#\w+", "", body)
        body = re.sub(r"\s+", " ", body).strip()
        t = body[:64].strip()
        if len(body) > 64:
            t = t[:t.rfind(" ")] + "…"
    return t

def fingerprint(text):
    """First 80 non-space chars, lowercased — for dedup."""
    t = re.sub(r"\s+", "", (text or "").lower())
    return t[:80]

# ══════════════════════════════════════════════════════════════════════════════
# 1. Load CLEAN posts (web-scraped with activity IDs + dates)
# ══════════════════════════════════════════════════════════════════════════════
clean_sources = [
    "linkedin_all_posts_fulltext.json",
    "linkedin_post_fulltext.json",
    "linkedin_post_fulltext_new.json",
]
clean_by_id = {}    # activity_id → post dict
clean_fps   = set() # fingerprints already loaded

for fname in clean_sources:
    try:
        posts = load(fname)
    except Exception:
        continue
    for p in posts:
        aid = str(p.get("activity_id", "")).strip()
        ft  = (p.get("full_text") or p.get("text") or "").strip()
        if len(ft) < 100:
            continue
        fp = fingerprint(ft)
        if aid and aid not in clean_by_id:
            clean_by_id[aid] = p
            clean_fps.add(fp)
        elif not aid and fp not in clean_fps:
            # give it a synthetic key
            clean_by_id[f"noid_{len(clean_by_id)}"] = p
            clean_fps.add(fp)

print(f"Clean posts loaded: {len(clean_by_id)}")

# ══════════════════════════════════════════════════════════════════════════════
# 2. Load PDF posts (171 entries, no activity IDs)
#    Skip if we already have clean text for the same post (by fingerprint)
# ══════════════════════════════════════════════════════════════════════════════
try:
    pdf_posts = load("linkedin_activity_parsed.json")
except Exception:
    pdf_posts = []

# Also try comprehensive JSONL
try:
    comp = [d for d in load_jsonl("documents_comprehensive.jsonl")
            if d.get("metadata", {}).get("kind") == "linkedin_post_full"]
except Exception:
    comp = []

# Garbled PDF/clean copies we replace with a clean manual version (despaced fragments)
DROP_SIGNATURES = ["scriptingindia", "technoworld"]
def has_drop_sig(text):
    flat = re.sub(r"\s+", "", (text or "").lower())
    return any(sig in flat for sig in DROP_SIGNATURES)

pdf_unique = []
pdf_fps    = set()

for p in pdf_posts:
    raw = (p.get("content") or "").strip()
    # strip leading "Xh • Title\n" line that repeats the title
    raw = re.sub(r"^\d+[hd]\s*[•··]\s*[^\n]+\n", "", raw)
    ct  = clean_text(raw)
    fp  = fingerprint(ct)
    if fp in clean_fps or fp in pdf_fps or len(ct) < 150 or has_drop_sig(ct):
        continue
    pdf_fps.add(fp)
    pdf_unique.append({"raw": raw, "cleaned": ct, "meta": p})

print(f"Additional PDF posts: {len(pdf_unique)}")

# drop any clean-source copy of a manual post too
for aid in list(clean_by_id.keys()):
    p = clean_by_id[aid]
    if has_drop_sig((p.get("full_text") or p.get("text") or "")):
        del clean_by_id[aid]

# ══════════════════════════════════════════════════════════════════════════════
# 3. Manual posts — clean text provided directly, pinned with an explicit date
# ══════════════════════════════════════════════════════════════════════════════
MANUAL_POSTS = [
    {
        "title": "Technosport is scripting India's MMF story",
        "date": "Jun 2026",
        "ts":   int(datetime.datetime(2026, 6, 1).timestamp()),  # pin near the top of the feed
        "full_text": """Technosport is scripting India's MMF story

Feel proud to be part of the inauguration of Technoworld today. And intentionally I choose a poster rather than any ceremonial picture. The below poster that attracted many eyeballs, "The T-shirt that built everything" talks about the product that builds the brand. I would rather say meet Sunil JhunJhunWala "The man who made the difference"

I have been witnessing the evolution of Technosport since June 2022 when my first student did an internship at their Tirupur plant. I first met Sunil JhunJhunWala in his Tirupur office in Feb 2023...in two hours of interaction he mesmerised me with his fabric knowledge. When he told me that he is a CS graduate I felt truly embarrassed as a textile graduate myself. His passion for and knowledge about fabric development is infectious. He painstakingly explained how Technosport has built some of the products to solve some of the key consumer problems.

The next few years were a rollercoaster ride....Technosport was everywhere. While everyone cribbed about the lack of MMF infrastructure in India, Sunil again took the bull by the horn...built fabric infrastructure from scratch. Today Technosport boasts some of India's first technology investment in MMF fabric manufacturing. They are not only one of the fastest growing sportswear brands, but also careful about how they manufacture.

In the coming years we may see many more record breaking performances by Technosport. Well done Sunil JhunJhunWala, Puspen Maity, Anirudh Pratap, amit kumar santhalia, Lokesh Radhakrishnan and the whole team.""",
        "url": "",
        "og_image": "",
    },
]

# ══════════════════════════════════════════════════════════════════════════════
# 4. Build unified post list
# ══════════════════════════════════════════════════════════════════════════════
items = []
pid   = 0

# --- Manual posts first (explicit dates) ---
for mp in MANUAL_POSTS:
    ft  = mp["full_text"].strip()
    pid += 1
    cat = categorize((mp.get("title", "") + " " + ft))
    items.append({
        "id":      pid,
        "cat":     cat,
        "t":       mp.get("title") or title_case_clean("", ft),
        "date":    mp.get("date", "Recent"),
        "ts":      mp.get("ts", 0),
        "read":    read_time(len(ft)),
        "excerpt": make_excerpt(ft),
        "body":    clean_text(ft),
        "tags":    extract_tags(ft) or [next(c["name"] for c in CATS if c["key"] == cat)],
        "url":     mp.get("url", ""),
        "img":     mp.get("og_image") or "",
    })

# --- Clean posts (have activity IDs → exact dates) ---
for aid, p in clean_by_id.items():
    ft  = (p.get("full_text") or p.get("text") or "").strip()
    if len(ft) < 100:
        continue
    dt  = decode_date(aid)
    date_str = dt.strftime("%b %Y") if dt else "Recent"
    ts       = int(dt.timestamp()) if dt else 0
    pid += 1
    cat = categorize((p.get("title", "") + " " + ft))
    items.append({
        "id":      pid,
        "cat":     cat,
        "t":       title_case_clean(p.get("title", ""), ft),
        "date":    date_str,
        "ts":      ts,
        "read":    read_time(len(ft)),
        "excerpt": make_excerpt(ft),
        "body":    clean_text(ft),
        "tags":    extract_tags(ft) or [next(c["name"] for c in CATS if c["key"] == cat)],
        "url":     p.get("url", ""),
        "img":     p.get("og_image") or "",
    })

# --- PDF-only posts (no activity IDs → no exact dates) ---
for entry in pdf_unique:
    ct   = entry["cleaned"]
    meta = entry["meta"]
    pid += 1
    cat  = categorize(ct)
    # Try to get a rough date from engagement metadata if stored
    items.append({
        "id":      pid,
        "cat":     cat,
        "t":       title_case_clean("", ct),
        "date":    "Archive",
        "ts":      0,
        "read":    read_time(len(ct)),
        "excerpt": make_excerpt(ct),
        "body":    ct,
        "tags":    extract_tags(ct) or [next(c["name"] for c in CATS if c["key"] == cat)],
        "url":     "",
        "img":     "",
    })

# sort: real-dated posts first (newest → oldest), undated archive posts last
items.sort(key=lambda x: (1 if x["ts"] == 0 else 0, -x["ts"]))
for i, it in enumerate(items, 1):
    it["id"] = i

print(f"Total posts: {len(items)}")

# ── cross-links ───────────────────────────────────────────────────────────────
by_cat = {}
for it in items:
    by_cat.setdefault(it["cat"], []).append(it["id"])
cross = []
for k, ids in by_cat.items():
    for i in range(1, len(ids)):
        cross.append([ids[0], ids[i]])
anchors = [ids[0] for ids in by_cat.values() if ids]
for i in range(len(anchors)):
    cross.append([anchors[i], anchors[(i + 1) % len(anchors)]])

# ── books ─────────────────────────────────────────────────────────────────────
books = load("publications_articles.json") + load("additional_publications.json")
book_out = []
for b in books:
    if b.get("type", "").startswith("book") or "book" in b.get("type", "") or b.get("type") == "edited book":
        book_out.append({
            "title":     b.get("title", ""),
            "year":      str(b.get("year", "")).split(" ")[0],
            "publisher": b.get("publisher", b.get("journal", "")),
            "themes":    (b.get("themes") or [])[:4],
        })
seen = set(); books_final = []
for b in book_out:
    if b["title"] in seen: continue
    seen.add(b["title"]); books_final.append(b)

# ── profile data ──────────────────────────────────────────────────────────────
achievements = load("achievements.json")
profile      = load("person_profile.json")

timeline = [
    {"period": "Apr 2022 — Present", "span": "Now",  "role": "Co-Founder",                        "org": "Apparel 4.0 Technologies Pvt. Ltd.",       "note": "Building technology for the sewn-product industry, alongside teaching. New Delhi."},
    {"period": "2019 — Present",     "span": "",      "role": "Shahi Chair Professor, Industry 4.0","org": "NIFT Delhi · Shahi Exports Industry Chair", "note": "Research into emerging technologies set to disrupt apparel manufacturing."},
    {"period": "2006 — Present",     "span": "",      "role": "Professor",                          "org": "National Institute of Fashion Technology, Delhi","note": "Education, research, training and writing on technology and management for the sewn-product industry."},
    {"period": "1999 — 2006",        "span": "7 yrs", "role": "Associate Professor",                "org": "NIFT Delhi",                               "note": ""},
    {"period": "Nov 1993 — 1999",    "span": "6 yrs", "role": "Assistant Professor",                "org": "NIFT Delhi",                               "note": "The first NIFT alumnus to return as a faculty member."},
    {"period": "Oct 1992 — Oct 1993","span": "1 yr",  "role": "Manager — Technical",               "org": "Shahi Exports House, Bengaluru",            "note": "Where the floor experience began."},
]

metrics = profile.get("public_metrics", {})
data = {
    "cats":             CATS,
    "posts":            items,
    "cross":            cross,
    "books":            books_final,
    "achievements":     achievements,
    "timeline":         timeline,
    "expertise":        ["Industrial Engineering","Ergonomics","ICT in Clothing","Industry 4.0","Lean Manufacturing","Team Working","PMTS / Work Study","Sewing Automation"],
    "metrics":          {"publications": metrics.get("researchgate_publications", 46), "reads": metrics.get("researchgate_reads", 80050), "citations": metrics.get("researchgate_citations", 269)},
    "links":            profile.get("academic_platforms", {}),
    "research_interests": profile.get("research_interests", []),
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.SITE_DATA = ")
    json.dump(data, f, ensure_ascii=False, indent=1)
    f.write(";\n")

print(f"posts: {len(items)} | books: {len(books_final)} | cross: {len(cross)}")
print(f"wrote {OUT}  ({os.path.getsize(OUT):,} bytes)")
