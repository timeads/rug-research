---
name: A History of Tufted Rugs
description: A dye house's yarn shade card; every chapter is one wound shade on a single cool card, read in a calm column with its sources in the margin.
colors:
  shade-teal: "#1e6767"
  ground: "#e6e9e4"
  sheet: "#f2f4f0"
  sheet-2: "#dde1db"
  ink: "#171b19"
  ink-2: "#3a413d"
  ink-3: "#515955"
  rule: "#c4cac3"
  rule-2: "#9ea69f"
  board: "#1e2421"
  board-ink: "#eef1ec"
  board-ink-2: "#b9c1bb"
  cloth-wheat: "#9a7b3c"
  cloth-oxblood: "#7a2e2a"
  cloth-navy: "#253b5f"
  cloth-rose: "#94566a"
  cloth-ochre: "#a87a22"
  cloth-teal: "#1e6767"
  cloth-indigo: "#3a3f78"
  cloth-plum: "#5a3e6b"
  cloth-rust: "#9a4a26"
  cloth-umber: "#6a4a2e"
  cloth-jade: "#2f6b52"
  cloth-slate: "#4e5966"
  cloth-moss: "#56662c"
  cloth-grey: "#5d6460"
typography:
  display:
    fontFamily: "Archivo Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(3rem, 8.5vw, 6rem)"
    fontWeight: 680
    lineHeight: 0.95
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 82"
  headline:
    fontFamily: "Archivo Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 4.5rem)"
    fontWeight: 680
    lineHeight: 1
    letterSpacing: "-0.022em"
    fontVariation: "'wdth' 84"
  title:
    fontFamily: "Archivo Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 660
    lineHeight: 1.15
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 90"
  shade-number:
    fontFamily: "Archivo Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1
    fontVariation: "'wdth' 84"
    fontFeature: "'tnum', 'lnum'"
  body:
    fontFamily: "Literata Variable, Iowan Old Style, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.66
  dek:
    fontFamily: "Literata Variable, Iowan Old Style, Georgia, serif"
    fontSize: "1.3125rem"
    fontWeight: 400
    lineHeight: 1.45
  pull:
    fontFamily: "Literata Variable, Iowan Old Style, Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  frame:
    fontFamily: "Archivo Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Archivo Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.3
  note:
    fontFamily: "Archivo Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  hair: "1px"
  sm: "2px"
  md: "3px"
spacing:
  gutter: "1.25rem"
  gap: "2.75rem"
  margin: "14rem"
  measure: "37rem"
  wide: "53.75rem"
  frame-max: "80rem"
  mast-height: "3.5rem"
components:
  masthead:
    backgroundColor: "{colors.board}"
    textColor: "{colors.board-ink}"
    typography: "{typography.label}"
    height: "3.5rem"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 1rem"
    height: "2.5rem"
  button:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 1rem"
    height: "2.5rem"
  chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 0.85rem"
    height: "2.25rem"
  chip-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  tag-pending:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "0.1em 0.55em"
  card-sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  aside-panel:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-2}"
    typography: "{typography.frame}"
    rounded: "{rounded.md}"
    padding: "1.5rem 1.75rem"
  margin-note:
    textColor: "{colors.ink-3}"
    typography: "{typography.note}"
    width: "14rem"
  cite-box:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "1rem 1.25rem"
---

# Design System: A History of Tufted Rugs

## Overview

**Creative North Star: "The Dye House Shade Card"**

The history is laid out like a dye house's yarn shade card: a cool, card-stock grey sheet with one band of wound yarn per chapter, each with its shade number. The cover is the card itself, thirteen shades in a single bordered sheet; a chapter is one shade picked off that card and read. A charcoal bookcloth board closes the page top and bottom, the way a sample book's covers hold its cards. The world owns the frame (masthead, bands, shade numbers, headings, rules); the reading column stays calm.

