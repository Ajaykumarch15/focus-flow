import { useEffect } from 'react';
import { looksLikeHtml, sanitizeHtml } from '@shared/utils/htmlContent';
import { Markdown } from '@shared/utils';

export const RICH_CONTENT_STYLES = `
.rich-content { font-size: 0.9375rem; line-height: 1.7; }
.rich-content h1 { font-size: 1.35rem; font-weight: 700; color: var(--color-surface-50); margin: 1rem 0 0.5rem; }
.rich-content h2 { font-size: 1.15rem; font-weight: 600; color: var(--color-surface-50); margin: 0.8rem 0 0.4rem; }
.rich-content h3 { font-size: 1.05rem; font-weight: 600; color: var(--color-surface-100); margin: 0.6rem 0 0.3rem; }
.rich-content p { margin: 0.5rem 0; line-height: 1.7; color: var(--color-surface-300); }
.rich-content ul { list-style: disc; padding-left: 1.25rem; margin: 0.5rem 0; }
.rich-content ol { list-style: decimal; padding-left: 1.25rem; margin: 0.5rem 0; }
.rich-content li { margin: 0.3rem 0; color: var(--color-surface-300); line-height: 1.6; }
.rich-content blockquote { border-left: 4px solid var(--color-brand-500); padding: 0.25rem 0.75rem; color: var(--color-surface-400); margin: 0.6rem 0; font-style: italic; background: color-mix(in srgb, var(--color-brand-500) 8%, transparent); border-radius: 0 4px 4px 0; }
.rich-content pre { background: var(--color-surface-850); border: 1px solid var(--color-surface-800); border-radius: 8px; padding: 0.75rem; overflow-x: auto; margin: 0.75rem 0; }
.rich-content code { background: var(--color-surface-850); border: 1px solid var(--color-surface-800); border-radius: 6px; padding: 2px 5px; font-family: 'JetBrains Mono', monospace; font-size: 0.85em; color: var(--color-brand-500); }
.rich-content pre code { background: none; border: none; padding: 0; color: var(--color-surface-200); }
.rich-content a { color: var(--color-brand-500); text-decoration: underline; text-underline-offset: 2px; font-weight: 500; }
.rich-content a:hover { color: var(--color-brand-400); }
.rich-content u { text-decoration: underline; }
.rich-content s { text-decoration: line-through; color: var(--color-surface-500); }
.rich-content [data-md-align="center"] { text-align: center; }
.rich-content [data-md-align="right"] { text-align: right; }
.rich-content [data-md-align="justify"] { text-align: justify; }
.rich-content strong { font-weight: 600; color: var(--color-surface-50); }
.rich-content hr { border: none; border-top: 1px solid var(--color-surface-800); margin: 1rem 0; }
.rich-content mark { background: #fef08a; color: #101828; border-radius: 3px; padding: 0.1em 0.2em; }
.rich-content table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.875rem; }
.rich-content th, .rich-content td { border: 1px solid var(--color-surface-700); padding: 0.5rem 0.75rem; text-align: left; }
.rich-content th { background: var(--color-surface-800); font-weight: 600; }
`;

function injectStyles() {
  const styleId = 'rich-content-styles';
  if (document.getElementById(styleId)) return;
  const el = document.createElement('style');
  el.id = styleId;
  el.innerHTML = RICH_CONTENT_STYLES;
  document.head.appendChild(el);
}

export function RichContent({ content, className = '' }: { content: string; className?: string }) {
  useEffect(() => { injectStyles(); }, []);

  if (!content) return null;

  if (looksLikeHtml(content)) {
    return <div className={`rich-content ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />;
  }

  return (
    <div className={`rich-content ${className}`}>
      <Markdown source={content} />
    </div>
  );
}
