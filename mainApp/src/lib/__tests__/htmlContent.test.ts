// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { looksLikeHtml, sanitizeHtml, stripHtml } from '../htmlContent';

describe('stripHtml', () => {
  it('extracts plain text from TipTap HTML', () => {
    const html = '<h1>Title</h1><p>Body with <strong>bold</strong> and <em>italic</em>.</p>';
    expect(stripHtml(html)).toBe('Title Body with bold and italic.');
  });

  it('leaves plain text (markdown) untouched', () => {
    expect(stripHtml('**bold** and `code`')).toBe('**bold** and `code`');
  });

  it('decodes common entities', () => {
    expect(stripHtml('<p>A &amp; B &lt; C &gt; D &quot;E&quot;</p>')).toBe('A & B < C > D "E"');
  });

  it('drops style/script blocks', () => {
    const html = '<style>p{color:red}</style><p>ok</p><script>alert(1)</script>';
    expect(stripHtml(html)).toBe('ok');
  });
});

describe('looksLikeHtml', () => {
  it('detects TipTap/block HTML', () => {
    expect(looksLikeHtml('<p>Hello <strong>world</strong></p>')).toBe(true);
    expect(looksLikeHtml('<h1>Title</h1>')).toBe(true);
  });

  it('rejects markdown and plain text', () => {
    expect(looksLikeHtml('## Heading **bold**')).toBe(false);
    expect(looksLikeHtml('plain note')).toBe(false);
  });
});

describe('sanitizeHtml', () => {
  it('strips script, handlers and javascript: links', () => {
    const html = '<p onclick="alert(1)">hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a>';
    const out = sanitizeHtml(html);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('javascript:');
  });

  it('keeps safe inline styles and drops unsafe ones', () => {
    const html = '<p style="text-align: center; background: url(javascript:alert(1)); color: red">x</p>';
    const out = sanitizeHtml(html);
    expect(out).toContain('text-align: center');
    expect(out).toContain('color: red');
    expect(out).not.toContain('background');
  });
});
