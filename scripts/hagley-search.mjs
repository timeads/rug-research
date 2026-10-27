#!/usr/bin/env node
// Searches the Hagley Digital Archives for carpet / nylon items and saves what it
// finds (title, date, description, image, link) to research/hagley/search-results.json.
// Runs in GitHub Actions (.github/workflows/hagley-search.yml), which can reach hagley.org.
//
// Usage: node scripts/hagley-search.mjs "nylon carpet" "Antron" ...

import { mkdir, writeFile } from "node:fs/promises";

const BASE = "https://digital.hagley.org";
const TERMS = process.argv.slice(2).length ? process.argv.slice(2)
  : ["nylon carpet", "carpet", "rug", "Antron", "501 nylon", "tufted", "broadloom", "carpet fiber", "carpeting", "nylon rug", "Dacron carpet", "Orlon carpet"];
const PER_TERM = 40;
const UA = "Mozilla/5.0 (compatible; RugResearchBot/1.0; +https://github.com/timeads/rug-research)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": UA, Accept: "text/html,application/json" } });
    return { status: r.status, url: r.url, text: await r.text() };
  } catch (e) { return { status: 0, url, text: "", error: e.message }; }
  finally { clearTimeout(t); }
}
const decode = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const strip = s => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const meta = (html, name) => { const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i")) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, "i")); return m ? decode(m[1]) : ""; };

// Candidate search URL patterns (Islandora 7, Islandora 2 / Drupal search_api, generic).
const SEARCHES = [
  t => `${BASE}/islandora/search/${encodeURIComponent(t)}?type=dismax`,
  t => `${BASE}/islandora/search/${encodeURIComponent(`"${t}"`)}?type=dismax`,
  t => `${BASE}/search?search_api_fulltext=${encodeURIComponent(t)}`,
  t => `${BASE}/search?keys=${encodeURIComponent(t)}`,
  t => `${BASE}/search/node?keys=${encodeURIComponent(t)}`,
];
// Links that look like object pages.
const OBJ = /href=["']((?:https?:\/\/digital\.hagley\.org)?\/(?:islandora\/object\/[^"'?#\/]+|node\/\d+|[A-Za-z0-9]+_[A-Za-z0-9_]+|[a-z]+:\d+|objects?\/[^"'?#]+))["']/g;

const out = { searchedAt: new Date().toISOString(), probes: [], items: {} };

// Official machine interfaces and the finding-aid catalog, which may be open where the website is not.
for (const url of [
  `${BASE}/oai2?verb=Identify`,
  `${BASE}/oai?verb=Identify`,
  `${BASE}/oai2?verb=ListSets`,
  "https://findingaids.hagley.org/search?q[]=nylon+carpet&op[]=&field[]=&limit=",
  "https://findingaids.hagley.org/search?q[]=Antron",
]) {
  const r = await get(url);
  out.probes.push({ term: "(interface)", url, status: r.status, finalUrl: r.url, error: r.error, title: (r.text.match(/<title>([^<]*)/i) || [])[1] || "",
    snippet: r.text.replace(/\s+/g, " ").slice(0, 1500) });
  await sleep(500);
}

for (const term of TERMS) {
  let links = [];
  for (const mk of SEARCHES) {
    const url = mk(term);
    const r = await get(url);
    const found = [...new Set([...r.text.matchAll(OBJ)].map(m => new URL(m[1], BASE).href))]
      .filter(u => !/\/(user|search|sites|themes|modules|core|admin|contact|about|node\/\d+\/edit)/.test(u));
    out.probes.push({ term, url, status: r.status, finalUrl: r.url, error: r.error, links: found.length, sample: found.slice(0, 5),
      title: (r.text.match(/<title>([^<]*)/i) || [])[1] || "", resultCount: (strip(r.text).match(/(\d[\d,]*)\s+(?:results?|items?|objects?)/i) || [])[0] || "" });
    if (found.length) { links = found; break; }
    await sleep(500);
  }
  for (const link of links.slice(0, PER_TERM)) {
    if (out.items[link]) { out.items[link].terms.push(term); continue; }
    const r = await get(link);
    if (r.status !== 200) { out.items[link] = { link, terms: [term], status: r.status }; continue; }
    const h = r.text;
    const fields = {};
    // Common metadata layouts: <dt>Label</dt><dd>Value</dd>, and Drupal field labels.
    for (const m of h.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)) fields[strip(m[1]).replace(/:$/, "")] = strip(m[2]).slice(0, 600);
    for (const m of h.matchAll(/class="field__label"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="field__items?">)?\s*<div[^>]*class="field__item"[^>]*>([\s\S]*?)<\/div>/gi)) fields[strip(m[1])] = strip(m[2]).slice(0, 600);
    const img = meta(h, "og:image") || (h.match(/(?:src|href)=["']([^"']*(?:datastream\/(?:TN|JPG|MEDIUM_SIZE)[^"']*|\/iiif\/[^"']+\/full\/[^"']+))["']/i) || [])[1] || "";
    out.items[link] = {
      link, finalUrl: r.url, terms: [term],
      title: meta(h, "og:title") || strip((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || (h.match(/<title>([^<]*)/i) || [])[1] || ""),
      description: (meta(h, "og:description") || meta(h, "description")).slice(0, 800),
      image: img ? new URL(img, BASE).href : "",
      fields
    };
    await sleep(400);
  }
}

await mkdir(new URL("../research/hagley/", import.meta.url), { recursive: true });
await writeFile(new URL("../research/hagley/search-results.json", import.meta.url), JSON.stringify(out, null, 2));
const items = Object.values(out.items).filter(x => x.title);
console.log(`Probes: ${out.probes.length}. Items with titles: ${items.length}.`);
for (const p of out.probes) console.log(`${p.status} ${p.links} links  ${p.url}  "${p.title.slice(0, 60)}" ${p.resultCount}`);
for (const x of items.slice(0, 80)) console.log(`- ${x.title} | ${x.fields?.Date || x.fields?.["Date Created"] || ""} | ${x.link}`);
