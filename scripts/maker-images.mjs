#!/usr/bin/env node
// Finds a picture for directory entries that have none, from the maker's own website: the page's
// share image (og:image) and the large pictures on it and on a few of its own collection, shop or
// portfolio pages. Logos, icons and banners are passed over by name and by shape (each candidate's
// size is read from the start of the file), so what is attached is a photograph of their work as far
// as a script can tell. Attached pictures are marked imageSource "auto", like those fetch-images.mjs
// finds, so a person can replace any of them and the fetch workflows leave a hand-picked one alone.
//
// Usage: node scripts/maker-images.mjs [--only id1,id2]   (default: every directory entry with a
// website and no image)

import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../data/items.js", import.meta.url);
const UA = "Mozilla/5.0 (compatible; RugResearchMakerImages/1.0; +https://github.com/timeads/rug-research)";
const args = process.argv.slice(2);
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",").map(s => s.trim()).filter(Boolean) : [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

const src = await readFile(FILE, "utf8");
const at = src.indexOf("window.RUG_ITEMS = ");
const header = src.slice(0, at);
const items = JSON.parse(src.slice(at + "window.RUG_ITEMS = ".length).trim().replace(/;$/, ""));

async function get(url, opts = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opts.timeout || 20000);
  try { return await fetch(url, { redirect: "follow", signal: ctl.signal, headers: { "User-Agent": UA, ...(opts.headers || {}) } }); }
  finally { clearTimeout(t); }
}
const abs = (u, base) => { try { return new URL(u.replace(/&amp;/g, "&"), base).href; } catch { return null; } };
const LOGO = /logo|icon|favicon|sprite|placeholder|avatar|badge|payment|paypal|visa|mastercard|flag|arrow|button|loader|spinner|blank|pixel|emoji|qr[-_]?code|signature|wordmark|brandmark|og[-_]?default|share[-_]?default/i;

// Width and height from the first bytes of a PNG, GIF, JPEG or WebP file.
function dims(b) {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49) return [b.readUInt16LE(6), b.readUInt16LE(8)];
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const k = b.toString("ascii", 12, 16);
    if (k === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (k === "VP8L") { const n = b.readUInt32LE(21); return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]; }
    if (k === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  return null;
}
async function probe(url) {
  try {
    const r = await get(url, { headers: { Range: "bytes=0-131071", Accept: "image/*" }, timeout: 15000 });
    if (!r.ok) return null;
    const type = r.headers.get("content-type") || "";
    if (!/image\/(jpe?g|png|webp|gif)/.test(type)) return null;
    const reader = r.body.getReader(); const parts = []; let got = 0;
    while (got < 131072) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; }
    reader.cancel().catch(() => {});
    const d = dims(Buffer.concat(parts.map(p => Buffer.from(p))));
    return d && { w: d[0], h: d[1], type };
  } catch { return null; }
}

function candidatesIn(html, base) {
  const out = [];
  const meta = (p) => [...html.matchAll(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*>`, "gi"))].map(m => (m[0].match(/content=["']([^"']+)/i) || [])[1]).filter(Boolean);
  for (const u of [...meta("og:image"), ...meta("og:image:url"), ...meta("twitter:image")]) out.push({ url: abs(u, base), why: "og", alt: "" });
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const alt = (tag.match(/\balt=["']([^"']*)/i) || [])[1] || "";
    const srcset = (tag.match(/\b(?:data-)?srcset=["']([^"']+)/i) || [])[1];
    let u = null;
    if (srcset) { const best = srcset.split(",").map(s => s.trim().split(/\s+/)).map(([x, w]) => [x, parseInt(w) || 0]).sort((a, b) => b[1] - a[1])[0]; u = best && best[0]; }
    u = u || (tag.match(/\b(?:data-src|data-image|src)=["']([^"']+)/i) || [])[1];
    if (u && !u.startsWith("data:")) out.push({ url: abs(u.replace(/^\/\//, "https://"), base), why: "img", alt });
  }
  // Squarespace and Wix keep their gallery pictures in data attributes and JSON.
  for (const m of html.matchAll(/https?:\/\/(?:images\.squarespace-cdn\.com|static\.wixstatic\.com\/media|cdn\.shopify\.com)\/[^"'\s)\\]+/g)) out.push({ url: m[0], why: "cdn", alt: "" });
  return out.filter(c => c.url && /^https?:/.test(c.url));
}
const morePages = (html, base) => {
  const host = new URL(base).hostname;
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)/gi)].map(m => abs(m[1], base)).filter(u => u && new URL(u).hostname === host);
  return [...new Set(links.filter(u => /(rug|collection|shop|product|portfolio|work|gallery|project|tapis|alfombra|teppich|tappet|kilim|carpet)/i.test(new URL(u).pathname)))].slice(0, 3);
};
const clean = u => u.replace(/([?&])(width|w|h|height|format|v)=[^&]*/g, "$1").replace(/[?&]+$/, "");

async function findFor(it) {
  const pages = [it.website];
  const seen = new Set(), cands = [];
  for (let p = 0; p < pages.length && p < 4; p++) {
    let html = "";
    try { const r = await get(pages[p], { headers: { Accept: "text/html" } }); if (!r.ok) continue; html = await r.text(); if (p === 0) pages.push(...morePages(html, r.url || pages[p])); }
    catch { continue; }
    for (const c of candidatesIn(html, pages[p])) {
      const key = clean(c.url); if (seen.has(key)) continue; seen.add(key);
      if (LOGO.test(c.url) || LOGO.test(c.alt) || /\.(svg|ico)(\?|$)/i.test(c.url)) continue;
      cands.push({ ...c, page: pages[p], order: cands.length });
    }
    await sleep(500);
  }
  // Read each candidate's size, best-placed first, and keep the first that is big and photo-shaped.
  const ranked = cands.sort((a, b) => (a.why === "og" ? -1 : 0) - (b.why === "og" ? -1 : 0) || a.order - b.order).slice(0, 25);
  for (const c of ranked) {
    const d = await probe(c.url);
    if (!d) continue;
    const ratio = d.w / d.h;
    if (Math.min(d.w, d.h) < 400 || ratio > 2.1 || ratio < 0.45) continue; // small, or a banner or strip
    if (/png/.test(d.type) && d.w < 700) continue; // small PNGs are nearly always graphics
    return { image: c.url, imagePage: c.page, w: d.w, h: d.h };
  }
  return null;
}

const targets = items.filter(it => ONLY.length ? ONLY.includes(it.id) : (it.directory && it.website && !it.image && it.imageSource !== "rejected"));
const found = [], missed = [];
for (const it of targets) {
  if (!it.website) { missed.push(`${it.id} (no website)`); continue; }
  if (it.image && it.imageSource !== "auto") { missed.push(`${it.id} (has a hand-picked image)`); continue; }
  const r = await findFor(it).catch(() => null);
  if (r) {
    Object.assign(it, { image: r.image, imageCredit: new URL(it.website).hostname.replace(/^www\./, ""), imagePage: r.imagePage, imageSource: "auto", rights: it.rights || "not-requested" });
    found.push(`${it.id}  ${r.w}x${r.h}  ${r.image}`);
  } else missed.push(`${it.id} (nothing suitable on ${it.website})`);
}
await writeFile(FILE, header + "window.RUG_ITEMS = " + JSON.stringify(items, null, 2) + ";\n");
console.log(`Found ${found.length} of ${targets.length}.\n` + found.join("\n") + "\n\nNone found:\n" + missed.join("\n"));
