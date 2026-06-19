/* Farewell Portal — Dr. Prabir Jana
   Vanilla SPA. Data comes from window.SITE_DATA (assets/data.js). */
(function () {
  "use strict";
  var D = window.SITE_DATA || {};
  var ACCENT = "#2E6F6A";
  var CATS = D.cats || [];
  var POSTS = D.posts || [];
  var CROSS = D.cross || [];

  var catColor = function (k) { var c = CATS.find(function (x) { return x.key === k; }); return c ? c.color : ACCENT; };
  var catName = function (k) { var c = CATS.find(function (x) { return x.key === k; }); return c ? c.name : ""; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]; }); };

  var DEFAULT_PRAISES = [
    { id: "d1", name: "Anjali Mehra", role: "Class of 2009, NIFT", message: "Sir turned a dry time-study lecture into the most useful skill I carry into every factory. The way he could spot a skipped stitch from across the room? Legendary." },
    { id: "d2", name: "Rohit Bansal", role: "Production Head, Gurugram", message: "He taught me to respect the operator before the spreadsheet. Everything good in my career started in his classroom." },
    { id: "d3", name: "Dr. Sunita Rao", role: "Colleague, NIFT", message: "Thirty years of generosity with his time, his ideas, and his floor walks. The corridor will be quieter without him." },
    { id: "d4", name: "Imran Khan", role: "Founder, KnitWell", message: "Half my factory's IE practices are footnotes to Prabir's papers. We owe him more than we can ever repay." },
    { id: "d5", name: "Meera Iyer", role: "Class of 2017", message: "Walked into his office nervous, walked out with a research topic and a plan. Pure warmth." },
    { id: "d6", name: "Karthik Nair", role: "Lean Consultant", message: "Rigorous on the data, gentle with people. A rare combination. Happy retirement, Sir." }
  ];

  var state = {
    screen: "landing",
    selectedNode: null,
    query: "",
    catFilter: null,
    added: [],
    msgSent: false, sentName: ""
  };

  try { var raw = localStorage.getItem("prabir_praises_v1"); if (raw) state.added = JSON.parse(raw); } catch (e) {}

  /* ---------------- shared store (Supabase) with localStorage fallback ---------------- */
  var SB = null;
  (function initStore() {
    try {
      var c = window.TRIBUTE_CONFIG || {};
      if (c.SUPABASE_URL && c.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient) {
        SB = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
      }
    } catch (e) { SB = null; }
  })();

  function pullPraises() {
    if (!SB) return;
    SB.from("tribute_praises").select("id,name,role,message,created_at")
      .order("created_at", { ascending: false }).limit(500)
      .then(function (res) {
        if (res.error || !res.data) return;
        state.added = res.data.map(function (r) {
          return { id: r.id, name: r.name, role: r.role || "", message: r.message, isNew: false };
        });
        if (state.screen === "praises") render();
      });
  }

  var app = document.getElementById("app");

  /* ---------------- navigation with stitch wipe ---------------- */
  var NAV = [["home", "Home"], ["writing", "Writing"], ["about", "About"], ["praises", "Praises"], ["message", "Message"]];
  function go(screen) {
    if (screen === state.screen && screen !== "writing") { /* still allow refresh */ }
    var wipe = document.getElementById("wipe");
    wipe.classList.remove("run"); void wipe.offsetWidth; wipe.classList.add("run");
    setTimeout(function () {
      state.screen = screen; state.selectedNode = null; state.query = ""; state.catFilter = null;
      render();
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { window.scrollTo(0, 0); }
    }, 330);
  }

  /* ---------------- icons / motifs ---------------- */
  var spoolIcon = function (stroke, w) {
    return '<svg width="' + (w || 24) + '" height="' + (w || 24) + '" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="1.4"/><path d="M7 7h10M7 17h10"/><path d="M9.2 9.6 14.8 12 9.2 14.4"/></svg>';
  };

  // The animated stitching motif that REPLACES the sewing machine:
  // a needle travels along a seam, dipping in and out, leaving a running stitch behind.
  function stitchScene() {
    var BASE = 70;                 // y of the seam
    return '' +
    '<svg class="stitch-scene" viewBox="0 0 300 96">' +
      // soft fabric band the seam runs along
      '<rect x="6" y="' + (BASE - 16) + '" width="288" height="40" rx="14" fill="#EFE0C6" opacity=".7"/>' +
      // completed running stitch behind the needle (left → centre)
      '<line x1="20" y1="' + BASE + '" x2="150" y2="' + BASE + '" stroke="var(--accent)" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="9 8" style="animation:stitchMove 1.4s linear infinite"/>' +
      // un-sewn guide holes ahead of the needle (centre → right)
      '<line x1="150" y1="' + BASE + '" x2="284" y2="' + BASE + '" stroke="#C7AE86" stroke-width="2" stroke-linecap="round" stroke-dasharray="1.5 13"/>' +
      // thread spool at the start, gently turning, feeding thread
      '<g style="transform-box:fill-box;transform-origin:30px 22px;animation:spool 3s ease-in-out infinite">' +
        '<rect x="20" y="12" width="20" height="20" rx="3" fill="#EAD8A0"/>' +
        '<rect x="17" y="10" width="26" height="3" rx="1.5" fill="#16442E"/>' +
        '<rect x="17" y="31" width="26" height="3" rx="1.5" fill="#16442E"/>' +
        '<path d="M23 30 L27 14 M30 30 L34 14 M37 30 L41 14" stroke="var(--accent)" stroke-width="2"/>' +
      '</g>' +
      // the traveling needle (fades in at left, out at right to mask the loop reset)
      '<g style="transform-box:fill-box;transform-origin:0 0;animation:travelStitch 3.4s ease-in-out infinite">' +
        // slack thread from the spool to the needle eye, waving
        '<path d="M34 22 C 70 8, 120 14, 150 40" fill="none" stroke="var(--accent)" stroke-width="1.6" opacity=".55" style="transform-box:fill-box;transform-origin:center;animation:threadWag 1.4s ease-in-out infinite"/>' +
        // needle bobbing through the fabric
        '<g style="transform-box:fill-box;transform-origin:center;animation:needleBob 1.4s ease-in-out infinite">' +
          '<line x1="150" y1="34" x2="150" y2="' + (BASE + 8) + '" stroke="#9A9AA3" stroke-width="2.6" stroke-linecap="round"/>' +
          '<circle cx="150" cy="40" r="1.7" fill="none" stroke="#7A7A82" stroke-width="1"/>' +   // eye
          '<path d="M150 ' + (BASE + 8) + ' l-3 -7 h6 z" fill="#5C5C64"/>' +                       // tip
          '<rect x="146" y="22" width="8" height="14" rx="3" fill="#16442E"/>' +                  // holder
        '</g>' +
      '</g>' +
    '</svg>';
  }

  /* ---------------- background drifting threads ---------------- */
  function bgThreads() {
    return '' +
    '<div class="bg-threads" aria-hidden="true">' +
      '<svg style="top:120px;left:-40px;width:200px;animation:drift 11s ease-in-out infinite" viewBox="0 0 80 80" fill="none" stroke="#D8C4A6" stroke-width="2"><path d="M10 70 C 30 40, 50 60, 70 20" stroke-dasharray="5 6"/></svg>' +
      '<svg style="top:60%;right:-20px;width:170px;animation:drift 14s ease-in-out infinite" viewBox="0 0 80 80" fill="none" stroke="#CBB79A" stroke-width="2"><path d="M70 10 C 40 35, 60 55, 20 75" stroke-dasharray="4 7"/></svg>' +
      '<svg style="top:40%;left:6%;width:120px;animation:drift 17s ease-in-out infinite" viewBox="0 0 80 80" fill="none" stroke="#D8C4A6" stroke-width="2"><path d="M14 14 C 50 20, 30 60, 66 64" stroke-dasharray="3 8"/></svg>' +
      '<svg style="top:16%;right:7%;width:70px;animation:drift 19s ease-in-out infinite;opacity:.5">' + needleMotif("#D2BF9E") + '</svg>' +
      '<svg style="bottom:9%;left:10%;width:64px;animation:drift 22s ease-in-out infinite;opacity:.5">' + needleMotif("#CDBA98") + '</svg>' +
    '</div>';
  }
  function needleMotif(stroke) {
    return '<g fill="none" stroke="' + stroke + '" stroke-width="1.4" stroke-linecap="round"><path d="M40 6 L40 70" /><circle cx="40" cy="14" r="3"/><path d="M30 30 L40 24 M30 44 L40 38 M30 58 L40 52" stroke-dasharray="0.1 6"/></g>';
  }

  /* ---------------- screens ---------------- */
  function screenLanding() {
    return '' +
    '<section class="wrap landing" data-reveal>' +
      '<div>' +
        '<span class="pill">★ Retiring after 30+ years</span>' +
        '<h1 class="title">Farewell, <span style="font-style:italic;color:var(--accent)">Dr. Prabir Jana</span></h1>' +
        '<p class="lede">Professor, mentor, co-founder — and the man who could re-balance a sewing line in his head. Three decades spent stitching ideas into the apparel industry, one method study at a time. This portal gathers his work, his story, and the warm words of everyone he taught along the way.</p>' +
        '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:34px">' +
          '<button class="btn btn-primary" data-go="home">Enter the tribute <span style="font-size:18px">→</span></button>' +
          '<button class="btn btn-ghost" data-go="praises">Leave a word ♥</button>' +
        '</div>' +
        '<div class="hero-stats">' +
          '<div><div class="v">30+</div><div class="l">Years at NIFT Delhi</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="portrait-stage">' +
        '<div class="spool-spin" style="animation:spool 6s ease-in-out infinite">' + spoolIcon("var(--accent)", 46) + '</div>' +
        '<div class="portrait">' +
          '<div class="inner"><img src="assets/img/prabir.png" alt="Dr. Prabir Jana"></div>' +
          '<span class="badge">EST. 1993 · NIFT DELHI</span>' +
        '</div>' +
        '<div class="seam-strip">' + stitchScene() + '</div>' +
      '</div>' +
    '</section>';
  }

  function noteCard(p) {
    var col = catColor(p.cat);
    return '<article class="note" data-open="' + p.id + '" data-reveal>' +
      '<span class="cat" style="color:' + col + '"><span class="dot" style="background:' + col + '"></span>' + esc(catName(p.cat)) + '</span>' +
      '<h3>' + esc(p.t) + '</h3>' +
      '<p>' + esc(p.excerpt) + '</p>' +
      '<div class="meta"><span>' + esc(p.date) + '</span><span>·</span><span>' + esc(p.read) + ' read</span></div>' +
    '</article>';
  }

  function screenHome() {
    var featured = POSTS[0];
    var recent = POSTS.slice(1, 7);
    return '' +
    '<section class="wrap">' +
      '<div class="row-head" data-reveal>' +
        '<div><span class="eyebrow">From the desk</span><h2 class="title">Latest writing</h2></div>' +
        '<button class="btn btn-ghost" data-go="writing" style="font-size:14px;padding:12px 20px">Explore the full archive →</button>' +
      '</div>' +
      '<svg class="stitch-divider" preserveAspectRatio="none" viewBox="0 0 600 10"><line x1="0" y1="5" x2="600" y2="5" stroke="#CBB79A" stroke-width="2" stroke-dasharray="6 6"/></svg>' +
      '<div class="home-grid">' +
        '<article class="feature" data-open="' + featured.id + '" data-reveal>' +
          '<svg class="ghost-mark" viewBox="0 0 80 80" fill="none" stroke="#F7EFE2" stroke-width="1.1">' + needleMotif("#F7EFE2") + '</svg>' +
          '<span class="feat-tag">Latest · ' + esc(catName(featured.cat)) + '</span>' +
          '<h3>' + esc(featured.t) + '</h3>' +
          '<p>' + esc(featured.excerpt) + '</p>' +
          '<div class="meta"><span>' + esc(featured.date) + '</span><span>·</span><span>' + esc(featured.read) + ' read</span></div>' +
        '</article>' +
        '<div class="rail">' +
          '<div class="rail-card" data-reveal>' +
            '<div class="k">At the machine</div>' +
            '<div class="big">Three decades at the sewing machine — and the patience to rethread anyone else\'s.</div>' +
            '<p>His door was never quite closed. Students walked in with a jammed feed dog and walked out with a method, a sketch and a plan.</p>' +
          '</div>' +
          '<div class="rail-cta" data-go="about" data-reveal>' +
            '<div class="big">A career in stitches</div>' +
            '<p>Shahi Exports to NIFT to a startup of his own — read the whole journey.</p>' +
            '<span style="font-weight:600;font-size:14px">Read his story →</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card-grid">' + recent.map(noteCard).join("") + '</div>' +
    '</section>';
  }

  function buildGraph() {
    var cx0 = 460, cy0 = 320, R = 225;
    var byCat = {};
    POSTS.forEach(function (a) { (byCat[a.cat] = byCat[a.cat] || []).push(a); });
    var nodes = [];
    CATS.forEach(function (c, ci) {
      var ang = (ci / CATS.length) * Math.PI * 2 - Math.PI / 2;
      var ccx = cx0 + Math.cos(ang) * R, ccy = cy0 + Math.sin(ang) * R;
      var list = byCat[c.key] || [];
      var rr = list.length > 1 ? Math.min(74, 24 + list.length * 7) : 0;
      list.forEach(function (a, i) {
        var aa = (i / Math.max(1, list.length)) * Math.PI * 2 + ci * 0.7;
        nodes.push(Object.assign({}, a, {
          color: c.color, catName: c.name,
          x: Math.round(ccx + Math.cos(aa) * rr), y: Math.round(ccy + Math.sin(aa) * rr)
        }));
      });
    });
    var byId = {}; nodes.forEach(function (n) { byId[n.id] = n; });
    var edgeDefs = [];
    CATS.forEach(function (c) {
      var list = (byCat[c.key] || []).map(function (a) { return byId[a.id]; });
      if (list.length) edgeDefs.push({ a: "hub", b: list[0].id, x1: cx0, y1: cy0, x2: list[0].x, y2: list[0].y });
      for (var i = 1; i < list.length; i++) edgeDefs.push({ a: list[0].id, b: list[i].id, x1: list[0].x, y1: list[0].y, x2: list[i].x, y2: list[i].y });
    });
    CROSS.forEach(function (pair) { var a = pair[0], b = pair[1]; if (byId[a] && byId[b]) edgeDefs.push({ a: a, b: b, x1: byId[a].x, y1: byId[a].y, x2: byId[b].x, y2: byId[b].y }); });

    var sel = state.selectedNode;
    var q = state.query.trim().toLowerCase();
    var cf = state.catFilter;
    var selColor = sel ? (byId[sel] ? byId[sel].color : ACCENT) : ACCENT;
    var neighbors = {};
    if (sel != null) edgeDefs.forEach(function (e) { if (e.a === sel) neighbors[e.b] = 1; if (e.b === sel) neighbors[e.a] = 1; });

    function matches(n) {
      if (cf && n.cat !== cf) return false;
      if (!q) return true;
      var hay = (n.t + " " + n.excerpt + " " + n.catName + " " + (n.tags || []).join(" ")).toLowerCase();
      return hay.indexOf(q) >= 0;
    }

    var edges = edgeDefs.map(function (e) {
      var active = sel != null && (e.a === sel || e.b === sel);
      return Object.assign({}, e, {
        stroke: active ? selColor : "#CBB79A",
        width: active ? 2.4 : 1.1,
        opacity: sel == null ? (q || cf ? 0.16 : 0.38) : (active ? 0.85 : 0.07)
      });
    });
    var gnodes = nodes.map(function (n) {
      var isSel = n.id === sel;
      var isNb = !!neighbors[n.id];
      var filtered = matches(n);
      var op, lblop;
      if (sel != null) { op = (isSel || isNb) ? 1 : 0.18; lblop = (isSel || isNb) ? 1 : 0.1; }
      else if (q || cf) { op = filtered ? 1 : 0.12; lblop = filtered ? 1 : 0; }
      else { op = 1; lblop = 0.55; }
      return Object.assign({}, n, {
        r: isSel ? 16 : 11, ring: isSel ? 23 : 16, ringOp: isSel ? 0.6 : 0,
        op: op, lblop: lblop, labelY: n.y + (isSel ? 16 : 11) + 14,
        short: (n.t.length > 22 ? n.t.slice(0, 20) + "…" : n.t)
      });
    });
    return { edges: edges, nodes: gnodes };
  }

  function screenWriting() {
    var g = buildGraph();
    var legend = CATS.map(function (c) {
      var on = state.catFilter === c.key;
      return '<button class="chip" data-cat="' + c.key + '" style="cursor:pointer;' + (on ? "border-color:" + c.color + ";box-shadow:0 0 0 2px " + c.color + "33" : "") + '"><span class="dot" style="background:' + c.color + '"></span>' + esc(c.name) + '</button>';
    }).join("");

    var sel = state.selectedNode != null ? POSTS.find(function (p) { return p.id === state.selectedNode; }) : null;
    var detail;
    if (sel) {
      var col = catColor(sel.cat);
      detail = '<div style="animation:popIn .3s ease both;display:flex;flex-direction:column;height:100%">' +
        '<span class="note" style="all:unset"><span style="display:inline-flex;align-items:center;gap:8px;font-family:\'Spline Sans Mono\',monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:' + col + '"><span class="dot" style="background:' + col + '"></span>' + esc(sel.catName || catName(sel.cat)) + '</span></span>' +
        '<h3>' + esc(sel.t) + '</h3>' +
        '<div class="meta"><span>' + esc(sel.date) + '</span><span>·</span><span>' + esc(sel.read) + ' read</span></div>' +
        '<p class="body">' + esc(sel.body || sel.excerpt) + '</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">' + (sel.tags || []).map(function (t) { return '<span class="tag">#' + esc(t) + '</span>'; }).join("") + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:auto">' +
          (sel.url ? '<a class="btn btn-primary" style="font-size:14px;padding:12px 18px" href="' + esc(sel.url) + '" target="_blank" rel="noopener">Read in full →</a>' : "") +
          '<button class="btn btn-soft" data-clear="1">Clear</button>' +
        '</div>' +
      '</div>';
    } else {
      detail = '<div class="empty">' +
        '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.4" style="opacity:.8"><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="7" r="2.4"/><circle cx="12" cy="17" r="2.4"/><path d="M7.8 7.4 10.4 15M16.5 8.7 13.4 15.4M8 6.6 16 6.8" stroke-dasharray="2 2.5"/></svg>' +
        '<h3 class="serif">Pick a thread to pull</h3>' +
        '<p>Each dot is something he wrote. Tap one to read it and watch its connections glow across the map — or search below.</p>' +
        '<div class="mono" style="font-size:12px;color:var(--muted);margin-top:22px">' + POSTS.length + ' pieces · ' + CATS.length + ' themes</div>' +
      '</div>';
    }

    return '' +
    '<section class="wrap wrap-wide">' +
      '<span class="eyebrow">The archive · connected</span>' +
      '<h2 class="title">A web of his work</h2>' +
      '<p style="font-size:16px;color:var(--ink-3);max-width:46em;margin:10px 0 22px">Everything he shared, mapped by theme. Tap a node to follow the threads — related pieces light up across the floor. Or search to pull a single stitch loose.</p>' +
      '<div class="toolbar">' +
        '<label class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A8268" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
        '<input id="gsearch" type="text" placeholder="Search his writing — PMTS, lean, automation, India…" value="' + esc(state.query) + '"></label>' +
      '</div>' +
      '<div class="legend">' + legend + '</div>' +
      '<div class="graph-wrap">' +
        '<div class="graph-box">' +
          '<svg viewBox="0 0 920 640">' +
            g.edges.map(function (e) { return '<line x1="' + e.x1 + '" y1="' + e.y1 + '" x2="' + e.x2 + '" y2="' + e.y2 + '" stroke="' + e.stroke + '" stroke-width="' + e.width + '" opacity="' + e.opacity + '"/>'; }).join("") +
            '<circle cx="460" cy="320" r="34" fill="#3A2C22"/>' +
            '<circle cx="460" cy="320" r="34" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="4 5" style="transform-box:fill-box;transform-origin:center;animation:ringSpin 28s linear infinite"/>' +
            '<text x="460" y="317" text-anchor="middle" fill="#F7EFE2" font-family="Newsreader,serif" font-size="13" font-style="italic">Prabir</text>' +
            '<text x="460" y="331" text-anchor="middle" fill="#C9B294" font-family="Spline Sans Mono,monospace" font-size="8" letter-spacing="1">JANA</text>' +
            g.nodes.map(function (n) {
              return '<g class="gnode" data-node="' + n.id + '">' +
                '<circle cx="' + n.x + '" cy="' + n.y + '" r="' + n.r + '" fill="' + n.color + '" opacity="' + n.op + '"/>' +
                '<circle cx="' + n.x + '" cy="' + n.y + '" r="' + n.ring + '" fill="none" stroke="' + n.color + '" stroke-width="2" opacity="' + n.ringOp + '"/>' +
                '<text x="' + n.x + '" y="' + n.labelY + '" text-anchor="middle" fill="#5C4A3C" font-family="Spline Sans Mono,monospace" font-size="9" opacity="' + n.lblop + '">' + esc(n.short) + '</text>' +
              '</g>';
            }).join("") +
          '</svg>' +
        '</div>' +
        '<div class="detail">' + detail + '</div>' +
      '</div>' +
    '</section>';
  }

  function screenAbout() {
    var tl = (D.timeline || []).map(function (j) {
      return '<div class="tl-item" data-reveal><span class="knot"></span>' +
        '<div class="per">' + esc(j.period) + (j.span ? " · " + esc(j.span) : "") + '</div>' +
        '<div class="role">' + esc(j.role) + '</div>' +
        '<div class="org">' + esc(j.org) + '</div>' +
        (j.note ? '<div class="nte">' + esc(j.note) + '</div>' : "") +
      '</div>';
    }).join("");
    var books = (D.books || []).slice(0, 9).map(function (b) {
      return '<div class="book" data-reveal><div class="bt">' + esc(b.title) + '</div><div class="by">' + esc([b.publisher, b.year].filter(Boolean).join(" · ")) + '</div></div>';
    }).join("");
    var expertise = (D.expertise || []).map(function (x) { return '<span class="chip">' + esc(x) + '</span>'; }).join("");
    var m = D.metrics || {};
    return '' +
    '<section class="wrap wrap-narrow" style="max-width:1080px">' +
      '<div class="about-grid about">' +
        '<aside class="about-aside" data-reveal>' +
          '<div class="about-photo"><img src="assets/img/prabir.png" alt="Dr. Prabir Jana"></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">' + expertise + '</div>' +
          '<div class="rail-card" style="margin-top:16px">' +
            '<div class="k">In the record</div>' +
            '<div style="display:flex;gap:18px;margin-top:10px;flex-wrap:wrap">' +
              '<div><div class="serif" style="font-size:26px;color:var(--accent)">' + (m.publications || "") + '</div><div class="by mono" style="font-size:11px;color:var(--muted)">Publications</div></div>' +
              '<div><div class="serif" style="font-size:26px;color:var(--accent)">' + ((m.reads || 0).toLocaleString()) + '</div><div class="by mono" style="font-size:11px;color:var(--muted)">Reads</div></div>' +
              '<div><div class="serif" style="font-size:26px;color:var(--accent)">' + (m.citations || "") + '</div><div class="by mono" style="font-size:11px;color:var(--muted)">Citations</div></div>' +
            '</div>' +
          '</div>' +
        '</aside>' +
        '<div>' +
          '<span class="eyebrow">About him</span>' +
          '<h2 class="title">Three decades at the sewing machine</h2>' +
          '<p>Dr. Prabir Jana has spent his career at the intersection of the sewing machine and the spreadsheet. From the floor at Shahi Exports to the classrooms of NIFT Delhi — and most recently as co-founder of Apparel 4.0 Technologies — he has made the apparel-manufacturing world measurably better, one method study at a time.</p>' +
          '<p style="font-size:16px">As Shahi Chair Professor of Industry 4.0, his work spans industrial engineering, ergonomics, PMTS, sewing automation and team working on the production line. But ask any of his students, and they\'ll mention his hands first: forever mid-modification on some machine, a jig clamped in the vice, a folder attachment half-fitted — and a door that was never quite closed.</p>' +
          '<div class="quote"><div class="q">“You can teach the stopwatch in an afternoon. Teaching someone to respect the operator behind it — that takes a career.”</div><div class="by">— PRABIR JANA</div></div>' +
          '<h3 class="serif" style="font-size:26px;margin:34px 0 4px">The journey</h3>' +
          '<div class="timeline"><span class="spine"></span>' + tl + '</div>' +
          '<h3 class="serif" style="font-size:26px;margin:34px 0 4px">On the shelf</h3>' +
          '<p style="font-size:15px;margin-top:6px">Books and handbooks that became standard reading across apparel-manufacturing classrooms and factory floors.</p>' +
          '<div class="books">' + books + '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function screenPraises() {
    var all = state.added.concat(DEFAULT_PRAISES);
    var wall = all.map(function (p) {
      return '<div class="pcard' + (p.isNew ? " new" : "") + '">' +
        '<div class="qmark">“</div>' +
        '<p class="msg">' + esc(p.message) + '</p>' +
        '<div class="nm">' + esc(p.name) + '</div>' +
        '<div class="rl">' + esc(p.role || "Friend & well-wisher") + '</div>' +
      '</div>';
    }).join("");
    return '' +
    '<section class="wrap">' +
      '<div class="praise-head" data-reveal>' +
        '<span class="eyebrow">The warmth wall</span>' +
        '<h2 class="title" style="font-size:clamp(32px,4vw,50px)">Words for Dr. Jana</h2>' +
        '<p style="font-size:16px;line-height:1.6;color:var(--ink-3);margin:14px 0 0">Students, colleagues and collaborators — add your note to the wall. Every message stays stitched here for everyone to read.</p>' +
      '</div>' +
      '<div class="form-card" data-reveal>' +
        '<div class="ft">Pin a message to the wall</div>' +
        '<div class="frow"><input class="fld" id="pName" placeholder="Your name"><input class="fld" id="pRole" placeholder="How you know him (e.g. Class of 2014)"></div>' +
        '<textarea class="fld" id="pMsg" rows="3" placeholder="Your message for Dr. Jana…"></textarea>' +
        '<div class="form-foot"><span class="hint" id="pHint">Your message stays on the wall for everyone to see.</span>' +
        '<button class="btn btn-primary" id="pAdd" style="font-size:14px;padding:13px 24px">Add to the wall →</button></div>' +
      '</div>' +
      '<div class="wall">' + wall + '</div>' +
    '</section>';
  }

  function screenMessage() {
    if (state.msgSent) {
      return '<section class="wrap wrap-narrow"><div class="msg-sent">' +
        '<svg style="width:64px;height:64px;margin-top:18px" viewBox="0 0 24 24" fill="none" stroke="#E0C9A6" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' + needleMotif("#E0C9A6") + '</svg>' +
        '<h3>Your message is on its way</h3>' +
        '<p>Thank you, ' + esc(state.sentName) + '. It\'ll be kept with all the others. ♥</p>' +
        '<button class="btn" style="margin-top:24px;background:#F7EFE2;color:#3A2C22" id="mReset">Send another</button>' +
      '</div></section>';
    }
    return '' +
    '<section class="wrap wrap-narrow">' +
      '<div style="text-align:center" data-reveal>' +
        '<span class="eyebrow">A private note</span>' +
        '<h2 class="title">Send Dr. Jana a message</h2>' +
        '<p style="font-size:16px;line-height:1.6;color:var(--ink-3);margin:14px auto 0;max-width:34em">Something you never got to say, a memory, a thank you. We\'ll make sure it reaches him.</p>' +
      '</div>' +
      '<div class="msg-card" data-reveal>' +
        '<div class="frow"><div><label>Your name</label><input class="fld" id="mName" placeholder="Name"></div>' +
        '<div><label>Email</label><input class="fld" id="mEmail" placeholder="you@email.com"></div></div>' +
        '<div style="margin-top:16px"><label>Your message</label><textarea class="fld" id="mMsg" rows="5" placeholder="Dear Sir…"></textarea></div>' +
        '<div class="form-foot"><span class="hint" id="mHint">This is a private note — only Dr. Jana will read it.</span>' +
        '<button class="btn btn-primary" id="mSend">Send with warmth →</button></div>' +
      '</div>' +
    '</section>';
  }

  /* ---------------- render ---------------- */
  function navBar() {
    return '<nav class="nav">' +
      '<button class="brand" data-go="landing"><span class="mark">' + spoolIcon("currentColor", 22) + '</span>' +
      '<span><span class="name">Dr. Prabir Jana</span><span class="sub">A Farewell Portal</span></span></button>' +
      '<div class="navlinks">' + NAV.map(function (n) {
        var active = state.screen === n[0] || (n[0] === "writing" && state.screen === "writing");
        return '<button data-go="' + n[0] + '" class="' + (active ? "active" : "") + '">' + esc(n[1]) + '<span class="underline"></span></button>';
      }).join("") + '</div>' +
    '</nav>';
  }

  function body() {
    switch (state.screen) {
      case "home": return screenHome();
      case "writing": return screenWriting();
      case "about": return screenAbout();
      case "praises": return screenPraises();
      case "message": return screenMessage();
      default: return screenLanding();
    }
  }

  function render() {
    app.innerHTML =
      bgThreads() +
      navBar() +
      '<div class="stage"><div class="screen show">' + body() + '</div>' +
      '<footer class="foot">MADE WITH WARMTH FOR DR. PRABIR JANA · NIFT DELHI · 1993—2026</footer></div>';
    bind();
    revealObserve();
  }

  /* ---------------- events ---------------- */
  function bind() {
    app.querySelectorAll("[data-go]").forEach(function (b) {
      b.addEventListener("click", function () { go(b.getAttribute("data-go")); });
    });
    app.querySelectorAll("[data-open]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.selectedNode = parseInt(b.getAttribute("data-open"), 10);
        go("writing");
        // go() resets selectedNode after wipe; restore it
        var id = state.selectedNode;
        setTimeout(function () { state.selectedNode = id; render(); }, 340);
      });
    });
    // graph nodes
    app.querySelectorAll("[data-node]").forEach(function (g) {
      g.addEventListener("click", function () { state.selectedNode = parseInt(g.getAttribute("data-node"), 10); render(); });
    });
    var clr = app.querySelector("[data-clear]");
    if (clr) clr.addEventListener("click", function () { state.selectedNode = null; render(); });
    app.querySelectorAll("[data-cat]").forEach(function (c) {
      c.addEventListener("click", function () {
        var k = c.getAttribute("data-cat");
        state.catFilter = state.catFilter === k ? null : k;
        state.selectedNode = null; render();
      });
    });
    var gs = app.querySelector("#gsearch");
    if (gs) {
      gs.addEventListener("input", function () {
        state.query = gs.value; state.selectedNode = null;
        render();
        var f = app.querySelector("#gsearch"); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
      });
    }
    // praises
    var pAdd = app.querySelector("#pAdd");
    if (pAdd) pAdd.addEventListener("click", function () {
      var name = (app.querySelector("#pName").value || "").trim();
      var role = (app.querySelector("#pRole").value || "").trim();
      var msg = (app.querySelector("#pMsg").value || "").trim();
      var hint = app.querySelector("#pHint");
      if (!name || !msg) { hint.textContent = "Please add your name and a message."; hint.classList.add("err"); return; }
      var entry = { id: "u" + Date.now(), name: name, role: role || "Friend & well-wisher", message: msg, isNew: true };
      state.added = [entry].concat(state.added);   // optimistic
      render();
      if (SB) {
        SB.from("tribute_praises").insert({ name: name, role: role || "Friend & well-wisher", message: msg })
          .then(function (res) { if (!res.error) pullPraises(); });
      } else {
        try { localStorage.setItem("prabir_praises_v1", JSON.stringify(state.added)); } catch (e) {}
      }
    });
    // message
    var mSend = app.querySelector("#mSend");
    if (mSend) mSend.addEventListener("click", function () {
      var name = (app.querySelector("#mName").value || "").trim();
      var email = (app.querySelector("#mEmail").value || "").trim();
      var msg = (app.querySelector("#mMsg").value || "").trim();
      var hint = app.querySelector("#mHint");
      if (!name || !msg) { hint.textContent = "Please add your name and a message."; hint.classList.add("err"); return; }
      if (SB) {
        SB.from("tribute_messages").insert({ name: name, email: email, message: msg }).then(function () {});
      } else {
        try {
          var box = JSON.parse(localStorage.getItem("prabir_messages_v1") || "[]");
          box.unshift({ name: name, email: email, message: msg, at: Date.now() });
          localStorage.setItem("prabir_messages_v1", JSON.stringify(box));
        } catch (e) {}
      }
      state.msgSent = true; state.sentName = name; render();
    });
    var mReset = app.querySelector("#mReset");
    if (mReset) mReset.addEventListener("click", function () { state.msgSent = false; state.sentName = ""; render(); });
  }

  /* ---------------- scroll reveal ---------------- */
  var io;
  function revealObserve() {
    if (!("IntersectionObserver" in window)) {
      app.querySelectorAll("[data-reveal]").forEach(function (e) { e.classList.add("in"); }); return;
    }
    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    app.querySelectorAll("[data-reveal]").forEach(function (e) { io.observe(e); });
  }

  render();
  pullPraises();
})();
