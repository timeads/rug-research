/* Rug Research Database — single-file app, no build step.
 *
 * Data layers:
 *   window.RUG_ITEMS        seed/committed records (data/items.js)
 *   localStorage[STORE_KEY] your edits, additions, deletions, flags, notes and lists
 *   IndexedDB "rugdb"       uploaded photos (yarn samples, tools, your own pictures)
 */
(() => {
  "use strict";

  const STORE_KEY = "rugdb.v1";

  const TYPES = {
    "object":        { label: "Object", plural: "Objects" },
    "book":          { label: "Book", plural: "Books" },
    "article":       { label: "Article", plural: "Articles" },
    "image":         { label: "Image / photo", plural: "Images & photos" },
    "archive":       { label: "Archive / manuscript", plural: "Archives & manuscripts" },
    "trade-catalog": { label: "Trade catalog", plural: "Trade catalogs" },
    "yarn":          { label: "Yarn / fiber sample", plural: "Yarn & fiber samples" },
    "tool":          { label: "Tool / equipment", plural: "Tools & equipment" },
    "patent":        { label: "Patent", plural: "Patents" },
    "film":          { label: "Film / audio", plural: "Film & audio" },
    "oral-history":  { label: "Oral history", plural: "Oral histories" },
    "event":         { label: "Event / milestone", plural: "Events & milestones" },
    "other":         { label: "Other", plural: "Other" }
  };

  const FLAGS = [
    { id: "fellowship", label: "Winterthur fellowship", color: "#a6382b" },
    { id: "tufting",    label: "History of tufting",    color: "#2f4a6d" },
    { id: "followup",   label: "Follow up / verify",    color: "#c08a2e" },
    { id: "request",    label: "Request / visit",       color: "#6b7f5b" },
    { id: "image",      label: "Need image rights",     color: "#8a5a9e" }
  ];
  const FLAG_BY_ID = Object.fromEntries(FLAGS.map(f => [f.id, f]));

  const DEFAULT_THEMES = [
    "Early tufting: bed rugs & needlework pile", "Hooked & handmade rugs", "Woven carpet", "Chenille & candlewick", "Machine tufting & Dalton",
    "Nylon & synthetic fibers (DuPont)", "Trade catalogs & marketing", "Tools & equipment", "Yarn & materials"
  ];

  // ---------- utilities ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = u => {
    if (!u) return "";
    u = String(u).trim();
    if (/^https?:\/\//i.test(u) || /^data:image\//i.test(u) || /^blob:/i.test(u)) return u;
    if (/^[\w./-]+$/.test(u) && !u.startsWith("//")) return u; // relative path, e.g. images/foo.jpg
    return "";
  };
  const arr = v => Array.isArray(v) ? v : (v ? String(v).split(",").map(s => s.trim()).filter(Boolean) : []);
  const uid = () => "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const download = (name, text, mime = "text/plain") => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  const csvCell = v => { const s = Array.isArray(v) ? v.join("; ") : String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  let toastTimer;
  const toast = msg => { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2600); };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // ---------- persistent state ----------
  const blankState = () => ({
    version: 1, items: {}, deleted: {}, flags: {}, notes: {}, touched: {},
    lists: [{ id: "fellowship", name: "Winterthur fellowship application", intro: "", items: [] }],
    activeList: "fellowship", ui: { layout: "grid", q: "", sort: "relevance" }
  });
  let S;
  try { S = Object.assign(blankState(), JSON.parse(localStorage.getItem(STORE_KEY) || "{}")); }
  catch { S = blankState(); }
  if (!S.lists.length) S.lists = blankState().lists;
  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
    catch (e) { toast("Couldn't save. Browser storage is full. Export a backup."); console.error(e); }
  };

  // ---------- image store (IndexedDB) ----------
  const imgCache = {};
  const idb = (() => {
    let dbp;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open("rugdb", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("images");
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction("images", mode); const out = fn(t.objectStore("images")); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); };
    return {
      put: (k, v) => tx("readwrite", s => s.put(v, k)),
      del: k => tx("readwrite", s => s.delete(k)),
      all: async () => { const db = await open(); return new Promise((res, rej) => { const out = {}; const c = db.transaction("images").objectStore("images").openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } else res(out); }; c.onerror = () => rej(c.error); }); }
    };
  })();
  const imgSrc = item => {
    if (!item.image) return "";
    if (item.image.startsWith("idb:")) return imgCache[item.image.slice(4)] || "";
    return safeUrl(item.image);
  };
  const resizeImage = file => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const max = 1400, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src); res(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = rej; img.src = URL.createObjectURL(file);
  });

  // ---------- items ----------
  const BASE = (window.RUG_ITEMS || []).map(x => ({ ...x }));
  const BASE_IDS = new Set(BASE.map(x => x.id));
  let ITEMS = [], BY_ID = {};

  const norm = x => ({
    ...x,
    type: TYPES[x.type] ? x.type : "other",
    materials: arr(x.materials), techniques: arr(x.techniques), themes: arr(x.themes), tags: arr(x.tags),
    dateStart: x.dateStart === "" || x.dateStart == null ? null : Number(x.dateStart),
    dateEnd: x.dateEnd === "" || x.dateEnd == null ? null : Number(x.dateEnd)
  });

  const rebuild = () => {
    const list = BASE.filter(x => !S.deleted[x.id]).map(x => S.items[x.id] || x);
    for (const [id, x] of Object.entries(S.items)) if (!BASE_IDS.has(id) && !S.deleted[id]) list.push(x);
    ITEMS = list.map(norm);
    BY_ID = Object.fromEntries(ITEMS.map(x => [x.id, x]));
    for (const it of ITEMS) {
      it._hay = {
        title: (it.title || "").toLowerCase(),
        creator: (it.creator || "").toLowerCase(),
        facets: [...it.themes, ...it.tags, ...it.techniques, ...it.materials, TYPES[it.type].label].join(" | ").toLowerCase(),
        where: [it.institution, it.collection, it.identifier, it.place, it.publisher, it.date].join(" | ").toLowerCase(),
        body: [it.description, S.notes[it.id], it.citation].join(" | ").toLowerCase()
      };
    }
  };

  // ---------- search ----------
  const parseQuery = q => {
    const out = { terms: [], neg: [], fields: [] };
    const re = /(-?)(?:(\w+):)?(?:"([^"]*)"|(\S+))/g;
    let m;
    while ((m = re.exec(q))) {
      const [, minus, field, quoted, bare] = m;
      const val = (quoted ?? bare ?? "").toLowerCase().trim();
      if (!val) continue;
      if (field) out.fields.push({ field: field.toLowerCase(), val, neg: !!minus });
      else (minus ? out.neg : out.terms).push(val);
    }
    return out;
  };
  const fieldMatch = (it, { field, val }) => {
    switch (field) {
      case "type": return it.type.includes(val) || TYPES[it.type].label.toLowerCase().includes(val);
      case "inst": case "institution": case "at": return (it.institution || "").toLowerCase().includes(val);
      case "theme": return it.themes.some(t => t.toLowerCase().includes(val));
      case "tag": return it.tags.some(t => t.toLowerCase().includes(val));
      case "material": return it.materials.some(t => t.toLowerCase().includes(val));
      case "technique": return it.techniques.some(t => t.toLowerCase().includes(val));
      case "flag": return (S.flags[it.id] || []).some(f => f.includes(val) || FLAG_BY_ID[f]?.label.toLowerCase().includes(val));
      case "status": return (it.status || "unverified").startsWith(val);
      case "by": case "creator": case "author": return it._hay.creator.includes(val);
      case "year": case "date": {
        const [a, b] = val.split(/[-–]/).map(Number);
        if (isNaN(a)) return false;
        const lo = a, hi = isNaN(b) ? a : b, s = it.dateStart, e = it.dateEnd ?? it.dateStart;
        return s != null && s <= hi && e >= lo;
      }
      default: return Object.values(it._hay).some(h => h.includes(val));
    }
  };
  const scoreItem = (it, pq) => {
    for (const f of pq.fields) if (fieldMatch(it, f) === f.neg) return -1;
    for (const n of pq.neg) if (Object.values(it._hay).some(h => h.includes(n))) return -1;
    let score = 0;
    for (const t of pq.terms) {
      const h = it._hay; let s = 0;
      if (h.title.includes(t)) s += 10 + (new RegExp("\\b" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(h.title) ? 5 : 0);
      if (h.creator.includes(t)) s += 4;
      if (h.facets.includes(t)) s += 4;
      if (h.where.includes(t)) s += 3;
      if (h.body.includes(t)) s += 1;
      if (!s) return -1;
      score += s;
    }
    if ((S.flags[it.id] || []).length) score += 0.5;
    return score;
  };

  // facet filters (checkbox state, not persisted)
  const F = { type: new Set(), theme: new Set(), inst: new Set(), flag: new Set(), status: new Set() };
  const facetValues = {
    type: it => [it.type],
    theme: it => it.themes,
    inst: it => it.institution ? [it.institution] : ["(none)"],
    flag: it => (S.flags[it.id] || []).length ? S.flags[it.id] : ["(unflagged)"],
    status: it => [it.status || "unverified"]
  };
  const passFacets = (it, except) => Object.entries(F).every(([k, set]) => k === except || !set.size || facetValues[k](it).some(v => set.has(v)));

  let lastResults = [];
  const runSearch = () => {
    const pq = parseQuery(S.ui.q || "");
    const scored = [];
    for (const it of ITEMS) { const s = scoreItem(it, pq); if (s >= 0) scored.push([it, s]); }
    const matches = scored.filter(([it]) => passFacets(it));
    const sort = S.ui.sort;
    const ds = it => it.dateStart ?? 99999;
    matches.sort((a, b) =>
      sort === "date-asc" ? ds(a[0]) - ds(b[0]) :
      sort === "date-desc" ? (b[0].dateStart ?? -1) - (a[0].dateStart ?? -1) :
      sort === "title" ? (a[0].title || "").localeCompare(b[0].title || "") :
      sort === "recent" ? (S.touched[b[0].id] || 0) - (S.touched[a[0].id] || 0) :
      (b[1] - a[1]) || ds(a[0]) - ds(b[0]));
    lastResults = matches.map(m => m[0]);
    return { pq, scored: scored.map(s => s[0]) };
  };

  const highlight = (text, terms) => {
    let html = esc(text);
    for (const t of terms) {
      if (t.length < 2) continue;
      html = html.replace(new RegExp("(" + esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>");
    }
    return html;
  };

  // ---------- placeholder art: a little "rug swatch" per item ----------
  const PALETTES = [
    ["#a6382b", "#e9d9b8", "#2f4a6d", "#c08a2e"], ["#2f4a6d", "#d8c7a3", "#6b7f5b", "#a6382b"],
    ["#6b7f5b", "#efe3c8", "#8a3b2a", "#c08a2e"], ["#3b2f2a", "#c9a46a", "#a6382b", "#e8dcc4"],
    ["#8a5a9e", "#ecdfc8", "#2f4a6d", "#c08a2e"], ["#c08a2e", "#f3e8d2", "#3a5a40", "#8a3b2a"]
  ];
  const swatch = item => {
    const h = hash(item.id || item.title);
    const [a, b, c, d] = PALETTES[h % PALETTES.length];
    const bg = [
      `repeating-linear-gradient(0deg, ${a} 0 6px, ${b} 6px 10px, ${c} 10px 13px, ${b} 13px 20px)`,
      `repeating-linear-gradient(45deg, ${a} 0 8px, ${b} 8px 16px)`,
      `radial-gradient(circle, ${c} 0 22%, ${a} 24% 44%, ${b} 46%) 0 0 / 12px 12px`,
      `conic-gradient(${a} 25%, ${b} 0 50%, ${a} 0 75%, ${b} 0) 0 0 / 18px 18px`,
      `linear-gradient(135deg, ${a} 25%, transparent 25%) -9px 0 / 18px 18px, linear-gradient(225deg, ${a} 25%, transparent 25%) -9px 0 / 18px 18px, linear-gradient(315deg, ${a} 25%, transparent 25%) 0 0 / 18px 18px, linear-gradient(45deg, ${a} 25%, ${b} 25%) 0 0 / 18px 18px`
    ][(h >>> 4) % 5];
    return `<div class="swatch" aria-hidden="true" style="border-color:${c};box-shadow:inset 0 0 0 7px ${d};background:${bg}"></div>`;
  };
  const thumbHTML = item => {
    const src = imgSrc(item);
    return src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.replaceWith(document.createRange().createContextualFragment(this.dataset.fallback))" data-fallback="${esc(swatch(item))}">` : swatch(item);
  };

  // ---------- citations ----------
  const citation = it => {
    if (it.citation) return it.citation;
    const who = it.creator ? it.creator + ". " : "";
    const url = it.sourceUrl ? " " + it.sourceUrl + "." : "";
    const date = it.date || (it.dateStart ? String(it.dateStart) : "n.d.");
    const join = (...p) => p.filter(Boolean).join(", ");
    switch (it.type) {
      case "book":
        return `${who}*${it.title}*. ${join(it.place && it.publisher ? it.place + ": " + it.publisher : it.publisher || it.place, date)}.${it.identifier ? " " + it.identifier + "." : ""}${url}`;
      case "article":
        return `${who}"${it.title}." ${join(it.publisher ? "*" + it.publisher + "*" : "", it.date)}.${url}`;
      case "object": case "yarn": case "tool":
        return `${it.creator || "Unknown maker"}. *${it.title}*, ${date}. ${[it.materials.join(", "), it.dimensions].filter(Boolean).join("; ")}${it.materials.length || it.dimensions ? ". " : ""}${join(it.institution, it.identifier)}.${url}`.replace(/\.\s*\./g, ".");
      default:
        return `${who}"${it.title}," ${date}. ${join(it.identifier, it.collection, it.institution)}.${url}`.replace(/\.\s*\./g, ".");
    }
  };
  const mdInline = s => esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // ---------- rendering: browse ----------
  const metaLine = it => [it.creator, it.date, it.institution].filter(Boolean).join(" · ");
  const flagDots = it => (S.flags[it.id] || []).map(f => FLAG_BY_ID[f] ? `<span class="flag-dot" title="${esc(FLAG_BY_ID[f].label)}" style="background:${FLAG_BY_ID[f].color}"></span>` : "").join("");
  const activeList = () => S.lists.find(l => l.id === S.activeList) || S.lists[0];

  const cardHTML = (it, terms = []) => {
    const inList = activeList().items.includes(it.id);
    const fl = S.flags[it.id] || [];
    return `<article class="card" tabindex="0" data-id="${esc(it.id)}">
      <div class="thumb">${thumbHTML(it)}<span class="type-pill">${esc(TYPES[it.type].label)}</span><span class="card-flags">${flagDots(it)}</span></div>
      <div class="card-body">
        <div class="card-title">${highlight(it.title || "(untitled)", terms)}</div>
        <div class="card-meta">${highlight(metaLine(it), terms)}</div>
        ${it.status !== "verified" ? `<div class="card-unverified">● unverified</div>` : ""}
        <div class="card-quick">
          <button class="qbtn ${fl.includes("fellowship") ? "on" : ""}" style="${fl.includes("fellowship") ? "background:" + FLAG_BY_ID.fellowship.color : ""}" data-qflag="fellowship" title="Flag: Winterthur fellowship">★ Fellowship</button>
          <button class="qbtn ${fl.includes("tufting") ? "on" : ""}" style="${fl.includes("tufting") ? "background:" + FLAG_BY_ID.tufting.color : ""}" data-qflag="tufting" title="Flag: History of tufting">⚑ Tufting</button>
          <button class="qbtn ${inList ? "on" : ""}" style="${inList ? "background:var(--ink)" : ""}" data-qlist title="Add to compilation: ${esc(activeList().name)}">${inList ? "✓ In list" : "+ List"}</button>
        </div>
      </div></article>`;
  };

  const renderFacets = scoredAll => {
    const defs = [
      ["flag", "Flags", v => v === "(unflagged)" ? v : FLAG_BY_ID[v]?.label || v, v => FLAG_BY_ID[v]?.color],
      ["type", "Type", v => TYPES[v]?.plural || v],
      ["theme", "Research theme", v => v],
      ["inst", "Institution", v => v],
      ["status", "Status", v => v === "verified" ? "Verified at source" : "Unverified"]
    ];
    $("#facets").innerHTML = defs.map(([key, title, label, color]) => {
      const counts = new Map();
      for (const it of scoredAll) if (passFacets(it, key)) for (const v of new Set(facetValues[key](it))) counts.set(v, (counts.get(v) || 0) + 1);
      for (const v of F[key]) if (!counts.has(v)) counts.set(v, 0);
      if (key === "flag") for (const f of FLAGS) if (!counts.has(f.id)) counts.set(f.id, 0);
      const entries = [...counts].sort((a, b) => b[1] - a[1] || String(label(a[0])).localeCompare(label(b[0])));
      if (!entries.length) return "";
      const expanded = $("#facets").dataset["open" + key] === "1";
      const shown = expanded ? entries : entries.slice(0, 8);
      return `<div class="facet"><h3>${title}</h3>${shown.map(([v, n]) => `<label><input type="checkbox" data-facet="${key}" value="${esc(v)}" ${F[key].has(v) ? "checked" : ""}>${color && color(v) ? `<span class="flag-dot" style="background:${color(v)}"></span>` : ""}<span>${esc(label(v))}</span><span class="count">${n}</span></label>`).join("")}
        ${entries.length > 8 ? `<button class="more" data-more="${key}">${expanded ? "Show less" : `Show all ${entries.length}`}</button>` : ""}</div>`;
    }).join("");
  };

  const renderBrowse = () => {
    const { pq, scored } = runSearch();
    renderFacets(scored);
    const res = $("#results");
    res.className = "grid" + (S.ui.layout === "list" ? " list" : "");
    res.innerHTML = lastResults.length ? lastResults.map(it => cardHTML(it, pq.terms)).join("")
      : `<div class="empty">No matches. Try fewer words, clear filters, or <a href="#" data-goto="sources">search other archives</a> / <a href="#" data-goto="discover">discover</a> new items.</div>`;
    $("#result-count").textContent = `${lastResults.length} of ${ITEMS.length} items`;
    const chips = [];
    for (const [k, set] of Object.entries(F)) for (const v of set) chips.push(`<span class="chip">${esc(k === "type" ? TYPES[v]?.label : k === "flag" ? FLAG_BY_ID[v]?.label || v : v)}<button data-unfacet="${k}" data-val="${esc(v)}" aria-label="Remove">✕</button></span>`);
    if (chips.length) chips.push(`<button class="btn small" id="clear-facets">Clear filters</button>`);
    $("#active-filters").innerHTML = chips.join(" ");
    renderListBadge();
    if (currentView === "timeline") renderTimeline();
  };

  // ---------- timeline ----------
  const renderTimeline = () => {
    const dated = lastResults.filter(it => it.dateStart != null).sort((a, b) => a.dateStart - b.dateStart);
    const undated = lastResults.length - dated.length;
    const groups = new Map();
    for (const it of dated) { const d = Math.floor(it.dateStart / 10) * 10; if (!groups.has(d)) groups.set(d, []); groups.get(d).push(it); }
    $("#timeline").innerHTML = (dated.length ? [...groups].map(([d, items]) => `<div class="decade"><div class="decade-label">${d}s</div><div class="decade-items">${items.map(it => cardHTML(it)).join("")}</div></div>`).join("") : `<div class="empty">No dated items match.</div>`)
      + (undated ? `<p class="hint" style="margin-top:16px">${undated} matching item(s) have no start year. Add one to place them on the timeline.</p>` : "");
  };

  // ---------- drawer ----------
  let drawerId = null;
  const openDrawer = id => {
    const it = BY_ID[id]; if (!it) return;
    drawerId = id;
    const fl = S.flags[id] || [];
    const src = imgSrc(it);
    const fields = [
      ["Type", TYPES[it.type].label], ["Creator", it.creator], ["Date", it.date || it.dateStart], ["Place", it.place],
      ["Institution", it.institution], ["Collection", it.collection], ["Identifier", it.identifier], ["Publisher", it.publisher],
      ["Materials", it.materials.join(", ")], ["Techniques", it.techniques.join(", ")], ["Dimensions", it.dimensions],
      ["Themes", it.themes.join(", ")], ["Tags", it.tags.join(", ")],
      ["Status", it.status === "verified" ? "Verified at source" : "Unverified. Confirm details before citing."]
    ].filter(([, v]) => v);
    const q = encodeURIComponent([it.title, it.creator].filter(Boolean).join(" "));
    const lists = S.lists.filter(l => l.items.includes(id));
    $("#drawer").innerHTML = `
      <div class="drawer-img">${src ? `<a href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="${esc(it.title)}"></a>` : swatch(it)}</div>
      <div class="drawer-body">
        <div class="drawer-top">
          <span class="chip">${esc(TYPES[it.type].label)}</span>
          <span class="spacer"></span>
          <button class="btn small" data-edit="${esc(id)}">Edit</button>
          <button class="btn small" data-close>Close ✕</button>
        </div>
        <h2>${esc(it.title)}</h2>
        <div class="sub">${esc(metaLine(it))}</div>
        ${it.sourceUrl && safeUrl(it.sourceUrl) ? `<a class="btn" href="${esc(safeUrl(it.sourceUrl))}" target="_blank" rel="noopener">View at source ↗</a>` : ""}
        ${it.description ? `<p>${esc(it.description)}</p>` : ""}
        <dl class="fields">${fields.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>

        <div class="section-label">Flags</div>
        <div class="flag-toggles">${FLAGS.map(f => `<button class="flag-toggle ${fl.includes(f.id) ? "on" : ""}" data-flag="${f.id}"><span class="flag-dot" style="background:${f.color}"></span>${esc(f.label)}</button>`).join("")}</div>

        <div class="section-label">Compilations</div>
        <div class="list-add">
          ${lists.map(l => `<span class="chip">${esc(l.name)}<button data-unlist="${esc(l.id)}" aria-label="Remove from list">✕</button></span>`).join("")}
          <select id="drawer-list-add"><option value="">+ Add to list…</option>${S.lists.filter(l => !l.items.includes(id)).map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("")}<option value="__new">New list…</option></select>
        </div>

        <div class="section-label">My notes</div>
        <textarea class="notes" id="drawer-notes" placeholder="Why this matters, what to check, quotes, page numbers…">${esc(S.notes[id] || "")}</textarea>

        <div class="section-label">Citation <button class="btn small" id="copy-cite">Copy</button></div>
        <div class="citation">${mdInline(citation(it))}</div>

        <div class="section-label">Search for this elsewhere</div>
        <div class="searchlinks">${(window.RUG_SOURCES || []).slice(0, 12).map(s => `<a href="${esc(s.url.replace("{q}", q))}" target="_blank" rel="noopener">${esc(s.group === "Museums" || s.group === "Books & texts" ? s.name : s.group + " " + s.name.toLowerCase())}</a>`).join(" · ")}</div>
      </div>`;
    $("#drawer").hidden = false; $("#scrim").hidden = false;
    $("#drawer").scrollTop = 0;
  };
  const closeDrawer = () => { $("#drawer").hidden = true; $("#scrim").hidden = true; drawerId = null; };

  // ---------- mutations ----------
  const touch = id => { S.touched[id] = Date.now(); };
  const toggleFlag = (id, f) => {
    const cur = new Set(S.flags[id] || []);
    cur.has(f) ? cur.delete(f) : cur.add(f);
    if (cur.size) S.flags[id] = [...cur]; else delete S.flags[id];
    touch(id); save(); refresh();
  };
  const toggleInList = (id, listId = S.activeList) => {
    const l = S.lists.find(x => x.id === listId); if (!l) return;
    const i = l.items.indexOf(id);
    i >= 0 ? l.items.splice(i, 1) : l.items.push(id);
    save(); refresh();
    toast(i >= 0 ? `Removed from "${l.name}"` : `Added to "${l.name}"`);
  };
  const newList = () => {
    const name = prompt("Name for the new compilation:", "History of tufting: chapter 1");
    if (!name) return null;
    const l = { id: uid(), name, intro: "", items: [] };
    S.lists.push(l); S.activeList = l.id; save(); return l;
  };
  const refresh = () => {
    rebuild();
    if (currentView === "browse" || currentView === "timeline") renderBrowse();
    if (currentView === "compile") renderCompile();
    if (currentView === "discover") renderDiscover();
    if (drawerId && BY_ID[drawerId]) {
      const scroll = $("#drawer").scrollTop; openDrawer(drawerId); $("#drawer").scrollTop = scroll;
    } else if (drawerId) closeDrawer();
    renderListBadge();
  };

  // ---------- edit dialog ----------
  const dlg = $("#edit-dialog"), form = $("#edit-form");
  let editingId = null;
  form.elements.type.innerHTML = Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("");
  const openEdit = (id, preset = {}) => {
    editingId = id;
    const it = id ? BY_ID[id] : { type: "object", status: "unverified", ...preset };
    $("#edit-title").textContent = id ? "Edit item" : "Add item";
    for (const el of form.elements) {
      if (!el.name || el.type === "file") continue;
      const v = it[el.name];
      el.value = Array.isArray(v) ? v.join(", ") : (v ?? "");
    }
    form.elements.imageFile.value = "";
    if (it.image && it.image.startsWith("idb:")) form.elements.image.value = it.image;
    $("#btn-delete-item").hidden = !id;
    $("#dl-inst").innerHTML = [...new Set(ITEMS.map(x => x.institution).filter(Boolean))].map(v => `<option value="${esc(v)}">`).join("");
    $("#dl-themes").innerHTML = [...new Set([...DEFAULT_THEMES, ...ITEMS.flatMap(x => x.themes)])].map(v => `<option value="${esc(v)}">`).join("");
    dlg.showModal();
  };
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const id = editingId || uid();
    const prev = editingId ? BY_ID[editingId] : {};
    const rec = { id };
    for (const [k, v] of fd.entries()) if (k !== "imageFile") rec[k] = typeof v === "string" ? v.trim() : v;
    for (const k of ["materials", "techniques", "themes", "tags"]) rec[k] = arr(rec[k]);
    for (const k of ["dateStart", "dateEnd"]) rec[k] = rec[k] === "" ? null : Number(rec[k]);
    if (rec.dateStart == null && rec.date) { const m = String(rec.date).match(/\b(1[0-9]{3}|20[0-9]{2})\b/g); if (m) { rec.dateStart = +m[0]; if (m[1]) rec.dateEnd = +m[1]; } }
    const file = form.elements.imageFile.files[0];
    if (file) {
      try {
        const data = await resizeImage(file);
        const key = "img-" + id + "-" + Date.now().toString(36);
        await idb.put(key, data);
        imgCache[key] = data;
        if (prev.image && prev.image.startsWith("idb:")) { idb.del(prev.image.slice(4)); delete imgCache[prev.image.slice(4)]; }
        rec.image = "idb:" + key;
      } catch (err) { console.error(err); toast("Couldn't read that image file."); }
    }
    for (const k of Object.keys(rec)) if (rec[k] === "" || (Array.isArray(rec[k]) && !rec[k].length)) delete rec[k];
    rec.id = id;
    S.items[id] = rec; touch(id); save();
    dlg.close(); refresh();
    toast(editingId ? "Saved" : "Added to database");
    if (!editingId) openDrawer(id);
  });
  $("#btn-cancel-edit").onclick = () => dlg.close();
  $("#btn-delete-item").onclick = () => {
    if (!editingId || !confirm("Delete this item from your database?")) return;
    const id = editingId;
    const img = BY_ID[id]?.image;
    if (img && img.startsWith("idb:")) idb.del(img.slice(4));
    if (BASE_IDS.has(id)) S.deleted[id] = true;
    delete S.items[id]; delete S.flags[id]; delete S.notes[id];
    for (const l of S.lists) l.items = l.items.filter(x => x !== id);
    save(); dlg.close(); closeDrawer(); refresh(); toast("Deleted");
  };

  // ---------- compile ----------
  const renderListBadge = () => { const n = activeList().items.filter(id => BY_ID[id]).length; $("#list-count").textContent = n || ""; };
  const renderCompile = () => {
    const l = activeList();
    $("#list-select").innerHTML = S.lists.map(x => `<option value="${esc(x.id)}" ${x.id === l.id ? "selected" : ""}>${esc(x.name)} (${x.items.length})</option>`).join("");
    if (document.activeElement !== $("#list-intro")) $("#list-intro").value = l.intro || "";
    $("#print-title").textContent = l.name;
    $("#print-intro").textContent = l.intro || "";
    const items = l.items.map(id => BY_ID[id]).filter(Boolean);
    $("#compile-items").innerHTML = items.length ? items.map((it, i) => `
      <div class="citem" data-id="${esc(it.id)}">
        <div class="num">${i + 1}</div>
        <div class="thumb">${thumbHTML(it)}</div>
        <div>
          <div class="card-title" style="cursor:pointer" data-open="${esc(it.id)}">${esc(it.title)}</div>
          <div class="card-meta">${esc(TYPES[it.type].label)} · ${esc(metaLine(it))} <span class="card-flags" style="position:static;display:inline-flex">${flagDots(it)}</span></div>
          <div class="ccite">${mdInline(citation(it))}</div>
          ${S.notes[it.id] ? `<div class="cnote">${esc(S.notes[it.id])}</div>` : ""}
        </div>
        <div class="cact">
          <button class="btn small" data-move="-1" ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="btn small" data-move="1" ${i === items.length - 1 ? "disabled" : ""}>↓</button>
          <button class="btn small danger-ghost" data-remove>Remove</button>
        </div>
      </div>`).join("")
      : `<div class="empty">This list is empty. In Browse, click <b>+ List</b> on any card, or open an item and choose <b>Add to list</b>.</div>`;
    renderListBadge();
  };
  const compileExport = fmt => {
    const l = activeList();
    const items = l.items.map(id => BY_ID[id]).filter(Boolean);
    const slug = l.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (fmt === "md") {
      const md = [`# ${l.name}`, "", l.intro || "", "", ...items.flatMap((it, i) => [
        `## ${i + 1}. ${it.title}`, "",
        `- **Type:** ${TYPES[it.type].label}`,
        ...[["Creator", it.creator], ["Date", it.date], ["Institution", it.institution], ["Identifier", it.identifier], ["Materials", it.materials.join(", ")], ["Source", it.sourceUrl]].filter(([, v]) => v).map(([k, v]) => `- **${k}:** ${v}`),
        it.status !== "verified" ? "- **Status:** unverified" : "",
        "", it.description || "", "",
        S.notes[it.id] ? `> ${S.notes[it.id].replace(/\n/g, "\n> ")}\n` : "",
        `*Citation:* ${citation(it)}`, ""
      ]), "## Bibliography", "", ...items.map(it => `- ${citation(it)}`)].join("\n").replace(/\n{3,}/g, "\n\n");
      download(slug + ".md", md, "text/markdown");
    } else if (fmt === "csv") {
      const cols = ["title", "type", "creator", "date", "dateStart", "dateEnd", "institution", "collection", "identifier", "materials", "techniques", "themes", "tags", "description", "sourceUrl", "status"];
      const rows = [[...cols, "flags", "notes", "citation"].join(","), ...items.map(it => [...cols.map(c => csvCell(it[c])), csvCell((S.flags[it.id] || []).map(f => FLAG_BY_ID[f]?.label || f)), csvCell(S.notes[it.id]), csvCell(citation(it))].join(","))];
      download(slug + ".csv", rows.join("\n"), "text/csv");
    } else {
      download(slug + ".json", JSON.stringify({ name: l.name, intro: l.intro, items: items.map(it => ({ ...clean(it), flags: S.flags[it.id] || [], notes: S.notes[it.id] || "", citation: citation(it) })) }, null, 2), "application/json");
    }
  };
  const clean = it => { const o = {}; for (const [k, v] of Object.entries(it)) if (!k.startsWith("_") && v != null && v !== "" && !(Array.isArray(v) && !v.length)) o[k] = v; return o; };

  // ---------- discover (open APIs) ----------
  let discoverResults = [];
  const DISCOVER = {
    async met(q) {
      const s = await (await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(q)}`)).json();
      const ids = (s.objectIDs || []).slice(0, 24);
      const objs = await Promise.allSettled(ids.map(id => fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`).then(r => r.json())));
      return objs.filter(o => o.status === "fulfilled" && o.value && o.value.objectID).map(({ value: o }) => ({
        id: "met-" + o.objectID, type: "object", title: o.title || o.objectName, creator: o.artistDisplayName || o.culture || "",
        date: o.objectDate, dateStart: o.objectBeginDate ?? null, dateEnd: o.objectEndDate ?? null,
        place: [o.city, o.state, o.country].filter(Boolean).join(", "), institution: "The Metropolitan Museum of Art",
        collection: o.department, identifier: o.accessionNumber, materials: o.medium ? o.medium.split(/,\s*/) : [], dimensions: o.dimensions,
        description: [o.classification, o.creditLine].filter(Boolean).join(". "), image: o.primaryImageSmall || o.primaryImage,
        sourceUrl: o.objectURL, status: "verified", tags: ["via Met API"]
      }));
    },
    async aic(q) {
      const r = await (await fetch(`https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&limit=24&fields=id,title,artist_display,date_display,date_start,date_end,medium_display,image_id,place_of_origin,main_reference_number,dimensions,credit_line,artwork_type_title,department_title`)).json();
      const iiif = (r.config && r.config.iiif_url) || "https://www.artic.edu/iiif/2";
      return (r.data || []).map(o => ({
        id: "aic-" + o.id, type: "object", title: o.title, creator: (o.artist_display || "").split("\n")[0], date: o.date_display,
        dateStart: o.date_start ?? null, dateEnd: o.date_end ?? null, place: o.place_of_origin, institution: "Art Institute of Chicago",
        collection: o.department_title, identifier: o.main_reference_number, materials: o.medium_display ? o.medium_display.split(/,\s*/) : [],
        dimensions: o.dimensions, description: [o.artwork_type_title, o.credit_line].filter(Boolean).join(". "),
        image: o.image_id ? `${iiif}/${o.image_id}/full/600,/0/default.jpg` : "", sourceUrl: `https://www.artic.edu/artworks/${o.id}`,
        status: "verified", tags: ["via AIC API"]
      }));
    },
    async openlibrary(q) {
      const r = await (await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=24&fields=key,title,subtitle,author_name,first_publish_year,cover_i,publisher,isbn,place`)).json();
      return (r.docs || []).map(d => ({
        id: "ol-" + d.key.replace(/\W+/g, "-").replace(/^-/, ""), type: "book", title: d.title + (d.subtitle ? ": " + d.subtitle : ""),
        creator: (d.author_name || []).join(", "), date: d.first_publish_year ? String(d.first_publish_year) : "", dateStart: d.first_publish_year ?? null,
        publisher: (d.publisher || [])[0], identifier: d.isbn && d.isbn[0] ? "ISBN " + d.isbn[0] : "",
        image: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : "", sourceUrl: "https://openlibrary.org" + d.key,
        status: "unverified", tags: ["via Open Library"]
      }));
    }
  };
  const runDiscover = async () => {
    const q = $("#dq").value.trim(), src = $("#dsource").value;
    if (!q) return;
    $("#discover-status").textContent = "Searching…"; $("#discover-results").innerHTML = "";
    try {
      discoverResults = await DISCOVER[src](q);
      $("#discover-status").textContent = discoverResults.length ? `${discoverResults.length} results. Click + Add to save one to your database.` : "No results.";
    } catch (err) {
      console.error(err); discoverResults = [];
      $("#discover-status").textContent = "That service couldn't be reached. Check your connection, or use Search elsewhere instead.";
    }
    renderDiscover();
  };
  const renderDiscover = () => {
    $("#discover-results").innerHTML = discoverResults.map(r => {
      const it = norm(r), have = !!BY_ID[r.id];
      return `<article class="card" data-did="${esc(r.id)}">
        <div class="thumb">${thumbHTML(it)}<span class="type-pill">${esc(TYPES[it.type].label)}</span></div>
        <div class="card-body"><div class="card-title">${esc(it.title)}</div><div class="card-meta">${esc(metaLine(it))}</div>
        <div class="card-quick">${have ? `<button class="qbtn on" style="background:var(--sage)" data-open="${esc(r.id)}">✓ In database</button>` : `<button class="qbtn" data-dadd>+ Add</button>`}
        ${safeUrl(r.sourceUrl) ? `<a class="qbtn" href="${esc(safeUrl(r.sourceUrl))}" target="_blank" rel="noopener">Source ↗</a>` : ""}</div></div></article>`;
    }).join("");
  };

  // ---------- sources ----------
  const renderSources = () => {
    const q = $("#sq").value.trim();
    const groups = {};
    for (const s of window.RUG_SOURCES || []) (groups[s.group] = groups[s.group] || []).push(s);
    $("#sources").innerHTML = Object.entries(groups).map(([g, list]) => `<div class="src-group"><h3>${esc(g)}</h3><div class="src-links">${list.map(s => {
      const href = q ? s.url.replace("{q}", encodeURIComponent(q)) : s.home;
      return `<a class="src-link" href="${esc(href)}" target="_blank" rel="noopener">${esc(s.name)} ↗<small>${q ? "Search: " + esc(q) : "Open home page"}</small></a>`;
    }).join("")}</div></div>`).join("");
  };

  // ---------- export / backup ----------
  const exportDb = async () => {
    const items = ITEMS.map(it => {
      const o = clean(it);
      if (o.image && o.image.startsWith("idb:")) o.image = imgCache[o.image.slice(4)] || ""; // embed uploaded photos
      return o;
    });
    const header = `// Rug Research Database: exported ${new Date().toISOString().slice(0, 10)}. Replace data/items.js with this file and commit.\n`;
    download("items.js", header + "window.RUG_ITEMS = " + JSON.stringify(items, null, 2) + ";\n", "text/javascript");
  };
  const exportBackup = async () => {
    const images = await idb.all().catch(() => ({}));
    download(`rug-research-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ ...S, images }, null, 1), "application/json");
  };
  const restoreBackup = async file => {
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.version !== 1) throw new Error("Not a Rug Research backup file");
      if (!confirm("Replace your current flags, notes, lists and edits with this backup?")) return;
      const { images = {}, ...rest } = data;
      S = Object.assign(blankState(), rest);
      for (const [k, v] of Object.entries(images)) { await idb.put(k, v); imgCache[k] = v; }
      save(); refresh(); toast("Backup restored");
    } catch (e) { alert("Couldn't restore: " + e.message); }
  };

  // ---------- views ----------
  let currentView = "browse";
  const setView = v => {
    currentView = v;
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === v));
    $$(".view").forEach(s => (s.hidden = s.id !== "view-" + v));
    if (v === "browse" || v === "timeline") renderBrowse();
    if (v === "compile") renderCompile();
    if (v === "sources") { if (!$("#sq").value) $("#sq").value = parseQuery(S.ui.q).terms.join(" "); renderSources(); }
    if (v === "discover" && !$("#dq").value) $("#dq").value = parseQuery(S.ui.q).terms.join(" ");
    try { history.replaceState(null, "", "#" + v); } catch {}
    window.scrollTo(0, 0);
  };

  // ---------- events ----------
  $$(".tab").forEach(t => (t.onclick = () => setView(t.dataset.view)));
  const q = $("#q");
  q.value = S.ui.q || "";
  q.addEventListener("input", debounce(() => { S.ui.q = q.value; save(); renderBrowse(); }, 120));
  $("#sort").value = S.ui.sort || "relevance";
  $("#sort").onchange = e => { S.ui.sort = e.target.value; save(); renderBrowse(); };
  $$(".seg-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.layout === S.ui.layout);
    b.onclick = () => { S.ui.layout = b.dataset.layout; $$(".seg-btn").forEach(x => x.classList.toggle("active", x === b)); save(); renderBrowse(); };
  });

  $("#facets").addEventListener("change", e => {
    const cb = e.target.closest("[data-facet]"); if (!cb) return;
    const set = F[cb.dataset.facet]; cb.checked ? set.add(cb.value) : set.delete(cb.value); renderBrowse();
  });
  $("#facets").addEventListener("click", e => {
    const b = e.target.closest("[data-more]"); if (!b) return;
    const k = "open" + b.dataset.more; $("#facets").dataset[k] = $("#facets").dataset[k] === "1" ? "0" : "1"; renderBrowse();
  });
  $("#active-filters").addEventListener("click", e => {
    if (e.target.id === "clear-facets") { Object.values(F).forEach(s => s.clear()); renderBrowse(); }
    const b = e.target.closest("[data-unfacet]"); if (b) { F[b.dataset.unfacet].delete(b.dataset.val); renderBrowse(); }
  });

  // card interactions (browse, timeline)
  const onCardClick = e => {
    const goto = e.target.closest("[data-goto]"); if (goto) { e.preventDefault(); setView(goto.dataset.goto); return; }
    const card = e.target.closest(".card[data-id]"); if (!card) return;
    const id = card.dataset.id;
    const qf = e.target.closest("[data-qflag]"); if (qf) { e.stopPropagation(); toggleFlag(id, qf.dataset.qflag); return; }
    if (e.target.closest("[data-qlist]")) { e.stopPropagation(); toggleInList(id); return; }
    openDrawer(id);
  };
  $("#results").addEventListener("click", onCardClick);
  $("#timeline").addEventListener("click", onCardClick);
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.matches(".card[data-id]")) openDrawer(e.target.dataset.id);
    if (e.key === "Escape" && drawerId && !dlg.open) closeDrawer();
    if (e.key === "/" && !e.target.matches("input, textarea, select")) { e.preventDefault(); setView("browse"); q.focus(); }
  });

  // drawer
  $("#scrim").onclick = closeDrawer;
  $("#drawer").addEventListener("click", e => {
    if (e.target.closest("[data-close]")) return closeDrawer();
    const ed = e.target.closest("[data-edit]"); if (ed) return openEdit(ed.dataset.edit);
    const f = e.target.closest("[data-flag]"); if (f) return toggleFlag(drawerId, f.dataset.flag);
    const ul = e.target.closest("[data-unlist]"); if (ul) return toggleInList(drawerId, ul.dataset.unlist);
    if (e.target.id === "copy-cite") {
      navigator.clipboard?.writeText(citation(BY_ID[drawerId]).replace(/\*/g, "")).then(() => toast("Citation copied"), () => toast("Copy failed"));
    }
  });
  $("#drawer").addEventListener("change", e => {
    if (e.target.id !== "drawer-list-add" || !e.target.value) return;
    let listId = e.target.value;
    if (listId === "__new") { const l = newList(); if (!l) { e.target.value = ""; return; } listId = l.id; }
    toggleInList(drawerId, listId);
  });
  const saveNotes = debounce(v => { const id = drawerId; if (!id) return; if (v.trim()) S.notes[id] = v; else delete S.notes[id]; touch(id); save(); rebuild(); }, 300);
  $("#drawer").addEventListener("input", e => { if (e.target.id === "drawer-notes") saveNotes(e.target.value); });

  $("#toggle-facets").onclick = () => $("#facets").classList.toggle("open");

  // add / export menu
  $("#btn-add").onclick = () => openEdit(null);
  $("#btn-export").onclick = e => { e.stopPropagation(); $("#export-menu").hidden = !$("#export-menu").hidden; };
  document.addEventListener("click", e => { if (!e.target.closest(".menu")) $("#export-menu").hidden = true; });
  $("#export-menu").addEventListener("click", e => {
    const b = e.target.closest("[data-export]"); if (!b) return;
    $("#export-menu").hidden = true;
    const k = b.dataset.export;
    if (k === "db") exportDb();
    if (k === "backup") exportBackup();
    if (k === "restore") $("#restore-file").click();
    if (k === "csv-all") {
      const cols = ["id", "title", "type", "creator", "date", "dateStart", "dateEnd", "institution", "collection", "identifier", "materials", "techniques", "themes", "tags", "description", "sourceUrl", "status"];
      download("rug-research-results.csv", [[...cols, "flags", "notes"].join(","), ...lastResults.map(it => [...cols.map(c => csvCell(it[c])), csvCell(S.flags[it.id]), csvCell(S.notes[it.id])].join(","))].join("\n"), "text/csv");
    }
  });
  $("#restore-file").onchange = e => { const f = e.target.files[0]; if (f) restoreBackup(f); e.target.value = ""; };

  // compile
  $("#list-select").onchange = e => { S.activeList = e.target.value; save(); renderCompile(); };
  $("#btn-new-list").onclick = () => { if (newList()) renderCompile(); };
  $("#btn-rename-list").onclick = () => { const l = activeList(); const n = prompt("Rename list:", l.name); if (n) { l.name = n; save(); renderCompile(); } };
  $("#btn-delete-list").onclick = () => {
    const l = activeList();
    if (S.lists.length === 1) return toast("You need at least one list.");
    if (!confirm(`Delete the list "${l.name}"? Items stay in the database.`)) return;
    S.lists = S.lists.filter(x => x !== l); S.activeList = S.lists[0].id; save(); renderCompile();
  };
  $("#list-intro").addEventListener("input", debounce(e => { activeList().intro = e.target.value; $("#print-intro").textContent = e.target.value; save(); }, 300));
  $("#compile-items").addEventListener("click", e => {
    const row = e.target.closest(".citem"); if (!row) return;
    const id = row.dataset.id, l = activeList(), i = l.items.indexOf(id);
    if (e.target.closest("[data-open]")) return openDrawer(id);
    const mv = e.target.closest("[data-move]");
    if (mv) { const j = i + Number(mv.dataset.move); if (j >= 0 && j < l.items.length) { [l.items[i], l.items[j]] = [l.items[j], l.items[i]]; save(); renderCompile(); } }
    if (e.target.closest("[data-remove]")) { l.items.splice(i, 1); save(); renderCompile(); }
  });
  $$("[data-cexport]").forEach(b => (b.onclick = () => compileExport(b.dataset.cexport)));
  $("#btn-print").onclick = () => window.print();

  // discover
  $("#btn-discover").onclick = runDiscover;
  $("#dq").addEventListener("keydown", e => { if (e.key === "Enter") runDiscover(); });
  $("#discover-results").addEventListener("click", e => {
    const o = e.target.closest("[data-open]"); if (o) return openDrawer(o.dataset.open);
    if (!e.target.closest("[data-dadd]")) return;
    const id = e.target.closest("[data-did]").dataset.did;
    const r = discoverResults.find(x => x.id === id); if (!r) return;
    const rec = clean(norm(r)); rec.themes = [];
    S.items[id] = rec; touch(id); save(); refresh(); toast("Added. Open it to flag, note or set a theme.");
  });

  // sources
  $("#sq").addEventListener("input", debounce(renderSources, 150));

  // ---------- boot ----------
  rebuild();
  const VIEWS = ["browse", "timeline", "compile", "discover", "sources"];
  const viewFromHash = () => { const v = (location.hash || "").slice(1); return VIEWS.includes(v) ? v : "browse"; };
  window.addEventListener("hashchange", () => { if (viewFromHash() !== currentView) setView(viewFromHash()); });
  setView(viewFromHash());
  idb.all().then(all => { Object.assign(imgCache, all); if (Object.keys(all).length) refresh(); }).catch(() => {});
})();
