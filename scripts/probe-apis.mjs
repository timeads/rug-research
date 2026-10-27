#!/usr/bin/env node
// Checks which collection search APIs a browser page can call (CORS) and saves a sample
// of each response, so the Discover view can be written against real data.
// Usage: node scripts/probe-apis.mjs [only,these,keys] [sample-chars]  ->  research/fetched/api-probe.json
import { writeFile, mkdir } from "node:fs/promises";
const ORIGIN = "https://timeads.github.io";
const Q = "tufted rug";
const e = encodeURIComponent(Q);
const ONLY = process.argv[2] ? process.argv[2].split(",") : null;
const SAMPLE = Number(process.argv[3]) || 2500;
const APIS = {
  wtMuseumHome: `https://museumcollection.winterthur.org/`,
  wtMuseumSearch: `https://museumcollection.winterthur.org/search?q=${e}`,
  wtLibraryHome: `https://library.winterthur.org/`,
  wtDigitalSearch: `https://digitalcollections.winterthur.org/search?query=${e}`,
  wtFindingAids: `https://findingaid.winterthur.org/`,
  hagleyDigitalSearch: `https://digital.hagley.org/islandora/search/${e}?type=dismax`,
  aicApp: `https://api.artic.edu/api/v1/artworks/search?q=${e}&limit=24&fields=id,title,artist_display,date_display,date_start,date_end,medium_display,image_id,place_of_origin,main_reference_number,dimensions,credit_line,artwork_type_title,department_title`,
  met11: `https://collectionapi.metmuseum.org/public/collection/v1.1/search?q=${e}&hasImages=true&limit=3`,
  metobj: `https://collectionapi.metmuseum.org/public/collection/v1/objects/14535`,
  met: `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${e}`,
  vam: `https://api.vam.ac.uk/v2/objects/search?q=${e}&page_size=3&images_exist=1`,
  cleveland: `https://openaccess-api.clevelandart.org/api/artworks/?q=${e}&limit=3&has_image=1`,
  archive: `https://archive.org/advancedsearch.php?q=${e}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=year&fl[]=mediatype&rows=3&output=json`,
  loc: `https://www.loc.gov/search/?q=${e}&fo=json&c=3`,
  chronam: `https://www.loc.gov/collections/chronicling-america/?q=${e}&fo=json&c=3`,
  commons: `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${e}&gsrlimit=3&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=600`,
  dlg: `https://dlg.usg.edu/search.json?q=${e}&per_page=3`,
  hathi: `https://catalog.hathitrust.org/api/volumes/brief/oclc/424023.json`,
  smithsonian: `https://api.si.edu/openaccess/api/v1.0/search?q=${e}&rows=3&api_key=DEMO_KEY`,
  europeana: `https://api.europeana.eu/record/v2/search.json?query=${e}&rows=3&wskey=api2demo`,
  harvard: `https://api.harvardartmuseums.org/object?q=${e}&size=3`,
  rijks: `https://data.rijksmuseum.nl/search/collection?description=${e}`,
  openlibrary: `https://openlibrary.org/search.json?q=${e}&limit=3`,
  aic: `https://api.artic.edu/api/v1/artworks/search?q=${e}&limit=3`,
  hagleyFA: `https://findingaids.hagley.org/search?q[]=${e}&format=json`,
  mfa: `https://collections.mfa.org/search/objects/*/${e}/json`,
  chs: `https://emuseum.chs.org/search/${e}/objects/json`,
};
// "sources" mode: try every Other archives search link with a sample query.
if (process.argv[2] === "sources") {
  const vm = await import("node:vm"); const fs = await import("node:fs/promises");
  const ctx = { window: {} }; vm.runInNewContext(await fs.readFile(new URL("../data/sources.js", import.meta.url), "utf8"), ctx);
  const res = {};
  for (const src of ctx.window.RUG_SOURCES) {
    const url = src.url.replace("{q}", encodeURIComponent("yarn samples"));
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", Accept: "text/html" }, redirect: "follow" });
      const body = await r.text();
      res[src.group + " / " + src.name] = { url, status: r.status, final: r.url, title: ((body.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim().slice(0, 120), mentionsQuery: /yarn/i.test(body), bytes: body.length };
    } catch (err) { res[src.group + " / " + src.name] = { url, error: err.message }; }
    console.log(src.name, res[src.group + " / " + src.name].status || res[src.group + " / " + src.name].error);
  }
  await fs.writeFile(new URL("../research/fetched/sources-probe.json", import.meta.url), JSON.stringify(res, null, 1));
  process.exit(0);
}
const out = {};
for (const [k, url] of Object.entries(APIS).filter(([k]) => !ONLY || ONLY.includes(k))) {
  try {
    const r = await fetch(url, { headers: { Origin: ORIGIN, "User-Agent": "RugResearchProbe/1.0" }, redirect: "follow" });
    const body = await r.text();
    out[k] = { url, status: r.status, cors: r.headers.get("access-control-allow-origin"), type: r.headers.get("content-type"), sample: body.slice(0, SAMPLE) };
  } catch (err) { out[k] = { url, error: err.message }; }
  console.log(k, out[k].status, out[k].cors, out[k].type || out[k].error);
}
await mkdir(new URL("../research/fetched/", import.meta.url), { recursive: true });
await writeFile(new URL("../research/fetched/api-probe.json", import.meta.url), JSON.stringify(out, null, 1));
