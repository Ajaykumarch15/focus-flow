import { useState, useRef, useEffect, useCallback } from 'react';
import { Bold, Italic, Code, List, ListOrdered, Quote, Minus, Link2, Maximize2, Minimize2, Loader2, Save, Type, Hash } from 'lucide-react';

// ── Simple markdown renderer (no external dependency) ─────────────────────────
export function renderMarkdown(raw: string): string {
  if (!raw.trim()) return '';

  let html = raw
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Restore safe inline tags (like font color and size tags)
    .replace(/&lt;font color="([^"]+)"&gt;([\s\S]*?)&lt;\/font&gt;/gi, '<font color="$1">$2</font>')
    .replace(/&lt;font size="([^"]+)"&gt;([\s\S]*?)&lt;\/font&gt;/gi, '<font size="$1">$2</font>')
    .replace(/&lt;font color="([^"]+)" size="([^"]+)"&gt;([\s\S]*?)&lt;\/font&gt;/gi, '<font color="$1" size="$2">$3</font>')

    // Multi-line code blocks: ```lang ... ```
    .replace(/```([a-zA-Z0-9]*)\n([\s\S]+?)\n```/g, '<pre class="md-pre"><code class="md-code-block language-$1">$2</code></pre>')

    // Headings (must come before bold/italic)
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="md-h1">$1</h1>')

    // Blockquote
    .replace(/^&gt; (.+)$/gm, '<blockquote class="md-quote">$1</blockquote>')

    // Horizontal rule
    .replace(/^---$/gm, '<hr class="md-hr" />')

    // Task Checklist items
    .replace(/^- \[ \] (.+)$/gm, '<li class="md-li md-task-li"><input type="checkbox" disabled class="md-task-checkbox" /> <span>$1</span></li>')
    .replace(/^- \[x\] (.+)$/gm, '<li class="md-li md-task-li"><input type="checkbox" checked disabled class="md-task-checkbox" /> <span class="line-through text-surface-500">$1</span></li>')

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
    .replace(/(<li class="md-li(?! md-oli)[^"]*">[\s\S]*?<\/li>\n?)+/g, m => `<ul class="md-ul">${m}</ul>`)
    .replace(/(<li class="md-li md-oli">[\s\S]*?<\/li>\n?)+/g,           m => `<ol class="md-ol">${m}</ol>`);

  // Paragraphs — blank-line-separated blocks not already wrapped in a block tag
  html = html
    .split(/\n\n+/)
    .map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^<(h[1-3]|ul|ol|blockquote|hr|pre)/.test(trimmed)) return trimmed;
      return `<p class="md-p">${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');

  return html;
}

// ── HTML to Markdown Converter ───────────────────────────────────────────────
function htmlToMarkdown(html: string): string {
  let md = html
    // Headings
    .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
    
    // Blockquote
    .replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1\n\n')
    
    // Horizontal Rule
    .replace(/<hr.*?>/gi, '---\n\n')
    
    // Code blocks
    .replace(/<pre class="md-pre"><code.*?>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n')
    .replace(/<code.*?>(.*?)<\/code>/gi, '`$1`')
    
    // Lists
    .replace(/<ul class="md-ul">([\s\S]*?)<\/ul>/gi, '$1\n')
    .replace(/<ol class="md-ol">([\s\S]*?)<\/ol>/gi, '$1\n')
    
    // Checklist items
    .replace(/<li class="md-li md-task-li"><input type="checkbox" disabled="" class="md-task-checkbox"> <span>(.*?)<\/span><\/li>/gi, '- [ ] $1\n')
    .replace(/<li class="md-li md-task-li"><input type="checkbox" checked="" disabled="" class="md-task-checkbox"> <span class="line-through text-surface-500">(.*?)<\/span><\/li>/gi, '- [x] $1\n')
    .replace(/<li class="md-li md-task-li"><input type="checkbox" checked="" disabled="" class="md-task-checkbox"> <span>(.*?)<\/span><\/li>/gi, '- [x] $1\n')
    .replace(/<li class="md-li md-task-li"><input type="checkbox" disabled class="md-task-checkbox"> <span>(.*?)<\/span><\/li>/gi, '- [ ] $1\n')
    .replace(/<li class="md-li md-task-li"><input type="checkbox" checked disabled class="md-task-checkbox"> <span class="line-through text-surface-500">(.*?)<\/span><\/li>/gi, '- [x] $1\n')
    .replace(/<li class="md-li md-task-li"><input type="checkbox" checked disabled class="md-task-checkbox"> <span>(.*?)<\/span><\/li>/gi, '- [x] $1\n')
    
    // Standard List items
    .replace(/<li class="md-li md-oli">(.*?)<\/li>/gi, '1. $1\n')
    .replace(/<li.*?>(.*?)<\/li>/gi, '- $1\n')
    
    // Bold / Italic
    .replace(/<strong><em>(.*?)<\/em><\/strong>/gi, '***$1***')
    .replace(/<b><i>(.*?)<\/i><\/b>/gi, '***$1***')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    
    // Colored spans / font tags
    .replace(/<span style="color:\s*(.*?);?">(.*?)<\/span>/gi, '<font color="$1">$2</font>')
    .replace(/<font color="(.*?)">(.*?)<\/font>/gi, '<font color="$1">$2</font>')
    .replace(/<font color="(.*?)" size="(.*?)">(.*?)<\/font>/gi, '<font color="$1" size="$2">$3</font>')
    
    // Links
    .replace(/<a href="(.*?)"\s*>(.*?)<\/a>/gi, '[$2]($1)')
    
    // Paragraphs / divs / breaks
    .replace(/<p.*?>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<div.*?>(.*?)<\/div>/gi, '$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    
    // Clean up entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

  // Trim extra spaces and newlines
  return md.trim();
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
          : 'text-surface-400 hover:text-surface-50 hover:bg-surface-700/60'
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
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  labelColor?: string;
  labelIcon?: React.ElementType;
  minRows?: number;
  saving?: boolean;
  saved?: boolean;
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
  const [mode, setMode]           = useState<'visual' | 'markdown'>('visual');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync value from prop on mount and when it changes externally
  useEffect(() => {
    if (mode === 'visual' && editorRef.current && !focused && !preview) {
      editorRef.current.innerHTML = value ? renderMarkdown(value) : '';
    }
  }, [value, mode, focused, preview]);

  // Keep textarea height in sync with content
  useEffect(() => { if (mode === 'markdown') autoResize(taRef.current, minRows); }, [value, minRows, preview, mode]);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!fullscreen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [fullscreen]);

  // Inject preview styling once on mount
  useEffect(() => {
    const styleId = 'prose-editor-preview-styles';
    if (!document.getElementById(styleId)) {
      const el = document.createElement('style');
      el.id = styleId;
      el.innerHTML = PROSE_STYLES;
      document.head.appendChild(el);
    }
  }, []);

  // ── Toolbar actions (Markdown Mode) ─────────────────────────────────────────
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

  // ── Visual Editing Command executor ─────────────────────────────────────────
  const execCmd = (command: string, val = '') => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      editorRef.current.focus();
      const html = editorRef.current.innerHTML;
      onChange(htmlToMarkdown(html));
    }
  };

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

    if (e.key === 'Tab') {
      e.preventDefault();
      insertAt('  ');
      return;
    }

    if (e.key === 'Enter') {
      const el = taRef.current!;
      const line = el.value.slice(0, el.selectionStart).split('\n').pop() || '';
      const checklistMatch = line.match(/^(\s*)- \[( |x)\] /);
      const ulMatch = line.match(/^(\s*)- /);
      const olMatch = line.match(/^(\s*)(\d+)\. /);
      
      if (checklistMatch) { 
        e.preventDefault(); 
        insertAt('\n' + checklistMatch[1] + '- [ ] '); 
        return; 
      }
      if (ulMatch) { 
        e.preventDefault(); 
        insertAt('\n' + ulMatch[1] + '- '); 
        return; 
      }
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
        <div className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${labelColor}`}>
          {LabelIcon && <LabelIcon size={12} />}
          {label}
        </div>
      )}

      {/* Editor card */}
      <div className={`
        flex flex-col border rounded-xl overflow-hidden transition-all duration-200 bg-surface-800/60
        ${focused && !fullscreen
          ? 'border-brand-500/50 ring-1 ring-brand-500/20 bg-surface-800'
          : 'border-surface-700 bg-surface-800/60'}
        ${fullscreen ? 'flex-1' : ''}
      `}>

        {/* ── Header Toolbar ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-surface-700/60 bg-surface-900/40 px-3 py-2 flex-wrap gap-2 select-none">
          {/* Write Mode Toggles */}
          <div className="flex items-center gap-1 bg-surface-800 p-0.5 rounded-lg border border-surface-700/50">
            <button
              type="button"
              onClick={() => { setMode('visual'); setPreview(false); }}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                mode === 'visual' && !preview
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-surface-400 hover:text-surface-50'
              }`}
            >
              Visual
            </button>
            <button
              type="button"
              onClick={() => { setMode('markdown'); setPreview(false); }}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                mode === 'markdown' && !preview
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-surface-400 hover:text-surface-50'
              }`}
            >
              Source
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                preview
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-surface-400 hover:text-surface-50'
              }`}
            >
              Preview
            </button>
          </div>

          {/* Formatting & Controls group */}
          <div className="flex items-center gap-0.5 flex-wrap">
            {/* Visual Mode Formatting */}
            {mode === 'visual' && !preview && (
              <>
                <ToolBtn icon={Bold}         label="Bold"                           onClick={() => execCmd('bold')} />
                <ToolBtn icon={Italic}       label="Italic"                         onClick={() => execCmd('italic')} />
                <ToolBtn icon={Link2}        label="Link"                           onClick={() => {
                  const url = prompt('Enter URL:');
                  if (url) execCmd('createLink', url);
                }} />

                <span className="w-px h-4 bg-surface-700 mx-1" />

                {/* Font Size Select */}
                <select
                  onChange={e => execCmd('fontSize', e.target.value)}
                  className="bg-surface-850 border border-surface-700 rounded px-1.5 py-0.5 text-[10px] text-surface-300 font-semibold outline-none cursor-pointer hover:border-surface-600 transition-colors"
                  defaultValue="3"
                >
                  <option value="2">Small</option>
                  <option value="3">Normal</option>
                  <option value="5">Large</option>
                  <option value="6">XL</option>
                </select>

                <span className="w-px h-4 bg-surface-700 mx-1" />

                {/* Color Swatches */}
                <div className="flex items-center gap-1.5 mx-1.5">
                  {[
                    { color: '#ffffff', title: 'White' },
                    { color: '#0ea5e9', title: 'Blue' },
                    { color: '#22c55e', title: 'Green' },
                    { color: '#8b5cf6', title: 'Purple' },
                    { color: '#f97316', title: 'Orange' },
                    { color: '#ef4444', title: 'Red' },
                  ].map(swatch => (
                    <button
                      key={swatch.color}
                      type="button"
                      title={`Text color: ${swatch.title}`}
                      onClick={() => execCmd('foreColor', swatch.color)}
                      className="w-3.5 h-3.5 rounded-full border border-surface-700 transition-all hover:scale-125 hover:border-white"
                      style={{ backgroundColor: swatch.color }}
                    />
                  ))}
                </div>

                <span className="w-px h-4 bg-surface-700 mx-1" />
                <ToolBtn icon={List}         label="Bullet List"                     onClick={() => execCmd('insertUnorderedList')} />
                <ToolBtn icon={ListOrdered}  label="Numbered List"                   onClick={() => execCmd('insertOrderedList')} />
              </>
            )}

            {/* Markdown Mode Formatting */}
            {mode === 'markdown' && !preview && (
              <>
                <ToolBtn icon={Bold}         label="Bold"          shortcut="Ctrl+B"     onClick={() => wrap('**', '**', 'bold text')} />
                <ToolBtn icon={Italic}       label="Italic"        shortcut="Ctrl+I"     onClick={() => wrap('*', '*', 'italic text')} />
                <ToolBtn icon={Code}         label="Inline Code"                         onClick={() => wrap('`', '`', 'code')} />
                <ToolBtn icon={Link2}        label="Link"          shortcut="Ctrl+K"     onClick={() => {
                  const url = prompt('Enter URL:');
                  if (url) wrap('[', `](${url})`, 'link text');
                }} />

                <span className="w-px h-4 bg-surface-700 mx-1" />

                <ToolBtn icon={Hash}         label="Heading 2"                           onClick={() => prepend('## ')} />
                <ToolBtn icon={Type}         label="Heading 3"                           onClick={() => prepend('### ')} />
                <ToolBtn icon={List}         label="Bullet List"                         onClick={() => prepend('- ')} />
                <ToolBtn icon={ListOrdered}  label="Numbered List"                       onClick={() => prepend('1. ')} />
                <ToolBtn icon={Quote}        label="Blockquote"                          onClick={() => prepend('> ')} />
                <ToolBtn icon={Minus}        label="Divider"                             onClick={() => insertAt('\n---\n')} />
              </>
            )}

            <span className="w-px h-4 bg-surface-700/60 mx-1.5" />

            {/* Cloud Auto-Save Indicator */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-800/40 text-[10px] border border-surface-700/30">
              {saving ? (
                <>
                  <Loader2 size={11} className="text-brand-400 animate-spin" />
                  <span className="text-brand-400 font-medium">Saving...</span>
                </>
              ) : (
                <>
                  <Save size={11} className={saved ? 'text-emerald-400' : 'text-yellow-400'} />
                  <span className={saved ? 'text-emerald-400 font-medium' : 'text-yellow-400 font-medium'}>
                    {saved ? 'Synced' : 'Unsaved'}
                  </span>
                </>
              )}
            </div>

            <span className="w-px h-4 bg-surface-700/60 mx-1.5" />

            {/* Fullscreen Overlay Toggle */}
            <ToolBtn
              icon={fullscreen ? Minimize2 : Maximize2}
              label={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (Ctrl+Enter)'}
              active={fullscreen}
              onClick={() => setFullscreen(f => !f)}
            />
          </div>
        </div>

        {/* ── Edit / Preview Area ─────────────────────────────────────────── */}
        <div className={`relative ${fullscreen ? 'flex-1 overflow-y-auto' : ''}`}>
          {preview ? (
            <div
              className={`prose-editor px-4 py-3 text-sm text-surface-200 overflow-y-auto ${fullscreen ? 'h-full' : 'min-h-[96px]'}`}
              dangerouslySetInnerHTML={{ __html: value ? renderMarkdown(value) : `<span class="text-surface-500 italic">${placeholder}</span>` }}
            />
          ) : mode === 'visual' ? (
            <div
              ref={editorRef}
              contentEditable
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onInput={e => {
                const html = e.currentTarget.innerHTML;
                onChange(htmlToMarkdown(html));
              }}
              className={`
                w-full px-4 py-3 bg-transparent text-sm text-surface-50 outline-none
                prose-editor overflow-y-auto leading-relaxed
                ${fullscreen ? 'h-full min-h-0' : 'min-h-[96px]'}
              `}
              style={{
                minHeight: `${minRows * 24 + 24}px`,
              }}
            />
          ) : (
            <textarea
              ref={taRef}
              value={value}
              placeholder={placeholder}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={e => { onChange(e.target.value); autoResize(e.target, minRows); }}
              onKeyDown={handleKeyDown}
              className={`
                w-full px-4 py-3 bg-transparent text-sm text-surface-50
                placeholder:text-surface-600 resize-none outline-none
                font-mono leading-relaxed overflow-hidden
                ${fullscreen ? 'h-full min-h-0' : ''}
              `}
              style={{
                minHeight: `${minRows * 24 + 24}px`,
              }}
              spellCheck
            />
          )}
        </div>

        {/* ── Bottom status bar ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-surface-700/60 bg-surface-900/20 px-3 py-1.5 text-[10px] text-surface-500">
          <div className="flex gap-3 overflow-hidden select-none">
            {focused && !preview && mode === 'markdown' && (
              <>
                <span><kbd className="text-[9px] bg-surface-800 border border-surface-700 rounded px-1">Ctrl+B</kbd> Bold</span>
                <span><kbd className="text-[9px] bg-surface-800 border border-surface-700 rounded px-1">Ctrl+I</kbd> Italic</span>
                <span><kbd className="text-[9px] bg-surface-800 border border-surface-700 rounded px-1">Ctrl+K</kbd> Link</span>
                <span><kbd className="text-[9px] bg-surface-800 border border-surface-700 rounded px-1">Tab</kbd> Indent</span>
              </>
            )}
            {focused && mode === 'visual' && (
              <span className="text-surface-500 font-medium">WYSIWYG Rich Text Mode Active</span>
            )}
          </div>
          <div className="font-mono text-surface-400 font-medium select-none flex items-center gap-2">
            <span>{wordCount} words</span>
            <span className="w-1 h-1 rounded-full bg-surface-600" />
            <span>{charCount} chars</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Fullscreen View ────────────────────────────────────────────────────────
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[60] bg-surface-950/95 backdrop-blur-sm flex flex-col p-6">
        {/* Fullscreen Header */}
        <div className="flex items-center justify-between mb-4">
          {label && (
            <div className={`flex items-center gap-2 text-sm font-semibold ${labelColor}`}>
              {LabelIcon && <LabelIcon size={14} />}
              {label}
            </div>
          )}
          <button
            onClick={() => setFullscreen(false)}
            className="text-xs text-surface-400 hover:text-surface-50 flex items-center gap-1.5 ml-auto px-3 py-1.5 bg-surface-800 rounded-lg border border-surface-700 transition-colors"
          >
            <Minimize2 size={13} /> Exit fullscreen
            <kbd className="ml-1 text-surface-600 text-[10px]">Esc</kbd>
          </button>
        </div>
        {editorContent}
      </div>
    );
  }

  return <div className={className}>{editorContent}</div>;
}

// ── AutoProEditor — drop-in wrapper with debounced auto-save ─────────────────
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

  useEffect(() => { setVal(initial); }, [initial]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (val === initial) return;
      setSaving(true);
      try { 
        await updateFn(logId, field, val); 
        setSaved(true); 
      }
      catch (e) { 
        console.error(e); 
      }
      finally   { 
        setSaving(false); 
      }
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

// ── Markdown preview styles ───────────────────────────────────────────────────
export const PROSE_STYLES = `
.prose-editor .md-h1 { font-size: 1.35rem; font-weight: 700; color: var(--color-surface-50); margin: 1rem 0 0.5rem; border-bottom: 1px solid var(--color-surface-800); padding-bottom: 0.25rem; }
.prose-editor .md-h2 { font-size: 1.15rem; font-weight: 600; color: var(--color-surface-50); margin: 0.8rem 0 0.4rem; border-bottom: 1px solid var(--color-surface-800); padding-bottom: 0.2rem; }
.prose-editor .md-h3 { font-size: 1.05rem; font-weight: 600; color: var(--color-surface-100); margin: 0.6rem 0 0.3rem; }
.prose-editor .md-p  { margin: 0.5rem 0; line-height: 1.7; color: var(--color-surface-300); }
.prose-editor .md-bold   { font-weight: 600; color: var(--color-surface-50); }
.prose-editor .md-italic { font-style: italic; }
.prose-editor .md-code   { background: var(--color-surface-850); border: 1px solid var(--color-surface-800); border-radius: 6px; padding: 2px 5px; font-family: 'JetBrains Mono', monospace; font-size: 0.85em; color: var(--color-brand-500); }
.prose-editor .md-pre { background: var(--color-surface-850); border: 1px solid var(--color-surface-800); border-radius: 8px; padding: 0.75rem; overflow-x: auto; margin: 0.75rem 0; }
.prose-editor .md-code-block { font-family: 'JetBrains Mono', monospace; font-size: 0.85em; color: var(--color-surface-200); line-height: 1.5; }
.prose-editor .md-quote  { border-left: 4px solid var(--color-brand-500); padding-left: 0.75rem; color: var(--color-surface-400); margin: 0.6rem 0; font-style: italic; background: color-mix(in srgb, var(--color-brand-500) 8%, transparent); padding-top: 0.25rem; padding-bottom: 0.25rem; border-radius: 0 4px 4px 0; }
.prose-editor .md-hr     { border: none; border-top: 1px solid var(--color-surface-800); margin: 1rem 0; }
.prose-editor .md-ul     { list-style: disc; padding-left: 1.25rem; margin: 0.5rem 0; }
.prose-editor .md-ol     { list-style: decimal; padding-left: 1.25rem; margin: 0.5rem 0; }
.prose-editor .md-li     { margin: 0.3rem 0; color: var(--color-surface-300); line-height: 1.6; }
.prose-editor .md-task-li { list-style: none; padding-left: 0; display: flex; align-items: center; gap: 6px; }
.prose-editor .md-task-checkbox { width: 14px; height: 14px; accent-color: var(--color-brand-500); margin: 0; cursor: default; }
.prose-editor .md-link   { color: var(--color-brand-500); text-decoration: underline; text-underline-offset: 2px; font-weight: 500; }
.prose-editor .md-link:hover { color: var(--color-brand-400); }
`;