// Starting outline for "A History of Tufting".
// Loaded once into the Write view; after that the chapters live in your browser
// (and in your backups), where you can rename, reorder, draft and add evidence.
// Each "intro" is a set of working notes drawn from the research so far, to write over.
window.RUG_CHAPTERS = [
  {
    id: "ch-before-machine", kind: "chapter",
    name: "Before the machine: needle-made pile in early America",
    intro: "Working notes (replace with your prose):\n\nAmericans were pushing wool through a ground cloth with a needle, and cutting the loops into pile, from the 1720s. Bed rugs (\"ruggs\") are needleworked, not hooked; the Met says this was once misunderstood. Candlewick spreads (1810s–1850s) name tufting as one of their stitches. Winterthur holds the Mary Foot bed rug, dated 1778.\n\nOpen questions: which Winterthur bed rugs have cut rather than looped pile? Is there tufted work between candlewick and Whitener (c. 1850–1890)?",
    items: ["wint-1960-0594", "chs-foote-bed-rug", "hd-blue-white-bed-rug", "met-13-207", "hd-packard-1801", "wint-1964-1641", "mfa-1980-447", "book-bed-ruggs-1972", "book-ulrich-age-of-homespun", "met-caswell-carpet", "afam-1995-13-2", "lacma-m-74-48", "chs-candlewick-group", "hne-1949-1018", "afam-great-cover-up"]
  },
  {
    id: "ch-dalton-bedspreads", kind: "chapter",
    name: "Dalton: from candlewick spreads to the Bedspread Capital",
    intro: "Working notes:\n\nCatherine Evans Whitener's revival (c. 1895–1900), the putting-out system of spread houses and haulers, Peacock Alley on U.S. 41, and department-store chenille by the 1920s. The Henry Ford's 1936 chenille rug is a dated, homemade tufted rug from the hand era.",
    items: ["event-whitener-bedspread", "article-nge-chenille", "book-callahan-southern-tufts", "photo-green-burton-1933", "hf-00-1510-19", "photo-cabin-crafts-arnall", "bandy-mahs-chenille", "archive-bandy-deaton", "ttw-evans-1895-1900", "ttw-turfer-pay", "ttw-bedspreads-1941"]
  },
  {
    id: "ch-machine", kind: "chapter",
    name: "Building the machine",
    intro: "Working notes:\n\nMoench (1928; ASME landmark), Looper's adapted Singer (1930s), Glenn Dalton (1936 filing), Cobble and Muse's multi-needle machine. ASME and the Dalton accounts disagree about who came first. Find the patent numbers.",
    items: ["tool-moench-1928", "event-looper-tufting-machine", "marker-mechanization-bedspread", "patent-us2977905", "book-deaton-bedspreads-broadloom", "book-patton-carpet-capital", "article-patton-ehnet", "ttw-carter-1922", "ttw-first-machine-1930-refuted", "ttw-tufted-share", "ttw-dalton-share"]
  },
  {
    id: "ch-nylon", kind: "chapter",
    name: "Nylon and the broadloom boom",
    intro: "Working notes:\n\nDuPont's bulked continuous filament (BCF) nylon, dated 1957 or 1959 by different sources; carpet nylon developed at Seaford in 1958. Tufted sales rose from near zero in the late 1940s to over 100 million square yards by 1958. Hagley holds the advertising, photography and consumer research. Do not repeat the Longlife 1952 nylon claim.",
    items: ["event-bcf-nylon", "hagley-seaford-nylon", "hagley-textile-fibers-album", "hagley-textile-fibers-product-info", "hagley-dupont-advertising-1803", "hagley-dichter-nylon-carpets", "hagley-hull-papers", "ner-de-longlife-refuted"]
  },
  {
    id: "ch-abroad", kind: "chapter",
    name: "Nobody else invented it: tufting goes abroad",
    intro: "Working notes:\n\nIn five languages, every national record says tufting came from America. And everywhere, outsiders adopted it first while established weavers held back: Germany (\"nur durch Außenseiter\", 1959), Japan (Nihon Jūtan waited 26 years), Britain. Dates: Japan 1954 (machine) / 1956 (production) / 1957 (Tufton); France 1954 (Balsan, softer); Germany 1956; Netherlands 1967; Belgium undated.",
    items: ["ner-nobody-invented", "ner-outsiders", "ner-jp-suminoe-1954", "ner-jp-tufton-1957", "ner-jp-carpet-day", "ner-jp-slow-diffusion", "ner-fr-balsan-1954", "ner-de-outsiders-1959", "ner-de-1956-mecheels", "ner-de-no-machines", "ner-nl-genemuiden-1967", "ner-be-gap", "ner-jp-dust-mite", "ner-jp-sakai-dantsu", "ner-jp-trade-body-1895", "ner-jp-industry-history-2008", "ner-jp-maruyama-1987", "ner-jp-study-missions"]
  },
  {
    id: "ch-china", kind: "chapter",
    name: "China: palace carpets, export factories and Cuihuangkou",
    intro: "Working notes:\n\nThe Chinese carpet line runs through Tibet, not Persia. The Beijing and Tianjin export era was industrial and labour history, not \"Chinese Art Deco\". Tufted carpet was standardised in 1989, but China built its own tufting machine only in 2004 and still imports the high end. Today Cuihuangkou makes eight of every ten Chinese carpets, and Iraq is the biggest customer. Hand-weaving was killed by printing, not tufting.",
    items: ["ner-cn-tibet-1860", "ner-cn-palace-carpet", "ner-cn-ningxia", "ner-cn-beijing-export", "ner-cn-tianjin", "ner-art-deco-not-chinese", "ner-cn-yanshan", "ner-cn-1970s", "ner-cn-gbt11746", "ner-cn-dht200", "ner-cn-sun-yize", "ner-cn-patents", "ner-cn-imports-2025", "ner-cn-cuihuangkou", "ner-cn-exports-iraq", "ner-cn-heat-transfer", "ner-cn-knotters-descendant", "ner-chase-tianjin-primary", "ner-chase-sohu-series", "ner-chase-gazetteers", "ner-chase-cnki"]
  },
  {
    id: "ch-gun", kind: "chapter",
    name: "Hand tools and the tufting gun",
    intro: "Working notes:\n\nThe hand tool comes first: Ross's 1891 two-handled needle-and-gauge patent, copied after 1908 by the Susan Burr (Torrington) and the Molter-Reinhard Shuttle Needle (Chicago), then sped up by the 1930s Bluenose hookers. Its patents run unbroken to a 1992 Dalton mending gun (Ross → Shaycraft 1948 → Spencer Wright 1992), while the gun itself gains a motor (1932), air (1946), a trigger and knife (1952) and its name (1964).\n\nTai Ping's Anthony Yeh built a cut-pile tufting needle from the American single-needle sewing-machine method and from domestic hand-tufting tools; in 1973 the gun was motorised. The Chinese text makes the hand-tool lineage explicit. The English version doesn't.",
    items: ["ner-hk-taiping-needle", "ner-hk-taiping-1973", "ttw-susan-burr", "ner-hk-taiping-1992", "ner-cn-terminology", "ner-cn-handmade-label", "ttw-shuttle-needle", "pat-us463548a", "ttw-excelsior-needle", "ttw-greer-susan-burr", "wint-photo-bucilla-tools", "wint-photo-fleisher", "wint-photo-olson-02", "pat-us1917162a", "pat-us2422126a", "pat-us2442906a", "pat-us2753820a", "pat-us3142276a", "pat-us5090341a", "ttw-mirzapur-manual"]
  },
  {
    id: "ch-india", kind: "chapter",
    name: "India: Bhadohi, Panipat and the hand-tufted takeover",
    intro: "Working notes:\n\nNo sourced date exists for hand-tufting's arrival; the gap is real. Hand-tufting overtook hand-knotting around 1995–2005. Bhadohi's \"traditional\" knotted trade was itself a colonial export industry. Panipat is a recycling town that became a rug town. The common tool is an unpowered ₹100 hand punch, and India now exports electric guns. Hindi has a word for tufted carpet that the trade never uses.",
    items: ["ner-in-colonial-bhadohi", "ner-in-date-gap", "ner-in-jain", "ner-in-hindi-wiki", "ner-in-crossover", "ner-in-unpowered-tool", "ner-in-iict-syllabus", "ner-in-sheru", "ner-in-backing-patents", "ner-in-vocabulary", "ner-in-panipat-migration", "ner-in-panipat-recycling", "ner-in-guinness-2025", "ner-in-tariff-2025", "ner-chase-goswami"]
  },
  {
    id: "ch-hobby", kind: "chapter",
    name: "The hand tool returns: hobby tufting and poke-poke",
    intro: "Working notes:\n\nThe gun invented in Hong Kong in 1973 re-entered mainland China around 2021 as an imported social-media craze, 戳戳秀 (\"poke-poke\"). Tie back to the hand tools of the first chapters.",
    items: ["ner-cn-pokepoke", "ner-hk-taiping-1973", "ner-in-sheru", "ttw-susan-burr"]
  }
];
