# Rendering Guidelines

## Recommended Defaults

- Canvas: logical `1080x1440`, export scale `2`, output `2160x2880`.
- Page count: hard maximum `18`; favor readability over squeezing to `17`.
- Long split route default: use `LAYOUT_PRESET=spacious`.
- Single-post route default: use `LAYOUT_PRESET=compact`.
- Optional byline: set `AUTHOR_NAME` or `XHS_AUTHOR`; leave unset when the user did not provide a public author name.
- Browser: use Playwright's installed Chromium by default, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chrome/Chromium binary.
- Body text: around `27px`, line-height around `1.8` to `1.86`.
- List text: around `26px`, line-height around `1.68` to `1.74`.
- H3/subtitle: around `32px`, line-height around `1.36`.
- Code blocks: around `17px`, line-height `1.38`; keep syntax readable.
- Use `.content > :last-child { margin-bottom: 0; }` to avoid wasting bottom space without visually compressing the whole page.

## Routing

Use a render-driven route, not a guess-only route.

1. Normalize the Notion export into Markdown.
2. Try a single-post render with `LAYOUT_PRESET=compact`.
3. If the manifest count is `<= 18` and the contact sheet is readable, keep one post.
4. If the compact single-post route exceeds `18` pages or looks cramped, split at a natural `##` boundary into two posts and render with `LAYOUT_PRESET=spacious`.
5. For a split, add a visual next-post callout at the end of part 1 with a Markdown quote beginning `更多内容：`. The renderer turns this into a card. Use wording such as “下一篇内容” and “上一篇内容”, not “组”.

Suggested commands:

```bash
LAYOUT_PRESET=compact CONTENT_PATH=src/content.md DIST_DIR=dist/article OUTPUT_SLUG=xhs-article node src/render.mjs

LAYOUT_PRESET=spacious CONTENT_PATH=src/content-part1.md DIST_DIR=dist/article-part1 OUTPUT_SLUG=xhs-article-part1 node src/render.mjs
LAYOUT_PRESET=spacious CONTENT_PATH=src/content-part2.md DIST_DIR=dist/article-part2 OUTPUT_SLUG=xhs-article-part2 node src/render.mjs
```

Theme commands:

```bash
THEME=blue node src/render.mjs
THEME_ACCENT="#2868a8" node src/render.mjs
AUTHOR_NAME="Your Name" node src/render.mjs
PLAYWRIGHT_CHROMIUM_EXECUTABLE="/path/to/chrome" node src/render.mjs
```

## Known Pitfalls

- YAML syntax highlighting must not run regex replacements over already-generated HTML. Build highlighted output from escaped segments to avoid leaked strings like `"tok-prop">paths`.
- Do not rely only on CSS for image corner radius. Use `sharp` to generate rounded PNG assets with transparent corners, then also apply CSS radius.
- `scrollHeight` is not enough for pagination decisions. Calculate actual used height from the last element's bounding box plus margin.
- If a page contains a large blank area before an image, try hard-fit image shrinking before sending the image to the next page. Keep text inside screenshots readable.
- If the last page contains only one sentence, merge it back by removing last-child margin, using the next-post callout card, or lightly shrinking a nearby image/code block before reducing global line-height.
- Avoid vertically centering a normal final page; it can create abnormal top whitespace.

## XHS Layout Taste

- The first image is a real cover, not a marketing landing page.
- Headers/footers should be quiet and consistent.
- Chapter headings should be distinctive but compact; remove decorative lines if they consume too much vertical space.
- Strong text should look editorial, not like warning labels.
- Byline/signature text should come from the user or environment, never from a local personal default baked into the skill.
- Long split posts may use looser image and heading spacing because each post has its own 18-image budget.
- Compact single posts should preserve readability while using tighter figure, heading, list, and paragraph margins.
- Use contact sheets for page-level rhythm, then open individual pages for legibility checks.

## Suggested Verification Snippet

Use Playwright and Sharp to assert the mechanical basics:

```js
const manifest = require(path.resolve("dist/manifest.json"));
// Check: manifest.count <= 18
// Check: each output image is 2160x2880
// In browser: inspect .slide count, overflow, figure src includes "-rounded.png",
// and each pre code text does not match /tok-|class=|span/.
```
