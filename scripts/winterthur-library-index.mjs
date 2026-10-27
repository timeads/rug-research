#!/usr/bin/env node
// Builds a searchable index of the Winterthur Library digital collections for the Discover view.
//
// The digital collections site (Quartex) has no search API, but its sitemap lists every document
// with its title in the address, e.g. /Documents/Detail/sugar-or-candied-apples-of-rouen/514.
// This job reads that list (three requests), then reads the detail pages of documents whose titles
// match rug, textile and trade words, for the full title, date, maker and image. Detail pages already
// in the index are kept, so later runs only read new documents. Saves data/winterthur-library-index.json.
//
// Usage: node scripts/winterthur-library-index.mjs [--details 800]

import { readFile, writeFile } from "node:fs/promises";

const BASE = "https://digitalcollections.winterthur.org";
const OUT = new URL("../data/winterthur-library-index.json", import.meta.url);
const UA = "Mozilla/5.0 (compatible; RugResearchIndexBot/1.0; +https://github.com/timeads/rug-research)";
const args = process.argv.slice(2);
const BUDGET = Number(args[args.indexOf("--details") + 1]) || 1500;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Whole words in the address (words are separated by hyphens), so "rug" doesn't match "Ruggles".
const KEYWORDS = /\b(rugs?|carpets?|carpeting|hook(ed|ing)?|tuft(ed|ing)?|textiles?|yarns?|chenille|candlewick|coverlets?|weav\w*|looms?|needle\w*|embroider\w*|samplers?|fabrics?|cloth|wool\w*|worsted|cotton|silks?|dye\w*|patterns?|swatch\w*|samples?|quilt\w*|bed-?spreads?|bedcovers?|floor\w*|upholster\w*|curtains?|drapery|linens?|lace|knit\w*|spinn\w*|mills?|nylon|du-?pont|bigelow|axminster|wilton|brussels|ingrain|kidderminster|mats?|matting|oilcloth|tapestr\w*|furnish\w*)\b/;
// Bump when the detail-page reader changes, so earlier detail reads are redone.
const READER = 2;

