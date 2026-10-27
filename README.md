# Rug Research Database

A searchable, visual research database of rugs, carpets and tufting: objects, books, images, archives, trade catalogs, yarn and fiber samples, and tools.

It serves two projects:
1. **Short term:** a research proposal for a Winterthur fellowship. The deadline for the next cycle appears to be January 15, 2027; confirm this on [winterthur.org](https://www.winterthur.org/research-and-scholars/research-fellowships/).
2. **Long term:** a history of tufting.

## Opening it

- **On your computer:** double-click `index.html`. It needs no installation or internet, except to load fonts, remote images and the Discover search.
- **As a website:** in GitHub, go to repo **Settings → Pages**, choose "Deploy from a branch", and pick the branch and `/ (root)`. The site appears at `https://timeads.github.io/rug-research/`.

## What it does

| Tab | Use it to |
|---|---|
| **Browse** | Search everything. Filter by flag, type, theme, institution and verification status. Switch between grid and list views. Click a card for full details, notes and a citation. |
| **Timeline** | See your current results grouped by decade, so gaps in the history of tufting stand out. |
| **Compile** | Build named lists (e.g. "Winterthur fellowship application"), put them in order, write an intro, and export as Markdown, CSV or JSON, or print to PDF. |
| **Discover** | Search the Met, the Art Institute of Chicago and Open Library live. Add results, with images, in one click. |
| **Search elsewhere** | One-click searches of Winterthur (museum, library, trade catalogs), Hagley (Digital Archives, finding aids), HathiTrust, Internet Archive, Google Patents, Digital Library of Georgia, the Bandy Heritage Center and more. |

### Search syntax
- `hooked rug` matches items containing both words
- `"tufting machine"` matches the exact phrase
- `-wool` excludes items containing "wool"
- `type:book`, `type:yarn`, `type:tool`, `type:trade-catalog`, `type:image`, …
- `inst:hagley`, `theme:nylon`, `tag:priority`, `material:cotton`, `technique:hooked`, `by:patton`
- `year:1940-1960` matches items whose date range overlaps those years
- `flag:fellowship`, `status:unverified`

Press `/` anywhere to jump to search.

### Flags
There are five flags: Winterthur fellowship ★, History of tufting ⚑, Follow up / verify, Request / visit, and Need image rights. The ★ and ⚑ flags have one-click buttons on every card.

### Adding your own things
Click **+ Add item**. For yarn samples, tools and your own photos, upload a picture straight from your phone or computer. Photos are resized and stored in the browser.

## Where your work is saved and how to keep it

Flags, notes, lists, edits and uploaded photos are saved **in your browser** on the device you use.

- **Export → Backup my flags, notes & lists** downloads one `.json` file containing everything, photos included. Do this regularly, and use **Restore** to move to another computer.
- **Export → Database file (items.js)** downloads the full database with your additions and edits. Replace `data/items.js` in this repo with it and commit, and the records become part of the permanent, shared site.

## Data

- `data/items.js` holds the records. Each one has `type`, `title`, `creator`, `date`/`dateStart`/`dateEnd`, `institution`, `collection`, `identifier`, `materials`, `techniques`, `themes`, `tags`, `description`, `sourceUrl`, `image` and `status`.
- `data/sources.js` holds the "Search elsewhere" portals. Add a line to add another archive.

**Every seed record is marked `unverified`.** They were gathered from search results, not from the institutions' own catalogs, because this was built in an environment that could not reach winterthur.org or hagley.org. Before citing a record, open its source link, confirm the details, and set its status to "Verified at source".

### Starting research threads in the seed data
- **Winterthur hooked and sewn rugs:** six objects dated 1800–1925. One record (1965.0685) reportedly cites a 2024 tufting manual.
- **Winterthur trade catalogs:** Olson Rug Co. (1920, 1922). McKinstry's *Trade Catalogues at Winterthur* is the finding aid for further floor-covering catalogs.
- **Nylon and DuPont at Hagley:** Advertising Dept. records (Acc. 1803; Nylon, Antron), the Seaford nylon plant photographs (carpet nylon developed there in 1958), the Textile Fibers photo album (1946–68), the Ernest Dichter study on selling nylon carpet, and the Donald R. Hull papers (anti-static carpet fiber, 1969).
- **Dalton and machine tufting:** Patton's *Carpet Capital*, Deaton's *Bedspreads to Broadloom* and his research archive at the Bandy Heritage Center, Catherine Evans Whitener, and the Looper tufting machine.
- **Open question:** what year DuPont introduced BCF nylon. Sources say 1957 or 1959; confirm in the Hagley Textile Fibers records.
