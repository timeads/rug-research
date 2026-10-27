#!/usr/bin/env node
// Research helper for pages the editing environment can't reach.
// 1. Saves the readable text of each URL to research/fetched/<name>.txt.
// 2. Optionally walks a numbered series of catalog pages and records every line
//    (with nearby links) that matches a pattern, to research/fetched/<name>-matches.json.
//
// Usage:
//   node scripts/fetch-pages.mjs --urls "https://a https://b"
//   node scripts/fetch-pages.mjs --crawl "https://site/index-{n}-411.html" --from 1 --to 411 --grep "nylon|hooked" --name winterthur-textiles

import { mkdir, writeFile } from "node:fs/promises";

const arg = k => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : ""; };
const OUT = new URL("../research/fetched/", import.meta.url);
const UA = "Mozilla/5.0 (compatible; RugResearchBot/1.0; +https://github.com/timeads/rug-research)";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const toText = html => decode(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|dt|dd|td|th)>/gi, "\n").replace(/<[^>]+>/g, " "))
  .split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
const slug = u => u.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 90);

async function get(url) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30000);
  try { const r = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": UA } }); return { status: r.status, url: r.url, text: await r.text() }; }
  catch (e) { return { status: 0, url, text: "", error: e.message }; }
  finally { clearTimeout(t); }
}

await mkdir(OUT, { recursive: true });
const log = [];

for (const url of arg("--urls").split(/\s+/).filter(Boolean)) {
  const r = await get(url);
  const title = (r.text.match(/<title>([^<]*)/i) || [])[1] || "";
  const body = `URL: ${url}\nFinal: ${r.url}\nStatus: ${r.status}${r.error ? " " + r.error : ""}\nTitle: ${decode(title).trim()}\nFetched: ${new Date().toISOString()}\n\n${toText(r.text)}`;
  await writeFile(new URL(`${slug(url)}.txt`, OUT), body.slice(0, 400000));
  log.push(`${r.status} ${url} (${body.length} chars) "${title.trim().slice(0, 60)}"`);
  await sleep(600);
}

const pattern = arg("--crawl");
if (pattern) {
  const from = +arg("--from") || 1, to = +arg("--to") || from, grep = new RegExp(arg("--grep") || "nylon", "i");
  const name = arg("--name") || slug(pattern);
  const matches = [];
  for (let n = from; n <= to; n++) {
    const url = pattern.replace("{n}", n);
    const r = await get(url);
    if (r.status !== 200) { log.push(`${r.status} ${url}`); continue; }
    // Split into rows/blocks that keep their links, then test each against the pattern.
    for (const block of r.text.split(/<(?:tr|li|div class="[^"]*(?:item|record|result)[^"]*")[^>]*>/i)) {
      const text = toText(block).replace(/\n/g, " | ");
      if (!grep.test(text)) continue;
      const links = [...block.matchAll(/href=["']([^"']+)["']/gi)].map(m => new URL(decode(m[1]), url).href).filter(h => !/index_files|\.css|\.js/.test(h)).slice(0, 4);
      const imgs = [...block.matchAll(/src=["']([^"']+\.(?:jpe?g|png|gif))["']/gi)].map(m => new URL(m[1], url).href).slice(0, 2);
      matches.push({ page: n, text: text.slice(0, 600), links, imgs });
    }
    if (n % 25 === 0) log.push(`…page ${n}, ${matches.length} matches so far`);
    await sleep(500);
  }
  await writeFile(new URL(`${name}-matches.json`, OUT), JSON.stringify({ pattern, from, to, grep: grep.source, crawledAt: new Date().toISOString(), count: matches.length, matches }, null, 1));
  log.push(`Crawl ${name}: ${matches.length} matching blocks`);
}

console.log(log.join("\n"));
