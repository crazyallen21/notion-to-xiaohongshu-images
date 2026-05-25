import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

function requireDependency(name) {
  try {
    return require(name);
  } catch (error) {
    if (process.env.NODE_PATH) {
      try {
        return require(path.join(process.env.NODE_PATH, name));
      } catch {
        // Fall through to the actionable install hint below.
      }
    }

    throw new Error(
      `Missing dependency "${name}". Install it in this workspace, for example: npm install playwright sharp. Original error: ${error.message}`
    );
  }
}

const { chromium } = requireDependency("playwright");
const sharp = requireDependency("sharp");
const rootDir = path.resolve(__dirname, "..");
const sourcePath = process.env.CONTENT_PATH
  ? path.resolve(rootDir, process.env.CONTENT_PATH)
  : path.join(rootDir, "src", "content.md");
const distDir = process.env.DIST_DIR
  ? path.resolve(rootDir, process.env.DIST_DIR)
  : path.join(rootDir, "dist");
const pagesDir = path.join(distDir, "pages");
const assetsDir = path.join(distDir, "assets");
const htmlPath = path.join(distDir, "index.html");
const manifestPath = path.join(distDir, "manifest.json");
const outputSlug = process.env.OUTPUT_SLUG || "xhs-notion-pages";
const authorName = (process.env.AUTHOR_NAME || process.env.XHS_AUTHOR || "").trim();
const authorLabel = authorName ? `By ${authorName}` : "";
const coverConfig = {
  kicker: process.env.COVER_KICKER || "Notion / Xiaohongshu",
  main: process.env.COVER_MAIN || "Notion Notes",
  sub: process.env.COVER_SUB || "图文卡片",
  desc:
    process.env.COVER_DESC ||
    "把 Notion 内容整理成适合小红书阅读的多图卡片，保留结构、重点和图片信息。",
};
const themeName = (process.env.THEME || process.env.XHS_THEME || "red").toLowerCase();
const layoutPreset = (process.env.LAYOUT_PRESET || "spacious").toLowerCase();
const themes = {
  red: {
    paper: "#fbfaf6",
    pageBg: "#e8e3d8",
    ink: "#1e242d",
    muted: "#7a817c",
    line: "#e7e1d5",
    accent: "#bd4b3f",
    accentSoft: "#efe0d9",
    accentWash: "rgba(189, 75, 63, .10)",
    accentLine: "rgba(189, 75, 63, .55)",
    markInk: "#7d4a2f",
    markLine: "rgba(226, 185, 96, .42)",
    codeBg: "#f1eee7",
    codeInk: "#6b6258",
    coverText: "#313842",
    signature: "#746f68",
    figureShadow: "rgba(68, 55, 42, .10)",
  },
  blue: {
    paper: "#f8fbff",
    pageBg: "#e6eef7",
    ink: "#182536",
    muted: "#68778a",
    line: "#d8e3ef",
    accent: "#2868a8",
    accentSoft: "#dbeafe",
    accentWash: "rgba(40, 104, 168, .11)",
    accentLine: "rgba(40, 104, 168, .50)",
    markInk: "#245b8d",
    markLine: "rgba(118, 173, 226, .38)",
    codeBg: "#eaf1f8",
    codeInk: "#52677d",
    coverText: "#28394f",
    signature: "#607086",
    figureShadow: "rgba(35, 71, 108, .13)",
  },
};
const theme = {
  ...themes.red,
  ...(themes[themeName] || {}),
  ...(process.env.THEME_ACCENT ? { accent: process.env.THEME_ACCENT } : {}),
};
const layouts = {
  spacious: {
    contentHeight: 1230,
    pageHeadMarginBottom: 24,
    h2Margin: "14px auto 38px",
    h2Padding: "30px 34px 18px",
    h3Margin: "18px 0 28px",
    pMargin: "0 0 29px",
    pLineHeight: 1.86,
    preMargin: "8px auto 30px",
    listMargin: "6px 0 29px",
    liMargin: "0 0 19px",
    liLineHeight: 1.74,
    blockquoteMargin: "8px 0 30px",
    blockquotePadding: "4px 0 4px 24px",
    blockquoteLineHeight: 1.8,
    figureMargin: "14px auto 42px",
    splitNoteMargin: "8px 0 30px",
    commandHeadingMarginTop: 16,
    commandHeadingMarginBottom: 26,
    commandParagraphMarginBottom: 28,
  },
  compact: {
    contentHeight: 1236,
    pageHeadMarginBottom: 18,
    h2Margin: "6px auto 24px",
    h2Padding: "24px 34px 14px",
    h3Margin: "7px 0 20px",
    pMargin: "0 0 23px",
    pLineHeight: 1.8,
    preMargin: "0 auto 18px",
    listMargin: "0 0 21px",
    liMargin: "0 0 15px",
    liLineHeight: 1.68,
    blockquoteMargin: "2px 0 22px",
    blockquotePadding: "2px 0 2px 24px",
    blockquoteLineHeight: 1.74,
    figureMargin: "2px auto 20px",
    splitNoteMargin: "0 0 22px",
    commandHeadingMarginTop: 4,
    commandHeadingMarginBottom: 16,
    commandParagraphMarginBottom: 18,
  },
};
const layout = { ...layouts.spacious, ...(layouts[layoutPreset] || {}) };