Density is that of a close-reading book page: a single text measure with a margin column beside it where every note sits next to the sentence it supports and links to its record in one step. The world is flat and matter-of-fact, made of tonal sheets, hairline rules and condensed type rather than shadows or ornament. Its honesty is visible design, not small print: the prototype notice under the masthead, "Permission pending" on uncleared pictures, and the count of sources "checked at the archive" are part of the system. (The author's "Still to find" lists are a private to-do list and stay in the research tool.)

The world refuses the cream-paper editorial long-read: serif display headings on off-white, italic deks, small tracked labels above headings.

**Key Characteristics:**
- Cool grey card-stock ground, never cream; charcoal board for masthead and foot only.
- One chapter shade per page, drawn as a wound-yarn band and reused as the page's only accent.
- Condensed Archivo for the frame and headings, Literata for reading, tabular numerals for dates and shade numbers.
- A text column with a margin-note column; every note, picture and date opens its record.
- Flat surfaces separated by tone and 1-2px rules; no shadows.
- Status (prototype, permission, verification, gaps) shown in plain words.

## Colors

A cool, near-neutral grey-green card and charcoal board, with a bookcloth palette of fourteen muted dyed shades of which a page uses exactly one.

### Primary
- **The Chapter Shade** (set per page as `--shade`; Nylon's Teal shown as `shade-teal`): the one accent on any page. It colours the chapter's wound band, the 2px scroll-progress thread under the masthead, the key-dates thread and ticks, the thread above a pull quote, note numbers and "Source" links (through a 22%-darkened shade ink, 18%-lightened in dark mode), the focus ring, the selection tint, the target-note highlight and the source-holder bars. The cover's default shade is Teal.

### Secondary
- **The Bookcloth Shades** (`cloth-*`, fourteen): wheat, oxblood, navy, rose, ochre, teal, indigo, plum, rust, umber, jade, slate, moss, and grey as the fallback. Each chapter owns one, fixed in `CHAPTER_CLOTH` and named with its shade number ("Shade 6, Teal"). They are the research tool's bookcloth palette, shared so a chapter has the same colour in both products. On the cover they appear only as their own chapter's band; on the timeline only as the small swatch and filter chip of the chapter an event belongs to.

### Neutral
- **Card-Stock Grey** (ground): the page ground everywhere.
- **Pale Card** (sheet): raised sheets: the contents card, note panels, the citation box, chips and buttons, folded margin notes.
- **Grey Mount** (sheet-2): the placeholder behind images while they load and the record-page plate.
- **Lamp Black** (ink): headings and primary text; the 2px heavy rule under the contents head and over the end matter, era and reference links; pressed chips and the primary button.
- **Graphite** (ink-2) and **Pencil** (ink-3): deks, captions and body in panels; then metadata, margin notes, labels.
- **Hairline** (rule) and **Card Edge** (rule-2): row dividers and byline rules; the contents card border, chip and button borders, the pending tag's outline.
- **Bookcloth Board** (board) with **Board Ink** and **Board Ink Dim** (board-ink, board-ink-2): masthead and foot only; current nav item in board ink with a 2px underline, others dim.

Dark mode (system preference) keeps the same roles: a near-black ground and sheets, light ink, and every cloth lifted to stay legible on dark (values in the sidecar).

### Named Rules
**The Card-Stock Rule.** The ground is cool grey card (#e6e9e4), never cream, ivory or warm paper.

**The One Shade Rule.** A page carries one chapter shade and every accent on it derives from that shade; no second accent colour is introduced. Other cloths appear only as a chapter's own band or swatch.

**The Board Rule.** The charcoal board is the binding: masthead and foot, nothing else. Content never sits on a dark panel.

## Typography

**Display Font:** Archivo Variable at condensed widths (with Arial Narrow, system-ui)
**Body Font:** Literata Variable, optical sizes (with Iowan Old Style, Georgia)

**Character:** A narrow industrial grotesque for everything that frames, labels or numbers, like the printing on a mill's card; a sturdy, warm book serif for everything a reader reads continuously. The contrast between the two is the hierarchy.

### Hierarchy
- **Display** (680, clamp(3rem, 8.5vw, 6rem), 0.95, 82% width): the cover title only.
- **Headline** (680, clamp(2.5rem, 6vw, 4.5rem), 1, 84% width): chapter titles (max 18ch) and page titles (Timeline, Bibliography). Record titles step down to 660 at clamp(1.75rem, 3.5vw, 2.5rem), 90% width.
- **Title** (660, 1.6rem, 1.15, 90% width): section heads inside the prose. The contents head is 680 1.75rem at 84%; end-matter heads 660 1.375rem.
- **Shade number** (700, 1.5rem beside the chapter band; 0.9375rem in contents rows; 84% width, tabular): "Shade 6", with the cloth name and years under it in regular Archivo.
- **Body** (Literata 400, 1.125rem, 1.66, 37rem measure): chapter prose. Deks are Literata 1.3125rem/1.45 in ink-2; the cover scope line 1.25rem/1.5; pull quotes 1.75rem/1.3 at 32ch.
- **Frame** (Archivo 400, 1rem, 1.55): the default body of the page outside the reading column; captions at 0.875rem/1.5.
- **Label** (Archivo 500-600, 0.875rem): navigation, buttons, chips, byline. Sentence case, no tracking.
- **Note** (Archivo 400, 0.8125rem, 1.45): margin notes, credits, timeline metadata; note numbers 700 in the shade ink.

### Named Rules
**The Frame and Read Rule.** Archivo for the frame: headings, navigation, captions, notes, labels, data. Literata for reading: prose, deks, the scope line, pull quotes, citations, timeline event titles, bibliography entries.

**The Condensed Heading Rule.** Headings are Archivo at 82-90% width, weight 650-700, with slight negative tracking. A serif display heading breaks the world.

**The Tabular Rule.** Years, shade numbers, note numbers and counts set in tabular lining numerals.

## Layout

Every page shares the masthead's frame: 80rem (`--page`) with a fluid clamp(1.25rem, 3vw, 2rem) side gutter (`--pad`), so content starts under the wordmark and ends under the last nav link. Reading happens in a 53.75rem "wide" block inside it: a 37rem text measure, a 2.75rem gap, and a 14rem margin column. The masthead is sticky at 3.5rem.

**Cover.** Title and scope, then the contents card across the full page width: one bordered sheet whose rows are a band (a third of the row), the shade number and cloth name, the chapter title and years, and the status. A ready chapter's band is full height (2.75rem) and reads "Read the chapter" in shade ink; a chapter in preparation shows a thin 0.5rem band and "In preparation". Below the card, Timeline and Bibliography as two reference links under 2px ink rules. Under 640px each row stacks: band across the top, number at left, title and status at right.

**Chapter.** The 4.5rem wound band with the shade label beside it in the margin column; the title, dek and a byline between hairlines (author, reading time, note/source/checked counts, draft status); then a full-bleed opening photograph at min(72vh, 46rem). Key dates follow on a horizontal shade thread, each date placed by year and labels alternating above and below; under 900px they become a vertical list on a shade rule. The prose column reserves the margin with right padding so notes and small "margin" figures float into it; wide figures, pull quotes, panels and full-bleed figures span the whole width. After the last paragraph, before the notes, links to the previous and next chapters (each with that chapter's own swatch, shade number and title; the first and last chapters link to the contents instead) let a reader go straight through the book. End matter is a two-column grid: full notes beside "Where the sources are". From 1180px the text, margin and end matter sit at the right of the page, and "In this chapter" (key dates, sections, notes) stays in view in the space to their left, marking the section being read with a 2px shade underline.

**Timeline and bibliography.** The timeline lists every theme filter at once, wrapping onto as many rows as it needs (never a sideways scroller); the bar is not sticky. Era heads sit in an up-to-18rem column, entries cap their titles at 64ch. From 1180px the bibliography's kinds of source become a list that stays in view to the left of the entries, as in a chapter, and each entry mirrors the reading block: the citation at the 37rem measure, its record link and chapter in the 14rem margin column, with the rules running to the page's right edge.

**Record pages.** Two halves across the full page: the picture on the left and the record on the right; a record without a picture puts what it is (title, kind, facts, links) on the left and how to cite it with the research notes on the right. One column under 861px.

**Responsive.** At 1100px the margin column folds away: the column narrows to the measure, notes hide and open beneath the line when their number is tapped, margin figures drop into the flow at up to 22rem. Figure pairs stack under 700px; end matter and record pages go single-column under 860px; the timeline drops thumbnails under 760px.

**Motion.** The only motion is the scroll-driven progress thread on chapter pages (CSS scroll timeline, where supported); reduced-motion turns all animation and transition off.

### Named Rules
**The Shared Frame Rule.** Pages line up with the masthead. Extra width on large screens goes to navigation that stays in view or to full-width bands and cards, never to longer lines: text keeps its measure.

**The Margin Column Rule.** Sources sit beside the sentence, not at the bottom of the screen: 37rem text plus a 14rem note column on wide screens; on narrow screens a tap opens the note in place rather than jumping to the end.

## Elevation & Depth

The system is flat. Depth comes from three tonal layers (board, ground, sheet) and from rules: 1px hairlines between rows, 2px ink rules to head a section, the 2px shade thread. There is no box-shadow anywhere. The only shading in the world is inside the wound band, where strands of yarn darken over the card's edges; that is drawing, not elevation.

### Named Rules
**The No-Shadow Rule.** Surfaces sit flat at rest and in every state; hover changes a border, underline or text colour, never adds lift.

## Shapes

Square-cut card. Corners are almost square: 2px on the contents sheet, chips, buttons and the pending tag; 3px on note panels, the citation box and folded margin notes; 1px on swatches and bars. Borders are 1px (rule or rule-2); section heads take a 2px ink rule. Bands are hard-edged rectangles with no radius. Images are unframed rectangles on a grey mount, never rounded or masked.

## Components

### Wound Band (signature)
The shade card's yarn: a rectangle of one shade covered in fine parallel strands (1.8 units apart, each 82% of the pitch) laid at a slight slope, alternately lightened with white and darkened with black at up to 21% opacity, with darker bands where the yarn turns over the top, bottom and both ends of the card. Drawn as SVG, stretched to its box, and deterministic: the strand tones come from the shade number, so the same chapter always draws the same band. Heights: 4.5rem at the chapter head (3.5rem under 640px), 2.75rem in a contents row (2rem mobile), 0.5rem for a chapter in preparation. Always paired with its shade number and cloth name.

### Navigation
Masthead on the board: the wordmark in Archivo 700 at 84% width, then Chapters, Timeline, Bibliography at 500 0.875rem in board-ink-2. The current page goes board-ink with a 2px board-ink underline; hover brightens to board ink. Under 560px the gaps tighten and the wordmark steps to 1rem (0.875rem under 360px). Chapter pages add the 2px shade progress thread along the masthead's bottom edge.

### Status notices
There is no site-wide prototype notice: it was taken down once the chapters had been fact-checked. Status that matters stays where it applies (a picture's "Permission pending", a record's "not yet checked at the source").
### Margin Notes and Footnote Markers
Superscript note numbers in Archivo 650 in the shade ink. The note itself floats into the 14rem margin: bold shade-ink number, a short citation in ink-3, and a "Record" link that opens the record page. Narrow screens show it as a sheet panel (3px radius, 0.875rem) when its number is tapped. Inside a note panel the number links to the full notes instead.

### Figures
An image on a grey mount linking to its record; caption in Archivo 0.875rem ink-2 up to 68ch; a credit line in ink-3 with a bold shade-ink "Source" link and, until cleared, the Permission pending tag. Sizes: text, margin (floats into the margin column), wide, full (full bleed), and pairs of two at text width.

### Permission Pending Tag
Archivo 550 0.75rem in ink-2, outlined in card edge with a 2px corner, no fill. Used wherever an uncleared image appears (hero, figures, record page).

### Pull Quote
Literata 1.75rem at 32ch with a 2px shade thread above it (never a bar beside it), attribution in Archivo ink-3 below.

### Note Panel (Aside)
A sheet panel with a 3px corner and 1.5rem 1.75rem padding; a 650 Archivo heading and a short list in ink-2. Available for a short panel readers should see; no chapter uses one at present.

### Buttons
- **Shape:** nearly square (2px), 2.5rem tall, 0 1rem padding, Archivo 600 0.875rem.
- **Primary:** ink fill with ground text ("View at the source").
- **Secondary:** sheet fill, ink text, card-edge border.
- **Hover / Focus:** border darkens to ink-3; focus is a 2px shade-ink outline at 3px offset, as on every interactive element.

### Chips
Timeline filters and bibliography jumps: sheet fill, card-edge border, 2px corner, 2.25rem tall, with a small 0.5rem cloth swatch for a chapter filter. Pressed is ink fill with ground text.

### Chapters Card
A sheet with a card-edge border and 2px corner; its head (title plus a count of ready and in-preparation chapters) sits over a 2px ink rule; rows divided by hairlines. Hovering a ready row underlines its title.

### End Matter
Full notes as a numbered list on hairlines (a targeted note is tinted with the shade at 15%), and "Where the sources are": holders with counts and a 4px shade bar sized to each count.

### Named Rules
**The One-Step Rule.** Every note, figure, key date and timeline event links straight to its record page; the record links on to the holding institution.

**The Visible Status Rule.** "Permission pending", "checked at the archive" counts, and "not yet checked at the source" are shown in plain words at full legibility, never hidden, greyed out of reach or styled away.

## Do's and Don'ts

### Do:
- **Do** set the page ground to Card-Stock Grey (#e6e9e4) and keep the charcoal board (#1e2421) for masthead and foot.
- **Do** set `--shade` once per page from the chapter's cloth and take every accent (band, threads, note numbers, Source links, focus ring) from it.
- **Do** show a chapter's shade as a wound band with its shade number and cloth name ("Shade 6, Teal"), never as a bare colour.
- **Do** set headings in Archivo at 82-90% width, weight 650-700, and reading text in Literata at a 37rem measure.
- **Do** put sources in the 14rem margin beside the text and link each to its record in one step.
- **Do** use tabular numerals for years, shade numbers and counts.
- **Do** show permission and verification status in words wherever the image or claim appears.

### Don't:
- **Don't** use cream, ivory or warm off-white grounds.
- **Don't** set headings in a serif display face, put deks in italic, or place small tracked uppercase labels above headings.
- **Don't** introduce a second accent colour on a chapter page, or use another chapter's cloth outside its own band or swatch.
- **Don't** add box-shadows, lift on hover, or rounded corners beyond 3px.
- **Don't** draw the band as a flat swatch, gradient or random noise; it is exact parallel strands, the same every render.
- **Don't** put content on the dark board or hide status marks to tidy a page.
