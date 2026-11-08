// Reads the short version's text (src/text/short-version.md), which the research tool's Book view edits.
// "## " starts a section. A section with "### Chapter N" entries is a part of the book; a list of
// "- **year** text" lines is the dates; any other list is a plain list; anything else is prose. The first
// section is the "In brief" box. Front matter: title, lede (the line under the title) and foot (the closing line).
export function parseShortVersion(src) {
  src = String(src).replace(/\r\n/g, "\n");
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm = {};
  for (const line of (m ? m[1] : "").split("\n")) {
    const f = line.match(/^(\w+):\s*(.*)$/); if (!f) continue;
    let v = f[2].trim();
    if (/^".*"$/.test(v)) { try { v = JSON.parse(v); } catch { v = v.slice(1, -1); } }
    fm[f[1]] = v;
  }
  const body = m ? src.slice(m[0].length) : src;
  const paras = t => t.split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, " ").trim()).filter(p => p && !/^- /.test(p));
  const sections = body.split(/^## /m).slice(1).map((chunk, i) => {
    const nl = chunk.indexOf("\n"), heading = (nl < 0 ? chunk : chunk.slice(0, nl)).trim(), rest = nl < 0 ? "" : chunk.slice(nl + 1);
    if (/^### /m.test(rest)) {
      const chapters = rest.split(/^### /m).slice(1).map(c => {
        const k = c.indexOf("\n"), h = (k < 0 ? c : c.slice(0, k)).trim(), n = +(h.match(/\d+/) || [])[0];
        return { heading: h, n, paras: paras(k < 0 ? "" : c.slice(k + 1)) };
      });
      return { heading, kind: "part", chapters };
    }
    const items = rest.split("\n").filter(l => /^\s*-\s+/.test(l)).map(l => l.replace(/^\s*-\s+/, "").trim());
    if (items.length) {
      const dated = items.map(t => t.match(/^\*\*(.+?)\*\*\s*(.*)$/));
      if (dated.every(Boolean)) return { heading, kind: "dates", items: dated.map(d => ({ when: d[1], text: d[2] })) };
      return { heading, kind: "list", items };
    }
    return { heading, kind: i === 0 ? "brief" : "prose", paras: paras(rest) };
  });
  return { fm, sections };
}
// Inline marks allowed in the text: **bold** and *italic*. Everything else is printed as written.
export const inline = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
