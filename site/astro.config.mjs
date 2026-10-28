// A History of Tufting: the public site. Built from the research database in ../data.
// The prototype is published inside the research site's GitHub Pages, at /rug-research/book/:
// it builds into dist/, and the build-site workflow copies that to ../book.
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import remarkCite from "./src/lib/remark-cite.js";

export default defineConfig({
  site: "https://timeads.github.io",
  base: "/rug-research/book",
  trailingSlash: "always",
  integrations: [mdx()],
  markdown: { remarkPlugins: [remarkCite], smartypants: true }
});
