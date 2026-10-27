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
  wtR_q: `https://museumcollection.winterthur.org/search-results?q=bed%20rug`,
  wtR_keyword: `https://museumcollection.winterthur.org/search-results?keyword=bed%20rug`,
  wtR_search: `https://museumcollection.winterthur.org/search-results?search=bed%20rug`,
  wtR_query: `https://museumcollection.winterthur.org/search-results?query=bed%20rug`,
  wtR_kw: `https://museumcollection.winterthur.org/search-results?kw=bed%20rug`,
  wtR_none: `https://museumcollection.winterthur.org/search-results`,
  wtLib8001: `http://library.winterthur.org:8001/`,
  wtS: `https://museumcollection.winterthur.org/search-results?s=bed%20rug`,
  qx1: `https://digitalcollections.winterthur.org/documents/search?search=yarn`,
  qx2: `https://digitalcollections.winterthur.org/Documents/Search/yarn`,
  qx3: `https://digitalcollections.winterthur.org/documents/search?returning=true&search=yarn`,
  lacma1: `https://collections.lacma.org/search?search_api_fulltext=yarn`,
  lacma2: `https://collections.lacma.org/?search=yarn`,
  lacma3: `https://collections.lacma.org/search?keys=yarn`,
  thf1: `https://www.thehenryford.org/collections-and-research/digital-collections/search-results`,
  thf2: `https://www.thehenryford.org/search?q=yarn`,
  thf3: `https://www.thehenryford.org/collections-and-research/digital-collections/search-results?s.0=yarn`,
  wtc1: `https://museumcollection.winterthur.org/_next/static/chunks/84b4bd254b0a1bc0.js`,
  wtc2: `https://museumcollection.winterthur.org/_next/static/chunks/b3ea614bd9f56a40.js`,
  wtc3: `https://museumcollection.winterthur.org/_next/static/chunks/eef056bf785424e1.js`,
  wtc4: `https://museumcollection.winterthur.org/_next/static/chunks/590def262d4144a1.js`,
  wtApi: { url: "https://museumcollection.winterthur.org/api/search", method: "POST", body: JSON.stringify({ query: "bed rug", hasImages: true, page: 1, perPage: 3 }) },
  wtApiPreflight: { url: "https://museumcollection.winterthur.org/api/search", method: "OPTIONS", headers: { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } },
  wtTextiles: { url: "https://museumcollection.winterthur.org/api/search", method: "POST", body: JSON.stringify({ categoriesAny: ["Textiles", "Textiles (Clothing)", "Textiles (Floorcovering)", "Textiles (Furnishing)", "Textiles (Needlework)"], page: 1, perPage: 1 }) },
  wtFloor: { url: "https://museumcollection.winterthur.org/api/search", method: "POST", body: JSON.stringify({ categoriesAny: ["Textiles (Floorcovering)"], page: 1, perPage: 200 }) },
  wtAll: { url: "https://museumcollection.winterthur.org/api/search", method: "POST", body: JSON.stringify({ page: 1, perPage: 1 }) },
  wtObj2: `https://museumcollection.winterthur.org/object/31938`,
  wtMuseumHelp: `https://museumcollection.winterthur.org/help`,
  wtMuseumObject: `https://museumcollection.winterthur.org/object/16695`,
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
  // Can these be indexed by a job, like the Winterthur museum? (October 2026)
  qxYarn: `https://digitalcollections.winterthur.org/documents/search?search=hooked%20rug`,
  qxApi: `https://digitalcollections.winterthur.org/api/documents/search?search=hooked%20rug`,
  qxIiif: `https://digitalcollections.winterthur.org/iiif/collection`,
  qxSitemap: `https://digitalcollections.winterthur.org/sitemap.xml`,
  wintercatHome: `https://library.winterthur.org/`,
  wintercatOai: `https://library.winterthur.org/oai?verb=Identify`,
  hagleyOai: `https://digital.hagley.org/oai2?verb=Identify`,
  hagleySitemap: `https://digital.hagley.org/sitemap.xml`,
  bandySearch: `https://bandyheritagecenter.pastperfectonline.com/search?search_criteria=chenille`,
  bandyBrowse: `https://bandyheritagecenter.pastperfectonline.com/bysearchterm?keyword=Bedspreads`,
  dpla: `https://api.dp.la/v2/items?q=${e}`,
  dlgRecords: `https://dlg.usg.edu/records.json?q=chenille&per_page=3`,
  mfah: `https://emuseum.mfah.org/search/chenille/objects/json`,
  cwf: `https://emuseum.history.org/search/bed%20rug/objects/json`,
  hne: `https://www.historicnewengland.org/explore/collections-access/?s=hooked+rug`,
  qxDocList: `https://digitalcollections.winterthur.org/sitemap_urls?type=DOCUMENT&skip=0&take=10000`,
  uwPazyryk: `https://depts.washington.edu/silkroad/museums/shm/shmpazyryk.html`,
  hermitagePazyryk: `https://www.hermitagemuseum.org/digital-collection/25.+archaeological+artifacts/879870`,
  uwImg1: `https://depts.washington.edu/silkroad/museums/shm/hermitagepazyryk15a.jpg`,
  uwImg2: `https://depts.washington.edu/silkroad/museums/shm/hermitagepazyryk6a.jpg`,
  cooperHewitt: `https://api.collection.cooperhewitt.org/rest/?method=cooperhewitt.search.objects&query=rug`,
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
for (const [k, spec] of Object.entries(APIS).filter(([k]) => !ONLY || ONLY.includes(k))) {
  // An entry is a URL, or { url, method, body, headers } for POST and preflight checks.
  const { url, method = "GET", body: reqBody, headers: extra = {} } = typeof spec === "string" ? { url: spec } : spec;
  try {
    const r = await fetch(url, { method, body: reqBody, headers: { Origin: ORIGIN, "User-Agent": "RugResearchProbe/1.0", ...(reqBody ? { "content-type": "application/json" } : {}), ...extra }, redirect: "follow" });
    const body = await r.text();
    out[k] = { url, method, status: r.status, cors: r.headers.get("access-control-allow-origin"), corsMethods: r.headers.get("access-control-allow-methods"), corsHeaders: r.headers.get("access-control-allow-headers"), type: r.headers.get("content-type"), sample: body.slice(0, SAMPLE) };
  } catch (err) {
    // Some sites send certificate chains Node rejects but browsers accept; retry with curl.
    try {
      const { execFileSync } = await import("node:child_process");
      const body = execFileSync("curl", ["-sSL", "-k", "-m", "30", "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124", url], { maxBuffer: 1 << 26 }).toString();
      out[k] = { url, status: "curl", error: err.message + " (" + (err.cause?.code || "") + ")", type: "text/html", sample: body.slice(0, SAMPLE) };
    } catch (e2) { out[k] = { url, error: err.message + " (" + (err.cause?.code || "") + "); curl: " + e2.message.slice(0, 200) }; }
  }
  console.log(k, out[k].status, out[k].cors, out[k].type || out[k].error);
}
await mkdir(new URL("../research/fetched/", import.meta.url), { recursive: true });
await writeFile(new URL("../research/fetched/api-probe.json", import.meta.url), JSON.stringify(out, null, 1));
