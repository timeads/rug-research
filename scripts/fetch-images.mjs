#!/usr/bin/env node
// Finds real images for database records that don't have one yet.
//
// For each item in data/items.js with no image, this looks up the institution's own
// image (Met / Art Institute APIs, Open Library covers, Google Patents figures, or the
// page's og:image / embedded collection image). If the record's own link has none, it
// tries Internet Archive thumbnails, an exact catalogue-number match at the V&A or on
// Wikimedia Commons, book covers matched by title, and the other pages the record cites,
// checks that the URL actually serves an image, and records the URL plus a
// credit line. Images are linked, not copied: the site displays them from the
// institution's server.
//
// Usage: node scripts/fetch-images.mjs [--refresh] [--only id1,id2]
// Runs in GitHub Actions (.github/workflows/fetch-images.yml).

import { readFile, writeFile, appendFile } from "node:fs/promises";

const FILE = new URL("../data/items.js", import.meta.url);
const args = process.argv.slice(2);
const REFRESH = args.includes("--refresh");
const ONLY = (args[args.indexOf("--only") + 1] || "").split(",").filter(Boolean);
const UA = "Mozilla/5.0 (compatible; RugResearchImageBot/1.0; +https://github.com/timeads/rug-research)";
const BAD = /logo|favicon|sprite|placeholder|default[-_]?image|no[-_ ]?image|image[-_ ]?not[-_ ]?available|coming[-_]?soon|blank\.|spacer|icon[-_.]|social[-_]?share|og[-_]default|share[-_]image|\/themes?\/|\/assets\/img|\bogp\b|og[-_]?banner|banner|menu[-_]image|[-_]hdr\b|header|_site-config|img\.youtube\.com|ytimg\.com|\bmap[-_ (]/i;
// Stock-photo filenames (Pixabay "macro-2573557_1920", Shutterstock, iStock…) are illustrations, not evidence.
const STOCK = /(shutterstock|istock|adobestock|gettyimages|pexels|unsplash|pixabay|dreamstime|depositphotos)|[a-z]-\d{6,8}_(640|960|1280|1920)\b/i;

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    return await fetch(url, { redirect: "follow", signal: ctrl.signal, ...opts, headers: { "User-Agent": UA, Accept: "*/*", ...(opts.headers || {}) } });
  } finally { clearTimeout(t); }
}
const json = async url => { const r = await get(url, { headers: { Accept: "application/json" } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };

// Confirms a URL serves a real image (not an HTML error page or a tiny icon).
async function isImage(url, minBytes = 6000) {
  if (STOCK.test(url)) return false;
  try {
    const r = await get(url, { headers: { Accept: "image/*" } });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.startsWith("image/")) return false;
    const buf = await r.arrayBuffer();
    return buf.byteLength > minBytes;
  } catch { return false; }
}

const decode = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/g, "/");
function metaImages(html, base) {
  const out = [];
  const tags = html.match(/<meta[^>]+>/gi) || [];
  for (const tag of tags) {
    if (/(property|name)=["'](og:image(:secure_url)?|twitter:image(:src)?)["']/i.test(tag)) {
      const m = tag.match(/content=["']([^"']+)["']/i);
      if (m) out.push(m[1]);
    }
  }
  const link = html.match(/<link[^>]+rel=["']image_src["'][^>]*>/i);
  if (link) { const m = link[0].match(/href=["']([^"']+)["']/i); if (m) out.push(m[1]); }
  return out.map(u => { try { return new URL(decode(u), base).href; } catch { return null; } }).filter(Boolean);
}
// Collection-system image URLs embedded in the page (eMuseum, IIIF, media servers).
function collectionImages(html, base, item) {
  const out = [];
  const acc = (item.identifier || "").replace(/^.*?(\d{2,4}[.\-]\d[\w.\-]*).*$/, "$1");
  const re = /(?:src|data-src|href|content)=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?|[^"']*(?:\/internal\/media\/dispatcher\/|\/iiif\/|\/media\/|\/images\/collection|\/full\/)[^"']*)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = decode(m[1]);
    if (BAD.test(u)) continue;
    const score = (acc && u.includes(acc) ? 5 : 0) + (/dispatcher|iiif|full|large|zoom|media/i.test(u) ? 2 : 0);
    // Any sizeable photo file is a weak candidate on collection pages that lack og:image.
    out.push([score || (/\.(jpe?g|webp)(\?|$)/i.test(u) && /files|uploads|images|media|collection|objects|piction/i.test(u) ? 1 : 0), u]);
  }
  return out.filter(([sc]) => sc > 0).sort((a, b) => b[0] - a[0]).map(([, u]) => { try { return new URL(u, base).href; } catch { return null; } }).filter(Boolean);
}

const RESOLVERS = [
  { // Winterthur: object images live on S3 under the object id
    test: u => /museumcollection\.winterthur\.org\/object\/\d+/.test(u),
    async run(item) {
      const id = item.sourceUrl.match(/object\/(\d+)/)[1];
      const url = `https://winocr-images.s3.us-east-1.amazonaws.com/art-objects/live/${id}/multimedia/0-original.jpg`;
      return (await isImage(url)) ? { image: url, imageCredit: "Winterthur Museum, Garden & Library" } : null;
    }
  },
  { // The Met: object id in URL, or an accession-number search
    test: u => /metmuseum\.org/.test(u),
    async run(item) {
      let id = (item.sourceUrl.match(/\/search\/(\d+)/) || [])[1];
      if (!id && item.identifier) {
        // v1 search was retired on 2026-10-01 (v1.1 is paginated). Fall back to ids linked from the website's search page.
        let ids = [];
        try { ids = (await json(`https://collectionapi.metmuseum.org/public/collection/v1.1/search?limit=15&q=${encodeURIComponent(item.identifier)}`)).objectIDs || []; }
        catch {
          const html = await (await get(`https://www.metmuseum.org/art/collection/search?q=${encodeURIComponent(item.identifier)}`)).text();
          ids = [...new Set([...html.matchAll(/collection\/search\/(\d+)/g)].map(m => m[1]))];
        }
        for (const oid of ids.slice(0, 15)) {
          const o = await json(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${oid}`);
          if (o.accessionNumber === item.identifier) { id = oid; break; }
        }
      }
      if (!id) return null;
      const o = await json(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
      const img = o.primaryImage || o.primaryImageSmall;
      return img ? { image: img, imageCredit: `The Metropolitan Museum of Art${o.isPublicDomain ? " (Open Access, public domain)" : ""}`, sourceUrl: o.objectURL || item.sourceUrl } : null;
    }
  },
  { // Art Institute of Chicago
    test: u => /artic\.edu\/artworks\/\d+/.test(u),
    async run(item) {
      const id = item.sourceUrl.match(/artworks\/(\d+)/)[1];
      const r = await json(`https://api.artic.edu/api/v1/artworks/${id}?fields=image_id,is_public_domain`);
      return r.data?.image_id ? { image: `${r.config?.iiif_url || "https://www.artic.edu/iiif/2"}/${r.data.image_id}/full/843,/0/default.jpg`, imageCredit: "Art Institute of Chicago" } : null;
    }
  },
  { // Google Patents: first drawing sheet
    test: u => /patents\.google\.com/.test(u),
    async run(item) {
      const html = await (await get(item.sourceUrl)).text();
      const m = html.match(/https:\/\/patentimages\.storage\.googleapis\.com\/[^"'\s]+?\.(?:png|jpg)/i);
      return m ? { image: m[0], imageCredit: "Patent drawing via Google Patents (public domain)" } : null;
    }
  }
];

async function bookCover(item) {
  const isbn = (item.identifier || "").match(/97[89]\d{10}|\b\d{9}[\dX]\b/);
  if (!isbn) return null;
  const url = `https://covers.openlibrary.org/b/isbn/${isbn[0]}-L.jpg?default=false`;
  return (await isImage(url)) ? { image: url, imageCredit: "Cover via Open Library" } : null;
}

// ---- deeper lookups, used when the record's own link has no image ----
const norm = t => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const titleMatch = (a, b) => { const x = norm(a).split(" ").slice(0, 6).join(" "), y = norm(b); return x.length > 6 && (y.startsWith(x) || norm(b).split(" ").slice(0, 6).join(" ") === x); };
const urlsIn = item => [...new Set(((item.description || "") + " " + (item.citation || "")).match(/https?:\/\/[^\s)\]"'<>·,]+/g) || [])]
  .map(u => u.replace(/[.;:]+$/, "")).filter(u => u !== item.sourceUrl);
const skipPage = u => { try { const x = new URL(u); return /(^|\.)(drive|docs)\.google\.com$/.test(x.hostname) || /google\.com\/search|\.pdf($|\?)/i.test(u) || x.pathname.replace(/\/$/, "") === ""; } catch { return true; } };

// Internet Archive items carry their own thumbnail.
async function archiveThumb(item) {
  for (const u of [item.sourceUrl, ...urlsIn(item)]) {
    const m = String(u || "").match(/archive\.org\/details\/([^/?#\s]+)/);
    if (m) { const img = `https://archive.org/services/img/${m[1]}`; if (await isImage(img, 8000)) return { image: img, imageCredit: "Internet Archive" }; }
  }
  return null;
}
// A catalogue number is only trusted when the collection returns that exact number.
async function byAccession(item) {
  const acc = String(item.identifier || "").trim();
  if (!acc || !/\d/.test(acc) || acc.length < 4 || item.type === "patent") return null;
  if (/V&A|Victoria and Albert/i.test(item.institution || "") || /vam\.ac\.uk/.test(item.sourceUrl || "")) {
    const r = await json(`https://api.vam.ac.uk/v2/objects/search?q=${encodeURIComponent(acc)}&page_size=10&images_exist=1`);
    const o = (r.records || []).find(x => (x.accessionNumber || "").toUpperCase() === acc.toUpperCase());
    if (o?._images?._iiif_image_base_url) return { image: o._images._iiif_image_base_url + "full/!1000,1000/0/default.jpg", imageCredit: "Victoria and Albert Museum, London", sourceUrl: item.sourceUrl || `https://collections.vam.ac.uk/item/${o.systemNumber}/` };
  }
  // Wikimedia Commons file names often carry the museum's number, e.g. "… NGA 25792.jpg".
  const r = await json(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent('"' + acc + '"')}&gsrlimit=10&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1000`);
  const key = acc.replace(/\s+/g, "").toLowerCase();
  const inst = norm(item.institution).split(" ").filter(w => w.length > 3);
  for (const pg of Object.values(r.query?.pages || {})) {
    const t = pg.title.replace(/[\s_]+/g, "").toLowerCase(), credit = norm((pg.imageinfo?.[0]?.extmetadata?.Credit?.value || "") + " " + pg.title);
    if (t.includes(key) && (!inst.length || inst.some(w => credit.includes(w)))) {
      const ii = pg.imageinfo[0]; return { image: ii.thumburl || ii.url, imageCredit: `Wikimedia Commons (${ii.extmetadata?.LicenseShortName?.value || "see file page"})` };
    }
  }
  return null;
}
// Book covers by title (and author), accepted only when the titles agree.
async function coverByTitle(item) {
  if (!["book", "trade-catalog", "article"].includes(item.type) || !item.title) return null;
  const title = item.title.replace(/\s*\(.*?\)\s*$/, ""), author = (item.creator || "").split(/[;,]/)[0];
  try {
    const r = await json(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}${author ? "&author=" + encodeURIComponent(author) : ""}&limit=5&fields=title,cover_i`);
    const d = (r.docs || []).find(x => x.cover_i && titleMatch(title, x.title));
    if (d) { const img = `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`; if (await isImage(img)) return { image: img, imageCredit: "Cover via Open Library" }; }
  } catch {}
  try {
    const r = await json(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:"${title}"` + (author ? ` inauthor:"${author}"` : ""))}&maxResults=5`);
    const v = (r.items || []).find(x => x.volumeInfo?.imageLinks?.thumbnail && titleMatch(title, x.volumeInfo.title + (x.volumeInfo.subtitle ? ": " + x.volumeInfo.subtitle : "")));
    if (v) { const img = v.volumeInfo.imageLinks.thumbnail.replace(/^http:/, "https:").replace("&edge=curl", ""); if (await isImage(img, 4000)) return { image: img, imageCredit: "Cover via Google Books" }; }
  } catch {}
  return null;
}
// Other pages the record cites: their collection image or og:image.
async function fromOtherPages(item) {
  // Another page's picture can illustrate a company, an event or a book, but an object or archive
  // record must show that object: a similar rug from elsewhere would be misleading.
  if (!["company", "event", "book", "trade-catalog"].includes(item.type)) return null;
  for (const u of urlsIn(item).filter(u => !skipPage(u)).slice(0, 6)) {
    try {
      const alt = { ...item, sourceUrl: u };
      const special = RESOLVERS.find(r => r.test(u));
      const r = special ? await special.run(alt) : await fromPage(alt);
      if (r && (await isImage(r.image))) {
        const host = new URL(u).hostname.replace(/^www\./, "");
        return { ...r, sourceUrl: item.sourceUrl, imageCredit: special ? r.imageCredit : `${r.imageCredit === item.institution ? host : r.imageCredit} (image from ${host})`, imagePage: u };
      }
    } catch {}
    await sleep(300);
  }
  return null;
}

async function fromPage(item) {
  const r = await get(item.sourceUrl, { headers: { Accept: "text/html" } });
  if (!r.ok || !(r.headers.get("content-type") || "").includes("html")) return null;
  const html = await r.text();
  const base = r.url || item.sourceUrl;
  const host = new URL(base).hostname.replace(/^www\./, "");
  const cands = [...metaImages(html, base), ...collectionImages(html, base, item)].filter(u => !BAD.test(u));
  for (const u of [...new Set(cands)].slice(0, 6)) if (await isImage(u, 20000)) return { image: u, imageCredit: item.institution || host };
  return null;
}

async function primary(item) {
  if (item.type === "book" || item.type === "trade-catalog") { const c = await bookCover(item); if (c) return c; }
  if (!item.sourceUrl) return null;
  if (/(^|\.)(drive|docs)\.google\.com$/.test(new URL(item.sourceUrl).hostname)) return null; // private Drive files
  try { if (new URL(item.sourceUrl).pathname.replace(/\/$/, "") === "") return null; } catch { return null; }
  const special = RESOLVERS.find(r => r.test(item.sourceUrl));
  if (special) { const r = await special.run(item); if (r && (await isImage(r.image))) return r; }
  // Search-engine links, PDFs and finding aids rarely carry an object image.
  if (/google\.com\/search|\.pdf($|\?)/i.test(item.sourceUrl)) return null;
  return fromPage(item);
}
async function resolve(item) {
  // Research findings are statements, not objects: the site shows a related record's image instead.
  if (item.type === "finding") return null;
  for (const step of [primary, archiveThumb, byAccession, coverByTitle, fromOtherPages]) {
    try { const r = await step(item); if (r) return r; } catch (e) { console.log(`  ${step.name}: ${e.message}`); }
  }
  return null;
}

const src = await readFile(FILE, "utf8");
const at = src.indexOf("window.RUG_ITEMS = ");
const header = src.slice(0, at);
const items = JSON.parse(src.slice(at + "window.RUG_ITEMS = ".length).trim().replace(/;$/, ""));

// Results are cached for the run, so a retry after a rejected push (the workflow starts again from
// the latest data) reuses them instead of repeating every lookup.
const CACHE = process.env.IMAGE_CACHE ? new URL(`file://${process.env.IMAGE_CACHE}`) : null;
let cache = {};
if (CACHE) { try { cache = JSON.parse(await readFile(CACHE, "utf8")); } catch {} }
const found = [], missed = [];
for (const item of items) {
  if (ONLY.length && !ONLY.includes(item.id)) continue;
  if (item.image && !REFRESH) continue;
  if (item.image && item.imageSource !== "auto") continue; // never overwrite a hand-picked image
  if (item.imageSource === "rejected") continue; // a person ruled out the found image; don't look again
  const cached = item.id in cache;
  try {
    const r = cached ? cache[item.id] : await resolve(item);
    cache[item.id] = r || null;
    if (r) { Object.assign(item, r, { imageSource: "auto" }); found.push(item); console.log(`✓ ${item.id}  ${r.image}`); }
    else {
      if (item.imageSource === "auto") { delete item.image; delete item.imageCredit; delete item.imageSource; } // refreshed and gone
      missed.push([item, "no image on source page"]); console.log(`– ${item.id}`);
    }
  } catch (e) { missed.push([item, e.message]); console.log(`! ${item.id}  ${e.message}`); }
  if (!cached) await sleep(400); // be polite to museum servers
}

// A URL shared by unrelated records is a site-wide banner, not an object photo.
const counts = {};
for (const it of found) counts[it.image] = (counts[it.image] || 0) + 1;
for (const it of found) if (counts[it.image] > 1 && new Set(found.filter(x => x.image === it.image).map(x => x.sourceUrl)).size > 1) {
  delete it.image; delete it.imageCredit; delete it.imageSource; missed.push([it, "only a generic site image"]);
}

await writeFile(FILE, header + "window.RUG_ITEMS = " + JSON.stringify(items, null, 2) + ";\n");
if (CACHE) await writeFile(CACHE, JSON.stringify(cache));
const kept = found.filter(x => x.image);
const summary = [`## Image lookup`, ``, `Found **${kept.length}**, no image for **${missed.length}**.`, ``,
  ...kept.map(x => `- ✅ ${x.title}: ${x.imageCredit}`), ...missed.map(([x, why]) => `- ⬜ ${x.title}: ${why}`)].join("\n");
console.log("\n" + summary);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