const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1440;
const EXPORT_SCALE = 2;

async function ensureCleanOutput() {
  await fs.mkdir(distDir, { recursive: true });
  await fs.rm(pagesDir, { recursive: true, force: true });
  await fs.mkdir(pagesDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
}

async function getExistingImageAsset(index) {
  for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
    const filename = `notion-${String(index + 1).padStart(2, "0")}${ext}`;
    const outputPath = path.join(assetsDir, filename);
    try {
      await fs.access(outputPath);
      const metadata = await sharp(outputPath).metadata();
      return {
        src: `assets/${filename}`,
        file: outputPath,
        width: metadata.width || 1600,
        height: metadata.height || 900,
      };
    } catch {
      // Keep looking for another cached extension.
    }
  }
  return null;
}

async function ensureRoundedImageAsset(index, sourcePath) {
  const filename = `notion-${String(index + 1).padStart(2, "0")}-rounded.png`;
  const outputPath = path.join(assetsDir, filename);
  const metadata = await sharp(sourcePath).metadata();
  const width = metadata.width || 1600;
  const height = metadata.height || 900;
  const radius = Math.max(24, Math.round(width * 18 / 900));
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/></svg>`
  );

  await sharp(sourcePath)
    .ensureAlpha()
    .composite([{ input: svg, blend: "dest-in" }])
    .png()
    .toFile(outputPath);

  return {
    src: `assets/${filename}`,
    file: outputPath,
    width,
    height,
  };
}

function imageExtension(contentType, url) {
  if (contentType?.includes("jpeg")) return ".jpg";
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  return ext || ".png";
}

async function downloadImages(markdown) {
  const imageMatches = [...markdown.matchAll(/^!\[\]\((.+)\)$/gm)].map((match) => match[1]);
  const urlToAsset = new Map();

  for (const [index, url] of imageMatches.entries()) {
    let response;
    try {
      response = await fetch(url);
    } catch (error) {
      const existing = await getExistingImageAsset(index);
      if (existing) {
        urlToAsset.set(url, await ensureRoundedImageAsset(index, existing.file));
        continue;
      }
      throw error;
    }

    if (!response.ok) {
      const existing = await getExistingImageAsset(index);
      if (existing) {
        urlToAsset.set(url, await ensureRoundedImageAsset(index, existing.file));
        continue;
      }
      throw new Error(`Failed to download image ${index + 1}: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = imageExtension(response.headers.get("content-type"), url);
    const filename = `notion-${String(index + 1).padStart(2, "0")}${ext}`;
    const outputPath = path.join(assetsDir, filename);
    await fs.writeFile(outputPath, buffer);

    const metadata = await sharp(buffer).metadata();
    urlToAsset.set(url, {
      ...(await ensureRoundedImageAsset(index, outputPath)),
      width: metadata.width || 1600,
      height: metadata.height || 900,
    });
  }

  return urlToAsset;
}

