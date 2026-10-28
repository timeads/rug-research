// Which chapter notes cite each record, worked out once per build.
import { getCollection, render } from "astro:content";

let cache;
export async function citedIndex() {
  if (cache) return cache;
  cache = {};
  for (const entry of await getCollection("chapters")) {
    const { remarkPluginFrontmatter } = await render(entry);
    for (const n of remarkPluginFrontmatter.notes || []) for (const r of n.refs) {
      const list = (cache[r.id] ??= []);
      let c = list.find(x => x.slug === entry.id);
      if (!c) list.push((c = { slug: entry.id, number: entry.data.number, ns: [] }));
      if (!c.ns.includes(n.n)) c.ns.push(n.n);
    }
  }
  return cache;
}
