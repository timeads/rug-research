#!/usr/bin/env node
// Checks which collection search APIs a browser page can call (CORS) and saves a sample
// of each response, so the Discover view can be written against real data.
// Usage: node scripts/probe-apis.mjs  ->  research/fetched/api-probe.json
import { writeFile, mkdir } from "node:fs/promises";
const ORIGIN = "https://timeads.github.io";
const Q = "tufted rug";
const e = encodeURIComponent(Q);
const APIS = {
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
const out = {};
for (const [k, url] of Object.entries(APIS)) {
  try {
    const r = await fetch(url, { headers: { Origin: ORIGIN, "User-Agent": "RugResearchProbe/1.0" }, redirect: "follow" });
    const body = await r.text();
    out[k] = { url, status: r.status, cors: r.headers.get("access-control-allow-origin"), type: r.headers.get("content-type"), sample: body.slice(0, 2500) };
  } catch (err) { out[k] = { url, error: err.message }; }
  console.log(k, out[k].status, out[k].cors, out[k].type || out[k].error);
}
await mkdir(new URL("../research/fetched/", import.meta.url), { recursive: true });
await writeFile(new URL("../research/fetched/api-probe.json", import.meta.url), JSON.stringify(out, null, 1));
