import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bold, Italic, Code, List, ListOrdered, Quote,
  Minus, Link2, Eye, EyeOff, Maximize2, Minimize2,
  Loader2, Save, Type, Hash,
} from 'lucide-react';

// ── Simple markdown renderer (no external dependency) ─────────────────────────
function renderMarkdown(raw: string): string {
  if (!raw.trim()) return '';

  let html = raw
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Headings (must come before bold/italic)
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="md-h1">$1</h1>')

    // Blockquote
    .replace(/^&gt; (.+)$/gm, '<blockquote class="md-quote">$1</blockquote>')

    // Horizontal rule
    .replace(/^---$/gm, '<hr class="md-hr" />')

    // Inline code
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')

    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong class="md-bold">$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em class="md-italic">$1</em>')

    // Links  [label](url)
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer" class="md-link">$1</a>',
    )

    // Unordered lists — group consecutive - lines
    .replace(/^- (.+)$/gm, '<li class="md-li">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="md-li md-oli">$1</li>');

  // Wrap consecutive <li> in <ul>/<ol>
  html = html
    .replace(/(<li class="md-li(?! md-oli)[^"]*">[^<]*<\/li>\n?)+/g, m => `<ul class="md-ul">${m}</ul>`)
    .replace(/(<li class="md-li md-oli">[^<]*<\/li>\n?)+/g,           m => `<ol class="md-ol">${m}</ol>`);

  // Paragraphs — blank-line-separated blocks not already wrapped in a block tag
  html = html
    .split(/\n\n+/)
    .map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^<(h[1-3]|ul|ol|blockquote|hr)/.test(trimmed)) return trimmed;
      return `<p class="md-p">${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');

  return html;
}

// ── Toolbar button ────────────────────────────────────────────────────────────
function ToolBtn({
  icon: Icon, label, onClick, active = false, shortcut,
}: {
  icon: React.ElementType; label: string; onClick: () => void;
  active?: boolean; shortcut?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={shortcut ? `${label}  (${shortcut})` : label}
      className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
        active
          ? 'bg-brand-500/20 text-brand-400'
          : 'text-surface-400 hover:text-white hover:bg-surface-700'
      }`}
    >
      <Icon size={14} />
    </button>
  );
}

// ── Insert text around selection ──────────────────────────────────────────────
function wrapSelection(
  el: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = 'text',
): string {
  const { selectionStart: s, selectionEnd: e, value } = el;
  const selected = value.slice(s, e) || placeholder;
  const next = value.slice(0, s) + before + selected + after + value.slice(e);
  // Restore cursor
  requestAnimationFrame(() => {
    el.focus();
    const ns = s + before.length;
    el.setSelectionRange(ns, ns + selected.length);
  });
  return next;
}

function prependLines(el: HTMLTextAreaElement, prefix: string): string {
  const { selectionStart: s, selectionEnd: e, value } = el;
  const block     = value.slice(s, e) || 'text';
  const replaced  = block.split('\n').map(l => prefix + l).join('\n');
  return value.slice(0, s) + replaced + value.slice(e);
}

// ── Auto-resize helper ────────────────────────────────────────────────────────
function autoResize(el: HTMLTextAreaElement | null, minRows = 3) {
  if (!el) return;
  el.style.height = 'auto';
  const lineH   = parseInt(getComputedStyle(el).lineHeight) || 20;
  const minH    = lineH * minRows + 16; // padding
  el.style.height = `${Math.max(minH, el.scrollHeight)}px`;
}

// ── Word / char count ─────────────────────────────────────────────────────────
function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// ── Main ProEditor component ──────────────────────────────────────────────────
interface ProEditorProps {
  /** Current value */
  value: string;
  /** Called with new value (debounced by parent) */
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  labelColor?: string;
  labelIcon?: React.ElementType;
  minRows?: number;
  /** Show save spinner / checkmark */
  saving?: boolean;
  saved?: boolean;
  /** Optional className for outer wrapper */
  className?: string;
}

