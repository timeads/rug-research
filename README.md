# Rug Research Database

A searchable, visual research database of rugs, carpets and tufting: objects, books, images, archives, trade catalogs, yarn and fiber samples, and tools.

It serves two projects:
1. **Short term:** a research proposal for a Winterthur fellowship. The deadline for the next cycle appears to be January 15, 2027; confirm this on [winterthur.org](https://www.winterthur.org/research-and-scholars/research-fellowships/).
2. **Long term:** a history of tufted rugs.

## Opening it

- **On your computer:** double-click `index.html`. It needs no installation or internet, except to load fonts, remote images and the Discover search.
- **As a website:** in GitHub, go to repo **Settings → Pages**, choose "Deploy from a branch", and pick the branch and `/ (root)`. The site appears at `https://timeads.github.io/rug-research/`.

## What it does

| Tab | Use it to |
|---|---|
| **Browse** | Search everything. Filter by flag, type, theme, institution and verification status. Switch between grid and list views. Click a card for full details, notes and a citation. |
| **Timeline** | See your current results grouped into seven eras and then by decade, so gaps in the history of tufted rugs stand out. Each era opens with a short summary of why the period matters (`data/eras.js`). Edit a summary in place on the page; your edit is kept in your browser and in backups, and **Restore draft** brings back the default. |
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
There are five flags: Winterthur fellowship ★, History of tufted rugs ⚑, Follow up / verify, Request / visit, and Need image rights. The ★ and ⚑ flags have one-click buttons on every card.

### Real images
Records show the institution's own photograph where one exists. The **Fetch images** GitHub Action (`.github/workflows/fetch-images.yml`) runs whenever `data/items.js` changes, every Monday, and on demand from the repo's **Actions** tab. It looks up each record's source page (Winterthur, the Met, the Art Institute of Chicago, Open Library covers, Google Patents drawings, eMuseum sites) and records the image link plus a credit. Images are **linked, not copied**, so rights stay with the institution. If it picks a wrong image, remove it in `data/items.js` and add `"imageSource": "rejected"` to that record. Records without an image show a plain label plate.

Patent records get their actual drawing sheets from the **Patent drawings** Action (`scripts/patent-drawings.mjs`), stored in `images/patents/`. US patents come from the USPTO and are public domain. Patents from other offices (DE, EP, GB, CN, CH, FR, JP and more; use the Google Patents number, e.g. `DE202015001234U1`) come from the PDF Google Patents mirrors. Those are credited to the issuing office and not marked public domain, so check that office's terms before publishing them beyond the database.

### Adding your own things
Click **+ Add item**. For yarn samples, tools and your own photos, add pictures straight from your phone or computer: choose several at once with **Add photos**, and add more later the same way. The first becomes the main picture; the rest form a strip under it (on the record page of the public site too). Any picture can be made the main one or removed. Photos are resized and kept in the browser until you publish.

## Writing the history of tufted rugs

The **Write** tab is where the book gets written. It opens with a chapter outline (`data/chapters.js`), from colonial bed rugs through Dalton, the machine, nylon, tufting's spread abroad, China, the Hong Kong gun, India and the hobby revival. Each chapter has:
- a **draft** you write in (saved as you type, with a word count), seeded with working notes from the research so far;
- its **evidence**: records you attach from any record's detail panel (*Add to a chapter or list*), numbered so the draft can cite them as [3]. You can reorder or remove them.

Use **New chapter**, **Rename** and **Move earlier/later** to reshape the outline. **Whole manuscript** downloads every chapter in order as one Markdown file, with each chapter's numbered evidence and original-language quotations, a "Sources still to chase" list and a bibliography. Lists that aren't chapters (like the Winterthur fellowship list) work as before.

### Research findings and confidence
Findings from research briefs (starting with `research/non-english-record.md`, the Chinese, Hindi, Japanese, German, French and Dutch record) are records of type **Finding**. Each keeps the **original-language quotation**, a **translation**, the **source**, the **country or region**, and a **confidence** grade:

| Grade | Meaning |
|---|---|
| Solid | Primary or authoritative source |
| Suggestive | Plausible but secondary, popular or uncited |
| Couldn't verify | Searched for and not found (a real gap) |
| Refuted | Checked and unsupported; never cite as fact |

Search them with `region:japan`, `conf:solid`, `lang:zh` or just type in the original script (`簇绒`, `緞通`). Sources marked `tag:"to chase"` are the offline reading list.

## Where your work is saved and how to keep it

Flags, notes, lists, edits and uploaded photos are saved **in your browser** on the device you use.

- **Export → Backup my flags, notes & lists** downloads one `.json` file containing everything, photos included. Do this regularly, and use **Restore** to move to another computer.
- **Publish** (top bar) sends your edits, new records, transcripts and uploaded photos straight to GitHub, merged with what is published there now, in one commit; the research site and www.historyoftuftedrugs.com update about two minutes later. The number on the button counts what hasn't been published yet. Before anything is sent it lists every change: fields changed on GitHub since you edited them are shown side by side (the published value stays unless you tick "Use mine"), records edited before the button existed are left unticked until you confirm them, and deletions are opt-in. It needs a fine-grained GitHub token for this repository with Contents: Read and write, made once and kept only in that browser (the dialog walks through it). The logic is in `js/publish.js`.
- **Chapter picture** (Manuscript view, beside each chapter) changes the picture at the head of that chapter on the public site: choose from the chapter's own sources or search every record with a picture (gallery photos included), click the part that must stay in view (wide-screen and phone previews follow), edit the caption, and save. It commits the change to the chapter's file with the same GitHub key as Publish; the page updates about two minutes later. It can also remove a chapter's picture.
- **Export → Database file (items.js)** still downloads the full database, for a backup or to send for merging by hand (`scripts/merge-export.cjs`).

## Data

- `data/items.js` holds the records. Each one has `type`, `title`, `creator`, `date`/`dateStart`/`dateEnd`, `institution`, `collection`, `identifier`, `materials`, `techniques`, `themes`, `tags`, `description`, `sourceUrl`, `image` and `status`.
- `data/sources.js` holds the "Search elsewhere" portals. Add a line to add another archive.

**Every seed record is marked `unverified`.** They were gathered from search results, not from the institutions' own catalogs, because this was built in an environment that could not reach winterthur.org or hagley.org. Before citing a record, open its source link, confirm the details, and set its status to "Verified at source".

### Starting research threads in the seed data
- **Early tufting (bed rugs → candlewick → chenille → machine):** see [`research/early-tufted-rugs.md`](research/early-tufted-rugs.md). Includes Winterthur's *Mary Foot* bed rug (1778), the Met's 1809 bed rug and Caswell carpet, dated candlewick spreads (1810s–1820s), the Henry Ford's 1936 chenille rug, and the Moench, Looper and Cobble tufting machines.
- **Winterthur hooked and sewn rugs:** six objects dated 1800–1925. One record (1965.0685) reportedly cites a 2024 tufting manual.
- **Winterthur trade catalogs:** Olson Rug Co. (1920, 1922). McKinstry's *Trade Catalogues at Winterthur* is the finding aid for further floor-covering catalogs.
- **Nylon and DuPont at Hagley:** Advertising Dept. records (Acc. 1803; Nylon, Antron), the Seaford nylon plant photographs (carpet nylon developed there in 1958), the Textile Fibers photo album (1946–68), the Ernest Dichter study on selling nylon carpet, and the Donald R. Hull papers (anti-static carpet fiber, 1969).
- **Dalton and machine tufting:** Patton's *Carpet Capital*, Deaton's *Bedspreads to Broadloom* and his research archive at the Bandy Heritage Center, Catherine Evans Whitener, and the Looper tufting machine.
- **Open question:** what year DuPont introduced BCF nylon. Sources say 1957 or 1959; confirm in the Hagley Textile Fibers records.
