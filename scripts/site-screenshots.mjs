#!/usr/bin/env node
// Photographs the live public site (desktop and phone) so its pictures can be checked by eye from
// anywhere: research/site-shots/*.png. Waits for each page's images to finish loading.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

// The site to photograph: the GitHub Pages prototype, or another address given as SHOTS_BASE (e.g. the domain).
const BASE = (process.env.SHOTS_BASE || "https://timeads.github.io/rug-research/book/").replace(/\/?$/, "/");
const SHOTS = [
  ["cover", "", 1440, 900, true],
  ["chapter-desktop", "chapters/nylon/", 1440, 900, true],
  ["chapter-phone", "chapters/nylon/", 390, 844, true],
  ["dalton-desktop", "chapters/dalton/", 1440, 900, true],
  ["dalton-phone", "chapters/dalton/", 390, 844, true],
  ["cover-phone", "", 390, 844, true],
  ["timeline", "timeline/", 1440, 900, false],
  ["record", "records/u-mvs3jcd5g72ua/", 1440, 900, false]
];
await mkdir(new URL("../research/site-shots/", import.meta.url), { recursive: true });
const browser = await chromium.launch();
const report = [`Site: ${BASE}`];
// At a site's own domain, also check what a crawler and a mistyped address see: the files search engines
// read, the not-found page, and (for a www address) the bare domain's redirect.
if (new URL(BASE).pathname === "/") {
  for (const path of ["robots.txt", "sitemap.xml", "no-such-page/"]) {
    const r = await fetch(BASE + path);
    report.push(`${path}: ${r.status}${path === "sitemap.xml" ? `, ${((await r.text()).match(/<url>/g) || []).length} pages` : ""}`);
  }
  const robots = (await (await fetch(BASE)).text()).match(/<meta name="robots" content="([^"]*)"/)?.[1];
  report.push(`robots tag on the cover: ${robots}`);
  const host = new URL(BASE).host;
  if (host.startsWith("www.")) {
    const bare = `https://${host.slice(4)}/chapters/dalton/?x=1`;
    const r = await fetch(bare, { redirect: "manual" });
    report.push(`${bare}: ${r.status} -> ${r.headers.get("location")}`);
  }
}
for (const [name, path, width, height, full] of SHOTS) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90000 });
  // Lazy images load as they scroll into view: scroll through, then back to the top.
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); });
  await page.waitForLoadState("networkidle");
  const imgs = await page.$$eval("img", list => list.map(i => ({ src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0 })));
  report.push(`${name}: ${imgs.filter(i => i.ok).length} of ${imgs.length} images loaded${imgs.filter(i => !i.ok).map(i => "\n  broken: " + i.src).join("")}`);
  await page.screenshot({ path: `research/site-shots/${name}.png`, fullPage: full });
  await page.close();
}
await browser.close();
console.log(report.join("\n"));
await (await import("node:fs/promises")).writeFile("research/site-shots/report.txt", report.join("\n") + "\n");
