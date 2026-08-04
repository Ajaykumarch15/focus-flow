// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderMarkdown, Markdown } from '../index';

describe('renderMarkdown — sanitized string renderer', () => {
  it('renders basic markdown with the legacy md-* class structure', () => {
    const html = renderMarkdown('# Title\n\n**bold** and `code`');
    expect(html).toContain('<h1 class="md-h1">Title</h1>');
    expect(html).toContain('<strong class="md-bold">bold</strong>');
    expect(html).toContain('<code class="md-code">code</code>');
  });

  it('returns empty string for blank input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown('   \n  ')).toBe('');
  });

  it('neutralizes javascript: URLs in markdown links', () => {
    const html = renderMarkdown('[x](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toMatch(/href/);
  });

  it('neutralizes vbscript: and data: URLs', () => {
    expect(renderMarkdown('[x](vbscript:msgbox(1))')).not.toContain('vbscript:');
    expect(renderMarkdown('[x](data:text/html,<script>alert(1)</script>)')).not.toContain('data:');
  });

  it('never emits a real <script> element', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script');
  });

  it('never emits a real <img> element from raw markup', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
  });

  it('keeps font markup but only with safe attributes (no event handlers)', () => {
    const safe = renderMarkdown('<font color="#0ea5e9">blue</font>');
    expect(safe).toContain('<font color="#0ea5e9">');
    expect(safe).not.toContain('onmouseover');

    const breakout = renderMarkdown('<font color="red" onmouseover="alert(1)">x</font>');
    expect(breakout).not.toContain('<font');
  });

  it('keeps content inside font escaped so nested tags cannot materialize', () => {
    const html = renderMarkdown('<font color="red">safe<img src=x onerror=alert(1)>text</font>');
    expect(html).toContain('<font color="red">');
    expect(html).not.toContain('<img');
  });
});

describe('Markdown component — react-markdown + rehype-sanitize', () => {
  it('renders headings with the md-* class mapping', () => {
    const html = renderToStaticMarkup(<Markdown source="# Title" />);
    expect(html).toContain('<h1 class="md-h1">Title</h1>');
  });

  it('renders GFM task lists with checkbox input', () => {
    const html = renderToStaticMarkup(<Markdown source="- [x] done\n- [ ] todo" />);
    expect(html).toContain('md-task-li');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  it('strips javascript: hrefs from markdown links', () => {
    const html = renderToStaticMarkup(<Markdown source="[x](javascript:alert(1))" />);
    expect(html).not.toContain('javascript:');
  });

  it('strips script elements and event handlers from raw HTML', () => {
    const html = renderToStaticMarkup(
      <Markdown source={'<script>alert(1)</script>\n\n<img src="x" onerror="alert(2)" />\n\n<a href="javascript:alert(3)">x</a>'} />
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });

  it('strips attribute breakout on font but keeps safe color', () => {
    const safe = renderToStaticMarkup(<Markdown source={'<font color="#0ea5e9">blue</font>'} />);
    expect(safe).toContain('<font color="#0ea5e9">');

    const breakout = renderToStaticMarkup(<Markdown source={'<font color="red" onmouseover="alert(1)">x</font>'} />);
    expect(breakout).not.toContain('onmouseover');
  });

  it('strips arbitrary class/onclick injection', () => {
    const html = renderToStaticMarkup(<Markdown source={'<p class="md-h1" onclick="alert(1)">x</p>'} />);
    expect(html).not.toContain('onclick');
  });
});
