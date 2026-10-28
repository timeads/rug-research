// Where A History of Tufting is published. The same files make two builds:
// - the public site on Cloudflare Pages, at the root of its own domain (Cloudflare's build sets CF_PAGES);
// - the prototype inside the research site on GitHub Pages, at /rug-research/book/.

// The registered address, e.g. "https://www.historyoftufting.org" (no trailing slash). Until it is set,
// the Cloudflare build uses its pages.dev address.
export const DOMAIN = "";
// Let search engines index the public site. Off while the chapters are prototypes; every page says noindex.
export const OPEN_TO_SEARCH = false;
// The research database the history is built from.
export const RESEARCH_URL = "https://timeads.github.io/rug-research/";

export const ON_CLOUDFLARE = !!process.env.CF_PAGES;
export const SITE = ON_CLOUDFLARE ? DOMAIN || process.env.CF_PAGES_URL || "http://localhost:4321" : "https://timeads.github.io";
export const BASE = ON_CLOUDFLARE ? "/" : "/rug-research/book/";
// Pictures kept with the research (own photographs, patent drawings): copied into the Cloudflare build,
// served from the research site on GitHub Pages.
export const IMAGE_ROOT = ON_CLOUDFLARE ? "/" : "/rug-research/";
// The address every page gives as its own: the domain once there is one, so the GitHub copy points there too.
export const CANONICAL = DOMAIN ? DOMAIN + "/" : SITE + BASE;
export const INDEXABLE = ON_CLOUDFLARE && !!DOMAIN && OPEN_TO_SEARCH;
