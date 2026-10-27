# Design: Rug Research

**World:** a mill's carpet sample book. Pages of cool grey card stock, a dark bookcloth board for the frame, photographs pasted in as swatches, and each research theme carried as a bookcloth colour.

**Mode:** a working research tool (Operate). The world lends type, palette, density and one signature move; navigation and controls stay standard.

## Signature move
**The fore-edge.** Above the results, every record sits as a leaf on a date axis, coloured by its theme's cloth, like the coloured page edges of a sample book. It shows at a glance where the current search sits in time, and each leaf opens its record.

## Tokens (`css/style.css` `:root`)
| Role | Light | Notes |
|---|---|---|
| Ground (card stock) | `#e6e8e3` | cool, never cream |
| Surface | `#f7f7f4` | cards, inputs, panels |
| Ink / secondary / tertiary | `#181c1a` / `#4f5652` / `#6b726e` | all ≥ 4.5:1 on ground |
| Board (shell) | `#1d2521` | header bookcloth |
| Primary action | `#7a2e2a` oxblood | primary buttons only |
| Focus | `#2d5f8a` | focus rings, links |

Bookcloth per theme: oxblood (early tufting), moss (hooked), navy (woven), rose (chenille/candlewick), ochre (Dalton/machine), teal (nylon/DuPont), slate (trade catalogs), umber (tools), plum (yarn). New themes get a cloth by hash. Dark mode redefines every token under `prefers-color-scheme: dark`.

## Type
One family, **Archivo** (variable width and weight). The wordmark uses the expanded width in caps, like a stamped spine; everything else is at normal width. Fixed rem scale at a ratio of about 1.2: 12 / 13 / 15 / 18 / 22 / 28. Tabular numerals for dates, counts and accession numbers.

## Components
- **Swatch card:** a 4:5 photo plate, then a label (colourway chips · type · date / title / institution · number). Flag and list actions appear on hover or focus, and always on touch. Records with no image get an honest **label plate** (a bookcloth strip, the type and the title), never a fake picture.
- **Icons:** authored inline SVG sprite, 1.75 stroke, round joins. No emoji or unicode glyphs.
- **States:** empty states teach the next step; Discover shows skeleton plates while loading and a named error on failure; notes say "Saved".
- **Motion:** 150–300 ms, exponential ease-out, for state only. Turned off under `prefers-reduced-motion`.

## Images
Images are linked from the holding institution, never copied, with a credit line in the detail view. `scripts/fetch-images.mjs` (run by GitHub Actions) finds them; set `"imageSource": "rejected"` on a record to stop it re-attaching an image you've ruled out.

## Findings and writing
- **Finding cards** show the original-language quotation on the plate, in the source's own script with `lang` set, so a Japanese or Hindi source looks like itself. The detail panel sets the quote above its translation.
- **Confidence** is a small coloured pill: moss = Solid, ochre = Suggestive, grey = Couldn't verify, red = Refuted. It's also a filter.
- **Write** shows the chapter as a heading (a select, to switch chapters), a draft area at a comfortable 78-character measure with a live word count, then numbered evidence in the chapter's order.
