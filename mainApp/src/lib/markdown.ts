import DOMPurify from 'dompurify';

/**
 * Pure, sanitized markdown → HTML string renderer.
 *
 * Keeps the legacy hand-rolled regex pipeline (so existing `md-*` styling,
 * the visual editor preview and docEngine exports keep their exact output)
 * but the final string is passed through DOMPurify. No raw HTML survives
 * unless DOMPurify's allow-list permits it, so stored payloads such as
 * `[x](javascript:alert(1))`, attribute breakouts or `<script>`/`<img>`
 * injections render inert. `<font>` is intentionally limited to its safe
 * `color`/`size`/`face` attributes by DOMPurify's defaults.
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

export function renderMarkdown(raw: string): string {
  if (!raw.trim()) return '';

  let html = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // ── Restore safe HTML tags from escaped forms ───────────────────────────
    .replace(/&lt;font color="([^"]+)"&gt;([\s\S]*?)&lt;\/font&gt;/gi, '<font color="$1">$2</font>')
    .replace(/&lt;font size="([^"]+)"&gt;([\s\S]*?)&lt;\/font&gt;/gi, '<font size="$1">$2</font>')
    .replace(/&lt;font color="([^"]+)" size="([^"]+)"&gt;([\s\S]*?)&lt;\/font&gt;/gi, '<font color="$1" size="$2">$3</font>')
    .replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/gi, '<u>$1</u>')
    .replace(/&lt;s&gt;([\s\S]*?)&lt;\/s&gt;/gi, '<s>$1</s>')
    // ── Block elements ──────────────────────────────────────────────────────
    .replace(/```([a-zA-Z0-9]*)\n([\s\S]+?)\n```/g, '<pre class="md-pre"><code class="md-code-block language-$1">$2</code></pre>')
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="md-h1">$1</h1>')
    .replace(/^&gt; (.+)$/gm, '<blockquote class="md-quote">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="md-hr" />')
    // ── Task list items ─────────────────────────────────────────────────────
    .replace(/^- \[ \] (.+)$/gm, '<li class="md-li md-task-li"><input type="checkbox" disabled class="md-task-checkbox" /> <span>$1</span></li>')
    .replace(/^- \[x\] (.+)$/gm, '<li class="md-li md-task-li"><input type="checkbox" checked disabled class="md-task-checkbox" /> <span class="line-through text-surface-500">$1</span></li>')
    // ── Inline formatting ───────────────────────────────────────────────────
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong class="md-bold">$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em class="md-italic">$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="md-link">$1</a>')
    // ── List items ──────────────────────────────────────────────────────────
    .replace(/^- (.+)$/gm, '<li class="md-li">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="md-li md-oli">$1</li>');

  html = html
    .replace(/(<li class="md-li(?! md-oli)[^"]*">[\s\S]*?<\/li>\n?)+/g, m => `<ul class="md-ul">${m}</ul>`)
    .replace(/(<li class="md-li md-oli">[\s\S]*?<\/li>\n?)+/g,           m => `<ol class="md-ol">${m}</ol>`);

  html = html
    .split(/\n\n+/)
    .map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^<(h[1-3]|ul|ol|blockquote|hr|pre)/.test(trimmed)) return trimmed;
      return `<p class="md-p">${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');

  // Restore alignment from data attribute to inline style (after block wrapping)
  html = html.replace(/data-md-align="(left|center|right|justify)"/gi, 'style="text-align: $1"');

  return DOMPurify.sanitize(html, { ADD_ATTR: ['style'] });
}
