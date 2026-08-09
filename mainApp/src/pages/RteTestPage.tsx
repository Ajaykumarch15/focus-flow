import { useState } from 'react';
import { TextEditor } from '@maple1521/rich-text-editor';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const INITIAL_HTML = `
<h1>Rich Text Editor Demo</h1>
<p>This is <strong>bold</strong>, <em>italic</em>, and <u>underlined</u> text. Add a <a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a> or a <code>code span</code>.</p>
<ul><li><p>Bullet list item</p></li><li><p>Another item</p></li></ul>
<ol><li><p>First step</p></li><li><p>Second step</p></li></ol>
<blockquote><p>A meaningful quote.</p></blockquote>
<p style="text-align: center">Centered paragraph.</p>
`.trim();

const FORMAT_HINT = [
  'Bold / Italic / Underline / Strikethrough',
  'Headings, font family, font size, text & highlight color',
  'Alignment, bullet & numbered lists',
  'Links, inline code, code block, block quote, horizontal rule',
  'Undo / Redo',
].map(s => s);

// Scoped typography refinements for the white "document canvas" area. The
// package injects its own stylesheet automatically — no manual CSS import.
// Class names below are optional and only affect the editor's content area.
const canvasStyle = `
.rte-canvas .ProseMirror { font-family: var(--font-sans, inherit); }
.rte-canvas .ProseMirror h1 { font-size: 1.6rem; margin: 0.75rem 0 0.5rem; }
.rte-canvas .ProseMirror h2 { font-size: 1.3rem; margin: 0.7rem 0 0.4rem; }
.rte-canvas .ProseMirror h3 { font-size: 1.1rem; margin: 0.6rem 0 0.35rem; }
.rte-canvas .ProseMirror p { margin: 0.5rem 0; }
.rte-canvas .ProseMirror blockquote { border-left: 3px solid #c4b5fd; }
.rte-canvas .ProseMirror ul { list-style: disc; padding-left: 1.4rem; }
.rte-canvas .ProseMirror ol { list-style: decimal; padding-left: 1.4rem; }
`;

export function RteTestPage() {
  const [html, setHtml] = useState(INITIAL_HTML);
  const [empty, setEmpty] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [minHeight, setMinHeight] = useState(240);

  return (
    <div className="p-8 lg:p-10 max-w-5xl mx-auto space-y-8">
      <style>{canvasStyle}</style>

      <PageHeader
        title="Rich Text Editor — Isolated Test"
        description="Phase 3 verification page for @maple1521/rich-text-editor@0.1.0 (not wired to any production screen)"
        icon={<span className="text-xl">📝</span>}
        iconColor="#0ea5e9"
        actions={
          <Button variant="outline" size="sm" onClick={() => setHtml(INITIAL_HTML)}>
            Reset to initial value
          </Button>
        }
      />

      <Card className="p-5 rounded-2xl border border-surface-800">
        <div className="mb-3 text-sm text-surface-400 leading-relaxed">
          Public API in use: <code className="text-brand-400">value</code>,{' '}
          <code className="text-brand-400">onChange</code>,{' '}
          <code className="text-brand-400">placeholder</code>,{' '}
          <code className="text-brand-400">minHeight</code>,{' '}
          <code className="text-brand-400">disabled</code>,{' '}
          <code className="text-brand-400">className</code>. No <code>maxCharacters</code> prop exists in v0.1.0.
        </div>

        {/* 1 — Controlled editor */}
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display font-bold text-surface-50">1. Controlled editor (value + onChange)</h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-surface-400">
              <input
                type="checkbox"
                checked={disabled}
                onChange={e => setDisabled(e.target.checked)}
                className="accent-brand-500"
              />
              disabled
            </label>
            <label className="flex items-center gap-1.5 text-xs text-surface-400">
              minHeight
              <input
                type="number"
                value={minHeight}
                min={120}
                max={600}
                step={40}
                onChange={e => setMinHeight(Number(e.target.value))}
                className="w-20 h-7 rounded-lg bg-surface-900 border border-surface-800 text-surface-50 text-xs px-2"
              />
            </label>
          </div>
        </div>
        <div className="rte-canvas rounded-2xl overflow-hidden border border-surface-800 shadow-lg shadow-black/10">
          <TextEditor
            value={html}
            onChange={setHtml}
            placeholder="Start writing..."
            minHeight={minHeight}
            disabled={disabled}
            className="rte-canvas-inner"
          />
        </div>

        {/* HTML readout — proves onChange fires with HTML */}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-1.5">
              Raw HTML from onChange ({html.length} chars)
            </div>
            <pre className="text-[11px] leading-relaxed bg-surface-950 border border-surface-800 rounded-xl p-3 overflow-auto max-h-56 text-surface-400">
              {html || '<empty>'}
            </pre>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-1.5">
              Rendered preview
            </div>
            <div className="prose prose-invert max-w-none text-sm text-surface-200 bg-surface-950 border border-surface-800 rounded-xl p-3 overflow-auto max-h-56">
              <div
                dangerouslySetInnerHTML={{ __html: html }}
                onClick={e => e.preventDefault()}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 2 — Placeholder demo */}
      <Card className="p-5 rounded-2xl border border-surface-800">
        <h3 className="font-display font-bold text-surface-50 mb-1">2. Placeholder</h3>
        <p className="text-xs text-surface-500 mb-3">
          Empty value shows the placeholder; typing updates the char count below (char count is computed here in the demo, not by the package).
        </p>
        <div className="rte-canvas rounded-2xl overflow-hidden border border-surface-800">
          <TextEditor value={empty} onChange={setEmpty} placeholder="Write a journal entry..." minHeight={140} />
        </div>
        <div className="mt-2 text-right text-xs text-surface-500 font-mono">{empty.length} chars</div>
      </Card>

      {/* 3 — Formatting inventory */}
      <Card className="p-5 rounded-2xl border border-surface-800">
        <h3 className="font-display font-bold text-surface-50 mb-2">3. Toolbar capabilities</h3>
        <ul className="space-y-1.5">
          {FORMAT_HINT.map((f, i) => (
            <li key={f} className="flex items-center gap-2 text-sm text-surface-300">
              <span className="w-5 h-5 rounded-md bg-brand-500/10 text-brand-400 flex items-center justify-center text-[11px] font-bold">
                {i + 1}
              </span>
              {f}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
