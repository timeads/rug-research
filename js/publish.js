/* Publish to the site: commits this browser's changes to the research database straight to GitHub.
 *
 * plan()   merges the browser's changes into the database as it is published now, field by field:
 *          a field you changed since your copy was made is taken, unless the published record has
 *          changed that same field too (a conflict: the published value stays, and you are told).
 * commit() writes the merged files, plus any photos uploaded in this browser, to GitHub in one commit,
 *          and retries from fresh if something else was committed meanwhile.
 *
 * Pure functions, no page state: js/app.js supplies the browser's changes and shows the results.
 * Exposed as window.RugPublish; also loadable in Node for tests (module.exports).
 */
(root => {
  "use strict";

  // Fields that belong to a record's picture: a local copy without its own picture keeps the published one.
  const IMG_KEYS = new Set(["image", "imageCredit", "imagePage", "imageSource", "rights", "images", "imageRole", "imageCaption"]);
  const empty = v => v === "" || v == null || (Array.isArray(v) && !v.length);
  const val = v => (empty(v) ? undefined : v);
  const same = (a, b) => JSON.stringify(val(a)) === JSON.stringify(val(b));
  const clean = o => { const c = {}; for (const [k, v] of Object.entries(o || {})) if (!k.startsWith("_") && !empty(v)) c[k] = v; return c; };
  // A published value that only adds to yours (a note appended, tags added) already includes your change.
  const extendsMine = (pub, mine) => typeof pub === "string" && typeof mine === "string" ? pub.length > mine.length && pub.startsWith(mine)
    : Array.isArray(pub) && Array.isArray(mine) ? pub.length > mine.length && mine.every(v => pub.includes(v)) : false;
  const urlKey = u => String(u || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[/#?]+$/, "");
  const titleKey = t => String(t || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  // Which records each chapter of the public site uses: its citations, pictures, quotations, hero and key
  // dates. chapters: [{ page, src }] (the .mdx files). Returns { id: ["Chapter 4", ...] }.
  const citedIn = chapters => {
    const out = {};
    for (const { page, src } of chapters) {
      const num = (String(src).match(/^number:\s*(\d+)/m) || [])[1];
      const label = num ? `Chapter ${num}` : page;
      const ids = new Set();
      for (const [, g] of String(src).matchAll(/\[(@[^\]]+)\]/g)) for (const part of g.split(";")) ids.add(part.trim().replace(/^@/, "").split(",")[0].trim());
      for (const [, id] of String(src).matchAll(/\b(?:id|from)="([^"]+)"/g)) ids.add(id);
      for (const [, id] of String(src).matchAll(/\brecord:\s*"?([\w-]+)"?/g)) ids.add(id);
      for (const id of ids) (out[id] = out[id] || []).includes(label) || out[id].push(label);
    }
    return out;
  };
  // Runs a data file (window.X = ...) and returns what it set.
  const readWindow = src => { const w = {}; new Function("window", src)(w); return w; };

  /**
   * local: { items: {id: record}, base: {id: record}, deleted: {id: true}, transcripts: {id: {text, file, added}},
   *          photos: {id: {"idb:key": dataUrl}} (photos uploaded in this browser, main picture and gallery) }
   * published: { items: [...], removed: {id: iso}, transcripts: {id: {...}} } (as on GitHub now)
   * loaded: {id: record}: the published records as this page loaded them, the fallback when an edit has no
   *          snapshot of the record it started from.
   * choose: { skip: Set of ids not to publish, deletions: Set of ids to delete, mine: Set of "id.field" conflicts to settle your way }
   */
  function plan({ local, published, loaded, choose = {}, now = new Date().toISOString() }) {
    const skip = choose.skip || new Set(), del = choose.deletions || new Set(), mineWins = choose.mine || new Set();
    const items = published.items.map(x => ({ ...x }));
    const byId = Object.fromEntries(items.map(x => [x.id, x]));
    const removed = { ...(published.removed || {}) };
    const changes = []; // { id, title, kind: edited|added|deleted|transcript|photo|duplicate|gone, fields, conflicts, legacy }
    const photos = [];

    for (const [id, raw] of Object.entries(local.items || {})) {
      if (local.deleted && local.deleted[id]) continue;
      const mine = clean(raw), theirs = byId[id];
      // A photo still only in this browser has to be at hand to publish; never publish a reference to it.
      const missing = uploadedIn(mine).filter(src => !photoMap(mine, local.photos && local.photos[id])[src]);
      if (missing.length) { changes.push({ id, title: mine.title || id, kind: theirs ? "edited" : "added", fields: [], conflicts: [], note: "a photo isn't loaded in this browser yet: reload the page and try again", skipped: true, blocked: true }); continue; }
      const snap = local.base && local.base[id];
      const start = snap || (loaded && loaded[id]) || theirs;
      const title = mine.title || (theirs && theirs.title) || id;
      if (!start && !theirs) {
        // New record: not if it repeats a published one.
        const dup = items.find(x =>
          (mine.sourceUrl && x.sourceUrl && urlKey(mine.sourceUrl) === urlKey(x.sourceUrl)) ||
          (mine.identifier && x.identifier && titleKey(mine.identifier) === titleKey(x.identifier) && titleKey(mine.institution) === titleKey(x.institution)) ||
          (titleKey(mine.title).length > 12 && titleKey(mine.title) === titleKey(x.title)));
        if (dup) { changes.push({ id, title, kind: "duplicate", note: `looks like published ${dup.id}, “${dup.title}”` }); continue; }
        if (skip.has(id)) { changes.push({ id, title, kind: "added", skipped: true }); continue; }
        const rec = { ...mine, id, reviewedAt: now };
        if (uploadedIn(rec).length) photos.push(...photosFor(rec, local.photos[id]));
        items.push(rec); byId[id] = rec;
        changes.push({ id, title, kind: "added" });
        continue;
      }
      if (!theirs) { changes.push({ id, title, kind: "gone", note: "removed from the published database since you edited it" }); continue; }
      const start_ = clean(start), now_ = clean(theirs);
      const keepPicture = !mine.image; // no picture of your own: the published one stays
      const keys = [...new Set([...Object.keys(mine), ...Object.keys(start_), ...Object.keys(now_)])]
        .filter(k => k !== "id" && k !== "reviewedAt" && !(keepPicture && IMG_KEYS.has(k)));
      const fields = [], conflicts = [];
      for (const k of keys) {
        const m = mine[k], b = start_[k], t = now_[k];
        if (same(m, b) || same(m, t)) continue; // you didn't change it, or the published record already has it
        // A published value that only adds to yours already holds your change. Without a snapshot this also
        // catches an old copy (made before a note was added); with one, a shortened field is a real edit.
        if ((!snap || !same(t, b)) && extendsMine(t, m)) continue;
        if (!same(t, b) && !mineWins.has(`${id}.${k}`)) { conflicts.push(k); continue; }
        fields.push(k);
      }
      const hasPhoto = uploadedIn(mine).length > 0;
      if (!fields.length && !conflicts.length && !hasPhoto) continue; // nothing to publish for this record
      const change = { id, title, kind: "edited", fields, conflicts, legacy: !snap };
      changes.push(change);
      if (skip.has(id)) { change.skipped = true; continue; }
      const rec = byId[id];
      for (const k of fields) { if (empty(mine[k])) delete rec[k]; else rec[k] = mine[k]; }
      if (hasPhoto) photos.push(...photosFor(rec, local.photos[id]));
      if (!conflicts.length) rec.reviewedAt = now; // left unstamped, your copy stays in this browser
    }

    for (const id of Object.keys(local.deleted || {})) {
      if (!byId[id]) continue;
      const usedBy = (published.cited || {})[id];
      if (usedBy && usedBy.length) { changes.push({ id, title: byId[id].title, kind: "deleted", skipped: true, blocked: true, note: `used in ${usedBy.join(", ")} of the public site: take it out of the chapter first, or keep the record` }); continue; }
      const change = { id, title: byId[id].title, kind: "deleted", skipped: !del.has(id) };
      changes.push(change);
      if (change.skipped) continue;
      items.splice(items.indexOf(byId[id]), 1); delete byId[id]; removed[id] = now;
    }

    const transcripts = { ...(published.transcripts || {}) };
    for (const [id, t] of Object.entries(local.transcripts || {})) {
      if (!t || typeof t.text !== "string" || !t.text.trim()) continue;
      if (transcripts[id] && transcripts[id].text === t.text) continue;
      const title = (byId[id] && byId[id].title) || id;
      if (!byId[id]) { changes.push({ id, title, kind: "transcript", note: "its record isn't published", skipped: true, blocked: true }); continue; }
      const change = { id, title, kind: "transcript", note: transcripts[id] ? "updated" : "added", skipped: skip.has(`tr:${id}`) };
      changes.push(change);
      if (!change.skipped) transcripts[id] = { text: t.text, file: t.file || "", added: t.added || "" };
    }
    return { items, removed, transcripts, photos, changes };
  }

  // Photos uploaded in this browser ("idb:" addresses) become files in the repository, and the record's
  // main picture and gallery point at them.
  const uploadedIn = rec => [rec.image, ...(Array.isArray(rec.images) ? rec.images.map(g => g && g.src) : [])].filter(s => String(s || "").startsWith("idb:"));
  const photoMap = (rec, photos) => (typeof photos === "string" ? { [rec.image]: photos } : photos || {}); // older pages sent the main picture alone
  function photosFor(rec, photos) {
    const map = photoMap(rec, photos), paths = {}, out = [], stamp = Date.now().toString(36);
    for (const src of [...new Set(uploadedIn(rec))]) {
      const path = `images/own/uploads/${rec.id}-${stamp}${out.length ? "-" + (out.length + 1) : ""}.jpg`;
      paths[src] = path;
      out.push({ id: rec.id, path, base64: String(map[src]).replace(/^data:[^,]*,/, "") });
    }
    if (paths[rec.image]) rec.image = paths[rec.image];
    if (Array.isArray(rec.images)) rec.images = rec.images.map(g => g && paths[g.src] ? { ...g, src: paths[g.src] } : g);
    if (!rec.rights) rec.rights = "own";
    return out;
  }

  // The database files in the form the repository keeps them.
  function writeItemsFile(prevSrc, items, removed) {
    let head = prevSrc.slice(0, prevSrc.indexOf("window.RUG_ITEMS = "));
    const line = "window.RUG_REMOVED = " + JSON.stringify(removed) + ";\n";
    head = /window\.RUG_REMOVED = [^\n]*\n/.test(head) ? head.replace(/window\.RUG_REMOVED = [^\n]*\n/, line) : head + line;
    return head + "window.RUG_ITEMS = " + JSON.stringify(items, null, 2) + ";\n";
  }
  function writeTranscriptsFile(prevSrc, transcripts) {
    return prevSrc.slice(0, prevSrc.indexOf("window.RUG_TRANSCRIPTS = ")) + "window.RUG_TRANSCRIPTS = " + JSON.stringify(transcripts, null, 1) + ";\n";
  }

  // ---------- GitHub ----------
  // fetchImpl: window.fetch (or a stand-in for tests). Uses the Git Data API so every file goes in one commit.
  function github({ repo, branch, token, fetchImpl }) {
    const call = async (path, opts = {}) => {
      const r = await fetchImpl(`https://api.github.com/repos/${repo}/${path}`, {
        cache: "no-store", ...opts,
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(opts.headers || {}) }
      });
      if (!r.ok) {
        let msg = ""; try { msg = (await r.json()).message || ""; } catch { /* no body */ }
        const e = new Error(msg || `GitHub answered ${r.status}`); e.status = r.status; throw e;
      }
      return r;
    };
    const json = async (path, opts) => (await call(path, opts)).json();
    return {
      head: async () => (await json(`git/ref/heads/${branch}`)).object.sha,
      file: async (path, ref) => (await call(`contents/${path}?ref=${ref}`, { headers: { Accept: "application/vnd.github.raw+json" } })).text(),
      check: async () => json(`git/ref/heads/${branch}`),
      // The records the public site's chapters use (see citedIn).
      cited: async ref => {
        const dir = await json(`contents/site/src/content/chapters?ref=${ref}`);
        const files = dir.filter(f => f.type === "file" && f.name.endsWith(".mdx"));
        const raw = { headers: { Accept: "application/vnd.github.raw+json" } };
        return citedIn(await Promise.all(files.map(async f => ({ page: f.name.replace(/\.mdx$/, ""), src: await (await call(`contents/${f.path}?ref=${ref}`, raw)).text() }))));
      },
      // Writes files on top of commit `parent`; returns the new commit, or null if the branch moved meanwhile.
      write: async (parent, files, message) => {
        const tree = (await json(`git/commits/${parent}`)).tree.sha;
        const entries = [];
        for (const f of files) {
          const blob = await json("git/blobs", { method: "POST", body: JSON.stringify(f.base64 != null ? { content: f.base64, encoding: "base64" } : { content: f.text, encoding: "utf-8" }) });
          entries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
        }
        const newTree = await json("git/trees", { method: "POST", body: JSON.stringify({ base_tree: tree, tree: entries }) });
        const commit = await json("git/commits", { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [parent] }) });
        try { await call(`git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) }); }
        catch (e) { if (e.status === 422) return null; throw e; }
        return commit;
      }
    };
  }

  /**
   * Reads the published database, merges, and commits. onPlan(plan) is called with the merge before
   * anything is written; return false from it to stop. Retries up to three times if the branch moves.
   */
  async function publish({ repo, branch, token, fetchImpl, local, loaded, choose, onPlan, message }) {
    const gh = github({ repo, branch, token, fetchImpl });
    for (let attempt = 1; attempt <= 3; attempt++) {
      const parent = await gh.head();
      const [itemsSrc, trSrc] = await Promise.all([gh.file("data/items.js", parent), gh.file("data/transcripts.js", parent)]);
      const w = readWindow(itemsSrc), tw = readWindow(trSrc);
      const published = { items: w.RUG_ITEMS || [], removed: w.RUG_REMOVED || {}, transcripts: tw.RUG_TRANSCRIPTS || {} };
      if (choose && choose.deletions && choose.deletions.size) published.cited = await gh.cited(parent);
      const p = plan({ local, published, loaded, choose });
      if (onPlan && (await onPlan(p, attempt)) === false) return { cancelled: true, plan: p };
      const live = p.changes.filter(c => !c.skipped && !["duplicate", "gone"].includes(c.kind));
      if (!live.length) return { nothing: true, plan: p };
      const files = [{ path: "data/items.js", text: writeItemsFile(itemsSrc, p.items, p.removed) }];
      if (live.some(c => c.kind === "transcript")) files.push({ path: "data/transcripts.js", text: writeTranscriptsFile(trSrc, p.transcripts) });
      for (const ph of p.photos) files.push({ path: ph.path, base64: ph.base64 });
      const commit = await gh.write(parent, files, message(p));
      if (commit) return { commit, plan: p };
    }
    throw new Error("The database kept changing on GitHub while publishing. Try again in a minute.");
  }

  // ---------- a chapter's opening picture ----------
  // Chapters are MDX files with YAML frontmatter; the picture is the "hero" block:
  //   hero:
  //     record: <record id>
  //     image: <gallery index, when not the main picture>
  //     focus: "<x% y%>"   (the point the crop keeps in view)
  //     caption: "<text>"
  const frontmatter = mdx => { const m = String(mdx).match(/^---\n([\s\S]*?)\n---\n/); if (!m) throw new Error("The chapter file has no frontmatter."); return m; };
  const unquote = v => { v = v.trim(); if (/^"/.test(v)) return JSON.parse(v); if (/^'/.test(v)) return v.slice(1, -1).replace(/''/g, "'"); return v; };
  function readHero(mdx) {
    const fm = frontmatter(mdx)[1].split("\n"), i = fm.findIndex(l => /^hero:\s*$/.test(l));
    if (i < 0) return null;
    const hero = {};
    for (let j = i + 1; j < fm.length && /^\s+\S/.test(fm[j]); j++) {
      const m = fm[j].match(/^\s+(\w+):\s*(.*)$/); if (!m) continue;
      hero[m[1]] = m[1] === "image" ? Number(m[2]) : unquote(m[2]);
    }
    return hero.record ? hero : null;
  }
  // Replaces the hero block (or adds one after researchChapter, or removes it when hero is null).
  function writeHero(mdx, hero) {
    const m = frontmatter(mdx), lines = m[1].split("\n");
    let i = lines.findIndex(l => /^hero:\s*$/.test(l)), at = i;
    if (i >= 0) { let j = i + 1; while (j < lines.length && /^\s+\S/.test(lines[j])) j++; lines.splice(i, j - i); }
    else at = lines.findIndex(l => /^researchChapter:/.test(l)) + 1 || lines.length;
    if (hero && hero.record) {
      const block = ["hero:", `  record: ${hero.record}`];
      if (hero.image != null && hero.image !== "") block.push(`  image: ${Number(hero.image)}`);
      if (hero.focus) block.push(`  focus: ${JSON.stringify(hero.focus)}`);
      if (hero.caption) block.push(`  caption: ${JSON.stringify(hero.caption)}`);
      lines.splice(at, 0, ...block);
    }
    return "---\n" + lines.join("\n") + "\n---\n" + String(mdx).slice(m[0].length);
  }
  // Reads the chapter file on GitHub, changes its picture, and commits; retries if the branch moves.
  async function saveHero({ repo, branch, token, fetchImpl, page, hero, message }) {
    const gh = github({ repo, branch, token, fetchImpl }), path = `site/src/content/chapters/${page}.mdx`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const parent = await gh.head(), src = await gh.file(path, parent), text = writeHero(src, hero);
      if (text === src) return { nothing: true };
      const commit = await gh.write(parent, [{ path, text }], message);
      if (commit) return { commit };
    }
    throw new Error("The chapter kept changing on GitHub while saving. Try again in a minute.");
  }
  async function loadHero({ repo, branch, token, fetchImpl, page }) {
    const gh = github({ repo, branch, token, fetchImpl });
    const src = await gh.file(`site/src/content/chapters/${page}.mdx`, await gh.head());
    // Pictures the chapter's text already shows, so the chooser can say so.
    const figures = [...src.matchAll(/<Figure\b[^>]*?\bid="([^"]+)"[^>]*?>/g)].map(f => ({ id: f[1], image: +((f[0].match(/image=\{(\d+)\}/) || [])[1] || 0) }));
    return { hero: readHero(src), figures };
  }

  const api = { readHero, writeHero, saveHero, loadHero, plan, citedIn, writeItemsFile, writeTranscriptsFile, github, publish, readWindow, clean };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.RugPublish = api;
})(typeof window !== "undefined" ? window : globalThis);
