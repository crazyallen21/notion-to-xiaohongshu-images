---
name: notion-to-xhs-images
description: Use when converting Notion pages, Notion exports, or Markdown drafts into Xiaohongshu/XHS multi-image card posts with preserved structure, images, code blocks, highlights, theme choices, and one-post or linked multi-post routing.
---

# Notion To XHS Images

Use this skill to produce production-ready Xiaohongshu image cards from a Notion document while preserving content fidelity and keeping the design readable.

## Core Workflow

1. **Ingest the document**
   - If the user provides a Notion URL and the current environment can access it, fetch/export the latest content before rendering. If access is not available, ask for a Notion export or Markdown copy.
   - Preserve block order, headings, lists, quotes, code fences, inline code, bold text, and images.
   - If the user says the Notion source changed, re-read it before producing the final images.

2. **Route before final rendering**
   - First decide whether the article should be a single XHS post or a two-post series.
   - Short/medium route: if the article can fit within `18` images as one complete post without hurting legibility, render one post with `LAYOUT_PRESET=compact`.
   - Long route: if a single compact render exceeds `18` pages or would become cramped, split into two complete posts at a natural `##` chapter boundary. Render each post with `LAYOUT_PRESET=spacious` unless the user asks otherwise.
   - When splitting, keep chapters intact. End part 1 with a next-post callout block: `> 更多内容：继续讲 ...`. Start part 2 with natural copy such as “上一篇内容...” and “这一篇内容...”. Do not use “上一组 / 这一组 / 下一组” wording.
   - Keep both posts independently understandable, with their own cover pages and output directories.

3. **Use the renderer**
   - For a new workspace, copy `skills/notion-to-xhs-images/assets/render-template.mjs` to `src/render.mjs`, put the Markdown at `src/content.md`, then render.
   - The renderer expects Node.js with `playwright` and `sharp` available. Install them in the rendering workspace if needed.
   - Keep the output contract: logical `1080x1440`, export scale `2`, final PNGs `2160x2880`.
   - The renderer supports `CONTENT_PATH`, `DIST_DIR`, `OUTPUT_SLUG`, `LAYOUT_PRESET=compact|spacious`, `THEME=red|blue`, `THEME_ACCENT`, `AUTHOR_NAME`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, and cover text env vars.

4. **Design for XHS**
   - Keep the image count at `18` or fewer. Prefer exactly `18` when readability would suffer at `17`.
   - Do not globally shrink all text to hit the limit. First improve pagination, merge low-information pages, trim excessive whitespace, and only then tune code/image sizes.
   - Keep a cover page unless the user explicitly asks to merge it.

5. **Iterate visually**
   - After every meaningful layout change, render the pages and inspect the contact sheet.
   - Show or inspect the pages the user calls out by number.
   - Keep adjusting until the user is satisfied, then re-zip `dist/pages`.

## Visual Rules

- Header left: full article title. Footer left: readable byline when `AUTHOR_NAME` is provided. Never hard-code a personal handle.
- Use the requested theme when the user specifies one. Otherwise choose a restrained palette that fits the topic; the renderer includes red/brown and blue presets.
- Avoid heavy colored text blocks. Bold text should use a warm highlight/underline treatment, not noisy red underlines.
- Inline code should be neutral gray and readable; never underline it.
- Code blocks should be dark, syntax-highlighted, and free of leaked markup text such as `tok-prop`, `class=`, or `<span>`.
- Images should render directly with consistent real rounded corners. Generate rounded transparent image assets; do not fake every image with a white wrapper.
- Chapter headings may share a page with other content. Make Chinese and English text visually aligned and similarly sized.
- Keep body reading comfortable. Use page utilization, not cramped spacing, to fit the XHS limit.

## Pagination Heuristics

- Let sections share pages; do not force every chapter to start a new page.
- Merge short tail pages into the previous page when possible.
- Use actual element bottom positions to measure remaining space; `scrollHeight` alone can mislead because it equals container height even when content is sparse.
- For pages with too much blank space, first try moving the next small block/image back, then tune figure height within a readable threshold.
- If a page has a large blank area and the next block is an image, allow hard-fit image shrinking within the configured minimum height before moving the image to a new page.
- Do not make screenshots so small that text inside them becomes unreadable.
- Avoid special final-page centering unless the page is intentionally designed as a closing card.

## Verification Checklist

Run fresh verification before saying the work is done:

- Render succeeds and `dist/manifest.json` reports `count <= 18`.
- Every page is `2160x2880`.
- No element overflows its page.
- Code text has no leaked highlighting markup.
- Figures use rounded image assets and have nonzero border radius.
- Contact sheet looks balanced, with no obvious huge blank pages except intentional cover/closing breathing room.
- The relevant `pages` directory is re-zipped after the final render. For two-post output, zip both post directories.

For detailed implementation notes and known pitfalls, read `references/rendering-guidelines.md`.