async function get(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xml" } });
      if (r.ok) return await r.text();
      console.log(`  ${r.status} ${url}`);
      if (r.status === 404) return "";
    } catch (e) { console.log(`  ${e.message} ${url}`); }
    await sleep(1500 * attempt);
  }
  return "";
}
const decode = s => (s || "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/\s+/g, " ").trim();
const meta = (html, prop) => decode((html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)`, "i")) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i")) || [])[1]);
// Labelled metadata fields, whether the page uses <dt>/<dd> or label/value elements.
function field(html, ...labels) {
  for (const l of labels) {
    const m = html.match(new RegExp(`>\\s*${l}\\s*:?\\s*</[^>]+>\\s*(?:<[^>]+>\\s*)*([^<]{1,300})`, "i"));
    if (m && decode(m[1])) return decode(m[1]);
  }
  return "";
}

let prev = {};
try { const old = JSON.parse(await readFile(OUT, "utf8")); if (old.reader === READER) for (const row of old.rows) prev[row[0]] = row; } catch {}

// 1. Every document, from the sitemap.
const index = await get(`${BASE}/sitemap.xml`);
const lists = [...index.matchAll(/<loc>([^<]*type=DOCUMENT[^<]*)<\/loc>/g)].map(m => decode(m[1]));
const docs = new Map();
for (const url of lists) {
  for (const m of (await get(url)).matchAll(/\/Documents\/Detail\/([^/<]+)\/(\d+)/g)) docs.set(m[2], m[1]);
  await sleep(500);
}
console.log(`${docs.size} documents listed in ${lists.length} sitemap pages`);
if (!docs.size) throw new Error("The sitemap listed no documents; keeping the old index.");

// 2. Detail pages for documents whose titles match, most likely first.
const fromSlug = slug => decode(slug).replace(/-/g, " ").replace(/\s+/g, " ").trim().replace(/^./, c => c.toUpperCase());
const wanted = [...docs].filter(([id, slug]) => KEYWORDS.test(slug) && !prev[id]?.[7]);
let read = 0;
const details = {};
for (const [id, slug] of wanted.slice(0, BUDGET)) {
  const html = await get(`${BASE}/Documents/Detail/${slug}/${id}`);
  await sleep(400);
  if (!html) continue;
  read++;
  // The page carries its catalogue fields as embedded data: {"id":"field_11","name":"Date (EDTF)","value":"1880 - 1889",...,"tags":[...]}
  const f = {};
  for (const m of html.matchAll(/\{"id":"field_\d+","name":"([^"]+)","value":(null|"(?:[^"\\]|\\.)*"),"fieldType":"[^"]*","tags":(\[(?:[^\]"]|"(?:[^"\\]|\\.)*")*\])/g)) {
    try { const v = JSON.parse(m[2]) || JSON.parse(m[3]).join("; "); if (v && !f[m[1]]) f[m[1]] = String(v).replace(/\s+/g, " ").trim(); } catch {}
  }
  const pick = (...ks) => ks.map(k => f[k]).find(Boolean) || "";
  const title = decode((html.match(/<h1[^>]*document-viewer__heading[^>]*>([^<]*)</) || html.match(/<title>([^<]*)<\/title>/i) || [])[1]).replace(/\s*-\s*Winterthur Library Digital Collections\s*$/i, "");
  const pages = (html.match(/"thumbnailUrl":/g) || []).length;
  details[id] = {
    title: pick("Title") || title,
    date: pick("Date (EDTF)", "Date", "Date Created", "Dates"),
    creator: pick("Creator", "Author", "Publisher", "Maker", "Manufacturer"),
    collection: pick("Source Collection", "Collection"),
    description: [pick("Description", "Abstract", "Summary"), pick("Subjects", "Subject") && "Subjects: " + pick("Subjects", "Subject"), pick("Place") && "Place: " + pick("Place"), pick("Format", "Type") && "Format: " + pick("Format", "Type"), pages > 1 ? `${pages} pages` : ""].filter(Boolean).join(". ").slice(0, 700),
    identifier: pick("Identifier", "Call Number")
  };
  if (read === 1) console.log("First detail page read:", JSON.stringify(details[id]));
}
console.log(`Detail pages read this run: ${read}; still to read: ${Math.max(0, wanted.length - read)}`);

// Compact rows: [id, slug, title, date, creator, collection, image, detailRead, keywordHit, description, identifier]
// The scans need a short-lived access key, so they can't be linked from another site: image stays empty.
const rows = [...docs].map(([id, slug]) => {
  const d = details[id], p = prev[id];
  const kw = KEYWORDS.test(slug) ? 1 : 0;
  if (d) return [id, slug, d.title || fromSlug(slug), d.date, d.creator, d.collection, "", 1, kw, d.description, d.identifier];
  if (p && p[7]) return [id, slug, ...p.slice(2, 8), kw, p[9] || "", p[10] || ""];
  return [id, slug, fromSlug(slug), "", "", "", "", 0, kw, "", ""];
}).sort((a, b) => Number(a[0]) - Number(b[0]));

await writeFile(OUT, JSON.stringify({
  source: `${BASE}/sitemap.xml`, builtAt: new Date().toISOString(), count: rows.length, reader: READER,
  fields: ["id", "slug", "title", "date", "creator", "collection", "image", "detailRead", "keywordHit", "description", "identifier"],
  page: `${BASE}/Documents/Detail/{slug}/{id}`, rows
}));
const summary = `## Winterthur Library digital collections index\n\n${rows.length} documents (${rows.filter(r => r[8]).length} match rug and textile words); ${read} detail pages read this run, ${rows.filter(r => r[7]).length} in total.`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary + "\n", { flag: "a" });
