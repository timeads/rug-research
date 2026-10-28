# A History of Tufting: the public site

An [Astro](https://astro.build) site built from the research database in `../data`. The same files make
two builds (set in `site.config.mjs`):

- **The public site, on Cloudflare Pages**, at the root of its own domain. Cloudflare builds it on every
  push. The build copies the pictures kept with the research (`../images/own`, `patents`, `tools`) and
  writes `robots.txt`, `sitemap.xml` and `_headers`.
- **The prototype, on GitHub Pages**, inside the research site at https://timeads.github.io/rug-research/book/.
  Every push that changes `site/` or `data/` rebuilds it (`.github/workflows/build-site.yml`); the built
  pages land in `../book`.

## Publishing on Cloudflare Pages

`.github/workflows/deploy-cloudflare.yml` builds the site for www.historyoftuftedrugs.com and publishes
it to the Cloudflare Pages project `historyoftuftedrugs` on every push that changes `site/`, `data/` or
`images/` (or by hand, from the Actions tab). It creates the project on its first run, and
`scripts/cloudflare-setup.sh` attaches both addresses, adds their DNS records where none exist, and
redirects historyoftuftedrugs.com to www.

It needs two repository secrets (GitHub → Settings → Secrets and variables → Actions):

- `CLOUDFLARE_ACCOUNT_ID`: the Account ID shown on the Cloudflare dashboard's account home page.
- `CLOUDFLARE_API_TOKEN`: a token made at My Profile → API Tokens → Create Token → Create Custom Token,
  with these permissions: Account · Cloudflare Pages · Edit; Zone · Zone · Read; Zone · DNS · Edit;
  Zone · Single Redirect (also listed as Dynamic URL Redirects) · Edit. Limit its zone resources to
  historyoftuftedrugs.com.

`DOMAIN` in `site.config.mjs` is the address every page (the GitHub copy too) names as its canonical one,
and the sitemap uses it.

**Search engines.** Every page says `noindex` until `OPEN_TO_SEARCH` in `site.config.mjs` is `true` (and
`DOMAIN` is set). Then add the domain to Google Search Console (Cloudflare can verify it automatically) and
submit `sitemap.xml`. Chapters carry Google Scholar tags (`citation_title`, `citation_author`,
`citation_publication_date` from the chapter's `published` year) and schema.org data (a Book, with Chapters).
In Cloudflare, "Block AI bots" stops AI assistants from reading and citing the site; turn it off to let them.

To try the Cloudflare build locally: `CF_PAGES=1 npm run build`, then serve `dist/` at the root of a local
server. Run a plain `npm run build` afterwards before copying `dist/` to `../book`.

## Pages

| Page | Built from |
| --- | --- |
| Cover (`src/pages/index.astro`) | The chapter list in `data/chapters.js`; chapters with a finished file here are "Read", the rest "Soon" |
| Chapter (`src/pages/chapters/[slug].astro`) | A file in `src/content/chapters/`, e.g. `nylon.mdx` |
| Timeline (`src/pages/timeline.astro`) | Every record with a date, grouped by the eras in `data/eras.js` |
| Record (`src/pages/records/[id].astro`) | One page per record in `data/items.js` |
| Bibliography (`src/pages/bibliography.astro`) | Records of type archive, trade catalogue, film, oral history, patent, book and article |

## Writing a chapter

A chapter is an `.mdx` file: settings at the top, then the text in Markdown.

- **Cite a source** with its record id in square brackets: `[@u-mvs379gngi80e]`. Add a page or
  locator after a comma, `[@u-mvs3387y549fp, image 25]`, or cite several at once,
  `[@pat-us2071250a; @pat-us2130948a]`. Each becomes a numbered note in the margin, listed in full at
  the end, and the chapter's "Where the sources are" panel counts them. A citation to an id that
  doesn't exist stops the build and names it.
- **A picture** from a record: `<Figure id="u-mvs3jcd5g72ua" size="wide" caption="…" />`. Sizes:
  `text` (default), `wide`, `full` (edge to edge) and `margin` (beside the text on wide screens).
  `image={1}` picks a record's second gallery image. Images without cleared rights are marked
  "Permission pending".
- **Two pictures side by side**: wrap two Figures in `<Pair>…</Pair>`.
- **A pull quote**: `<PullQuote from="record-id" who="DuPont press release, 12 May 1948">Quoted words</PullQuote>`.
- **A side box**: `<Aside title="Still to find">…</Aside>`.
- The settings at the top set the chapter number, title, dek (the line under the title), theme
  (which sets the colour), the opening image (`hero`), the key dates strip (`milestones`) and
  `status` (`prototype`, `draft` or `final`).

## Working on it

```
cd site
npm ci
npm run dev      # a live preview at http://localhost:4321/rug-research/book/
npm run build    # the finished site in site/dist
```
