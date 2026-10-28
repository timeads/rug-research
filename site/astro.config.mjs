// A History of Tufting: the public site. Built from the research database in ../data.
// Where it is published (Cloudflare Pages at its own domain, or GitHub Pages at /rug-research/book/)
// is set in site.config.mjs. The GitHub copy builds into dist/, and the build-site workflow copies it to ../book.
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import { cpSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import remarkCite from "./src/lib/remark-cite.js";
import { SITE, BASE, ON_CLOUDFLARE, CANONICAL } from "./site.config.mjs";

// The Cloudflare build carries what a site at its own domain needs: the pictures kept with the research,
// robots.txt, a sitemap, and long caching for the fingerprinted files.
const publicSite = {
  name: "public-site",
  hooks: {
    "astro:build:done": ({ dir, pages }) => {
      if (!ON_CLOUDFLARE) return;
      const out = fileURLToPath(dir);
      for (const d of ["own", "patents", "tools"]) cpSync(fileURLToPath(new URL(`../images/${d}`, import.meta.url)), `${out}/images/${d}`, { recursive: true });
      const urls = pages.map(p => p.pathname).filter(p => !/^404/.test(p)).map(p => `  <url><loc>${CANONICAL}${p}</loc></url>`);
      writeFileSync(`${out}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
      // Crawlers are always let in: while the site is closed to search, each page's own noindex keeps it out.
      writeFileSync(`${out}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${CANONICAL}sitemap.xml\n`);
      writeFileSync(`${out}/_headers`, `/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
    }
  }
};

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: "always",
  integrations: [mdx(), publicSite],
  markdown: { remarkPlugins: [remarkCite], smartypants: true }
});
