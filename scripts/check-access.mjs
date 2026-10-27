#!/usr/bin/env node
// Checks which archives and record links still work, and which sites keep automated tools out.
//
// For every search link on the Other archives page and every record's source link, it reads the
// site's robots.txt first. A site that asks all tools to stay out (Disallow: /) is reported and not
// visited further. Otherwise one request per link records whether it answers normally, shows a
// bot check (Cloudflare and similar), has moved, or is gone. A bot check here usually means the
// site's automatic image lookup and indexing are blocked; people in a browser normally get through.
//
// Usage: node scripts/check-access.mjs  ->  research/fetched/access-check.json and research/access-check.md

import { readFile, writeFile, mkdir } from "node:fs/promises";
import vm from "node:vm";

const UA = "Mozilla/5.0 (compatible; RugResearchLinkCheck/1.0; +https://github.com/timeads/rug-research)";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const load = async (file, name) => { const ctx = { window: {} }; vm.runInNewContext(await readFile(new URL(`../data/${file}`, import.meta.url), "utf8"), ctx); return ctx.window[name]; };
const sources = await load("sources.js", "RUG_SOURCES");
const items = await load("items.js", "RUG_ITEMS");

// robots.txt: does the group for all tools (User-agent: *) disallow the whole site?
const robots = {};
async function robotsFor(origin) {
  if (origin in robots) return robots[origin];
  let verdict = { status: "none" };
  try {
    const r = await fetch(origin + "/robots.txt", { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    const t = r.ok ? await r.text() : "";
    let all = false, blocksAll = false, mentionsAi = /GPTBot|ClaudeBot|anthropic-ai|CCBot|Google-Extended/i.test(t);
    for (const raw of t.split(/\r?\n/)) {
      const line = raw.replace(/#.*/, "").trim();
      const m = line.match(/^([\w-]+)\s*:\s*(.*)$/); if (!m) continue;
      const k = m[1].toLowerCase(), v = m[2].trim();
      if (k === "user-agent") all = v === "*";
      else if (all && k === "disallow" && v === "/") blocksAll = true;
    }
    verdict = { status: r.ok ? (blocksAll ? "disallows all tools" : "allows") : `none (${r.status})`, aiBlocks: mentionsAi };
  } catch (e) { verdict = { status: "unreachable", error: e.message }; }
  robots[origin] = verdict;
  return verdict;
}

const BOTCHECK = /Just a moment|Verifying Connection|Attention Required|cf-chl|challenges\.cloudflare\.com|Request unsuccessful\. Incapsula|Access denied|captcha|bot detection|are you a robot|Pardon Our Interruption/i;
async function check(url) {
  const origin = new URL(url).origin;
  const rb = await robotsFor(origin);
  if (rb.status === "disallows all tools") return { verdict: "robots: keep out", robots: rb.status };
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(30000) });
    const type = r.headers.get("content-type") || "";
    const body = type.includes("html") ? (await r.text()).slice(0, 40000) : "";
    const title = ((body.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim().slice(0, 100);
    const moved = new URL(r.url).origin !== origin ? r.url : (new URL(r.url).pathname !== new URL(url).pathname ? r.url : "");
    let verdict;
    if (r.status === 404 || r.status === 410 || /page not found|not found|404/i.test(title) && body.length < 30000 && !/search/i.test(url)) verdict = "gone (not found)";
    else if (r.status === 202 && !body.trim() || r.status === 403 || r.status === 429 || r.status === 503 || BOTCHECK.test(title) || BOTCHECK.test(body.slice(0, 4000))) verdict = "bot check";
    else if (r.status >= 500) verdict = `server error (${r.status})`;
    else if (r.ok) verdict = moved ? "ok (redirected)" : "ok";
    else verdict = `error (${r.status})`;
    return { verdict, status: r.status, title, moved: moved || undefined, robots: rb.status };
  } catch (e) { return { verdict: "unreachable", error: (e.cause?.code || e.message).slice(0, 80), robots: rb.status }; }
}

// 1. Other archives search links, with a sample search.
const archives = [];
for (const s of sources) {
  if (s.via === "Google") { archives.push({ name: `${s.group} / ${s.name}`, url: s.url, verdict: "via Google (not checked)" }); continue; }
  const url = s.copy ? s.home : s.url.replace("{q}", encodeURIComponent("carpet"));
  archives.push({ name: `${s.group} / ${s.name}`, url, ...(await check(url)) });
  console.log(archives.at(-1).verdict.padEnd(22), archives.at(-1).name);
  await sleep(400);
}

// 2. Record source links, one request each, a site at a time.
const links = [];
for (const it of items) {
  const u = it.sourceUrl;
  if (!u || !/^https?:/.test(u) || /google\.com\/search/.test(u)) continue;
  links.push({ id: it.id, title: it.title, url: u });
}
for (const l of links) {
  Object.assign(l, await check(l.url));
  if (!/^ok/.test(l.verdict)) console.log(l.verdict.padEnd(22), l.id, l.url);
  await sleep(300);
}

const byHost = {};
for (const l of links) { const h = new URL(l.url).hostname.replace(/^www\./, ""); (byHost[h] = byHost[h] || { records: 0, verdicts: {} }).records++; byHost[h].verdicts[l.verdict] = (byHost[h].verdicts[l.verdict] || 0) + 1; }

await mkdir(new URL("../research/fetched/", import.meta.url), { recursive: true });
await writeFile(new URL("../research/fetched/access-check.json", import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), robots, archives, links, byHost }, null, 1));

