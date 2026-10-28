// Citations in chapter text: [@record-id] or [@record-id, p. 4] or [@one; @two, locator].
// Each becomes a numbered note (the Cite component) and is listed in the chapter's notes;
// the ids must exist in the research database, or the build stops and names the bad one.
import { db } from "./data.js";

const RE = /\[(@[a-z0-9][\w-]*(?:,[^;\]]*)?(?:;\s*@[a-z0-9][\w-]*(?:,[^;\]]*)?)*)\]/g;

export default function remarkCite() {
  return (tree, file) => {
    const { byId } = db();
    const notes = [];
    const walk = node => {
      if (!node.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type !== "text") { walk(child); continue; }
        const text = child.value;
        if (!RE.test(text)) continue;
        RE.lastIndex = 0;
        const parts = [];
        let last = 0, m;
        while ((m = RE.exec(text))) {
          if (m.index > last) parts.push({ type: "text", value: text.slice(last, m.index) });
          const refs = m[1].split(";").map(s => {
            const [id, ...loc] = s.trim().replace(/^@/, "").split(",");
            if (!byId[id.trim()]) throw new Error(`Citation [@${id.trim()}] in ${file.path || "a chapter"}: no record with that id in data/items.js`);
            return { id: id.trim(), loc: loc.join(",").trim() };
          });
          const n = notes.length + 1;
          notes.push({ n, refs });
          parts.push({
            type: "mdxJsxTextElement", name: "Cite", children: [],
            attributes: [
              { type: "mdxJsxAttribute", name: "n", value: String(n) },
              { type: "mdxJsxAttribute", name: "refs", value: JSON.stringify(refs) }
            ]
          });
          last = m.index + m[0].length;
        }
        if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
        node.children.splice(i, 1, ...parts);
        i += parts.length - 1;
      }
    };
    walk(tree);
    file.data.astro ??= {};
    file.data.astro.frontmatter ??= {};
    file.data.astro.frontmatter.notes = notes;
  };
}
