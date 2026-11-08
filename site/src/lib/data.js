// Reads the research database (../data/*.js, the same files the research tool loads) at build time.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { BASE, SITE, IMAGE_ROOT, CANONICAL } from "../../site.config.mjs";

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
// The cloth (shade) of each chapter, as in the research tool.
export const CHAPTER_CLOTH = { "ch-processes": "wheat", "ch-before-machine": "oxblood", "ch-woven": "navy", "ch-dalton-bedspreads": "rose", "ch-machine": "ochre", "ch-nylon": "teal", "ch-abroad": "indigo", "ch-china": "plum", "ch-gun": "rust", "ch-india": "umber", "ch-today": "jade", "ch-cnc": "slate", "ch-hobby": "moss" };
export const clothName = c => c ? c[0].toUpperCase() + c.slice(1) : "";
// The years a chapter's dated evidence spans.
export function chapterYears(ch) {
  const ys = (ch.items || []).map(id => db().byId[id]?.dateStart).filter(y => y != null).sort((a, b) => a - b);
  return ys.length ? [ys[0], ys.at(-1)] : null;
}
export const cloth = theme => `var(--cloth-${THEME_CLOTH[theme] || "grey"})`;

export const fmtYear = y => (y < 0 ? `${-y} BCE` : String(y));

// Images: the research database links pictures where institutions publish them; pictures kept with the
// research (own photographs, patent drawings) are served with the site (see IMAGE_ROOT in site.config.mjs). IIIF images are asked for at the
// width the layout needs.
export function imageUrl(src, width = 1200) {
  if (!src) return "";
  if (!/^https?:/.test(src)) return IMAGE_ROOT + src.replace(/^\/+/, "");
  // Pictures keep the address stored in the research database (the size the research tool shows),
  // except that Hagley's, which reliably answers large sizes, are asked for full-width pictures.
  if (!/digital\.hagley\.org/.test(src) || width < 1800) return src;
  return src.replace(/\/full\/(?:full|max|!?\d*,\d*)\/0\/default\.jpg$/, `/full/${width},/0/default.jpg`);
}
// Who may see a picture published: "own" and "public-domain" are clear; anything else is pending.
export const imageCleared = it => ["own", "public-domain", "granted"].includes(it.rights) || it.type === "patent";
// Marks a picture marked public domain in the database, unless its credit line already says so.
export const publicDomainTag = (it, credit = "") => it.rights === "public-domain" && !/public domain|cc0/i.test(`${credit} ${it.imageCredit || ""}`);

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
    case "finding": s = `“${esc(inner(it.title).replace(/^(REFUTED|UNVERIFIED|CORRECTION)\s*:\s*/i, ""))}.” Research note${it.collection ? ", " + esc(it.collection) : ""}.`; break;
    case "object": case "tool": case "yarn": s = `${esc(it.creator || "Unknown maker")}. <em>${esc(curly(it.title))}</em>, ${date}. ${join(esc(it.institution), esc(it.identifier))}.`; break;
    default: s = `${who}“${esc(inner(it.title))},” ${date}. ${join(esc(it.identifier), esc(it.collection), esc(it.institution))}.`;
  }
  return at(s.replace(/\.\s*\./g, ".").replace(/,\s*\./g, ".")) + url;
}
// A short note for the margin: title, date and where it is held; the full citation is in the notes.
export function shortCitation(it, { loc = "" } = {}) {
  if (!it) return "";
  if (it.citation) return citation(it, { link: false, loc });
  const title = it.type === "book" || it.type === "object" ? `<em>${esc(curly(it.title))}</em>` : it.type === "patent" ? esc(curly(it.title)) : `“${esc(inner(it.title.replace(/^(REFUTED|UNVERIFIED|CORRECTION)\s*:\s*/i, "")))}”`;
  const who = it.type === "book" || it.type === "article" ? (it.creator || "").split(/ and |,/)[0].trim() : "";
  const held = it.institution && !/assignee/i.test(it.institution) ? it.institution.replace(/ Museum and Library$/, "") : it.type === "article" ? it.publisher : it.type === "finding" ? "research note" : "";
  return [who, title, it.date, held, it.type === "patent" ? "" : it.identifier, loc].filter(Boolean).map(String).join(", ").replace(/,\s*,/g, ",") + ".";
}
export const base = p => BASE + p.replace(/^\/+/, "");
// The full address of a page (the public one, once the site has its domain), and of a picture.
export const canonical = p => CANONICAL + p.replace(/^\/+/, "");
export const absolute = src => (/^https?:/.test(src) ? src : new URL(src, SITE).href);

