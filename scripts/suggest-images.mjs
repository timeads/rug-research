#!/usr/bin/env node
// Gathers candidate pictures for records that have no image, so "Find an image" on the site can
// show suggestions straight away. Each record is searched in the open collections (the Met, V&A,
// Art Institute of Chicago, Cleveland, Wikimedia Commons) and the Winterthur museum index, using
// words from its title. Nothing is attached to a record here: a person picks on the site, and a
// picture of a comparable item is labelled as an illustration.
//
// imageQuery must stay in step with the same function in js/app.js.
//
// Usage: node scripts/suggest-images.mjs [--only id1,id2]  ->  data/image-suggestions.json

import { readFile, writeFile } from "node:fs/promises";

const ITEMS = new URL("../data/items.js", import.meta.url);
const OUT = new URL("../data/image-suggestions.json", import.meta.url);
const WT = new URL("../data/winterthur-index.json", import.meta.url);
const UA = "Mozilla/5.0 (compatible; RugResearchImageSuggest/1.0; +https://github.com/timeads/rug-research)";
const args = process.argv.slice(2);
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : [];
const PER = 12;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const IMAGE_TERMS = ["Brussels carpet", "Wilton carpet", "Kidderminster carpet", "Venetian carpet", "ingrain carpet", "Axminster carpet", "Scotch carpet", "tapestry carpet", "chenille carpet", "Moquette", "Savonnerie", "Turkey carpet", "needlework carpet", "hearth rug", "floor cloth", "floorcloth", "hooked rug", "bed rug", "yarn-sewn rug", "shirred rug", "braided rug", "rag rug", "candlewick", "chenille bedspread", "tufted bedspread", "coverlet", "Jacquard loom", "power loom", "draw loom", "tufting machine", "tufting gun", "rug hook", "punch needle", "Pazyryk", "kilim", "soumak", "dhurrie", "rya", "shyrdak", "felt rug", "Navajo rug", "carpet loom", "carpet sample", "sample book", "pattern book", "nylon", "Kidderminster", "Wilton", "Axminster", "Venetian", "ingrain", "Brussels", "tufted carpet", "tufting", "hand-knotted carpet", "knotted carpet", "woven carpet"];
const STOP = new Set("the a an of and or in on at for to from by with as is are was were be its it this that these those begins began first earliest early late new into over under about how what why which who whose than then their his her our your not no only also more most some any all each per via vs".split(" "));
const imageQuery = it => {
  const t = (it.title || "").replace(/^(REFUTED|UNVERIFIED|CORRECTION)\s*:\s*/i, "").replace(/\([^)]*\)/g, " ").replace(/[‘’“”"']/g, "");
  const find = text => IMAGE_TERMS.find(k => new RegExp(`\\b${k}`, "i").test(text));
  // Findings and events often have abstract titles; their text usually names the thing to picture.
  const term = find(t) || (["finding", "event"].includes(it.type) && find([...(it.techniques || []), ...(it.tags || []), it.description || ""].join(" ")));
  if (term) return /^(Kidderminster|Wilton|Axminster|Venetian|ingrain|Brussels)$/.test(term) ? term + " carpet" : term; // a weave name alone finds towns and paintings
  const head = t.split(/[:;–—]|\s-\s/)[0];
  return head.replace(/\b\d{1,4}s?\b|\b(c|ca)\./gi, " ").split(/[^\p{L}\p{N}-]+/u).filter(w => w.length > 2 && !STOP.has(w.toLowerCase())).slice(0, 3).join(" ");
};

async function json(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch {}
    await sleep(1000 * attempt);
  }
  return null;
}
const e = encodeURIComponent;

