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
    { id: "fellowship", label: "Winterthur fellowship", color: "var(--cloth-oxblood)" },
    { id: "tufting",    label: "History of tufting",    color: "var(--cloth-navy)" },
    { id: "followup",   label: "Follow up or verify",   color: "var(--cloth-ochre)" },
    { id: "request",    label: "Request or visit",      color: "var(--cloth-moss)" },
    { id: "image",      label: "Need image rights",     color: "var(--cloth-plum)" }
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
    // A local edit keeps any image the committed database has since gained (e.g. from the image lookup).
    const list = BASE.filter(x => !S.deleted[x.id]).map(x => {
      const o = S.items[x.id];
      return !o ? x : o.image ? o : { ...o, image: x.image, imageCredit: x.imageCredit };
    });
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
      // Mark matches at the start of words only, so "bed" doesn't light up inside "inscribed".
      html = html.replace(new RegExp("(^|[^\\p{L}\\p{N}])(" + esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "igu"), "$1<mark>$2</mark>");
    }
    return html;
  };

  // ---------- bookcloth: every research theme has a cloth colour ----------
  const THEME_CLOTH = {
    "Early tufting: bed rugs & needlework pile": "oxblood", "Hooked & handmade rugs": "moss", "Woven carpet": "navy",
    "Chenille & candlewick": "rose", "Machine tufting & Dalton": "ochre", "Nylon & synthetic fibers (DuPont)": "teal",
    "Trade catalogs & marketing": "slate", "Tools & equipment": "umber", "Yarn & materials": "plum"
  };
  const SPARE_CLOTH = ["navy", "moss", "plum", "teal", "umber", "slate", "rose", "ochre"];
  const cloth = theme => `var(--cloth-${THEME_CLOTH[theme] || (theme ? SPARE_CLOTH[hash(theme) % SPARE_CLOTH.length] : "grey")})`;
  const itemCloth = it => cloth(it.themes[0]);
  const icon = (name, cls = "") => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  // An honest empty plate: bare bookcloth stamped with what the record is. Never a fake picture.
  const boardPlate = it => `<div class="board-plate" style="--c:${itemCloth(it)}" aria-hidden="true">
      <span class="bp-tape"><span class="bp-type">${esc(TYPES[it.type].label)}</span></span>
      <span class="bp-title">${esc(it.title || "")}</span>
      <span class="bp-note">${it.sourceUrl ? "No image found yet" : "No image"}</span></div>`;
  const plateHTML = (it, alt = "") => {
    const src = imgSrc(it);
    return src
      ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback="${esc(boardPlate(it))}">`
      : boardPlate(it);
  };
  // Broken remote images fall back to the board plate.
  document.addEventListener("error", e => {
    const img = e.target;
    if (img.tagName === "IMG" && img.dataset.fallback) img.replaceWith(document.createRange().createContextualFragment(img.dataset.fallback));
  }, true);

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
  const flagDots = it => (S.flags[it.id] || []).map(f => FLAG_BY_ID[f] ? `<span class="flag-dot" title="${esc(FLAG_BY_ID[f].label)}" style="--c:${FLAG_BY_ID[f].color}"></span>` : "").join("");
  const activeList = () => S.lists.find(l => l.id === S.activeList) || S.lists[0];
  const colorway = it => it.themes.length ? `<span class="colorway" title="${esc(it.themes.join(", "))}">${it.themes.slice(0, 3).map(t => `<i style="--c:${cloth(t)}"></i>`).join("")}</span>` : "";

  const cardHTML = (it, terms = []) => {
    const fl = S.flags[it.id] || [];
    const inList = activeList().items.includes(it.id);
    const act = (on, attr, ic, label, c) => `<button class="act ${on ? "on" : ""}" ${attr} style="--c:${c}" aria-pressed="${on}" aria-label="${esc(label)}" title="${esc(label)}">${icon(ic)}</button>`;
    const sub = [it.institution, it.identifier ? `<span class="num">${highlight(it.identifier, terms)}</span>` : ""].filter(Boolean);
    return `<article class="card" data-id="${esc(it.id)}">
      <button class="card-open" data-open="${esc(it.id)}">
        <span class="plate">${plateHTML(it)}<span class="plate-flags">${flagDots(it)}</span></span>
        <span class="label">
          <span class="label-top">${colorway(it)}<span>${esc(TYPES[it.type].label)}</span>${it.date ? `<span>${esc(it.date)}</span>` : ""}${it.status === "verified" ? `<span class="verified">${icon("check")}Verified</span>` : ""}</span>
          <h3>${highlight(it.title || "Untitled", terms)}</h3>
          ${sub.length ? `<span class="meta">${sub.map(s => s.startsWith("<") ? s : highlight(s, terms)).join(" · ")}</span>` : ""}
        </span>
      </button>
      <div class="card-actions ${fl.length || inList ? "has-on" : ""}">
        ${act(fl.includes("fellowship"), 'data-qflag="fellowship"', "star", "Flag for Winterthur fellowship", FLAG_BY_ID.fellowship.color)}
        ${act(fl.includes("tufting"), 'data-qflag="tufting"', "flag", "Flag for History of tufting", FLAG_BY_ID.tufting.color)}
        ${act(inList, "data-qlist", "bookmark", inList ? `Remove from "${activeList().name}"` : `Add to "${activeList().name}"`, "var(--ink)")}
      </div></article>`;
  };

  const renderFacets = scoredAll => {
    const defs = [
      ["flag", "Flags", v => v === "(unflagged)" ? "Not flagged" : FLAG_BY_ID[v]?.label || v, v => FLAG_BY_ID[v] && `<span class="flag-dot" style="--c:${FLAG_BY_ID[v].color}"></span>`],
      ["theme", "Research themes", v => v, v => `<span class="cloth-dot" style="--c:${cloth(v)}"></span>`],
      ["type", "Kinds of record", v => TYPES[v]?.plural || v],
      ["inst", "Held by", v => v === "(none)" ? "No institution" : v],
      ["status", "Checked", v => v === "verified" ? "Verified at source" : "Not yet verified"]
    ];
    $("#facets").innerHTML = defs.map(([key, title, label, mark]) => {
      const counts = new Map();
      for (const it of scoredAll) if (passFacets(it, key)) for (const v of new Set(facetValues[key](it))) counts.set(v, (counts.get(v) || 0) + 1);
      for (const v of F[key]) if (!counts.has(v)) counts.set(v, 0);
      if (key === "flag") for (const f of FLAGS) if (!counts.has(f.id)) counts.set(f.id, 0);
      const order = key === "flag" ? [...FLAGS.map(f => f.id), "(unflagged)"] : null;
      const entries = [...counts].sort((a, b) => order ? order.indexOf(a[0]) - order.indexOf(b[0]) : b[1] - a[1] || String(label(a[0])).localeCompare(label(b[0])));
      if (!entries.length) return "";
      const expanded = $("#facets").dataset["open" + key] === "1";
      const limit = key === "flag" || key === "theme" ? 20 : 7;
      const shown = expanded ? entries : entries.slice(0, limit);
      return `<div class="facet" role="group" aria-labelledby="fh-${key}"><h2 id="fh-${key}">${title}</h2>${shown.map(([v, n]) => `<label class="${n ? "" : "zero"}"><input type="checkbox" data-facet="${key}" value="${esc(v)}" ${F[key].has(v) ? "checked" : ""}>${mark ? mark(v) || "" : ""}<span class="fl">${esc(label(v))}</span><span class="count">${n}</span></label>`).join("")}
        ${entries.length > limit ? `<button class="more" data-more="${key}">${expanded ? "Show fewer" : `Show all ${entries.length}`}</button>` : ""}</div>`;
    }).join("");
  };

  // Fore-edge: every result as a leaf on a date axis, coloured by its theme's cloth.
  const renderForeedge = () => {
    const dated = lastResults.filter(it => it.dateStart != null);
    const fe = $("#foreedge"), axis = $("#foreedge-axis");
    if (!dated.length) { fe.innerHTML = `<div class="foreedge-empty">No dated records in these results</div>`; axis.innerHTML = ""; return; }
    const step = 50;
    let lo = Math.floor(Math.min(...dated.map(it => it.dateStart)) / step) * step;
    let hi = Math.ceil(Math.max(...dated.map(it => it.dateEnd ?? it.dateStart)) / step) * step;
    if (hi - lo < 100) { lo -= step; hi += step; }
    const x = y => ((y - lo) / (hi - lo)) * 100;
    fe.innerHTML = dated.map(it => {
      const s = it.dateStart, e = it.dateEnd ?? s, mid = (s + e) / 2;
      const span = e - s >= 15 ? `<span class="leaf span" style="left:${x(s)}%;width:${x(e) - x(s)}%;--c:${itemCloth(it)}"></span>` : "";
      return `${span}<button class="leaf" tabindex="-1" style="left:${x(mid)}%;--c:${itemCloth(it)}" data-open="${esc(it.id)}" title="${esc(`${it.date || s} · ${it.title}`)}" aria-label="${esc(it.title)}"></button>`;
    }).join("");
    const ticks = [];
    const narrow = fe.clientWidth < 560;
    const every = (hi - lo > 250 ? 50 : 25) * (narrow ? 2 : 1);
    for (let y = lo; y <= hi; y += every) ticks.push(`<span style="left:${x(y)}%">${y}</span>`);
    axis.innerHTML = ticks.join("");
  };

  const renderBrowse = () => {
    const { pq, scored } = runSearch();
    renderFacets(scored);
    const res = $("#results");
    res.className = "grid" + (S.ui.layout === "list" ? " list" : "");
    const filtered = Object.values(F).some(s => s.size);
    res.innerHTML = lastResults.length ? lastResults.map(it => cardHTML(it, pq.terms)).join("")
      : `<div class="empty"><h2>Nothing matches${S.ui.q ? ` “${esc(S.ui.q)}”` : ""}</h2>
         <p>${filtered ? "Some filters are switched on. Clear them, or" : "Try fewer or different words, or"} look for it outside your database.</p>
         <div class="btns">${filtered ? `<button class="btn" id="clear-facets-empty">Clear filters</button>` : ""}<a class="btn" href="#sources">Search other archives</a><a class="btn" href="#discover">Search open collections</a></div></div>`;
    $("#result-count").innerHTML = lastResults.length === ITEMS.length ? `<b>${ITEMS.length}</b> records` : `<b>${lastResults.length}</b> of ${ITEMS.length} records`;
    const chips = [];
    for (const [k, set] of Object.entries(F)) for (const v of set) chips.push(`<span class="chip">${esc(k === "type" ? TYPES[v]?.label : k === "flag" ? FLAG_BY_ID[v]?.label || "Not flagged" : v)}<button data-unfacet="${k}" data-val="${esc(v)}" aria-label="Remove filter">${icon("x")}</button></span>`);
    if (chips.length > 1) chips.push(`<button class="link-btn" id="clear-facets">Clear all</button>`);
    $("#active-filters").innerHTML = chips.join("");
    renderForeedge();
    renderListBadge();
    if (currentView === "timeline") renderTimeline();
  };

  // ---------- timeline ----------
  const renderTimeline = () => {
    const dated = lastResults.filter(it => it.dateStart != null).sort((a, b) => a.dateStart - b.dateStart);
    const undated = lastResults.length - dated.length;
    const groups = new Map();
    for (const it of dated) { const d = Math.floor(it.dateStart / 10) * 10; if (!groups.has(d)) groups.set(d, []); groups.get(d).push(it); }
    const decades = [...groups.keys()];
    const out = [];
    decades.forEach((d, i) => {
      if (i && d - decades[i - 1] > 20) out.push(`<p class="gap-note">No records from ${decades[i - 1] + 10} to ${d - 1}.</p>`);
      const items = groups.get(d);
      out.push(`<section class="decade"><h2 class="decade-label">${d}s<small>${items.length} record${items.length > 1 ? "s" : ""}</small></h2><div class="grid">${items.map(it => cardHTML(it)).join("")}</div></section>`);
    });
    $("#timeline").innerHTML = (out.length ? out.join("") : `<div class="empty"><h2>No dated records match</h2><p>Change your search in Browse, or add start years to your records.</p></div>`)
      + (undated ? `<p class="gap-note">${undated} matching record${undated > 1 ? "s have" : " has"} no start year, so ${undated > 1 ? "they aren't" : "it isn't"} shown. Add a start year to place ${undated > 1 ? "them" : "it"} here.</p>` : "");
  };

  // ---------- drawer ----------
  let drawerId = null, drawerReturn = null;
  const openDrawer = id => {
    const it = BY_ID[id]; if (!it) return;
    if (!drawerId) drawerReturn = document.activeElement;
    drawerId = id;
    const fl = S.flags[id] || [];
    const src = imgSrc(it);
    const fields = [
      ["Maker", it.creator], ["Date", it.date || it.dateStart], ["Place", it.place],
      ["Held by", it.institution], ["Collection", it.collection], ["Number", it.identifier], ["Publisher", it.publisher],
      ["Materials", it.materials.join(", ")], ["Techniques", it.techniques.join(", ")], ["Dimensions", it.dimensions],
      ["Themes", it.themes.join(", ")], ["Tags", it.tags.join(", ")]
    ].filter(([, v]) => v);
    const q = encodeURIComponent([it.title, it.creator].filter(Boolean).join(" "));
    const lists = S.lists.filter(l => l.items.includes(id));
    const credit = it.imageCredit || (src && !src.startsWith("data:") && !src.startsWith("blob:") && it.institution) || "";
    $("#drawer").innerHTML = `
      <div class="drawer-bar">
        <span class="label-top">${colorway(it)}<span>${esc(TYPES[it.type].label)}</span>${it.status === "verified" ? `<span class="verified">${icon("check")}Verified</span>` : ""}</span>
        <span class="spacer"></span>
        <button class="btn sm" data-edit="${esc(id)}">${icon("edit")}Edit</button>
        <button class="icon-btn" data-close aria-label="Close details">${icon("x")}</button>
      </div>
      <div class="drawer-plate">${src ? `<a href="${esc(src)}" target="_blank" rel="noopener" aria-label="Open full image">${plateHTML(it, it.title)}</a>` : `<div class="plate-board">${boardPlate(it)}</div>`}</div>
      ${src && credit ? `<p class="credit">Image: ${esc(credit)}</p>` : ""}
      <div class="drawer-body">
        <h2 id="drawer-title">${esc(it.title)}</h2>
        <p class="sub">${esc(metaLine(it))}</p>
        <div class="btn-row">
          ${it.sourceUrl && safeUrl(it.sourceUrl) ? `<a class="btn primary" href="${esc(safeUrl(it.sourceUrl))}" target="_blank" rel="noopener">View at source${icon("external")}</a>` : ""}
          <button class="btn" id="copy-cite">${icon("copy")}Copy citation</button>
        </div>
        ${it.description ? `<p class="desc">${esc(it.description)}</p>` : ""}
        ${it.status !== "verified" ? `<div class="unverified-note">${icon("flag")}<span>Not yet checked against the institution's own record. Confirm the details, then mark it verified with <b>Edit</b>.</span></div>` : ""}
        <dl class="fields">${fields.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>

        <section class="dsec"><h3>Flags</h3>
          <div class="toggles">${FLAGS.map(f => `<button class="toggle" data-flag="${f.id}" aria-pressed="${fl.includes(f.id)}" style="--c:${f.color}"><span class="flag-dot" style="--c:${f.color}"></span>${esc(f.label)}</button>`).join("")}</div>
        </section>

        <section class="dsec"><h3>Lists</h3>
          <div class="list-add">
            ${lists.map(l => `<span class="chip">${esc(l.name)}<button data-unlist="${esc(l.id)}" aria-label="Remove from ${esc(l.name)}">${icon("x")}</button></span>`).join("")}
            <label class="select"><span class="vh">Add to a list</span><select id="drawer-list-add"><option value="">Add to a list…</option>${S.lists.filter(l => !l.items.includes(id)).map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("")}<option value="__new">New list…</option></select></label>
          </div>
        </section>

        <section class="dsec"><h3><label for="drawer-notes">My notes</label> <span class="saved" id="notes-saved"></span></h3>
          <textarea class="notes" id="drawer-notes" placeholder="Why this matters, what to check, quotes, page numbers…">${esc(S.notes[id] || "")}</textarea>
        </section>

        <section class="dsec"><h3>Citation</h3>
          <div class="citation">${mdInline(citation(it))}</div>
        </section>

        <section class="dsec"><h3>Search for this elsewhere</h3>
          <div class="searchlinks">${(window.RUG_SOURCES || []).slice(0, 12).map(s => `<a href="${esc(s.url.replace("{q}", q))}" target="_blank" rel="noopener">${esc(s.group === "Museums" || s.group === "Books & texts" ? s.name : s.group + " " + s.name.toLowerCase())}</a>`).join("")}</div>
        </section>
      </div>`;
    $("#drawer").setAttribute("aria-labelledby", "drawer-title");
    const wasHidden = $("#drawer").hidden;
    $("#drawer").hidden = false; $("#scrim").hidden = false;
    if (wasHidden) { $("#drawer").scrollTop = 0; $("#drawer").focus({ preventScroll: true }); }
  };
  const closeDrawer = () => {
    $("#drawer").hidden = true; $("#scrim").hidden = true; drawerId = null;
    if (drawerReturn && document.contains(drawerReturn)) drawerReturn.focus({ preventScroll: true });
    drawerReturn = null;
  };

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
  $("#btn-cancel-edit").onclick = $("#btn-x-edit").onclick = () => dlg.close();
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
      <article class="citem" data-id="${esc(it.id)}">
        <div class="n">${i + 1}</div>
        <div class="plate">${plateHTML(it)}</div>
        <div>
          <h3><button data-open="${esc(it.id)}">${esc(it.title)}</button></h3>
          <div class="label-top">${colorway(it)}<span>${esc(TYPES[it.type].label)}</span>${it.date ? `<span>${esc(it.date)}</span>` : ""}${it.institution ? `<span>${esc(it.institution)}</span>` : ""}<span class="plate-flags" style="position:static">${flagDots(it)}</span></div>
          <p class="ccite">${mdInline(citation(it))}</p>
          ${S.notes[it.id] ? `<div class="cnote">${esc(S.notes[it.id])}</div>` : ""}
        </div>
        <div class="cact">
          <button class="icon-btn" data-move="-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">${icon("up")}</button>
          <button class="icon-btn" data-move="1" ${i === items.length - 1 ? "disabled" : ""} aria-label="Move down">${icon("down")}</button>
          <button class="icon-btn" data-remove aria-label="Remove from list">${icon("x")}</button>
        </div>
      </article>`).join("")
      : `<div class="empty"><h2>This list is empty</h2><p>In Browse, use the ${icon("bookmark", "sm")} button on any record, or open a record and choose <b>Add to a list</b>.</p><div class="btns"><a class="btn" href="#browse">Go to Browse</a></div></div>`;
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
    const status = $("#discover-status");
    if (!q) { status.textContent = "Type something to search for."; $("#dq").focus(); return; }
    status.className = "status"; status.textContent = "Searching…";
    $("#discover-results").innerHTML = Array.from({ length: 8 }, () => `<div class="card skel" aria-hidden="true"><div class="plate"></div><div class="bar"></div><div class="bar short"></div></div>`).join("");
    $("#btn-discover").disabled = true;
    try {
      discoverResults = await DISCOVER[src](q);
      status.textContent = discoverResults.length ? `${discoverResults.length} results. Add the ones you want to keep.` : `No results for “${q}”. Try a broader word, or another collection.`;
    } catch (err) {
      console.error(err); discoverResults = [];
      status.className = "status error";
      status.textContent = "That collection couldn't be reached. Check your connection and try again, or use Other archives.";
    }
    $("#btn-discover").disabled = false;
    renderDiscover();
  };
  const renderDiscover = () => {
    $("#discover-results").innerHTML = discoverResults.map(r => {
      const it = norm(r), have = !!BY_ID[r.id];
      return `<article class="card" data-did="${esc(r.id)}">
        <a class="card-open" href="${esc(safeUrl(r.sourceUrl) || "#")}" target="_blank" rel="noopener">
          <span class="plate">${plateHTML(it)}</span>
          <span class="label"><span class="label-top"><span>${esc(TYPES[it.type].label)}</span>${it.date ? `<span>${esc(it.date)}</span>` : ""}</span>
          <h3>${esc(it.title)}</h3><span class="meta">${esc([it.creator, it.institution].filter(Boolean).join(" · "))}</span></span>
        </a>
        <div class="add-btn">${have ? `<button class="btn sm" data-open="${esc(r.id)}">${icon("check")}Added</button>` : `<button class="btn sm primary" data-dadd>${icon("plus")}Add</button>`}</div>
      </article>`;
    }).join("");
  };

  // ---------- sources ----------
  const renderSources = () => {
    const q = $("#sq").value.trim();
    const groups = {};
    for (const s of window.RUG_SOURCES || []) (groups[s.group] = groups[s.group] || []).push(s);
    $("#sources").innerHTML = Object.entries(groups).map(([g, list]) => `<section class="src-group"><h2>${esc(g)}</h2><div class="src-links">${list.map(s => {
      const href = q ? s.url.replace("{q}", encodeURIComponent(q)) : s.home;
      return `<a class="src-link" href="${esc(href)}" target="_blank" rel="noopener"><span><strong>${esc(s.name)}</strong><small>${q ? "Search for “" + esc(q) + "”" : "Open the collection"}</small></span>${icon("external")}</a>`;
    }).join("")}</div></section>`).join("");
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
    $$(".tab").forEach(t => t.dataset.view === v ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current"));
    $$(".view").forEach(s => (s.hidden = s.id !== "view-" + v));
    if (v === "browse" || v === "timeline") renderBrowse();
    if (v === "compile") renderCompile();
    if (v === "sources") { if (!$("#sq").value) $("#sq").value = parseQuery(S.ui.q).terms.join(" "); renderSources(); }
    if (v === "discover" && !$("#dq").value) $("#dq").value = parseQuery(S.ui.q).terms.join(" ");
    try { history.replaceState(null, "", "#" + v); } catch {}
    window.scrollTo(0, 0);
  };

  // ---------- events ----------
  const q = $("#q");
  q.value = S.ui.q || "";
  q.addEventListener("input", debounce(() => { S.ui.q = q.value; save(); renderBrowse(); }, 120));
  $("#sort").value = S.ui.sort || "relevance";
  $("#sort").onchange = e => { S.ui.sort = e.target.value; save(); renderBrowse(); };
  const syncLayout = () => $$(".seg-btn").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.layout === S.ui.layout)));
  syncLayout();
  $$(".seg-btn").forEach(b => (b.onclick = () => { S.ui.layout = b.dataset.layout; syncLayout(); save(); renderBrowse(); }));
  $$(".tip").forEach(b => (b.onclick = () => { q.value = b.dataset.q; S.ui.q = q.value; save(); renderBrowse(); q.focus(); }));

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
    if (e.target.closest("#clear-facets-empty")) { Object.values(F).forEach(s => s.clear()); renderBrowse(); return; }
    const card = e.target.closest(".card[data-id]"); if (!card) return;
    const id = card.dataset.id;
    const qf = e.target.closest("[data-qflag]"); if (qf) { toggleFlag(id, qf.dataset.qflag); return; }
    if (e.target.closest("[data-qlist]")) { toggleInList(id); return; }
    if (e.target.closest("[data-open]")) openDrawer(id);
  };
  $("#results").addEventListener("click", onCardClick);
  $("#timeline").addEventListener("click", onCardClick);
  $("#foreedge").addEventListener("click", e => { const b = e.target.closest("[data-open]"); if (b) openDrawer(b.dataset.open); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !$("#export-menu").hidden) { $("#export-menu").hidden = true; $("#btn-export").setAttribute("aria-expanded", "false"); $("#btn-export").focus(); return; }
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
  const saveNotes = debounce(v => {
    const id = drawerId; if (!id) return;
    if (v.trim()) S.notes[id] = v; else delete S.notes[id];
    touch(id); save(); rebuild();
    const m = $("#notes-saved"); if (m) m.textContent = "Saved";
  }, 400);
  $("#drawer").addEventListener("input", e => { if (e.target.id === "drawer-notes") saveNotes(e.target.value); });

  $("#toggle-facets").onclick = e => { const open = $("#facets").classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", String(open)); };

  // add / export menu
  $("#btn-add").onclick = () => openEdit(null);
  const setMenu = open => { $("#export-menu").hidden = !open; $("#btn-export").setAttribute("aria-expanded", String(open)); if (open) $("#export-menu button").focus(); };
  $("#btn-export").onclick = e => { e.stopPropagation(); setMenu($("#export-menu").hidden); };
  document.addEventListener("click", e => { if (!e.target.closest(".menu")) setMenu(false); });
  $("#export-menu").addEventListener("click", e => {
    const b = e.target.closest("[data-export]"); if (!b) return;
    setMenu(false);
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
