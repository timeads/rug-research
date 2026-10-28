#!/usr/bin/env node
// Checks one chapter file without building the site: the frontmatter, the MDX syntax, that every cited
// record exists, and that every Figure, PullQuote and hero names a record (with a picture, where one is
// needed). Usage, from site/: node scripts/check-chapter.mjs src/content/chapters/china.mdx
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import yaml from "js-yaml";
import { compile } from "@mdx-js/mdx";

const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/check-chapter.mjs <chapter.mdx>"); process.exit(2); }
const src = readFileSync(file, "utf8");
const problems = [];

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../../data/items.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../../data/chapters.js", import.meta.url), "utf8"), ctx);
const items = Object.values(ctx.window).find(v => Array.isArray(v) && v[0]?.id && v[0]?.type);
const chapters = Object.values(ctx.window).find(v => Array.isArray(v) && v[0]?.kind === "chapter");
const byId = Object.fromEntries(items.map(i => [i.id, i]));
const hasImage = (it, n = 0) => {
  const gallery = Array.isArray(it.images) ? it.images : [];
  if (n && !gallery[n]) return false;
  return !!(n ? gallery[n].src : it.image) && !String(it.image || "").startsWith("idb:");
};

// Frontmatter.
const m = src.match(/^---\n([\s\S]*?)\n---\n/);
if (!m) problems.push("No frontmatter block.");
const fm = m ? yaml.load(m[1]) : {};
for (const k of ["number", "title", "dek", "theme", "status", "researchChapter", "published"]) if (fm[k] == null) problems.push(`Frontmatter: missing ${k}.`);
if (fm.researchChapter && !chapters.some(c => c.id === fm.researchChapter)) problems.push(`Frontmatter: no research chapter ${fm.researchChapter}.`);
if (fm.status && !["prototype", "draft", "final"].includes(fm.status)) problems.push(`Frontmatter: status must be prototype, draft or final.`);
if (fm.hero) {
  const it = byId[fm.hero.record];
  if (!it) problems.push(`Hero: no record ${fm.hero.record}.`);
  else if (!hasImage(it, fm.hero.image || 0)) problems.push(`Hero: ${fm.hero.record} has no picture${fm.hero.image ? " at image " + fm.hero.image : ""}.`);
}
for (const [i, ms] of (fm.milestones || []).entries()) {
  if (!ms.year || !ms.label || !ms.record) problems.push(`Milestone ${i + 1}: needs year, label and record.`);
  else if (!byId[ms.record]) problems.push(`Milestone ${i + 1}: no record ${ms.record}.`);
  if (ms.year && typeof ms.year !== "string") problems.push(`Milestone ${i + 1}: put the year in quotes.`);
}

// Citations.
const body = m ? src.slice(m[0].length) : src;
const cited = new Set();
for (const [, group] of body.matchAll(/\[(@[^\]]+)\]/g))
  for (const part of group.split(";")) {
    const id = part.trim().replace(/^@/, "").split(",")[0].trim();
    cited.add(id);
    if (!byId[id]) problems.push(`Citation: no record ${id}.`);
  }

// Components.
for (const [, tag, attrs] of body.matchAll(/<(Figure|PullQuote)\b([^>]*)\/?>/g)) {
  const id = (attrs.match(/\b(?:id|from)="([^"]+)"/) || [])[1];
  const n = +((attrs.match(/image=\{(\d+)\}/) || [])[1] || 0);
  if (!id) continue;
  const it = byId[id];
  if (!it) problems.push(`${tag}: no record ${id}.`);
  else if (tag === "Figure" && !hasImage(it, n)) problems.push(`Figure: ${id} has no picture${n ? " at image " + n : ""}.`);
}

// Braces in the prose are read as code by MDX and break the page; components' own attributes may use them.
const prose = body.replace(/^import .*$/gm, "").replace(/<[A-Z][\s\S]*?>/g, "");
for (const line of prose.split("\n")) if (/[{}]/.test(line)) problems.push(`Prose: a brace in "${line.trim().slice(0, 70)}"; reword it.`);

// MDX syntax (stray angle brackets and the like stop the build).
try { await compile(body); } catch (e) { problems.push(`MDX: ${e.message}`); }

const words = body.replace(/<[^>]+>|\[@[^\]]+\]|^import .*$/gm, " ").split(/\s+/).filter(Boolean).length;
console.log(`${file}: ${words} words, ${cited.size} records cited, ${(fm.milestones || []).length} milestones`);
if (problems.length) { console.log(problems.map(p => "  ✗ " + p).join("\n")); process.exit(1); }
console.log("  ✓ No problems found.");