const SOURCES = {
  async met(q) {
    const s = await json(`https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&limit=6&q=${e(q)}`);
    const out = [];
    for (const id of (s?.objectIDs || []).slice(0, 6)) {
      const o = await json(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
      if (o?.primaryImageSmall) out.push({ image: o.primaryImageSmall, title: o.title || o.objectName, date: o.objectDate, institution: "The Metropolitan Museum of Art", identifier: o.accessionNumber, sourceUrl: o.objectURL });
      await sleep(150);
    }
    return out;
  },
  async vam(q) {
    const r = await json(`https://api.vam.ac.uk/v2/objects/search?q=${e(q)}&page_size=8&images_exist=1`);
    return (r?.records || []).filter(o => o._images?._iiif_image_base_url).map(o => ({ image: o._images._iiif_image_base_url + "full/!600,600/0/default.jpg", title: o._primaryTitle || o.objectType, date: o._primaryDate, institution: "Victoria and Albert Museum", identifier: o.accessionNumber, sourceUrl: `https://collections.vam.ac.uk/item/${o.systemNumber}/` }));
  },
  async aic(q) {
    const r = await json(`https://api.artic.edu/api/v1/artworks/search?q=${e(q)}&limit=8&fields=id,title,date_display,image_id,main_reference_number`);
    const iiif = r?.config?.iiif_url || "https://www.artic.edu/iiif/2";
    return (r?.data || []).filter(o => o.image_id).map(o => ({ image: `${iiif}/${o.image_id}/full/600,/0/default.jpg`, title: o.title, date: o.date_display, institution: "Art Institute of Chicago", identifier: o.main_reference_number, sourceUrl: `https://www.artic.edu/artworks/${o.id}` }));
  },
  async cleveland(q) {
    const r = await json(`https://openaccess-api.clevelandart.org/api/artworks/?q=${e(q)}&limit=8&has_image=1`);
    return (r?.data || []).filter(o => o.images?.web?.url).map(o => ({ image: o.images.web.url, title: o.title, date: o.creation_date, institution: "Cleveland Museum of Art", identifier: o.accession_number, sourceUrl: o.url }));
  },
  async commons(q) {
    const r = await json(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${e(q)}&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=600`);
    return Object.values(r?.query?.pages || {}).map(p => p.imageinfo?.[0]).filter(ii => ii && /\.(jpe?g|png|gif|tiff?)$/i.test(ii.url)).map(ii => ({ image: ii.thumburl || ii.url, title: (ii.extmetadata?.ObjectName?.value || ii.extmetadata?.ImageDescription?.value || "").replace(/<[^>]+>/g, "").slice(0, 120) || decodeURIComponent(ii.descriptionurl.split("File:")[1] || "").replace(/_/g, " "), date: (ii.extmetadata?.DateTimeOriginal?.value || "").replace(/<[^>]+>/g, "").slice(0, 40), institution: "Wikimedia Commons", identifier: "", sourceUrl: ii.descriptionurl }));
  }
};

// The Winterthur index is searched locally, like the site does.
let wt = null;
try { wt = JSON.parse(await readFile(WT, "utf8")); } catch {}
const winterthur = q => {
  if (!wt) return [];
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return wt.rows.filter(r => r[8] && terms.every(t => (r[1] + " " + r[2] + " " + r[4]).toLowerCase().includes(t))).slice(0, 8).map(r => ({
    image: wt.image.replace("{irn}", r[0]), title: r[1] || r[2], date: r[6] == null ? "" : r[7] != null && r[7] !== r[6] ? `${r[6]}–${r[7]}` : String(r[6]),
    institution: "Winterthur Museum, Garden & Library", identifier: r[3], sourceUrl: wt.page.replace("{irn}", r[0])
  }));
};

const relevant = (list, q) => {
  const words = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 3).map(w => w.replace(/s$/, ""));
  if (!words.length) return list;
  return list.filter(r => words.some(w => (r.title || "").toLowerCase().includes(w)));
};

const src = await readFile(ITEMS, "utf8");
const items = JSON.parse(src.slice(src.indexOf("window.RUG_ITEMS = ") + "window.RUG_ITEMS = ".length).trim().replace(/;$/, ""));
let prev = { items: {} };
try { prev = JSON.parse(await readFile(OUT, "utf8")); } catch {}

const want = items.filter(it => ONLY.length ? ONLY.includes(it.id) : !it.image);
const byQuery = {}, out = {};
let searched = 0;
for (const it of want) {
  const q = imageQuery(it);
  if (!q) continue;
  // The same words for several records are searched once.
  if (!byQuery[q]) {
    const lists = [winterthur(q)];
    for (const [name, run] of Object.entries(SOURCES)) {
      try { lists.push(await run(q)); } catch (err) { console.log(`  ${name}: ${err.message}`); lists.push([]); }
      await sleep(250);
    }
    // Loose matches (a painting for "Brussels carpet") are dropped when the title shares no word with the search.
    for (let i = 0; i < lists.length; i++) lists[i] = relevant(lists[i], q);
    const seen = new Set(), mixed = [];
    for (let i = 0; mixed.length < PER && lists.some(l => i < l.length); i++) for (const l of lists) if (i < l.length && l[i].image && !seen.has(l[i].image)) { seen.add(l[i].image); mixed.push(l[i]); }
    byQuery[q] = mixed.slice(0, PER);
    searched++;
    console.log(`${String(byQuery[q].length).padStart(2)}  "${q}"`);
  }
  if (byQuery[q].length) out[it.id] = { q, results: byQuery[q] };
}
// A run limited to some records keeps the others' suggestions.
const items2 = ONLY.length ? { ...prev.items, ...out } : out;
await writeFile(OUT, JSON.stringify({ builtAt: new Date().toISOString(), count: Object.keys(items2).length, items: items2 }));
const summary = `## Image suggestions\n\n${want.length} records without an image; ${searched} distinct searches; suggestions for ${Object.keys(out).length}.`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary + "\n", { flag: "a" });
