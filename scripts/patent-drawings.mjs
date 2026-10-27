#!/usr/bin/env node
// Fetches the official patent document for every patent record and renders its
// first pages (the drawing sheets on early patents, the front page on later ones)
// to PNG under images/patents/. US patents are public domain, so the images are
// stored with the site rather than linked. Other offices' documents (DE, EP, GB, CN…)
// are stored the same way but credited to the office and not marked public domain:
// check each office's terms before publishing them outside the database.
//
// Source: USPTO image server (image-ppubs.uspto.gov) for US patents, and the PDF that
// Google Patents mirrors for everything (and as the US fallback). Needs `pdftoppm`.
// Usage: node scripts/patent-drawings.mjs [--refresh] [--pages 3]

import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FILE = new URL("../data/items.js", import.meta.url);
const OUT = new URL("../images/patents/", import.meta.url);
const args = process.argv.slice(2);
const REFRESH = args.includes("--refresh");
const PAGES = Number(args[args.indexOf("--pages") + 1]) || 3;
const UA = "Mozilla/5.0 (compatible; RugResearchPatentBot/1.0; +https://github.com/timeads/rug-research)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, accept) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 60000);
  try { return await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": UA, Accept: accept } }); }
  finally { clearTimeout(t); }
}
const OFFICES = { DE: "DPMA (German Patent and Trade Mark Office)", EP: "European Patent Office", GB: "UK Intellectual Property Office",
  CN: "CNIPA (China National Intellectual Property Administration)", CH: "Swiss Federal Institute of Intellectual Property", FR: "INPI (France)",
  JP: "Japan Patent Office", NL: "Netherlands Patent Office", BE: "Belgian Office of Intellectual Property", AT: "Austrian Patent Office",
  WO: "WIPO", KR: "Korean Intellectual Property Office", IT: "Italian Patent and Trademark Office", ES: "Spanish Patent and Trademark Office",
  DK: "Danish Patent and Trademark Office", SE: "Swedish Intellectual Property Office", CA: "Canadian Intellectual Property Office", AU: "IP Australia", IN: "Indian Patent Office" };

// The PDF Google Patents mirrors from the issuing office.
async function googlePdf(id) {
  try {
    const page = await (await get(`https://patents.google.com/patent/${id}/en`, "text/html")).text();
    const m = page.match(/https:\/\/patentimages\.storage\.googleapis\.com\/[^"'\s]+\.pdf/i);
    if (!m) { console.log("  Google Patents: no PDF link on page"); return null; }
    const r = await get(m[0], "application/pdf");
    const buf = Buffer.from(await r.arrayBuffer());
    return r.ok && buf.subarray(0, 4).toString() === "%PDF" ? buf : null;
  } catch (e) { console.log(`  Google Patents: ${e.message}`); return null; }
}

async function pdfFor(num) {
  // 1. USPTO's own image server.
  try {
    const r = await get(`https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/${num}`, "application/pdf");
    const buf = Buffer.from(await r.arrayBuffer());
    if (r.ok && buf.subarray(0, 4).toString() === "%PDF") return { buf, source: "USPTO" };
    console.log(`  USPTO: ${r.status} ${r.headers.get("content-type")}`);
  } catch (e) { console.log(`  USPTO: ${e.message}`); }
  // 2. The PDF Google Patents mirrors from the USPTO.
  const buf = await googlePdf(`US${num}A`);
  return buf ? { buf, source: "USPTO via Google Patents" } : null;
}

const src = await readFile(FILE, "utf8");
const at = src.indexOf("window.RUG_ITEMS = ");
const header = src.slice(0, at);
const items = JSON.parse(src.slice(at + "window.RUG_ITEMS = ".length).trim().replace(/;$/, ""));
await mkdir(OUT, { recursive: true });

const done = [], missed = [];
for (const item of items) {
  if (item.type !== "patent") continue;
  const id = String(item.identifier || "").replace(/[\s,.\/-]/g, "").toUpperCase();
  const us = id.match(/^US0*(\d{3,8})[A-Z]?\d?$/);
  const other = !us && id.match(/^([A-Z]{2})(\d{3,12})([A-Z]\d?)$/);
  if (!us && !(other && OFFICES[other[1]])) continue;
  if (["uspto", "patent-office"].includes(item.imageSource) && !REFRESH) continue;
  if (item.imageSource === "rejected" || (item.image && !["auto", "uspto", "patent-office"].includes(item.imageSource))) continue;
  const stem = us ? `US${us[1]}` : id;
  console.log(`${stem}  ${item.title}`);
  const pdf = us ? await pdfFor(us[1]) : await googlePdf(id).then(buf => buf && { buf, source: `${OFFICES[other[1]]} via Google Patents` });
  if (!pdf) { missed.push(item); continue; }
  const tmp = join(tmpdir(), `${stem}.pdf`);
  await writeFile(tmp, pdf.buf);
  for (const f of await readdir(OUT)) if (f.startsWith(`${stem}-`)) await unlink(new URL(f, OUT));
  // Grey PNGs at 110 dpi: crisp line drawings at a few hundred KB.
  execFileSync("pdftoppm", ["-png", "-gray", "-r", "110", "-f", "1", "-l", String(PAGES), tmp, new URL(stem, OUT).pathname]);
  const pages = (await readdir(OUT)).filter(f => f.startsWith(`${stem}-`) && f.endsWith(".png")).sort();
  if (!pages.length) { missed.push(item); continue; }
  const label = us ? `US ${Number(us[1]).toLocaleString("en-US")}` : item.identifier;
  item.images = pages.map((f, i) => ({ src: `images/patents/${f}`, caption: `${label}, sheet ${i + 1}` }));
  item.image = item.images[0].src;
  item.imageCredit = us ? `${pdf.source} (public domain)` : pdf.source;
  item.imageSource = us ? "uspto" : "patent-office";
  done.push(item);
  console.log(`  saved ${pages.length} page(s) from ${pdf.source}`);
  await sleep(800); // be polite to the USPTO
}

await writeFile(FILE, header + "window.RUG_ITEMS = " + JSON.stringify(items, null, 2) + ";\n");
const summary = [`## Patent drawings`, ``, `Rendered **${done.length}** patent(s); **${missed.length}** without a downloadable PDF.`, ``,
  ...done.map(x => `- ✅ ${x.identifier}: ${x.title} (${x.images.length} page(s))`), ...missed.map(x => `- ⬜ ${x.identifier}: ${x.title}`)].join("\n");
console.log("\n" + summary);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary + "\n", { flag: "a" });
