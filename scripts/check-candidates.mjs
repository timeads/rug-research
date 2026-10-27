#!/usr/bin/env node
// Checks candidate replacement addresses for broken record links, and the Internet Archive's
// latest saved copy of each original. Reads research/relink-candidates.json ({record id: [original,
// candidates…]}) and writes research/fetched/relink-results.json for review; changes no records.
import { readFile, writeFile } from "node:fs/promises";
const UA = "Mozilla/5.0 (compatible; RugResearchLinkCheck/1.0; +https://github.com/timeads/rug-research)";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = JSON.parse(await readFile(new URL("../research/relink-candidates.json", import.meta.url), "utf8"));
async function look(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/json;q=0.9,*/*;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(30000) });
    const type = r.headers.get("content-type") || "", body = await r.text();
    const title = ((body.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim().slice(0, 140);
    return { status: r.status, final: r.url !== url ? r.url : undefined, type: type.split(";")[0], title, sample: body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 6000) };
  } catch (e) { return { error: (e.cause?.code || e.message).slice(0, 80) }; }
}
const out = {};
for (const [id, urls] of Object.entries(list)) {
  out[id] = { candidates: [] };
  for (const u of urls) { out[id].candidates.push({ url: u, ...(await look(u)) }); await sleep(400); }
  // The Internet Archive's newest saved copy of the original address.
  const wb = await look(`https://archive.org/wayback/available?url=${encodeURIComponent(urls[0])}`);
  try { out[id].wayback = JSON.parse(wb.sample).archived_snapshots?.closest || null; } catch { out[id].wayback = { error: wb.error || "unreadable" }; }
  console.log(id, out[id].candidates.map(c => c.status || c.error).join(" "), out[id].wayback?.url ? "archived" : "no archive");
  await sleep(600);
}
await writeFile(new URL("../research/fetched/relink-results.json", import.meta.url), JSON.stringify(out, null, 1));
