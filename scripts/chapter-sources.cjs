#!/usr/bin/env node
// Prints everything a chapter writer needs: the chapter's draft intro from data/chapters.js, then every
// record in its evidence list in full (ids, dates, status, description, images with their gallery index
// and whether each may be shown). Usage: node scripts/chapter-sources.cjs ch-china [more-record-ids...]
global.window = {};
require("../data/items.js"); require("../data/chapters.js");
const items = Object.values(window).find(v => Array.isArray(v) && v[0] && v[0].id && v[0].type);
const chapters = Object.values(window).find(v => Array.isArray(v) && v[0] && v[0].kind === "chapter");
const byId = Object.fromEntries(items.map(i => [i.id, i]));
const [chId, ...extra] = process.argv.slice(2);
const ch = chapters.find(c => c.id === chId);
if (!ch) { console.error("No chapter " + chId + ". Chapters: " + chapters.map(c => c.id).join(", ")); process.exit(1); }
const cleared = it => ["own", "public-domain"].includes(it.rights) || it.type === "patent";
const out = [`CHAPTER ${ch.id}: ${ch.name}`, "", "DRAFT INTRO (from the research tool; rewrite freely, but every claim must trace to a record below):", "", ch.intro || "(none)", ""];
const ids = [...new Set([...(ch.items || []), ...extra])];
out.push(`RECORDS (${ids.length})`, "");
for (const id of ids) {
  const it = byId[id];
  if (!it) { out.push(`## ${id}: MISSING FROM data/items.js`, ""); continue; }
  out.push(`## ${it.id}`);
  out.push(`type: ${it.type} | status: ${it.status || "-"} | confidence: ${it.confidence || "-"} | date: ${it.date || "-"} (start ${it.dateStart ?? "-"})`);
  for (const k of ["title", "creator", "institution", "identifier", "collection", "publisher", "place", "region", "citation", "sourceUrl", "rights"]) if (it[k]) out.push(`${k}: ${it[k]}`);
  const gallery = Array.isArray(it.images) && it.images.length ? it.images : [];
  if (it.image && !String(it.image).startsWith("idb:")) {
    out.push(`IMAGE: ${cleared(it) ? "may be shown (cleared)" : "may be shown, marked 'Permission pending'"}; credit: ${it.imageCredit || it.institution || "-"}`);
    if (gallery.length) gallery.forEach((g, i) => out.push(`  image={${i}}: ${g.src}${g.caption ? " (" + g.caption + ")" : ""}`));
    else out.push(`  image: ${it.image}`);
  } else out.push("IMAGE: none (cannot be a Figure or hero)");
  out.push("", it.description || "(no description)", "");
}
console.log(out.join("\n"));
