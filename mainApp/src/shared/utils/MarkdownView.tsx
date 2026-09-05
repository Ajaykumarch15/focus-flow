import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

/**
 * Sanitized markdown display component.
 *
 * Renders markdown through react-markdown with GFM support and parses legacy
 * inline HTML (e.g. stored `<font color>` markup), then passes the tree
 * through rehype-sanitize. The schema only permits a whitelist of tags and
 * attributes: scripts, event handlers, `javascript:`/`data:` URLs and other
 * attribute breakouts are stripped before anything reaches the DOM.
 *
 * Elements are mapped to the same `md-*` classes used by the string renderer
 * (`src/lib/markdown.ts`) so the existing `.prose-editor` styles apply.
 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'font'],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className'],
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
    font: ['color', 'size', 'face'],
  },
};

const components: Components = {
  h1: ({ node, className, ...props }) => <h1 className="md-h1" {...props} />,
  h2: ({ node, className, ...props }) => <h2 className="md-h2" {...props} />,
  h3: ({ node, className, ...props }) => <h3 className="md-h3" {...props} />,
  p: ({ node, className, ...props }) => <p className="md-p" {...props} />,
  ul: ({ node, className, ...props }) => <ul className="md-ul" {...props} />,
  ol: ({ node, className, ...props }) => <ol className="md-ol" {...props} />,
  li: ({ node, className, ...props }) => (
    <li className={`md-li${String(className ?? '').includes('task-list-item') ? ' md-task-li' : ''}`} {...props} />
  ),
  blockquote: ({ node, className, ...props }) => <blockquote className="md-quote" {...props} />,
  hr: ({ node, className, ...props }) => <hr className="md-hr" {...props} />,
  pre: ({ node, className, ...props }) => <pre className="md-pre" {...props} />,
  code: ({ node, className, children, ...props }) => {
    const isBlock = typeof className === 'string' && className.includes('language-');
    return isBlock ? (
      <code className={`md-code-block ${className}`} {...props}>{children}</code>
    ) : (
      <code className="md-code" {...props}>{children}</code>
    );
  },
  a: ({ node, href, className, ...props }) => (
    <a href={href} className="md-link" target="_blank" rel="noreferrer" {...props} />
  ),
  strong: ({ node, className, ...props }) => <strong className="md-bold" {...props} />,
  em: ({ node, className, ...props }) => <em className="md-italic" {...props} />,
  input: ({ node, className, ...props }) => <input className="md-task-checkbox" {...props} />,
};

export function Markdown({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
      components={components}
    >
      {source}
    </ReactMarkdown>
  );
}
