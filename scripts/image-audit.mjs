#!/usr/bin/env node
// Lays out every automatically found image on labelled contact sheets so a person can check by eye
// that each picture shows what its record describes. Each tile gives the record's id, title,
// institution, the image credit and the host the image came from. Images that fail to load show as
// "did not load". Writes research/fetched/image-audit-N.png (25 per sheet) and image-audit.json.
//
// Usage: node scripts/image-audit.mjs   (needs Playwright with Chromium)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import vm from "node:vm";
import { chromium } from "playwright";

const ctx = { window: {} };
vm.runInNewContext(await readFile(new URL("../data/items.js", import.meta.url), "utf8"), ctx);
const items = ctx.window.RUG_ITEMS.filter(x => x.image && /^https?:/.test(x.image) && ["auto", "manual", "picked"].includes(x.imageSource));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const PER = 25;
await mkdir(new URL("../research/fetched/", import.meta.url), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const sheets = [];
for (let s = 0; s * PER < items.length; s++) {
  const batch = items.slice(s * PER, (s + 1) * PER);
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:12px;font:13px/1.3 system-ui,sans-serif;background:#fff;color:#111}
    .g{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
    .t{border:1px solid #ccc;border-radius:6px;overflow:hidden}
    .i{height:220px;background:#eee;display:flex;align-items:center;justify-content:center}
    .i img{max-width:100%;max-height:220px;object-fit:contain}
    .x{padding:6px 8px}.n{font-weight:700;color:#a00}.id{font:11px monospace;color:#555}.h{color:#06c}
    .bad{color:#c00;font-weight:700}</style>
    <h3>Image audit sheet ${s + 1} of ${Math.ceil(items.length / PER)}</h3><div class="g">${batch.map((it, i) => `<div class="t">
    <div class="i"><img src="${esc(it.image)}" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=bad>did not load</span>'"></div>
    <div class="x"><span class="n">${s * PER + i + 1}.</span> <b>${esc(it.title.slice(0, 110))}</b><br><span class="id">${esc(it.id)} · ${esc(it.type)}</span><br>
    ${esc(it.institution || it.creator || "").slice(0, 70)}<br><span class="h">image: ${esc(host(it.image))}</span> · ${esc((it.imageCredit || "").slice(0, 70))}</div></div>`).join("")}</div>`;
  await page.setContent(html, { waitUntil: "load", timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const file = `image-audit-${s + 1}.png`;
  await page.screenshot({ path: new URL(`../research/fetched/${file}`, import.meta.url).pathname, fullPage: true });
  sheets.push(file);
  console.log(file, batch.length);
}
await browser.close();
await writeFile(new URL("../research/fetched/image-audit.json", import.meta.url), JSON.stringify(items.map((it, i) => ({ n: i + 1, id: it.id, title: it.title, image: it.image, credit: it.imageCredit, imagePage: it.imagePage })), null, 1));
console.log(`${items.length} images on ${sheets.length} sheets`);
