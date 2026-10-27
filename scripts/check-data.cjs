#!/usr/bin/env node
// Data check: every data file parses, ids are unique, chapter links resolve, local images exist.
const fs = require("fs"); global.window = {};
for (const f of ["data/items.js", "data/sources.js", "data/chapters.js", "data/eras.js"]) require(require("path").resolve(__dirname, "..", f));
const items = window.RUG_ITEMS, ids = new Set(items.map(x => x.id)); let bad = 0;
if (ids.size !== items.length) { console.log("duplicate ids"); bad++; }
for (const c of window.RUG_CHAPTERS) { const s = new Set(); for (const i of c.items) { if (!ids.has(i)) { console.log("missing", c.id, i); bad++; } if (s.has(i)) { console.log("repeat", c.id, i); bad++; } s.add(i); } }
for (const x of items) for (const g of x.images || []) if (!/^https?:/.test(g.src) && !fs.existsSync(require("path").resolve(__dirname, "..", g.src))) { console.log("no file", g.src); bad++; }
console.log(items.length, "items,", window.RUG_CHAPTERS.length, "chapters,", window.RUG_ERAS.length, "eras:", bad ? "FAIL" : "ok"); process.exit(bad ? 1 : 0);
