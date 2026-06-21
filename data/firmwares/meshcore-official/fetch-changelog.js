// Custom changelog source for the official MeshCore firmware.
//
// The GitHub release bodies only link to the real release notes on the MeshCore
// blog (blog.meshcore.io, a Jekyll site). This script reads the blog's Atom feed
// — which carries the full post HTML per entry — matches each release to its
// blog post by URL, and converts the post HTML to Markdown for the changelog.
//
// Contract: default-exports `async ({ githubReleases, mapRelease, fetch }) => releases`.
import TurndownService from 'turndown';

const BLOG_ORIGIN = 'https://blog.meshcore.io';
const FEED_URL = `${BLOG_ORIGIN}/feed.xml`;
const BLOG_RE = /https?:\/\/blog\.meshcore\.io\/[^\s)"'<]+/;
const MAX_NOTE_CHARS = 16000;

function unescapeXml(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

const normUrl = (u) => u.replace(/[).,\s]+$/, '').replace(/\/$/, '');

// Fetch the blog feed and return a Map of post URL -> Markdown.
async function loadBlogNotes(fetch) {
  const map = new Map();
  const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'meshcore-index' } });
  if (!res.ok) throw new Error(`blog feed ${res.status}`);
  const xml = await res.text();

  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
  });

  for (const m of xml.matchAll(/<entry\b[\s\S]*?<\/entry>/g)) {
    const entry = m[0];
    const link = entry.match(/<link[^>]*\bhref="([^"]+)"/)?.[1];
    const content = entry.match(/<content\b[^>]*>([\s\S]*?)<\/content>/)?.[1];
    if (!link || !content) continue;
    let md = td.turndown(unescapeXml(content)).trim();
    // Drop the leading hero image the blog posts open with.
    md = md.replace(/^!\[[^\]]*\]\([^)]*\)\s*/, '').trim();
    // Make root-relative blog links/images (](/...) absolute.
    md = md.replace(/\]\(\/(?!\/)/g, `](${BLOG_ORIGIN}/`);
    if (md.length > MAX_NOTE_CHARS) md = md.slice(0, MAX_NOTE_CHARS) + '\n…';
    map.set(normUrl(link), md);
  }
  return map;
}

export default async function ({ githubReleases, mapRelease, fetch }) {
  let blog = new Map();
  try {
    blog = await loadBlogNotes(fetch);
  } catch (err) {
    console.warn(`  (blog feed unavailable: ${err.message}; falling back to GitHub bodies)`);
  }

  return githubReleases.map((r) => {
    const release = mapRelease(r);
    const url = r.body?.match(BLOG_RE)?.[0];
    const notes = url && blog.get(normUrl(url));
    if (notes) {
      release.notes = notes;
      release.notesUrl = normUrl(url); // record where the notes came from
    }
    return release;
  });
}