export function ProEditor({
  value,
  onChange,
  placeholder = 'Start writing…',
  label,
  labelColor = 'text-surface-300',
  labelIcon: LabelIcon,
  minRows = 3,
  saving = false,
  saved  = true,
  className = '',
}: ProEditorProps) {
  const [preview, setPreview]     = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [focused, setFocused]     = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Keep textarea height in sync with content
  useEffect(() => { autoResize(taRef.current, minRows); }, [value, minRows]);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!fullscreen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [fullscreen]);

  // ── Toolbar actions ─────────────────────────────────────────────────────────
  const wrap = useCallback((before: string, after: string, ph?: string) => {
    if (!taRef.current) return;
    onChange(wrapSelection(taRef.current, before, after, ph));
  }, [onChange]);

  const prepend = useCallback((prefix: string) => {
    if (!taRef.current) return;
    onChange(prependLines(taRef.current, prefix));
  }, [onChange]);

  const insertAt = useCallback((text: string) => {
    const el = taRef.current;
    if (!el) return;
    const s = el.selectionStart;
    onChange(el.value.slice(0, s) + text + el.value.slice(el.selectionEnd));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + text.length, s + text.length); });
  }, [onChange]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === 'b') { e.preventDefault(); wrap('**', '**', 'bold text'); return; }
    if (ctrl && e.key === 'i') { e.preventDefault(); wrap('*',  '*',  'italic text'); return; }
    if (ctrl && e.key === 'k') {
      e.preventDefault();
      const url = prompt('Enter URL:');
      if (url) wrap('[', `](${url})`, 'link text');
      return;
    }
    if (ctrl && e.key === 'Enter') { e.preventDefault(); setFullscreen(f => !f); return; }

    // Tab inserts 2 spaces instead of shifting focus
    if (e.key === 'Tab') {
      e.preventDefault();
      insertAt('  ');
      return;
    }

    // Auto-close markdown pairs
    const pairs: Record<string, string> = { '**': '**', '*': '*', '`': '`' };
    if (e.key === '*' && e.ctrlKey) return; // let the wrap handle it

    // Continue list on Enter
    if (e.key === 'Enter') {
      const el = taRef.current!;
      const line = el.value.slice(0, el.selectionStart).split('\n').pop() || '';
      const ulMatch = line.match(/^(\s*)- /);
      const olMatch = line.match(/^(\s*)(\d+)\. /);
      if (ulMatch) { e.preventDefault(); insertAt('\n' + ulMatch[1] + '- '); return; }
      if (olMatch) {
        e.preventDefault();
        insertAt('\n' + olMatch[1] + (parseInt(olMatch[2]) + 1) + '. ');
        return;
      }
    }
  }, [wrap, insertAt]);

  const wordCount = countWords(value);
  const charCount = value.length;

  // ── Render ──────────────────────────────────────────────────────────────────
  const editorContent = (
    <div className={`flex flex-col ${fullscreen ? 'h-full' : ''}`}>
      {/* Label row */}
      {label && (
        <div className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${labelColor}`}>
          {LabelIcon && <LabelIcon size={12} />}
          {label}
        </div>
      )}

      {/* Editor card */}
      <div className={`
        flex flex-col border rounded-xl overflow-hidden transition-all duration-200
        ${focused && !fullscreen
          ? 'border-brand-500/50 ring-1 ring-brand-500/20 bg-surface-800'
          : 'border-surface-700 bg-surface-800/60'}
        ${fullscreen ? 'flex-1' : ''}
      `}>

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-surface-700/60 flex-wrap">
          <ToolBtn icon={Bold}         label="Bold"          shortcut="Ctrl+B"     onClick={() => wrap('**', '**', 'bold text')} />
          <ToolBtn icon={Italic}       label="Italic"        shortcut="Ctrl+I"     onClick={() => wrap('*', '*', 'italic text')} />
          <ToolBtn icon={Code}         label="Inline Code"                         onClick={() => wrap('`', '`', 'code')} />
          <ToolBtn icon={Link2}        label="Link"          shortcut="Ctrl+K"     onClick={() => {
            const url = prompt('Enter URL:');
            if (url) wrap('[', `](${url})`, 'link text');
          }} />

          {/* Divider */}
          <span className="w-px h-4 bg-surface-700 mx-1" />

          <ToolBtn icon={Hash}         label="Heading 2"                           onClick={() => prepend('## ')} />
          <ToolBtn icon={Type}         label="Heading 3"                           onClick={() => prepend('### ')} />
          <ToolBtn icon={List}         label="Bullet List"                         onClick={() => prepend('- ')} />
          <ToolBtn icon={ListOrdered}  label="Numbered List"                       onClick={() => prepend('1. ')} />
          <ToolBtn icon={Quote}        label="Blockquote"                          onClick={() => prepend('> ')} />
          <ToolBtn icon={Minus}        label="Divider"                             onClick={() => insertAt('\n---\n')} />

          {/* Spacer */}
          <span className="flex-1" />

          {/* Word count */}
          <span className="text-xs text-surface-600 mr-2 hidden sm:block tabular-nums">
            {wordCount}w · {charCount}c
          </span>

          {/* Save indicator */}
          <div className="mr-1">
            {saving
              ? <Loader2 size={12} className="text-brand-400 animate-spin" />
              : <Save size={12} className={saved ? 'text-surface-700' : 'text-yellow-400'} />}
          </div>

          {/* Divider */}
          <span className="w-px h-4 bg-surface-700 mx-1" />

          {/* Preview toggle */}
          <ToolBtn
            icon={preview ? EyeOff : Eye}
            label={preview ? 'Edit mode' : 'Preview'}
            active={preview}
            onClick={() => setPreview(p => !p)}
          />

          {/* Fullscreen */}
          <ToolBtn
            icon={fullscreen ? Minimize2 : Maximize2}
            label={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (Ctrl+Enter)'}
            active={fullscreen}
            onClick={() => setFullscreen(f => !f)}
          />
        </div>

        {/* ── Edit / Preview pane ───────────────────────────────────────────── */}
        <AnimatePresence mode="wait" initial={false}>
          {preview ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={`prose-editor px-4 py-3 text-sm text-surface-200 overflow-y-auto ${fullscreen ? 'flex-1' : 'min-h-[80px]'}`}
              dangerouslySetInnerHTML={{ __html: value ? renderMarkdown(value) : `<span class="text-surface-600 italic">${placeholder}</span>` }}
            />
          ) : (
            <motion.textarea
              key="editor"
              ref={taRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              value={value}
              placeholder={placeholder}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={e => { onChange(e.target.value); autoResize(e.target, minRows); }}
              onKeyDown={handleKeyDown}
              className={`
                w-full px-4 py-3 bg-transparent text-sm text-white
                placeholder:text-surface-600 resize-none outline-none
                font-mono leading-relaxed overflow-hidden
                ${fullscreen ? 'flex-1 min-h-0' : ''}
              `}
              style={{
                minHeight: `${minRows * 24 + 24}px`,
                // no max-height → grows to fit all content, no scroll
              }}
              spellCheck
            />
          )}
        </AnimatePresence>

        {/* ── Shortcut hint (bottom bar, only when focused) ─────────────────── */}
        <AnimatePresence>
          {focused && !preview && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-3 py-1 border-t border-surface-700/40 flex gap-3 overflow-hidden"
            >
              {[
                ['Ctrl+B', 'Bold'],
                ['Ctrl+I', 'Italic'],
                ['Ctrl+K', 'Link'],
                ['Tab', 'Indent'],
                ['Ctrl+↵', 'Fullscreen'],
              ].map(([key, hint]) => (
                <span key={key} className="text-xs text-surface-600">
                  <kbd className="text-surface-500 bg-surface-800 border border-surface-700 rounded px-1">{key}</kbd>
                  {' '}{hint}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  // ── Fullscreen overlay ───────────────────────────────────────────────────────
  if (fullscreen) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-surface-950/95 backdrop-blur-sm flex flex-col p-6"
        >
          {/* Fullscreen header */}
          <div className="flex items-center justify-between mb-4">
            {label && (
              <div className={`flex items-center gap-2 text-sm font-medium ${labelColor}`}>
                {LabelIcon && <LabelIcon size={14} />}
                {label}
              </div>
            )}
            <button
              onClick={() => setFullscreen(false)}
              className="text-xs text-surface-400 hover:text-white flex items-center gap-1.5 ml-auto px-3 py-1.5 bg-surface-800 rounded-lg border border-surface-700 transition-colors"
            >
              <Minimize2 size={13} /> Exit fullscreen
              <kbd className="ml-1 text-surface-600 text-xs">Esc</kbd>
            </button>
          </div>
          {editorContent}
        </motion.div>
      </AnimatePresence>
    );
  }

  return <div className={className}>{editorContent}</div>;
}

// ── AutoProEditor — drop-in wrapper with debounced auto-save ─────────────────
// Matches the AutoTextarea API used in WorkLog.tsx
interface AutoProEditorProps {
  logId:        string;
  field:        string;
  value:        string;
  placeholder?: string;
  minRows?:     number;
  label?:       string;
  hint?:        string;
  updateFn:     (id: string, field: string, value: string) => Promise<void>;
}

export function AutoProEditor({
  logId, field, value: initial, placeholder, minRows, updateFn,
}: AutoProEditorProps) {
  const [val, setVal]       = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(true);

  // Sync if parent value changes (e.g. data loads after mount)
  useEffect(() => { setVal(initial); }, [initial]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(async () => {
      if (val === initial) return;
      setSaving(true);
      try { await updateFn(logId, field, val); setSaved(true); }
      catch (e) { console.error(e); }
      finally   { setSaving(false); }
    }, 750);
    return () => clearTimeout(t);
  }, [val]);

  return (
    <ProEditor
      value={val}
      onChange={v => { setVal(v); setSaved(false); }}
      placeholder={placeholder}
      minRows={minRows}
      saving={saving}
      saved={saved}
    />
  );
}

// ── Markdown preview styles (injected once via a style tag) ───────────────────
// Call this once in your app root or index.css
export const PROSE_STYLES = `
.prose-editor .md-h1 { font-size: 1.25rem; font-weight: 700; color: white; margin: 0.75rem 0 0.5rem; }
.prose-editor .md-h2 { font-size: 1.1rem;  font-weight: 600; color: white; margin: 0.6rem 0 0.4rem; }
.prose-editor .md-h3 { font-size: 0.95rem; font-weight: 600; color: #e4e4e7; margin: 0.5rem 0 0.3rem; }
.prose-editor .md-p  { margin: 0.4rem 0; line-height: 1.65; color: #d4d4d8; }
.prose-editor .md-bold   { font-weight: 600; color: white; }
.prose-editor .md-italic { font-style: italic; }
.prose-editor .md-code   { background: #27272a; border: 1px solid #3f3f46; border-radius: 4px; padding: 1px 5px; font-family: 'JetBrains Mono', monospace; font-size: 0.85em; color: #7dd3fc; }
.prose-editor .md-quote  { border-left: 3px solid #0ea5e9; padding-left: 0.75rem; color: #a1a1aa; margin: 0.4rem 0; font-style: italic; }
.prose-editor .md-hr     { border: none; border-top: 1px solid #3f3f46; margin: 0.75rem 0; }
.prose-editor .md-ul     { list-style: disc; padding-left: 1.25rem; margin: 0.4rem 0; }
.prose-editor .md-ol     { list-style: decimal; padding-left: 1.25rem; margin: 0.4rem 0; }
.prose-editor .md-li     { margin: 0.2rem 0; color: #d4d4d8; }
.prose-editor .md-link   { color: #38bdf8; text-decoration: underline; text-underline-offset: 2px; }
.prose-editor .md-link:hover { color: #7dd3fc; }
`;