// A readable report.
const count = (list, v) => list.filter(x => x.verdict === v).length;
const lines = [`# Access check`, ``, `Checked ${new Date().toISOString().slice(0, 10)} from GitHub Actions by scripts/check-access.mjs. A "bot check" or "robots: keep out" site blocks the automatic jobs (image lookup, indexing); people in a browser usually get through. "Gone" links are broken for everyone.`, ``,
  `## Other archives (${archives.length})`, ``, `| Archive | Result | Notes |`, `|---|---|---|`,
  ...archives.map(a => `| ${a.name} | ${a.verdict} | ${[a.status && `HTTP ${a.status}`, a.title && `“${a.title}”`, a.moved && `now at ${a.moved}`, a.robots && a.robots !== "allows" && `robots.txt: ${a.robots}`].filter(Boolean).join("; ").replace(/\|/g, "/")} |`), ``,
  `## Record source links (${links.length})`, ``,
  `${count(links, "ok") + count(links, "ok (redirected)")} work, ${count(links, "bot check")} hit a bot check, ${count(links, "robots: keep out")} are on sites that ask tools to keep out, ${count(links, "gone (not found)")} are gone, ${links.filter(l => /unreachable|error/.test(l.verdict)).length} didn't answer.`, ``,
  `### Sites that block automated tools`, ``, `| Site | Records | Results |`, `|---|---|---|`,
  ...Object.entries(byHost).filter(([, v]) => v.verdicts["bot check"] || v.verdicts["robots: keep out"]).sort((a, b) => b[1].records - a[1].records).map(([h, v]) => `| ${h} | ${v.records} | ${Object.entries(v.verdicts).map(([k, n]) => `${k} ${n}`).join(", ")} |`), ``,
  `### Broken or unanswered links`, ``, `| Record | Link | Result |`, `|---|---|---|`,
  ...links.filter(l => /gone|unreachable|error/.test(l.verdict)).map(l => `| ${l.id} | ${l.url} | ${l.verdict}${l.status ? ` (HTTP ${l.status})` : ""}${l.error ? ` (${l.error})` : ""} |`), ``,
  `### Links that moved`, ``, `| Record | Link | Now |`, `|---|---|---|`,
  ...links.filter(l => l.moved).map(l => `| ${l.id} | ${l.url} | ${l.moved} |`), ``];
await writeFile(new URL("../research/access-check.md", import.meta.url), lines.join("\n"));
console.log(`\n${links.length} record links checked; report in research/access-check.md`);
