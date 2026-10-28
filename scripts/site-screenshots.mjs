#!/usr/bin/env node
// Photographs the live public site (desktop and phone) so its pictures can be checked by eye from
// anywhere: research/site-shots/*.png. Waits for each page's images to finish loading.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = "https://timeads.github.io/rug-research/book/";
const SHOTS = [
  ["cover", "", 1440, 900, true],
  ["chapter-desktop", "chapters/nylon/", 1440, 900, true],
  ["chapter-phone", "chapters/nylon/", 390, 844, true],
  ["cover-phone", "", 390, 844, true],
  ["timeline", "timeline/", 1440, 900, false],
  ["record", "records/u-mvs3jcd5g72ua/", 1440, 900, false]
];
await mkdir(new URL("../research/site-shots/", import.meta.url), { recursive: true });
const browser = await chromium.launch();
const report = [];
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
