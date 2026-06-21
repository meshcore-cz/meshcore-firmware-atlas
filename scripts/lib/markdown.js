// Render Markdown (GitHub release notes) to sanitized HTML at build time.
// Done in the build pipeline (Node) so the app only ever renders trusted HTML.
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

marked.setOptions({ gfm: true, breaks: false });

const allowedTags = [
  ...sanitizeHtml.defaults.allowedTags,
  'img',
  'h1',
  'h2',
  'del',
  'ins'
];

/** @param {string|undefined|null} md @returns {string|null} */
export function renderMarkdown(md, { baseUrl = null } = {}) {
  if (!md) return null;
  const html = marked.parse(md.trim());
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          href: resolveUrl(attribs.href, baseUrl),
          target: '_blank',
          rel: 'noopener noreferrer'
        }
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          src: resolveUrl(attribs.src, baseUrl)
        }
      })
    }
  });
}

function resolveUrl(value, baseUrl) {
  if (!value || !baseUrl || value.startsWith('#')) return value;
  try {
    return new URL(value, markdownBaseUrl(baseUrl)).toString();
  } catch {
    return value;
  }
}

function markdownBaseUrl(baseUrl) {
  const githubRepo = baseUrl.match(/^https:\/\/github\.com\/([^/]+\/[^/#?]+)/);
  if (githubRepo) return `https://github.com/${githubRepo[1]}/blob/HEAD/`;
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}
