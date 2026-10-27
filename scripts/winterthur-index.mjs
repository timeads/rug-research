#!/usr/bin/env node
// Builds a searchable index of Winterthur Museum objects for the Discover view.
//
// Winterthur's collection site searches through its own /api/search, which browsers on other
// sites are not allowed to call (no CORS). This job calls it from GitHub Actions instead and saves
// a compact index to data/winterthur-index.json: all textiles, plus objects in any category that
// match rug- and tufting-related keywords. Objects in the keyword set (and floor coverings) also
// get their full display title from the object page, e.g. "Bedcover (Bed rug), 1780-1850";
// titles already in the index are kept, so later runs only fetch new objects.
//
// Usage: node scripts/winterthur-index.mjs [--titles 1500]

import { readFile, writeFile } from "node:fs/promises";

const BASE = "https://museumcollection.winterthur.org";
const OUT = new URL("../data/winterthur-index.json", import.meta.url);
const UA = "Mozilla/5.0 (compatible; RugResearchIndexBot/1.0; +https://github.com/timeads/rug-research)";
const args = process.argv.slice(2);
const TITLE_BUDGET = Number(args[args.indexOf("--titles") + 1]) || 1500;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const TEXTILES = ["Textiles", "Textiles (Clothing)", "Textiles (Floorcovering)", "Textiles (Furnishing)", "Textiles (Needlework)"];
const KEYWORDS = ["rug", "carpet", "bed rug", "hooked", "tufted", "tufting", "candlewick", "chenille", "coverlet", "floor cloth",
  "yarn", "swatch", "sample book", "pattern book", "needle", "loom", "shuttle", "rug hook", "nylon", "worsted", "ingrain",
  "Brussels", "Wilton", "Axminster", "Kidderminster", "hearth rug", "bedcover", "bedspread", "quilt"];

async function search(body, page) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(`${BASE}/api/search`, { method: "POST", headers: { "content-type": "application/json", "User-Agent": UA }, body: JSON.stringify({ ...body, page, perPage: 100 }) });
      if (r.ok) return await r.json();
      console.log(`  ${r.status} on page ${page}, retrying`);
    } catch (e) { console.log(`  ${e.message} on page ${page}, retrying`); }
    await sleep(1500 * attempt);
  }
  throw new Error("search failed: " + JSON.stringify(body));
}
async function all(body, label) {
  const out = [];
  for (let page = 1; ; page++) {
    const r = await search(body, page);
    out.push(...(r.results || []));
    if (page === 1) console.log(`${label}: ${r.total} objects`);
    if (page >= (r.totalPages || 1)) break;
    await sleep(250);
  }
  return out;
}

let prev = {};
try { for (const row of JSON.parse(await readFile(OUT, "utf8")).rows) prev[row[0]] = row; } catch {}

const objects = new Map(), keywordHits = new Set();
for (const o of await all({ categoriesAny: TEXTILES }, "Textiles")) objects.set(o.irn, o);
for (const k of KEYWORDS) {
  for (const o of await all({ query: k }, `"${k}"`)) { objects.set(o.irn, o); keywordHits.add(o.irn); }
}

// Full display titles from object pages, for the most relevant objects first.
const titleOf = irn => prev[irn]?.[1] || "";
const wantTitle = [...objects.values()].filter(o => !titleOf(o.irn) && (keywordHits.has(o.irn) || o.category === "Textiles (Floorcovering)"))
  .sort((a, b) => (b.category === "Textiles (Floorcovering)") - (a.category === "Textiles (Floorcovering)"));
const titles = {};
let fetched = 0;
for (const o of wantTitle.slice(0, TITLE_BUDGET)) {
  try {
    const html = await (await fetch(`${BASE}/object/${o.irn}`, { headers: { "User-Agent": UA, Accept: "text/html" } })).text();
    const t = (html.match(/<title>([^<]*)<\/title>/i) || [])[1];
    if (t) titles[o.irn] = t.replace(/\s*\|\s*Winterthur Museum Collection\s*$/i, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').trim();
    fetched++;
  } catch {}
  await sleep(300);
}
console.log(`Titles fetched this run: ${fetched}; still without a full title: ${Math.max(0, wantTitle.length - fetched)}`);

// Compact rows: [irn, title, objectName, objectNumber, category, creator, dateEarliest, dateLatest, hasImages, keywordHit]
const rows = [...objects.values()].map(o => [
  o.irn, titles[o.irn] || titleOf(o.irn), o.objectName || "", o.objectNumber || "", o.category || "",
  o.creatorDisplay || (o.creator && o.creator !== "__unidentified_creator__" ? o.creator : "") || "",
  o.dateEarliest ?? null, o.dateLatest ?? null, o.hasImages ? 1 : 0, keywordHits.has(o.irn) ? 1 : 0
]).sort((a, b) => Number(a[0]) - Number(b[0]));

await writeFile(OUT, JSON.stringify({
  source: `${BASE}/api/search`, builtAt: new Date().toISOString(), count: rows.length,
  fields: ["irn", "title", "objectName", "objectNumber", "category", "creator", "dateEarliest", "dateLatest", "hasImages", "keywordHit"],
  image: "https://winocr-images.s3.us-east-1.amazonaws.com/art-objects/live/{irn}/multimedia/0-original.jpg",
  page: `${BASE}/object/{irn}`, rows
}));
const summary = `## Winterthur index\n\n${rows.length} objects (${keywordHits.size} keyword matches); ${fetched} new titles fetched.`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary + "\n", { flag: "a" });