function parseMarkdown(markdown, urlToAsset) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let title = process.env.ARTICLE_TITLE || "Notion 图文卡片";
  let para = [];
  let list = null;
  let inCode = false;
  let codeLang = "";
  let code = [];
  let orderedContinuationNext = null;

  const flushParagraph = () => {
    if (!para.length) return;
    const text = para.join(" ").trim();
    if (text) blocks.push({ type: "p", text });
    para = [];
  };

  const flushList = () => {
    if (!list) return;
    if (list.items.length) blocks.push(list);
    if (list.type === "ol") {
      orderedContinuationNext = (list.start || 1) + list.items.length;
    }
    list = null;
  };

  const resetOrderedContinuation = () => {
    orderedContinuationNext = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, "");

    if (inCode) {
      if (line.startsWith("```")) {
        blocks.push({ type: "code", lang: codeLang, code: code.join("\n") });
        inCode = false;
        codeLang = "";
        code = [];
      } else {
        code.push(rawLine);
      }
      continue;
    }

    const fence = line.match(/^```(\w+)?/);
    if (fence) {
      flushParagraph();
      flushList();
      inCode = true;
      codeLang = fence[1] || "";
      code = [];
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.trim() === "<empty-block/>") {
      flushParagraph();
      flushList();
      continue;
    }

    const imageMatch = line.match(/^!\[\]\((.+)\)$/);
    if (imageMatch) {
      flushParagraph();
      flushList();
      resetOrderedContinuation();
      const asset = urlToAsset.get(imageMatch[1]);
      blocks.push({ type: "image", ...asset });
      continue;
    }

    const h1 = line.match(/^# (.+)/);
    if (h1) {
      resetOrderedContinuation();
      title = h1[1].trim();
      continue;
    }

    const h2 = line.match(/^## (.+)/);
    if (h2) {
      flushParagraph();
      flushList();
      resetOrderedContinuation();
      blocks.push({ type: "h2", text: cleanHeading(h2[1]) });
      continue;
    }

    const h3 = line.match(/^### (.+)/);
    if (h3) {
      flushParagraph();
      flushList();
      resetOrderedContinuation();
      blocks.push({ type: "h3", text: cleanHeading(h3[1]) });
      continue;
    }

    const quote = line.match(/^> (.+)/);
    if (quote) {
      flushParagraph();
      flushList();
      resetOrderedContinuation();
      blocks.push({ type: "quote", text: quote[1].trim() });
      continue;
    }

    const ordered = line.match(/^(\d+)\. (.+)/);
    if (ordered) {
      flushParagraph();
      if (!list || list.type !== "ol") {
        flushList();
        const requestedStart = Number.parseInt(ordered[1], 10);
        const start = requestedStart === 1 && orderedContinuationNext ? orderedContinuationNext : requestedStart;
        list = { type: "ol", start, items: [] };
      }
      list.items.push(ordered[2].trim());
      continue;
    }

    const bullet = line.match(/^- (.+)/);
    if (bullet) {
      flushParagraph();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(bullet[1].trim());
      continue;
    }

    flushList();
    resetOrderedContinuation();
    para.push(line.trim());
  }

  flushParagraph();
  flushList();

  return { title, blocks };
}

function buildHtml({ title, blocks }) {
  const data = JSON.stringify({
    title,
    blocks,
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    cover: coverConfig,
    author: authorLabel,
  });

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --paper: ${theme.paper};
    --page-bg: ${theme.pageBg};
    --ink: ${theme.ink};
    --muted: ${theme.muted};
    --line: ${theme.line};
    --accent: ${theme.accent};
    --accent-soft: ${theme.accentSoft};
    --accent-wash: ${theme.accentWash};
    --accent-line: ${theme.accentLine};
    --mark-ink: ${theme.markInk};
    --mark-line: ${theme.markLine};
    --code-bg: ${theme.codeBg};
    --code-ink: ${theme.codeInk};
    --cover-text: ${theme.coverText};
    --signature: ${theme.signature};
    --figure-shadow: ${theme.figureShadow};
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--page-bg);
    color: var(--ink);
    font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }

  #slides {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    padding: 28px;
  }

  .slide {
    position: relative;
    width: 1080px;
    height: 1440px;
    padding: 62px 78px 46px;
    background: var(--paper);
    overflow: hidden;
  }

  .slide::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(30, 36, 45, 0.018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(30, 36, 45, 0.012) 1px, transparent 1px);
    background-size: 54px 54px;
    opacity: .42;
  }

  .slide > * { position: relative; z-index: 1; }

  .cover {
    padding: 78px 86px 70px;
    display: grid;
    grid-template-rows: auto 1fr auto;
    background: var(--paper);
  }

  .cover-mark {
    color: var(--accent);
    font-size: 24px;
    line-height: 1.2;
    font-weight: 500;
    letter-spacing: 0;
  }

  .cover-title {
    position: relative;
    align-self: center;
    padding-left: 34px;
  }

  .cover-title::before {
    content: "";
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 6px;
    border-radius: 999px;
    background: var(--accent);
  }

  .cover-kicker {
    margin-bottom: 30px;
    font-size: 28px;
    color: var(--muted);
    font-weight: 400;
    letter-spacing: 0;
  }

  .cover h1 {
    margin: 0;
    max-width: 860px;
    letter-spacing: 0;
    color: var(--ink);
  }

  .cover h1 .title-main,
  .cover h1 .title-sub {
    display: block;
  }

  .cover h1 .title-main {
    color: var(--accent);
    font-size: 116px;
    line-height: .98;
    font-weight: 680;
  }

  .cover h1 .title-sub {
    margin-top: 24px;
    font-size: 72px;
    line-height: 1.16;
    font-weight: 560;
  }

  .cover h1 .accent {
    color: var(--accent);
  }

  .cover-title-line {
    width: 238px;
    height: 2px;
    margin-top: 34px;
    background: linear-gradient(90deg, var(--accent), transparent);
  }

  .cover-subtitle {
    margin-top: 40px;
    max-width: 780px;
    font-size: 33px;
    line-height: 1.72;
    font-weight: 400;
    color: var(--cover-text);
  }

  .cover-footer {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 28px;
    align-items: end;
    border-top: 1px solid var(--line);
    padding-top: 24px;
  }

  .cover-author {
    color: var(--muted);
    font-family: "Baskerville", "Georgia", "Times New Roman", serif;
    font-size: 25px;
    line-height: 1;
    font-style: italic;
    font-weight: 400;
    letter-spacing: .1px;
  }

  .cover-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .tag {
    padding-bottom: 4px;
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    font-size: 24px;
    font-weight: 400;
  }

  .cover-page {
    color: var(--muted);
    font-size: 32px;
    font-weight: 400;
  }

  .page-head {
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--line);
    padding-bottom: 12px;
    margin-bottom: ${layout.pageHeadMarginBottom}px;
  }

  .page-label {
    max-width: 690px;
    font-size: 22px;
    line-height: 1.16;
    color: var(--accent);
    font-weight: 500;
    overflow: hidden;
    white-space: normal;
  }

  .section-label {
    max-width: 210px;
    color: var(--muted);
    font-size: 19px;
    font-weight: 400;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .content {
    height: ${layout.contentHeight}px;
    overflow: hidden;
  }

  .content > :last-child {
    margin-bottom: 0;
  }

  .page-foot {
    height: 30px;
    display: flex;
    align-items: end;
    justify-content: space-between;
    border-top: 1px solid var(--line);
    padding-top: 10px;
    color: var(--muted);
    font-size: 22px;
    font-weight: 400;
  }

  .author-signature {
    font-family: "Baskerville", "Georgia", "Times New Roman", serif;
    font-size: 25px;
    line-height: 1;
    font-style: italic;
    font-weight: 400;
    letter-spacing: .1px;
    color: var(--signature);
  }

  .page-number {
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    font-weight: 400;
  }

  h2 {
    position: relative;
    isolation: isolate;
    margin: ${layout.h2Margin};
    padding: ${layout.h2Padding};
    max-width: 850px;
    text-align: center;
    font-family: "Songti SC", "Noto Serif CJK SC", "STSong", "PingFang SC", serif;
    font-size: 49px;
    line-height: 1.08;
    letter-spacing: 0;
    font-weight: 660;
    color: #192331;
  }

  h2::before {
    content: attr(data-chapter);
    position: absolute;
    left: 50%;
    top: 3px;
    transform: translateX(-50%);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 104px;
    line-height: 1;
    font-weight: 700;
    color: var(--accent-wash);
    z-index: 0;
  }

  h2::after {
    content: none;
  }

  .chapter-eyebrow,
  .chapter-title-text {
    position: relative;
    z-index: 1;
  }

  .chapter-eyebrow {
    display: block;
    position: relative;
    width: 100%;
    margin: 0 auto 9px;
    text-align: center;
    color: var(--accent);
    font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", Arial, sans-serif;
    font-size: 18px;
    line-height: 1;
    font-weight: 500;
  }

  .chapter-eyebrow::before,
  .chapter-eyebrow::after {
    content: "";
    position: absolute;
    top: 50%;
    width: 86px;
    height: 1px;
    transform: translateY(-50%);
    background: linear-gradient(90deg, transparent, var(--accent-line));
  }

  .chapter-eyebrow::before {
    right: calc(50% + 78px);
  }

  .chapter-eyebrow::after {
    left: calc(50% + 78px);
    background: linear-gradient(90deg, var(--accent-line), transparent);
  }

  .chapter-title-text {
    display: flex;
    align-items: baseline;
    justify-content: center;
    flex-wrap: wrap;
    column-gap: .16em;
    row-gap: .08em;
    text-align: center;
    line-height: 1;
  }

  .chapter-cjk {
    display: inline-block;
    line-height: 1;
  }

  .chapter-latin {
    display: inline-block;
    font-family: "Songti SC", "Noto Serif CJK SC", "STSong", "PingFang SC", serif;
    font-size: .98em;
    line-height: .9;
    transform: translateY(.015em);
  }

  h3 {
    margin: ${layout.h3Margin};
    padding: 0 0 0 17px;
    width: fit-content;
    max-width: 100%;
    font-size: 32px;
    line-height: 1.36;
    letter-spacing: 0;
    font-weight: 600;
    color: #243044;
    border-left: 5px solid var(--accent);
  }

  p {
    margin: ${layout.pMargin};
    font-size: 27px;
    line-height: ${layout.pLineHeight};
    letter-spacing: 0;
    font-weight: 400;
    word-break: break-word;
  }

  strong {
    font-weight: 600;
    color: var(--mark-ink);
    text-decoration: none;
    background: linear-gradient(to top, var(--mark-line) 0 32%, transparent 32% 100%);
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }

  code {
    padding: 1px 6px 3px;
    border-radius: 4px;
    background: var(--code-bg);
    color: var(--code-ink);
    border-bottom: 0;
    font-family: "SFMono-Regular", "Cascadia Mono", Menlo, Consolas, monospace;
    font-size: .84em;
    font-weight: 430;
    word-break: break-word;
  }

  pre {
    position: relative;
    margin: ${layout.preMargin};
    width: 94%;
    padding: 16px 20px;
    background: #252b35;
    color: #f4f1e8;
    border-left: 5px solid var(--accent);
    border-radius: 6px;
    overflow: hidden;
  }

  pre code {
    display: block;
    padding: 0;
    background: transparent;
    color: inherit;
    font-size: 17px;
    line-height: 1.38;
    white-space: pre-wrap;
    word-break: break-word;
    font-weight: 400;
  }

  .tok-comment { color: #8d96a3; }
  .tok-key { color: #e8a468; }
  .tok-str { color: #e3c273; }
  .tok-num { color: #d88d82; }
  .tok-prop { color: #8fb7cf; }
  .tok-punc { color: #bac1ca; }
  .tok-md { color: #f0d27f; }
  .tok-path { color: #c7b8f2; }

  ul, ol {
    margin: ${layout.listMargin};
    padding-left: 0;
    list-style: none;
  }

  li {
    position: relative;
    margin: ${layout.liMargin};
    padding-left: 36px;
    font-size: 26px;
    line-height: ${layout.liLineHeight};
    letter-spacing: 0;
    font-weight: 400;
    word-break: break-word;
  }

  ul li::before {
    content: "";
    position: absolute;
    top: .82em;
    left: 5px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--accent);
  }

  ol {
    counter-reset: step;
  }

  ol li {
    padding-left: 48px;
  }

  ol li::before {
    counter-increment: step;
    content: counter(step);
    position: absolute;
    top: 7px;
    left: 0;
    width: 31px;
    height: 31px;
    display: grid;
    place-items: center;
    border: 1px solid var(--accent-soft);
    color: var(--accent);
    font-size: 19px;
    line-height: 1;
    font-weight: 500;
  }

  blockquote {
    margin: ${layout.blockquoteMargin};
    padding: ${layout.blockquotePadding};
    border-left: 4px solid var(--accent-soft);
    color: #4e463d;
    font-size: 26px;
    line-height: ${layout.blockquoteLineHeight};
    font-weight: 400;
  }

  .next-guide {
    position: relative;
    margin: 28px 0 0;
    padding: 30px 34px 32px;
    border: 1px solid var(--line);
    border-left: 7px solid var(--accent);
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent-soft) 58%, white), rgba(255, 255, 255, .52));
    border-radius: 10px;
    box-shadow: 0 18px 46px rgba(28, 63, 101, .08);
    overflow: hidden;
  }

  .next-guide::after {
    content: "NEXT";
    position: absolute;
    right: 24px;
    bottom: 12px;
    color: var(--accent-wash);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 92px;
    line-height: 1;
    font-weight: 700;
    pointer-events: none;
  }

  .next-guide-label {
    width: fit-content;
    margin-bottom: 18px;
    padding: 5px 12px 6px;
    color: var(--accent);
    background: rgba(255, 255, 255, .68);
    border: 1px solid var(--line);
    border-radius: 999px;
    font-size: 20px;
    line-height: 1;
    font-weight: 600;
  }

  .next-guide-title {
    position: relative;
    z-index: 1;
    max-width: 760px;
    color: var(--ink);
    font-size: 33px;
    line-height: 1.44;
    font-weight: 650;
  }

  .next-guide-action {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
    color: var(--accent);
    font-size: 23px;
    font-weight: 600;
  }

  .next-guide-action::after {
    content: "→";
    font-family: Georgia, "Times New Roman", serif;
    font-size: 30px;
    line-height: 1;
  }

  figure {
    margin: ${layout.figureMargin};
    width: var(--image-width);
    max-width: 100%;
    padding: 0;
    background: transparent;
    border: 0;
    border-radius: 18px;
    overflow: hidden;
    clip-path: inset(0 round 18px);
    -webkit-mask-image: -webkit-radial-gradient(white, black);
    box-shadow: 0 0 0 1px var(--figure-shadow);
  }

  figure img {
    display: block;
    width: 100%;
    height: var(--image-height);
    object-fit: contain;
    border-radius: inherit;
    clip-path: inset(0 round 18px);
    background: transparent;
  }

  .split-note {
    margin: ${layout.splitNoteMargin};
    padding: 16px 18px;
    font-size: 22px;
    color: var(--muted);
    border-left: 4px solid var(--accent-soft);
  }

  h3.command-heading {
    margin-top: ${layout.commandHeadingMarginTop}px;
    margin-bottom: ${layout.commandHeadingMarginBottom}px;
  }

  h3.command-heading + p {
    margin-bottom: ${layout.commandParagraphMarginBottom}px;
  }
</style>
</head>
<body>
<div id="slides"></div>
<script>
const DATA = ${data};
let chapterNo = 0;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/\\\`([^\\\`]+)\\\`/g, "<code>$1</code>");
  html = html.replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>");
  return html;
}

function cleanHeading(value) {
  return String(value).replace(/\\*\\*/g, "").replace(/\\s+/g, " ").trim();
}

function chapterMarkdown(value) {
  const escaped = escapeHtml(cleanHeading(value));
  return escaped
    .split(/([A-Za-z][A-Za-z0-9.+/_-]*(?:\.md)?|[0-9]+(?:\.[0-9]+)?[KMBT]?)/g)
    .filter(Boolean)
    .map((part) => {
      if (/^([A-Za-z][A-Za-z0-9.+/_-]*(?:\.md)?|[0-9]+(?:\.[0-9]+)?[KMBT]?)$/.test(part)) {
        return '<span class="chapter-latin">' + part + '</span>';
      }
      return '<span class="chapter-cjk">' + part + '</span>';
    })
    .join("");
}

function token(className, value) {
  return '<span class="' + className + '">' + escapeHtml(value) + '</span>';
}

function highlightInlineCode(line) {
  const parts = line.split(/("(?:\\\\.|[^"])*"|'(?:\\\\.|[^'])*'|\\b(?:const|let|var|function|return|if|else|for|while|await|async|import|from|export|default|true|false|null|undefined)\\b|\\b\\d+(?:\\.\\d+)?\\b|[{}()[\\],.:;=>]+)/g);
  return parts.map((part) => {
    if (!part) return "";
    if (/^["']/.test(part)) return token("tok-str", part);
    if (/^\\d/.test(part)) return token("tok-num", part);
    if (/^(const|let|var|function|return|if|else|for|while|await|async|import|from|export|default|true|false|null|undefined)$/.test(part)) {
      return token("tok-key", part);
    }
    if (/^[{}()[\\],.:;=>]+$/.test(part)) return token("tok-punc", part);
    return escapeHtml(part);
  }).join("");
}

function splitComment(line, marker) {
  const index = line.indexOf(marker);
  if (index < 0) return [line, ""];
  return [line.slice(0, index), line.slice(index)];
}

function highlightJavascriptLine(line) {
  if (/^\\s*\\/\\//.test(line)) return token("tok-comment", line);
  const [main, comment] = splitComment(line, "//");
  return highlightInlineCode(main) + (comment ? token("tok-comment", comment) : "");
}

function highlightYamlLine(line) {
  if (/^\\s*#/.test(line)) return token("tok-comment", line);
  const [main, comment] = splitComment(line, "#");
  const keyMatch = main.match(/^(\\s*-?\\s*)([A-Za-z0-9_./*-]+)(\\s*:)(.*)$/);
  let html = "";
  const renderValue = (value) => escapeHtml(value)
    .replace(/(&quot;.*?&quot;|&#039;.*?&#039;)/g, '<span class="tok-str">$1</span>')
    .replace(/(\\s\\/\\/\\s.*)$/g, '<span class="tok-comment">$1</span>');

  if (keyMatch) {
    html = escapeHtml(keyMatch[1]) + token("tok-prop", keyMatch[2]) + token("tok-punc", keyMatch[3]) + renderValue(keyMatch[4]);
  } else {
    html = renderValue(main);
  }
  return html + (comment ? token("tok-comment", comment) : "");
}

function highlightMarkdownLine(line) {
  if (/^\\s*#/.test(line)) {
    const match = line.match(/^(\\s*#+\\s*)(.*)$/);
    return token("tok-md", match[1]) + escapeHtml(match[2]);
  }
  let html = escapeHtml(line);
  html = html.replace(/^(\\s*-\\s*)/, '<span class="tok-md">$1</span>');
  const tick = String.fromCharCode(96);
  html = html.replace(new RegExp("(" + tick + "[^" + tick + "]+" + tick + ")", "g"), '<span class="tok-str">$1</span>');
  html = html.replace(/(→|->)/g, '<span class="tok-punc">$1</span>');
  return html;
}

function highlightCode(source, lang) {
  const normalized = (lang || "").toLowerCase();
  return source.split("\\n").map((line) => {
    if (normalized === "markdown" || normalized === "md") return highlightMarkdownLine(line);
    if (normalized === "yaml" || normalized === "yml") return highlightYamlLine(line);
    if (normalized === "javascript" || normalized === "js" || normalized === "typescript" || normalized === "ts") {
      return highlightJavascriptLine(line);
    }
    return highlightInlineCode(line);
  }).join("\\n");
}

function renderBlock(block) {
  if (block.type === "h2") {
    const el = document.createElement("h2");
    chapterNo += 1;
    const chapter = String(chapterNo).padStart(2, "0");
    el.dataset.chapter = chapter;
    el.innerHTML = '<span class="chapter-eyebrow">CHAPTER ' + chapter + '</span><span class="chapter-title-text">' + chapterMarkdown(block.text) + '</span>';
    return el;
  }
  if (block.type === "h3") {
    const el = document.createElement("h3");
    if (/^\\d+\\.\\s*\\//.test(block.text)) el.className = "command-heading";
    el.innerHTML = inlineMarkdown(block.text);
    return el;
  }
  if (block.type === "p") {
    const el = document.createElement("p");
    el.innerHTML = inlineMarkdown(block.text);
    return el;
  }
  if (block.type === "quote") {
    const nextMatch = block.text.match(/^更多内容[:：]\s*(.+)$/);
    if (nextMatch) {
      const el = document.createElement("aside");
      el.className = "next-guide";
      el.innerHTML =
        '<div class="next-guide-label">下一篇内容</div>' +
        '<div class="next-guide-title">' + inlineMarkdown(nextMatch[1]) + '</div>' +
        '<div class="next-guide-action">前往主页查看下一篇内容</div>';
      return el;
    }
    const el = document.createElement("blockquote");
    el.innerHTML = inlineMarkdown(block.text);
    return el;
  }
  if (block.type === "ul" || block.type === "ol") {
    const el = document.createElement(block.type);
    if (block.type === "ol" && block.start) {
      el.start = block.start;
      el.style.counterReset = "step " + (block.start - 1);
    }
    for (const item of block.items) {
      const li = document.createElement("li");
      li.innerHTML = inlineMarkdown(item);
      el.appendChild(li);
    }
    return el;
  }
  if (block.type === "code") {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    if (block.lang) pre.dataset.lang = block.lang;
    code.innerHTML = highlightCode(block.code, block.lang);
    pre.appendChild(code);
    return pre;
  }
  if (block.type === "image") {
    const figure = document.createElement("figure");
    const img = document.createElement("img");
    img.src = block.src;
    img.alt = "Notion image";
    const availableWidth = 900;
    const computedHeight = Math.round(availableWidth * block.height / block.width);
    const displayHeight = Math.min(720, computedHeight);
    const imageCanStayLarge = displayHeight >= 620;
    const minHeight = Math.min(
      displayHeight,
      Math.max(imageCanStayLarge ? 520 : 320, Math.round(displayHeight * (imageCanStayLarge ? 0.8 : 0.72)))
    );
    const preferredMinHeight = Math.min(displayHeight, Math.max(minHeight, Math.round(displayHeight * 0.84)));
    figure.style.setProperty("--image-height", displayHeight + "px");
    figure.style.setProperty("--image-width", availableWidth + "px");
    figure.dataset.idealHeight = String(displayHeight);
    figure.dataset.minHeight = String(minHeight);
    figure.dataset.preferredMinHeight = String(preferredMinHeight);
    figure.appendChild(img);
    return figure;
  }
  throw new Error("Unknown block: " + block.type);
}

function makeListElement(block, startIndex) {
  const el = document.createElement(block.type);
  if (block.type === "ol") {
    const start = (block.start || 1) + startIndex;
    el.start = start;
    el.style.counterReset = "step " + (start - 1);
  }
  return el;
}

function makeListItem(text) {
  const li = document.createElement("li");
  li.innerHTML = inlineMarkdown(text);
  return li;
}

function restoreNodeFigures(node) {
  for (const figure of node.querySelectorAll?.("figure") || []) {
    const idealHeight = Number.parseFloat(figure.dataset.idealHeight || "0");
    if (Number.isFinite(idealHeight) && idealHeight > 0) {
      figure.style.setProperty("--image-height", Math.round(idealHeight) + "px");
    }
  }

  if (node.matches?.("figure")) {
    const idealHeight = Number.parseFloat(node.dataset.idealHeight || "0");
    if (Number.isFinite(idealHeight) && idealHeight > 0) {
      node.style.setProperty("--image-height", Math.round(idealHeight) + "px");
    }
  }
}

function tryReduceOverflow(content, mode = "preferred") {
  let overflow = actualContentUsed(content) - content.clientHeight;
  if (overflow <= 1) return true;

  const figures = [...content.querySelectorAll("figure")].reverse();
  for (const figure of figures) {
    const current = Number.parseFloat(figure.style.getPropertyValue("--image-height"));
    const limit = mode === "hard" ? figure.dataset.minHeight : figure.dataset.preferredMinHeight;
    const minHeight = Number.parseFloat(limit || figure.dataset.minHeight || "0");
    if (!Number.isFinite(current) || !Number.isFinite(minHeight)) continue;

    const room = current - minHeight;
    if (room <= 0) continue;

    const reduceBy = Math.min(room, overflow + 8);
    figure.style.setProperty("--image-height", Math.round(current - reduceBy) + "px");
    overflow = actualContentUsed(content) - content.clientHeight;
    if (overflow <= 1) return true;
  }

  return actualContentUsed(content) - content.clientHeight <= 1;
}

function remainingContentSpace(content) {
  return content.clientHeight - actualContentUsed(content);
}

function actualContentUsed(content) {
  const children = [...content.children];
  if (!children.length) return 0;
  const contentRect = content.getBoundingClientRect();
  const last = children[children.length - 1];
  const lastRect = last.getBoundingClientRect();
  const marginBottom = Number.parseFloat(getComputedStyle(last).marginBottom || "0");
  return lastRect.bottom - contentRect.top + marginBottom;
}

function contentHasOverflow(content) {
  return actualContentUsed(content) - content.clientHeight > 1;
}

function makeSlide(index, sectionTitle) {
  const slide = document.createElement("section");
  slide.className = "slide";
  slide.dataset.index = index;

  const head = document.createElement("div");
  head.className = "page-head";
  head.innerHTML = '<div class="page-label"></div><div class="section-label"></div>';
  head.querySelector(".page-label").textContent = DATA.title;
  head.querySelector(".section-label").textContent = sectionTitle || "一文搞懂";

  const content = document.createElement("main");
  content.className = "content";

  const foot = document.createElement("div");
  foot.className = "page-foot";
  foot.innerHTML = '<span class="author-signature"></span><span class="page-number"></span>';
  foot.querySelector(".author-signature").textContent = DATA.author || "";

  slide.append(head, content, foot);
  document.querySelector("#slides").appendChild(slide);
  return { slide, content };
}

function makeCover() {
  const slide = document.createElement("section");
  slide.className = "slide cover";
  slide.dataset.index = 0;
  slide.innerHTML = \`
    <div class="cover-mark">\${escapeHtml(DATA.title)}</div>
    <div class="cover-title">
      <div class="cover-kicker">\${escapeHtml(DATA.cover.kicker)}</div>
      <h1><span class="title-main">\${escapeHtml(DATA.cover.main)}</span><span class="title-sub">\${escapeHtml(DATA.cover.sub)}</span></h1>
      <div class="cover-title-line"></div>
      <div class="cover-subtitle">\${escapeHtml(DATA.cover.desc)}</div>
    </div>
    <div class="cover-footer">
      <div class="cover-author">\${escapeHtml(DATA.author || "")}</div>
      <div class="cover-page">01</div>
    </div>
  \`;
  document.querySelector("#slides").appendChild(slide);
}

function blockSection(block, currentSection) {
  if (block.type === "h2") return cleanHeading(block.text);
  if (block.type === "h3") return cleanHeading(block.text);
  return currentSection;
}

function paginate() {
  makeCover();
  let slideNo = 1;
  let currentSection = "开篇";
  let page = makeSlide(slideNo, currentSection);

  const nextPage = () => {
    slideNo += 1;
    page = makeSlide(slideNo, currentSection);
  };

  const placeNode = (node) => {
    page.content.appendChild(node);
    if (!contentHasOverflow(page.content)) return;
    if (tryReduceOverflow(page.content)) return;
    if (node.matches?.("figure") && tryReduceOverflow(page.content, "hard")) return;

    if (page.content.children.length > 1) {
      node.remove();
      restoreNodeFigures(node);
      nextPage();
      page.content.appendChild(node);
      tryReduceOverflow(page.content, "hard");
    }
  };

  const placeHeading = (node, minSpaceAfter = 260) => {
    const hadContent = page.content.children.length > 0;
    page.content.appendChild(node);
    if (contentHasOverflow(page.content) && !tryReduceOverflow(page.content)) {
      node.remove();
      nextPage();
      page.content.appendChild(node);
      return;
    }

    if (hadContent && remainingContentSpace(page.content) < minSpaceAfter) {
      node.remove();
      nextPage();
      page.content.appendChild(node);
    }
  };

  const placeList = (block) => {
    let listEl = null;

    for (let itemIndex = 0; itemIndex < block.items.length; itemIndex += 1) {
      if (!listEl) {
        listEl = makeListElement(block, itemIndex);
        page.content.appendChild(listEl);
      }

      const item = makeListItem(block.items[itemIndex]);
      listEl.appendChild(item);

      if (!contentHasOverflow(page.content) || tryReduceOverflow(page.content)) {
        continue;
      }

      item.remove();
      if (listEl.children.length === 0) listEl.remove();
      nextPage();
      listEl = makeListElement(block, itemIndex);
      page.content.appendChild(listEl);
      listEl.appendChild(item);
      tryReduceOverflow(page.content);
    }
  };

  for (const block of DATA.blocks) {
    if (block.type === "h2") {
      currentSection = blockSection(block, currentSection);
      placeHeading(renderBlock(block), 0);
      page.slide.querySelector(".section-label").textContent = currentSection;
    } else if (block.type === "ul" || block.type === "ol") {
      page.slide.querySelector(".section-label").textContent = currentSection;
      placeList(block);
    } else {
      currentSection = blockSection(block, currentSection);
      page.slide.querySelector(".section-label").textContent = currentSection;
      placeNode(renderBlock(block));
    }
  }

  const slides = [...document.querySelectorAll(".slide")];
  const total = slides.length;
  slides.forEach((slide, index) => {
    const pageNumber = slide.querySelector(".page-number");
    if (pageNumber) pageNumber.textContent = String(index + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0");
    const coverPage = slide.querySelector(".cover-page");
    if (coverPage) coverPage.textContent = "01 / " + String(total).padStart(2, "0");
  });

  window.__PAGE_COUNT__ = total;
  window.__PAGINATION_DONE__ = true;
}

window.addEventListener("load", async () => {
  await document.fonts.ready;
  paginate();
});
</script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanHeading(value) {
  return String(value).replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

async function makeContactSheet(pageFiles) {
  const thumbs = [];
  const thumbWidth = 270;
  const thumbHeight = 360;
  for (const file of pageFiles) {
    const buffer = await sharp(file)
      .resize(thumbWidth, thumbHeight)
      .png()
      .toBuffer();
    thumbs.push(buffer);
  }

  const columns = 4;
  const gap = 18;
  const rows = Math.ceil(thumbs.length / columns);
  const width = columns * thumbWidth + (columns + 1) * gap;
  const height = rows * thumbHeight + (rows + 1) * gap;
  const composite = thumbs.map((input, index) => ({
    input,
    left: gap + (index % columns) * (thumbWidth + gap),
    top: gap + Math.floor(index / columns) * (thumbHeight + gap),
  }));

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#f8f4ea",
    },
  })
    .composite(composite)
    .png()
    .toFile(path.join(distDir, "contact-sheet.png"));
}

async function renderScreenshots() {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: SLIDE_WIDTH + 120, height: SLIDE_HEIGHT + 120 },
    deviceScaleFactor: EXPORT_SCALE,
  });

  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__PAGINATION_DONE__ === true);
  const pageCount = await page.evaluate(() => window.__PAGE_COUNT__);
  const files = [];

  for (let index = 0; index < pageCount; index += 1) {
    const locator = page.locator(".slide").nth(index);
    const filename = `${outputSlug}-${String(index + 1).padStart(2, "0")}.png`;
    const outputPath = path.join(pagesDir, filename);
    await locator.screenshot({ path: outputPath, type: "png" });
    files.push(outputPath);
  }

  await browser.close();
  await makeContactSheet(files);
  return files;
}

async function main() {
  await ensureCleanOutput();
  const markdown = await fs.readFile(sourcePath, "utf8");
  const urlToAsset = await downloadImages(markdown);
  const parsed = parseMarkdown(markdown, urlToAsset);
  const html = buildHtml(parsed);
  await fs.writeFile(htmlPath, html, "utf8");
  const files = await renderScreenshots();

  const manifest = {
    title: parsed.title,
    width: SLIDE_WIDTH * EXPORT_SCALE,
    height: SLIDE_HEIGHT * EXPORT_SCALE,
    logicalWidth: SLIDE_WIDTH,
    logicalHeight: SLIDE_HEIGHT,
    scale: EXPORT_SCALE,
    count: files.length,
    pages: files.map((file) => path.relative(rootDir, file)),
    preview: path.relative(rootDir, path.join(distDir, "contact-sheet.png")),
    html: path.relative(rootDir, htmlPath),
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`Rendered ${files.length} pages to ${pagesDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
