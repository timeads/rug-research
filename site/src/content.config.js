import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Chapters are MDX files: frontmatter for the page furniture, prose with [@record-id] citations.
const chapters = defineCollection({
  loader: glob({ pattern: "*.mdx", base: "./src/content/chapters" }),
  schema: z.object({
    number: z.number(),
    title: z.string(),
    dek: z.string(),
    theme: z.string(),
    hero: z.object({ record: z.string(), image: z.number().optional(), caption: z.string().optional(), focus: z.string().optional() }),
    milestones: z.array(z.object({ year: z.string(), label: z.string(), record: z.string() })).default([]),
    status: z.enum(["prototype", "draft", "final"]).default("draft"),
    // The year the chapter was first put online, for citations (Google Scholar) and search engines.
    published: z.string().optional(),
    researchChapter: z.string().optional()
  })
});
export const collections = { chapters };
