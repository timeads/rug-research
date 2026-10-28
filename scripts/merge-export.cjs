#!/usr/bin/env node
// Merges a database file exported from the site (Export → Database file) into data/items.js.
//
// An export holds every record as that browser last saw it, so most records are just older copies
// of published ones. Each record is compared with every published version of it in git history:
//   - same as now, or same as an older published version  → unchanged / old copy: ignored
//   - different from every published version              → edited: the fields changed against the
//     closest published version are applied to the current record; a field that was also changed
//     since then on the published side is reported as a conflict and left as published
//   - not published at all                                 → new: added, unless it looks like a
//     duplicate (same page address, same catalogue number at the same place, or the same title)
//   - published but missing from the export                → reported, never deleted
// Transcripts in the export (window.RUG_TRANSCRIPTS) that are new or changed go to data/transcripts.js.
// Merged records get reviewedAt (see js/app.js: a browser's own copy older than that is dropped).
// Pictures borrowed from a related record (credit "Image from related record…") are ignored, as
// older exports wrongly saved them as records' own.
//
// Usage: node scripts/merge-export.cjs path/to/items.js [--write]
//   Without --write it only reports. The report is also written to research/merge-report.md.

const fs = require("fs"), vm = require("vm"), path = require("path"), { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const [file, flag] = process.argv.slice(2);
if (!file) { console.error("Usage: node scripts/merge-export.cjs export.js [--write]"); process.exit(1); }
const loadW = src => { const c = { window: {} }; vm.runInNewContext(src, c); return c.window; };
const load = src => loadW(src).RUG_ITEMS || [];

const empty = v => v === "" || v == null || (Array.isArray(v) && !v.length);
const tidy = o => {
  const c = {};
  for (const k of Object.keys(o).sort()) if (!k.startsWith("_") && !empty(o[k])) c[k] = o[k];
  if (String(c.imageCredit || "").startsWith("Image from related record")) { delete c.image; delete c.imageCredit; }
  return c;
};
const key = o => JSON.stringify(tidy(o));
// Merged records are stamped, so a browser drops its own older copy and shows the published one.
const NOW = new Date().toISOString();
const urlKey = u => String(u || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[/#?]+$/, "");
const titleKey = t => String(t || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const expW = loadW(fs.readFileSync(file, "utf8")), exp = expW.RUG_ITEMS || [];
const curSrc = fs.readFileSync(path.join(ROOT, "data/items.js"), "utf8");
const cur = load(curSrc);
const CUR = Object.fromEntries(cur.map(x => [x.id, x]));

// Every published version of every record.
const hist = {}, firstSeen = {};
for (const line of execSync("git log --format=%h%x20%ad --date=format:%Y-%m-%d\\ %H:%M -- data/items.js", { cwd: ROOT }).toString().trim().split("\n")) {
  const [h, ...d] = line.split(" ");
  let items; try { items = load(execSync(`git show ${h}:data/items.js`, { cwd: ROOT, maxBuffer: 1 << 28 }).toString()); } catch { continue; }
  for (const x of items) { (hist[x.id] = hist[x.id] || new Map()).set(key(x), tidy(x)); firstSeen[x.id] = d.join(" "); } // log runs newest first, so the last date seen is the first publication
}

const report = { unchanged: [], stale: [], edited: [], conflicts: [], added: [], duplicates: [], missing: [], transcripts: [] };
const out = cur.map(x => ({ ...x }));
const OUT = Object.fromEntries(out.map(x => [x.id, x]));

for (const e of exp) {
  const id = e.id, ek = key(e);
  if (CUR[id]) {
    if (ek === key(CUR[id])) { report.unchanged.push(id); continue; }
    if (hist[id] && hist[id].has(ek)) { report.stale.push(id); continue; }
    // Edited: find the published version it differs from least, and apply only those differences.
    const te = tidy(e);
    const versions = [...(hist[id] ? hist[id].values() : []), tidy(CUR[id])];
    const diffKeys = b => [...new Set([...Object.keys(te), ...Object.keys(b)])].filter(k => JSON.stringify(te[k]) !== JSON.stringify(b[k]));
    const base = versions.reduce((best, v) => diffKeys(v).length < diffKeys(best).length ? v : best, versions[0]);
    const now = tidy(CUR[id]), changed = [];
    // A published value that only adds to the export's (a note appended, tags added) is already up to date.
    const extends_ = (pub, mine) => typeof pub === "string" && typeof mine === "string" ? pub.startsWith(mine) && pub.length > mine.length
      : Array.isArray(pub) && Array.isArray(mine) ? mine.every(v => pub.includes(v)) && pub.length > mine.length : false;
    for (const k of diffKeys(base)) {
      if (extends_(now[k], te[k])) continue;
      // The published side changed this field too since that version: keep it, report the clash.
      if (JSON.stringify(now[k]) !== JSON.stringify(base[k]) && JSON.stringify(now[k]) !== JSON.stringify(te[k])) { report.conflicts.push(`${id}: ${k}`); continue; }
      if (k in te) OUT[id][k] = te[k]; else delete OUT[id][k];
      changed.push(k);
    }
    if (changed.length) { OUT[id].reviewedAt = NOW; report.edited.push(`${id}: ${changed.join(", ")}`); } else report.stale.push(id);
  } else if (hist[id]) {
    report.stale.push(`${id} (removed from the published database since; not re-added)`);
  } else {
    // New: check for duplicates of published records.
    const dup = cur.find(x =>
      (e.sourceUrl && x.sourceUrl && urlKey(e.sourceUrl) === urlKey(x.sourceUrl)) ||
      (e.identifier && x.identifier && titleKey(e.identifier) === titleKey(x.identifier) && titleKey(e.institution) === titleKey(x.institution)) ||
      (titleKey(e.title).length > 12 && titleKey(e.title) === titleKey(x.title)));
    if (dup) { report.duplicates.push(`${id} "${e.title}" looks like published ${dup.id} "${dup.title}": not added`); continue; }
    const rec = tidy(e); rec.id = id; rec.reviewedAt = NOW; out.push(rec); OUT[id] = rec;
    report.added.push(`${id}: ${e.title}`);
  }
}
// Transcripts: new or changed ones are taken; a transcript for a record that isn't published is reported.
const TRF = path.join(ROOT, "data/transcripts.js");
const trSrc = fs.readFileSync(TRF, "utf8"), pubTr = loadW(trSrc).RUG_TRANSCRIPTS || {}, outTr = { ...pubTr };
for (const [id, t] of Object.entries(expW.RUG_TRANSCRIPTS || {})) {
  if (!t || typeof t.text !== "string" || !t.text.trim() || (pubTr[id] && pubTr[id].text === t.text)) continue;
  if (!OUT[id]) { report.transcripts.push(`${id}: not added (no published record with this id)`); continue; }
  outTr[id] = { text: t.text, file: t.file || "", added: t.added || "" };
  report.transcripts.push(`${id}: ${pubTr[id] ? "updated" : "added"} (${t.text.split("\n").filter(l => l.trim()).length} lines${t.file ? `, from ${t.file}` : ""})`);
}
const EXP = new Set(exp.map(x => x.id));
for (const x of cur) if (!EXP.has(x.id)) report.missing.push(`${x.id}: ${x.title} (first published ${firstSeen[x.id] || "now"}; if that's after the export was made, it simply wasn't there yet)`);

const lines = [`# Merge report`, ``, `Export: ${path.basename(file)} (${exp.length} records) into data/items.js (${cur.length} records). ${flag === "--write" ? "Written." : "Not written (dry run)."}`, ``,
  `- Unchanged: ${report.unchanged.length}`, `- Old copies ignored: ${report.stale.length}`, `- Edited and applied: ${report.edited.length}`, `- Conflicts kept as published: ${report.conflicts.length}`,
  `- New and added: ${report.added.length}`, `- Possible duplicates not added: ${report.duplicates.length}`, `- Published but missing from the export (not deleted): ${report.missing.length}`, `- Transcripts added or updated: ${report.transcripts.filter(x => !x.includes("not added")).length}`, ``];
for (const [k, title] of [["edited", "Edited"], ["conflicts", "Conflicts"], ["added", "Added"], ["duplicates", "Possible duplicates"], ["transcripts", "Transcripts"], ["missing", "Missing from the export"]])
  if (report[k].length) lines.push(`## ${title}`, ``, ...report[k].map(x => `- ${x}`), ``);
fs.writeFileSync(path.join(ROOT, "research/merge-report.md"), lines.join("\n"));
console.log(lines.join("\n"));

if (flag === "--write") {
  const head = curSrc.slice(0, curSrc.indexOf("window.RUG_ITEMS = "));
  fs.writeFileSync(path.join(ROOT, "data/items.js"), head + "window.RUG_ITEMS = " + JSON.stringify(out, null, 2) + ";\n");
  if (report.transcripts.length) fs.writeFileSync(TRF, trSrc.slice(0, trSrc.indexOf("window.RUG_TRANSCRIPTS = ")) + "window.RUG_TRANSCRIPTS = " + JSON.stringify(outTr, null, 1) + ";\n");
}
