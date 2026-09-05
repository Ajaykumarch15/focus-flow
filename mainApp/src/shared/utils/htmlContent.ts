import DOMPurify from 'dompurify';

/**
 * Helpers for the HTML payloads produced by the rich-text editor
 * (@maple1521/rich-text-editor). Journal entries now store TipTap HTML
 * instead of raw markdown, while every plain-text consumer (search, memory,
 * continuation, timeline, dashboard preview) reads them as text.
 *
 *   - sanitizeHtml  → DOMPurify with a safe inline-style allowlist so the
 *     editor's alignment/color/highlight output survives while XSS sinks
 *     (event handlers, javascript:/data: URLs, unknown tags) are stripped.
 *   - looksLikeHtml → cheap structural test so old markdown entries keep
 *     rendering through the markdown pipeline instead of being misread.
 *   - stripHtml     → regex plain-text extraction (no DOM) so pure selectors
 *     and server-side tests can run without a browser.
 */

const SAFE_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'text-align',
  'font-size',
  'font-family',
  'font-weight',
  'font-style',
  'text-decoration',
]);

DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName !== 'style') return;
  const kept = (data.attrValue || '')
    .split(';')
    .map((rule) => rule.trim())
    .filter((rule) => {
      const prop = rule.split(':')[0]?.trim().toLowerCase();
      return prop && SAFE_STYLE_PROPS.has(prop);
    });
  if (kept.length === 0) {
    data.keepAttr = false;
    return;
  }
  data.attrValue = kept.join('; ');
});

export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, { ADD_ATTR: ['style'] });
}

const HTML_STRUCTURE_RE =
  /<(?:p|div|h[1-6]|ul|ol|li|blockquote|pre|table|hr|br|strong|em|b|i|u|mark|span|a)(?:\s|>)/i;

export function looksLikeHtml(input: string): boolean {
  return HTML_STRUCTURE_RE.test(input);
}

export function stripHtml(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
