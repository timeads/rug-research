// Reads the research database (../data/*.js, the same files the research tool loads) at build time.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const DATA = path.resolve(process.cwd(), "../data");
let cache;
export function db() {
  if (cache) return cache;
  const ctx = { window: {} };
  for (const f of ["items", "chapters", "eras", "transcripts"]) {
    const file = path.join(DATA, f + ".js");
    if (fs.existsSync(file)) vm.runInNewContext(fs.readFileSync(file, "utf8"), ctx);
  }
  const items = (ctx.window.RUG_ITEMS || []).map(x => ({ themes: [], tags: [], materials: [], techniques: [], ...x }));
  cache = {
    items,
    byId: Object.fromEntries(items.map(x => [x.id, x])),
    chapters: ctx.window.RUG_CHAPTERS || [],
    eras: ctx.window.RUG_ERAS || [],
    transcripts: ctx.window.RUG_TRANSCRIPTS || {}
  };
  return cache;
}
export const record = id => db().byId[id];

// Theme colours: the research tool's bookcloth palette.
export const THEME_CLOTH = {
  "Early tufting: bed rugs & needlework pile": "oxblood", "Hooked & handmade rugs": "moss", "Woven carpet": "navy",
  "Chenille & candlewick": "rose", "Machine tufting & Dalton": "ochre", "Nylon & synthetic fibers (DuPont)": "teal",
  "Trade catalogs & marketing": "slate", "Tools & equipment": "umber", "Yarn & materials": "plum",
  "Global diffusion of tufting": "indigo", "Hand-tufting tools & the gun": "rust",
  "Companies & modern tufting": "jade", "Rug-making techniques": "wheat"
};
export const cloth = theme => `var(--cloth-${THEME_CLOTH[theme] || "grey"})`;

export const fmtYear = y => (y < 0 ? `${-y} BCE` : String(y));

// Images: the research database links pictures where institutions publish them; pictures kept with the
// research site (own photographs, patent drawings) are served from it. IIIF images are asked for at the
// width the layout needs.
const SITE_ROOT = "/rug-research/";
export function imageUrl(src, width = 1200) {
  if (!src) return "";
  if (!/^https?:/.test(src)) return SITE_ROOT + src.replace(/^\/+/, "");
  return src.replace(/\/full\/(?:full|max|!?\d*,\d*)\/0\/default\.jpg$/, `/full/${width},/0/default.jpg`);
}
// Who may see a picture published: "own" and "public-domain" are clear; anything else is pending.
export const imageCleared = it => ["own", "public-domain"].includes(it.rights) || it.type === "patent";

// A citation in the research tool's style (close to Chicago), as HTML.
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const it_ = s => s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
// Straight quotes to curly; quotes inside a quoted title become single quotes.
const curly = s => String(s ?? "").replace(/"([^"]*)"/g, "“$1”").replace(/(\w)'(\w)/g, "$1’$2").replace(/'([^']*)'/g, "‘$1’");
const inner = s => String(s ?? "").replace(/"([^"]*)"/g, "‘$1’").replace(/(\w)'(\w)/g, "$1’$2");
export function citation(it, { link = true, loc = "" } = {}) {
  if (!it) return "";
  const at = t => (loc ? t.replace(/\.?\s*$/, `, ${esc(loc)}.`) : t);
  const url = link && it.sourceUrl ? ` <a href="${esc(it.sourceUrl)}" rel="noopener">${esc(it.sourceUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>.` : "";
  if (it.citation) return at(it_(esc(it.citation))) + (url && !it.citation.includes("http") ? url : "");
  const who = it.creator ? esc(it.creator) + ". " : "";
  const date = esc(it.date || (it.dateStart != null ? fmtYear(it.dateStart) : "n.d."));
  const join = (...p) => p.filter(Boolean).join(", ");
  let s;
  switch (it.type) {
    case "book": s = `${who}<em>${esc(curly(it.title))}</em>. ${join(esc(it.publisher || it.place), date)}.`; break;
    case "article": s = `${who}“${esc(inner(it.title))}.” ${join(it.publisher ? "<em>" + esc(it.publisher) + "</em>" : "", date)}.`; break;
    case "patent": s = `${esc(curly(it.title))}, ${date}${it.institution ? `; assigned to ${esc(it.institution.replace(/\s*\(assignee\)/i, ""))}` : ""}.`; break;
    case "finding": s = `“${esc(it.title.replace(/^(REFUTED|UNVERIFIED|CORRECTION)\s*:\s*/i, ""))}.” Research note${it.collection ? ", " + esc(it.collection) : ""}.`; break;
    case "object": case "tool": case "yarn": s = `${esc(it.creator || "Unknown maker")}. <em>${esc(curly(it.title))}</em>, ${date}. ${join(esc(it.institution), esc(it.identifier))}.`; break;
    default: s = `${who}“${esc(inner(it.title))},” ${date}. ${join(esc(it.identifier), esc(it.collection), esc(it.institution))}.`;
  }
  return at(s.replace(/\.\s*\./g, ".").replace(/,\s*\./g, ".")) + url;
}
export const base = p => "/rug-research/book/" + p.replace(/^\/+/, "");
