# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: scholars and reviewers (Winterthur fellowship reviewers, curators, textile and design historians) who read closely and check sources. The history is built to their standard of evidence first. Secondary: makers, the tufters, hobbyists and customers around Tuft the World, who should enjoy reading it as much as the scholars can rely on it.

The research tool (the root site) has one user, Tim Eads, with Claude and Claude in Chrome gathering records for him.

## Product Purpose

Two connected products in one repository:

- **The research database** (root site, `index.html`): gathers, checks and organises the evidence for a history of tufted rugs, and drafts the chapters.
- **A History of Tufted Rugs** (`site/`, published at `/book/`): the public history, by Tim Eads, written from that evidence. Chapters, a timeline of every dated record, a page per source, and a full bibliography.

Success: a reader can follow the history chapter by chapter and reach the original source behind any sentence in one step; a scholar finds nothing asserted without evidence.

## Positioning

A history of tufted rugs written by a practising tufter and the co-founder of a tufting firm, from primary sources (patents, trade literature, company archives at Hagley and Winterthur, museum objects, oral histories), with every claim footnoted to a public record. It follows both branches of the needle: the multiplied needle of Dalton's broadloom industry and the single hand-held tool that went global.

## Operating Context

- Published non-commercially, under Tim Eads's own name, on its own site, linked from Tuft the World. Not part of the company's commercial site.
- Written alongside a Winterthur fellowship application.
- Content lives as files in the GitHub repository: records in `data/items.js`, chapters in `site/src/content/chapters/*.mdx`, transcripts in `data/transcripts.js`. Every push rebuilds the public site (`.github/workflows/build-site.yml`).

## Capabilities and Constraints

- **Every claim footnoted.** Each statement in a chapter cites a record in the research database (`[@record-id]`); no unsourced claims.
- **Images linked, not copied.** Pictures are shown from the institutions that hold them, with credit and permission status. Tim's own photographs are the exception and are kept in the repository.
- **Verification status is visible** to readers: which sources were checked at the archive and which are not yet.
- **Chicago notes-and-bibliography** citation style.
- Image permissions are mostly not yet requested (about 109 images); until granted, an image is marked as pending.
- Undecided: the domain name; whether the research tool becomes private; whether to add a sign-in editor (Keystatic).

## Brand Commitments

- Author: Tim Eads. Title: *A History of Tufted Rugs*. Tuft the World (founded 2018 by Tiernan Alexander and Tim Eads, Philadelphia) is credited, not the publisher.
- The research tool's established world is recorded in `DESIGN.md` (a mill's carpet sample book). The public site is a separate surface whose visual world is decided in new-work.

## Evidence on Hand

- 466 research records (`data/items.js`), 13 chapter drafts (`data/chapters.js`), 7 eras (`data/eras.js`).
- One prototype chapter in finished prose: Nylon and the broadloom boom (`site/src/content/chapters/nylon.mdx`), not yet checked at the archives.
- Tim's own photographs: tools and kits in `images/tools/`, patent drawings in `images/patents/`.
- No testimonials, reviews, partner endorsements or institutional affiliations to show; none may be invented.

## Product Principles

1. Evidence first: a sentence without a source does not ship.
2. The original is one step away: every note, picture and date opens its source.
3. Honest status: unverified, refuted and permission-pending are shown, not hidden.
4. Written for close readers, readable by makers.
