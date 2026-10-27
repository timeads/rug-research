#!/usr/bin/env node
// Finds real images for database records that don't have one yet.
//
// For each item in data/items.js with a sourceUrl and no image, this looks up
// the institution's own image (Met / Art Institute APIs, Open Library covers,
// Google Patents figures, or the page's og:image / embedded collection image),
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
const BAD = /logo|favicon|sprite|placeholder|default[-_]?image|no[-_ ]?image|image[-_ ]?not[-_ ]?available|coming[-_]?soon|blank\.|spacer|icon[-_.]|social[-_]?share|og[-_]default|share[-_]image|\/themes?\/|\/assets\/img/i;
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
        // The API search endpoint may be unavailable; fall back to object ids linked from the website's search page.
        let ids = [];
        try { ids = (await json(`https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(item.identifier)}`)).objectIDs || []; }
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

async function resolve(item) {
  if (item.type === "book" || item.type === "trade-catalog") { const c = await bookCover(item); if (c) return c; }
  if (!item.sourceUrl) return null;
  // Research findings are statements, not objects; a site's home page shows a banner, not the record.
  if (item.type === "finding") return null;
  try { if (new URL(item.sourceUrl).pathname.replace(/\/$/, "") === "") return null; } catch { return null; }
  const special = RESOLVERS.find(r => r.test(item.sourceUrl));
  if (special) { const r = await special.run(item); if (r && (await isImage(r.image))) return r; }
  // Search-engine links, PDFs and finding aids rarely carry an object image.
  if (/google\.com\/search|\.pdf($|\?)/i.test(item.sourceUrl)) return null;
  return fromPage(item);
}

const src = await readFile(FILE, "utf8");
const at = src.indexOf("window.RUG_ITEMS = ");
const header = src.slice(0, at);
const items = JSON.parse(src.slice(at + "window.RUG_ITEMS = ".length).trim().replace(/;$/, ""));

const found = [], missed = [];
for (const item of items) {
  if (ONLY.length && !ONLY.includes(item.id)) continue;
  if (item.image && !REFRESH) continue;
  if (item.image && item.imageSource !== "auto") continue; // never overwrite a hand-picked image
  if (item.imageSource === "rejected") continue; // a person ruled out the found image; don't look again
  try {
    const r = await resolve(item);
    if (r) { Object.assign(item, r, { imageSource: "auto" }); found.push(item); console.log(`✓ ${item.id}  ${r.image}`); }
    else {
      if (item.imageSource === "auto") { delete item.image; delete item.imageCredit; delete item.imageSource; } // refreshed and gone
      missed.push([item, "no image on source page"]); console.log(`– ${item.id}`);
    }
  } catch (e) { missed.push([item, e.message]); console.log(`! ${item.id}  ${e.message}`); }
  await sleep(400); // be polite to museum servers
}

// A URL shared by unrelated records is a site-wide banner, not an object photo.
const counts = {};
for (const it of found) counts[it.image] = (counts[it.image] || 0) + 1;
for (const it of found) if (counts[it.image] > 1 && new Set(found.filter(x => x.image === it.image).map(x => x.sourceUrl)).size > 1) {
  delete it.image; delete it.imageCredit; delete it.imageSource; missed.push([it, "only a generic site image"]);
}

await writeFile(FILE, header + "window.RUG_ITEMS = " + JSON.stringify(items, null, 2) + ";\n");
const kept = found.filter(x => x.image);
const summary = [`## Image lookup`, ``, `Found **${kept.length}**, no image for **${missed.length}**.`, ``,
  ...kept.map(x => `- ✅ ${x.title}: ${x.imageCredit}`), ...missed.map(([x, why]) => `- ⬜ ${x.title}: ${why}`)].join("\n");
console.log("\n" + summary);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