// ---------- the directory: firms, studios and artists tufting now ----------
// A record joins the Directory page when the research tool marks it "commercial" or "artist". Countries
// come from the record's region (or listingCountry, where a firm now works somewhere else), grouped here.
const REGION_OF = {
  "United States": "North America", Canada: "North America", Mexico: "Latin America", Brazil: "Latin America", Argentina: "Latin America", Peru: "Latin America", Chile: "Latin America", Colombia: "Latin America", Uruguay: "Latin America", Ecuador: "Latin America", "Puerto Rico": "Latin America", Guatemala: "Latin America", "Costa Rica": "Latin America",
  "United Kingdom": "Europe", Ireland: "Europe", France: "Europe", Belgium: "Europe", Netherlands: "Europe", Germany: "Europe", Switzerland: "Europe", Sweden: "Europe",
  Denmark: "Europe", Norway: "Europe", Finland: "Europe", Spain: "Europe", Portugal: "Europe", Italy: "Europe", Poland: "Europe", Austria: "Europe", Czechia: "Europe", Bulgaria: "Europe", Serbia: "Europe", Slovakia: "Europe", Luxembourg: "Europe", Greece: "Europe", Hungary: "Europe", Romania: "Europe", Ukraine: "Europe", Lithuania: "Europe", Latvia: "Europe", Estonia: "Europe", Slovenia: "Europe", Croatia: "Europe", Iceland: "Europe",
  Japan: "Asia", China: "Asia", "Hong Kong": "Asia", Taiwan: "Asia", "South Korea": "Asia", Korea: "Asia", Thailand: "Asia", Vietnam: "Asia", India: "Asia", Nepal: "Asia", Pakistan: "Asia", Indonesia: "Asia", Philippines: "Asia", Singapore: "Asia", Malaysia: "Asia", "Sri Lanka": "Asia", Bangladesh: "Asia", Mongolia: "Asia", Kazakhstan: "Asia",
  Australia: "Oceania", "New Zealand": "Oceania",
  Egypt: "Middle East and Africa", Turkey: "Middle East and Africa", Morocco: "Middle East and Africa", Iran: "Middle East and Africa", "South Africa": "Middle East and Africa", "United Arab Emirates": "Middle East and Africa", "Saudi Arabia": "Middle East and Africa", Qatar: "Middle East and Africa", Kuwait: "Middle East and Africa", Israel: "Middle East and Africa", Lebanon: "Middle East and Africa", Jordan: "Middle East and Africa", Nigeria: "Middle East and Africa", Kenya: "Middle East and Africa", Ghana: "Middle East and Africa", Senegal: "Middle East and Africa", Tunisia: "Middle East and Africa"
};
export const REGION_ORDER = ["North America", "Latin America", "Europe", "Asia", "Oceania", "Middle East and Africa", "Elsewhere"];
export const DIRECTORY_KINDS = [
  ["commercial", "Commercial and professional", "Manufacturers, mills and design houses making tufted rugs and carpet."],
  ["artist", "Artists and studios", "Artists and small studios making tufted work and custom rugs."],
  ["workshop", "Workshops and classes", "Places to take a tufting class: studios that teach the hand gun, by the session or the course."]
];
// A record can be listed under more than one kind: directory is one kind or a list of them.
export const directoryKinds = it => [].concat(it.directory || []).filter(k => DIRECTORY_KINDS.some(([d]) => d === k));
export const directoryCountry = it => it.listingCountry || it.region || "Not recorded";
export const directoryRegion = it => REGION_OF[directoryCountry(it)] || "Elsewhere";
export const directoryName = it => it.listingName || it.title.split(/: | \(/)[0];
export const slug = s => s.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
// A social link as words: "Instagram @handle", "TikTok @handle", or the site's name.
export function socialLabel(url) {
  let u; try { u = new URL(url); } catch { return url; }
  const host = u.hostname.replace(/^www\./, ""), first = u.pathname.split("/").filter(Boolean)[0] || "";
  const NAMES = { "instagram.com": "Instagram", "tiktok.com": "TikTok", "youtube.com": "YouTube", "facebook.com": "Facebook", "linkedin.com": "LinkedIn", "pinterest.com": "Pinterest", "x.com": "X", "twitter.com": "X", "threads.net": "Threads", "vimeo.com": "Vimeo", "behance.net": "Behance" };
  const name = NAMES[host];
  if (!name) return host;
  const h = first.replace(/^@/, "");
  return h && !["company", "channel", "user", "c", "in"].includes(h) ? `${name} @${h}` : name;
}
export const websiteLabel = url => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };
