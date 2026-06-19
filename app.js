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

  var state = {
    screen: "landing",
    selectedNode: null,
    query: "",
    catFilter: null,
    view: { z: 1, x: 0, y: 0 },   // graph pan/zoom (persists across re-renders)
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
      state.view = { z: 1, x: 0, y: 0 };
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
    // highlight the "last 100 days at NIFT" farewell post if present
    var featIdx = POSTS.findIndex(function (p) { return /100 days/i.test(p.t); });
    if (featIdx < 0) featIdx = 0;
    var featured = POSTS[featIdx];
    var recent = POSTS.filter(function (_, i) { return i !== featIdx; }).slice(0, 6);
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

  function viewTransform() {
    var v = state.view;
    return "translate(" + v.x + " " + v.y + ") scale(" + v.z + ")";
  }

  function matchPost(n) {
    var q = state.query.trim().toLowerCase();
    var cf = state.catFilter;
    if (cf && n.cat !== cf) return false;
    if (!q) return true;
    var hay = (n.t + " " + n.excerpt + " " + (n.body || "") + " " + catName(n.cat) + " " + (n.tags || []).join(" ")).toLowerCase();
    return hay.indexOf(q) >= 0;
  }
  function matchedPosts() { return POSTS.filter(matchPost); }

  // ---- honeycomb (hex-spiral) cell generator: beehive packing ----
  var CUBE_DIRS = [[1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1]];
  function hexCells(n) {
    var out = [[0, 0, 0]];
    var radius = 1;
    while (out.length < n) {
      var hx = CUBE_DIRS[4][0] * radius, hy = CUBE_DIRS[4][1] * radius, hz = CUBE_DIRS[4][2] * radius;
      for (var i = 0; i < 6; i++) {
        for (var j = 0; j < radius; j++) {
          if (out.length < n) out.push([hx, hy, hz]);
          hx += CUBE_DIRS[i][0]; hy += CUBE_DIRS[i][1]; hz += CUBE_DIRS[i][2];
        }
      }
      radius++;
    }
    return out;
  }
  function hexPixel(cell, size) {            // pointy-top axial → pixel
    var q = cell[0], r = cell[2];
    return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r };
  }

  function buildGraph() {
    var CX = 720, CY = 560, BRANCH_R = 430, HEX = 21;
    var byCat = {};
    POSTS.forEach(function (a) { (byCat[a.cat] = byCat[a.cat] || []).push(a); });

    var branches = [];   // the 6 main mind-map limbs
    var nodes = [];      // every post, hex-packed around its branch
    CATS.forEach(function (c, ci) {
      var ang = (ci / CATS.length) * Math.PI * 2 - Math.PI / 2;
      var bx = CX + Math.cos(ang) * BRANCH_R, by = CY + Math.sin(ang) * BRANCH_R;
      var list = byCat[c.key] || [];
      branches.push({ key: c.key, name: c.name, color: c.color, x: Math.round(bx), y: Math.round(by), count: list.length, ang: ang });
      var cells = hexCells(list.length);
      // rotate the honeycomb so it fans outward from the centre
      var rot = ang + Math.PI / 2;
      var cosR = Math.cos(rot), sinR = Math.sin(rot);
      list.forEach(function (a, i) {
        var p = hexPixel(cells[i], HEX);
        var rx = p.x * cosR - p.y * sinR, ry = p.x * sinR + p.y * cosR;
        nodes.push(Object.assign({}, a, {
          color: c.color, catName: c.name, branch: c.key,
          x: Math.round(bx + rx), y: Math.round(by + ry)
        }));
      });
    });
    var byId = {}; nodes.forEach(function (n) { byId[n.id] = n; });

    var sel = state.selectedNode;
    var q = state.query.trim().toLowerCase();
    var cf = state.catFilter;
    var selNode = sel != null ? byId[sel] : null;
    var selColor = selNode ? selNode.color : ACCENT;

    // neighbours of the selected node: same-branch siblings + explicit cross-links
    var neighbors = {};
    if (selNode) {
      CROSS.forEach(function (pair) {
        if (pair[0] === sel && byId[pair[1]]) neighbors[pair[1]] = 1;
        if (pair[1] === sel && byId[pair[0]]) neighbors[pair[0]] = 1;
      });
    }

    var matchCount = nodes.filter(matchPost).length;
    var showLabels = (q || cf) && matchCount <= 22;

    // structural mind-map edges: centre → branch (thick curve), branch → post (twig)
    var trunk = branches.map(function (b) {
      var active = !cf && !q && sel == null;
      var on = (cf === b.key) || (selNode && selNode.branch === b.key);
      return {
        kind: "trunk", color: b.color,
        d: "M" + CX + " " + CY + " Q " + ((CX + b.x) / 2 + (b.y - CY) * 0.12) + " " + ((CY + b.y) / 2 - (b.x - CX) * 0.12) + " " + b.x + " " + b.y,
        opacity: on ? 0.9 : (cf || selNode ? 0.18 : 0.5), width: on ? 3.4 : 2.2
      };
    });
    var twigs = nodes.map(function (n) {
      var b = branches.filter(function (x) { return x.key === n.branch; })[0];
      var lit = (selNode && (n.id === sel || neighbors[n.id])) || (!selNode && (cf === n.branch));
      var dim = (selNode && !(n.id === sel || neighbors[n.id])) || (cf && cf !== n.branch) || (q && !matchPost(n));
      return {
        x1: b.x, y1: b.y, x2: n.x, y2: n.y, color: n.color,
        opacity: lit ? 0.6 : (dim ? 0.03 : 0.14), width: lit ? 1.8 : 0.7
      };
    });
    // glowing cross-links only for the selected node (the "mind-map" associations)
    var links = [];
    if (selNode) {
      CROSS.forEach(function (pair) {
        var a = pair[0], b = pair[1];
        if ((a === sel || b === sel) && byId[a] && byId[b]) {
          links.push({ x1: byId[a].x, y1: byId[a].y, x2: byId[b].x, y2: byId[b].y, color: selColor });
        }
      });
    }

    var gnodes = nodes.map(function (n) {
      var isSel = n.id === sel;
      var isNb = !!neighbors[n.id];
      var filtered = matchPost(n);
      var op, lit;
      if (selNode) { op = (isSel || isNb) ? 1 : 0.12; lit = isSel || isNb; }
      else if (q || cf) { op = filtered ? 1 : 0.07; lit = filtered && showLabels; }
      else { op = 1; lit = false; }
      return Object.assign({}, n, {
        r: isSel ? 15 : 8.5, ring: isSel ? 24 : 15, ringOp: isSel ? 0.7 : 0,
        op: op, lit: lit, labelY: n.y + (isSel ? 15 : 8.5) + 26,
        short: (n.t.length > 26 ? n.t.slice(0, 24) + "…" : n.t)
      });
    });
    return { CX: CX, CY: CY, branches: branches, trunk: trunk, twigs: twigs, links: links, nodes: gnodes };
  }

  function listCard(p) {
    var col = catColor(p.cat);
    var on = p.id === state.selectedNode;
    return '<article class="note' + (on ? " sel" : "") + '" data-node="' + p.id + '" data-reveal>' +
      '<span class="cat" style="color:' + col + '"><span class="dot" style="background:' + col + '"></span>' + esc(catName(p.cat)) + '</span>' +
      '<h3>' + esc(p.t) + '</h3>' +
      '<p>' + esc(p.excerpt) + '</p>' +
      '<div class="meta"><span>' + esc(p.date) + '</span><span>·</span><span>' + esc(p.read) + ' read</span></div>' +
    '</article>';
  }

  function screenWriting() {
    var g = buildGraph();
    var matched = matchedPosts();
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
        '<input id="gsearch" type="text" placeholder="Search his writing — PMTS, lean, automation, India…" value="' + esc(state.query) + '">' +
        (state.query || state.catFilter ? '<button class="search-x" data-reset="1" aria-label="Clear search">✕</button>' : "") +
        '</label>' +
        '<span class="search-count">' + matched.length + ' of ' + POSTS.length + '</span>' +
      '</div>' +
      '<div class="legend">' + legend + '</div>' +
      '<div class="graph-wrap">' +
        '<div class="graph-box" id="graphBox">' +
          '<div class="graph-hint">Drag to move · scroll to zoom · tap a cell</div>' +
          '<div class="zoom-ctrl">' +
            '<button data-zoom="in" aria-label="Zoom in">+</button>' +
            '<button data-zoom="out" aria-label="Zoom out">−</button>' +
            '<button data-zoom="reset" aria-label="Reset view">⤢</button>' +
          '</div>' +
          '<svg id="graphSvg" viewBox="0 0 1440 1120">' +
            '<g class="viewport" id="viewport" transform="' + viewTransform() + '">' +
              // mind-map trunks (centre → each branch)
              g.trunk.map(function (t) { return '<path class="trunk" d="' + t.d + '" fill="none" stroke="' + t.color + '" stroke-width="' + t.width + '" opacity="' + t.opacity + '" stroke-linecap="round"/>'; }).join("") +
              // twigs (branch → each post)
              g.twigs.map(function (e) { return '<line x1="' + e.x1 + '" y1="' + e.y1 + '" x2="' + e.x2 + '" y2="' + e.y2 + '" stroke="' + e.color + '" stroke-width="' + e.width + '" opacity="' + e.opacity + '"/>'; }).join("") +
              // glowing associations from the selected post
              g.links.map(function (e) { return '<line class="assoc" x1="' + e.x1 + '" y1="' + e.y1 + '" x2="' + e.x2 + '" y2="' + e.y2 + '" stroke="' + e.color + '" stroke-width="2.6" opacity="0.85" stroke-dasharray="5 6"/>'; }).join("") +
              // branch hubs with labels (mind-map limbs)
              g.branches.map(function (b) {
                var on = state.catFilter === b.key || (g.nodes.some(function (n) { return n.id === state.selectedNode && n.branch === b.key; }));
                return '<g class="ghub' + (on ? " on" : "") + '" data-cat="' + b.key + '">' +
                  '<circle class="hub-ring" cx="' + b.x + '" cy="' + b.y + '" r="' + (on ? 40 : 34) + '" fill="none" stroke="' + b.color + '" stroke-width="2" opacity="' + (on ? 0.5 : 0.22) + '"/>' +
                  '<circle class="hub-core" cx="' + b.x + '" cy="' + b.y + '" r="' + (on ? 27 : 23) + '" fill="' + b.color + '"/>' +
                  '<text x="' + b.x + '" y="' + (b.y + 7) + '" text-anchor="middle" fill="#fff" font-family="Spline Sans Mono,monospace" font-size="20" font-weight="600">' + b.count + '</text>' +
                  '<text class="blbl" x="' + b.x + '" y="' + (b.y - 44) + '" text-anchor="middle" fill="#3A2C22" font-family="Spline Sans Mono,monospace" font-size="21" font-weight="600" letter-spacing=".5">' + esc(b.name) + '</text>' +
                '</g>';
              }).join("") +
              // central hub
              '<circle class="core-glow" cx="' + g.CX + '" cy="' + g.CY + '" r="58" fill="' + ACCENT + '" opacity="0.12"/>' +
              '<circle cx="' + g.CX + '" cy="' + g.CY + '" r="50" fill="#3A2C22"/>' +
              '<circle cx="' + g.CX + '" cy="' + g.CY + '" r="50" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="5 6" style="transform-box:fill-box;transform-origin:center;animation:ringSpin 28s linear infinite"/>' +
              '<text x="' + g.CX + '" y="' + (g.CY - 4) + '" text-anchor="middle" fill="#F7EFE2" font-family="Newsreader,serif" font-size="26" font-style="italic">Prabir</text>' +
              '<text x="' + g.CX + '" y="' + (g.CY + 18) + '" text-anchor="middle" fill="#C9B294" font-family="Spline Sans Mono,monospace" font-size="15" letter-spacing="2">JANA</text>' +
              // post nodes (honeycomb cells) — gently drifting
              g.nodes.map(function (n) {
                var dur = (6 + (n.id % 45) / 9).toFixed(2);
                var del = (-(n.id % 70) / 9).toFixed(2);
                return '<g class="gnode' + (n.lit ? " lit" : "") + '" data-node="' + n.id + '" style="animation-duration:' + dur + 's;animation-delay:' + del + 's">' +
                  (n.ringOp ? '<circle class="halo" cx="' + n.x + '" cy="' + n.y + '" r="' + n.ring + '" fill="none" stroke="' + n.color + '" stroke-width="2.5" opacity="' + n.ringOp + '"/>' : "") +
                  '<circle class="node" cx="' + n.x + '" cy="' + n.y + '" r="' + n.r + '" fill="' + n.color + '" opacity="' + n.op + '"/>' +
                  '<text class="lbl" x="' + n.x + '" y="' + n.labelY + '" text-anchor="middle" fill="#3A2C22" font-family="Spline Sans Mono,monospace" font-size="20" font-weight="500">' + esc(n.short) + '</text>' +
                '</g>';
              }).join("") +
            '</g>' +
          '</svg>' +
        '</div>' +
        '<div class="detail">' + detail + '</div>' +
      '</div>' +
      '<div class="results-head">' +
        '<span class="eyebrow">' + (state.query || state.catFilter ? "Search results" : "Every piece, in full") + '</span>' +
        '<span class="search-count">' + matched.length + (matched.length === 1 ? " piece" : " pieces") + '</span>' +
      '</div>' +
      '<div class="card-grid result-grid">' +
        (matched.length ? matched.map(listCard).join("") :
          '<div class="no-results">Nothing matches “' + esc(state.query) + '”. Try another word, or clear the search.</div>') +
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
          '<div class="quote"><div class="q">“Industrial Engineering is not an Art; it is Science.”</div><div class="by">— PRABIR JANA</div></div>' +
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
    var all = state.added;
    var wall = all.length ? all.map(function (p) {
      return '<div class="pcard' + (p.isNew ? " new" : "") + '">' +
        '<div class="qmark">“</div>' +
        '<p class="msg">' + esc(p.message) + '</p>' +
        '<div class="nm">' + esc(p.name) + '</div>' +
        '<div class="rl">' + esc(p.role || "Friend & well-wisher") + '</div>' +
      '</div>';
    }).join("") :
      '<div class="wall-empty" data-reveal>' +
        '<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="opacity:.85"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
        '<h3 class="serif">Be the first to leave a word</h3>' +
        '<p>The wall is empty for now. Add the first message above and it will live here for everyone to read.</p>' +
      '</div>';
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
      '<div class="' + (all.length ? "wall" : "wall wall-none") + '">' + wall + '</div>' +
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
    // graph nodes + list cards
    app.querySelectorAll("[data-node]").forEach(function (g) {
      g.addEventListener("click", function () {
        state.selectedNode = parseInt(g.getAttribute("data-node"), 10);
        var fromList = g.classList.contains("note");
        render();
        if (fromList) {
          var box = app.querySelector(".graph-wrap");
          if (box) try { box.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
        }
      });
    });
    var clr = app.querySelector("[data-clear]");
    if (clr) clr.addEventListener("click", function () { state.selectedNode = null; render(); });
    var rst = app.querySelector("[data-reset]");
    if (rst) rst.addEventListener("click", function () { state.query = ""; state.catFilter = null; state.selectedNode = null; render(); });

    /* ---- graph zoom / pan (mind-map navigation) ---- */
    var box = app.querySelector("#graphBox");
    var svg = app.querySelector("#graphSvg");
    if (box && svg) {
      function svgPoint(cx, cy) {
        var pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy;
        var m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
        var p = pt.matrixTransform(m.inverse());
        return { x: p.x, y: p.y };
      }
      function applyView() { var vp = app.querySelector("#viewport"); if (vp) vp.setAttribute("transform", viewTransform()); }
      function zoomAt(p, factor) {
        var nz = Math.max(0.4, Math.min(4.5, state.view.z * factor));
        factor = nz / state.view.z;
        state.view.x = p.x - (p.x - state.view.x) * factor;
        state.view.y = p.y - (p.y - state.view.y) * factor;
        state.view.z = nz;
        applyView();
      }
      box.addEventListener("wheel", function (e) {
        e.preventDefault();
        zoomAt(svgPoint(e.clientX, e.clientY), e.deltaY < 0 ? 1.12 : 1 / 1.12);
      }, { passive: false });

      var dragging = false, moved = false, lastP = null;
      box.addEventListener("pointerdown", function (e) {
        if (e.target.closest && e.target.closest(".zoom-ctrl")) return;
        dragging = true; moved = false; lastP = svgPoint(e.clientX, e.clientY);
        try { box.setPointerCapture(e.pointerId); } catch (x) {}
        box.classList.add("grabbing");
      });
      box.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        var p = svgPoint(e.clientX, e.clientY);
        var dx = p.x - lastP.x, dy = p.y - lastP.y;
        if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) moved = true;
        state.view.x += dx; state.view.y += dy; lastP = p; applyView();
      });
      function endDrag(e) { if (!dragging) return; dragging = false; box.classList.remove("grabbing"); try { box.releasePointerCapture(e.pointerId); } catch (x) {} }
      box.addEventListener("pointerup", endDrag);
      box.addEventListener("pointercancel", endDrag);
      // swallow the click that ends a drag so it doesn't select a node
      box.addEventListener("click", function (e) { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);

      app.querySelectorAll("[data-zoom]").forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          var k = b.getAttribute("data-zoom");
          if (k === "reset") { state.view = { z: 1, x: 0, y: 0 }; applyView(); }
          else zoomAt({ x: 720, y: 560 }, k === "in" ? 1.3 : 1 / 1.3);
        });
      });
    }
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
