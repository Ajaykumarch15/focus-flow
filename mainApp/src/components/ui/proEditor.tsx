import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TextEditor } from '@maple1521/rich-text-editor';
import {
  Bold, Italic, Code, List, ListOrdered, Quote, Minus, Link2,
  Maximize2, Minimize2, Loader2, Save, Type, Hash, CheckSquare,
  Heading1, Heading2, Heading3, Strikethrough, Sparkles,
} from 'lucide-react';
import { renderMarkdown } from '../../lib/markdown';

// ── HTML to Markdown Converter ───────────────────────────────────────────────
function htmlToMarkdown(html: string): string {
  let md = html
    // ── Block elements ──────────────────────────────────────────────────────
    .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1\n\n')
    .replace(/<hr.*?>/gi, '---\n\n')
    // Code blocks — match both TipTap (<pre><code>) and md-pre format
    .replace(/<pre(?:\s+class="md-pre")?>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, '```\n$1\n```\n\n')
    .replace(/<code.*?>(.*?)<\/code>/gi, '`$1`')
    // ── Alignment — preserve as data attribute (survives DOMPurify) ─────────
    .replace(/style="text-align:\s*(left|center|right|justify)"/gi, 'data-md-align="$1"')
    // ── Unwrap TipTap list wrappers (before task-list & li matching) ────────
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1')
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1')
    // ── Strip <p> inside <li> (TipTap wraps list text in <p>) ───────────────
    .replace(/<li([^>]*)><p>([\s\S]*?)<\/p><\/li>/gi, '<li$1>$2</li>')
    // ── Task list items ─────────────────────────────────────────────────────
    .replace(/<li class="md-li md-task-li"><input type="checkbox" disabled="" class="md-task-checkbox"> <span>(.*?)<\/span><\/li>/gi, '- [ ] $1\n')
    .replace(/<li class="md-li md-task-li"><input type="checkbox" checked="" disabled="" class="md-task-checkbox"> <span class="line-through text-surface-500">(.*?)<\/span><\/li>/gi, '- [x] $1\n')
    .replace(/<li class="md-li md-task-li"><input type="checkbox" checked="" disabled="" class="md-task-checkbox"> <span>(.*?)<\/span><\/li>/gi, '- [x] $1\n')
    .replace(/<li class="md-li md-task-li"><input type="checkbox" disabled class="md-task-checkbox"> <span>(.*?)<\/span><\/li>/gi, '- [ ] $1\n')
    .replace(/<li class="md-li md-task-li"><input type="checkbox" checked disabled class="md-task-checkbox"> <span class="line-through text-surface-500">(.*?)<\/span><\/li>/gi, '- [x] $1\n')
    .replace(/<li class="md-li md-task-li"><input type="checkbox" checked disabled class="md-task-checkbox"> <span>(.*?)<\/span><\/li>/gi, '- [x] $1\n')
    // ── Ordered / unordered list items (specific BEFORE catch-all) ──────────
    .replace(/<li class="md-li md-oli">(.*?)<\/li>/gi, '1. $1\n')
    .replace(/<li class="md-li">(.*?)<\/li>/gi, '- $1\n')
    .replace(/<li.*?>(.*?)<\/li>/gi, '- $1\n')
    // ── Inline formatting ───────────────────────────────────────────────────
    .replace(/<strong><em>(.*?)<\/em><\/strong>/gi, '***$1***')
    .replace(/<b><i>(.*?)<\/i><\/b>/gi, '***$1***')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    // ── Color / font ────────────────────────────────────────────────────────
    .replace(/<span style="color:\s*(.*?);?">(.*?)<\/span>/gi, '<font color="$1">$2</font>')
    .replace(/<font color="(.*?)">(.*?)<\/font>/gi, '<font color="$1">$2</font>')
    .replace(/<font color="(.*?)" size="(.*?)">(.*?)<\/font>/gi, '<font color="$1" size="$2">$3</font>')
    .replace(/<a href="(.*?)"\s*>(.*?)<\/a>/gi, '[$2]($1)')
    // ── Strip remaining block wrappers ──────────────────────────────────────
    .replace(/<p.*?>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<div.*?>(.*?)<\/div>/gi, '$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // ── Restore HTML entities ───────────────────────────────────────────────
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

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
    <button type="button"
      onClick={onClick}
      onMouseDown={e => e.preventDefault()}
      title={shortcut ? `${label}  (${shortcut})` : label}
      aria-label={shortcut ? `${label}  (${shortcut})` : label}
      className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
        active ? 'bg-brand-500/20 text-brand-400' : 'text-surface-400 hover:text-surface-50 hover:bg-surface-700/60'
      }`}>
      <Icon size={14} />
    </button>
  );
}

// ── Insert text around selection ──────────────────────────────────────────────
function wrapSelection(el: HTMLTextAreaElement, before: string, after: string, placeholder = 'text'): string {
  const { selectionStart: s, selectionEnd: e, value } = el;
  const selected = value.slice(s, e) || placeholder;
  const next = value.slice(0, s) + before + selected + after + value.slice(e);
  requestAnimationFrame(() => {
    el.focus();
    const ns = s + before.length;
    el.setSelectionRange(ns, ns + selected.length);
  });
  return next;
}

function prependLines(el: HTMLTextAreaElement, prefix: string): string {
  const { selectionStart: s, selectionEnd: e, value } = el;
  const block = value.slice(s, e) || 'text';
  const replaced = block.split('\n').map(l => prefix + l).join('\n');
  return value.slice(0, s) + replaced + value.slice(e);
}

function autoResize(el: HTMLTextAreaElement | null, minRows = 3) {
  if (!el) return;
  el.style.height = 'auto';
  const lineH = parseInt(getComputedStyle(el).lineHeight) || 20;
  const minH = lineH * minRows + 16;
  el.style.height = `${Math.max(minH, el.scrollHeight)}px`;
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// ── Slash Command definitions ────────────────────────────────────────────────
interface SlashCommand {
  id: string;
  label: string;
  icon: React.ElementType;
  category: 'blocks' | 'lists' | 'inline' | 'code';
  shortcut?: string;
  action: 'insert' | 'wrap' | 'prepend';
  payload: string;
  after?: string;
  description: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'h1', label: 'Heading 1', icon: Heading1, category: 'blocks', action: 'prepend', payload: '# ', description: 'Large section heading' },
  { id: 'h2', label: 'Heading 2', icon: Heading2, category: 'blocks', action: 'prepend', payload: '## ', description: 'Medium section heading' },
  { id: 'h3', label: 'Heading 3', icon: Heading3, category: 'blocks', action: 'prepend', payload: '### ', description: 'Small section heading' },
  { id: 'quote', label: 'Blockquote', icon: Quote, category: 'blocks', action: 'prepend', payload: '> ', description: 'Capture a quote' },
  { id: 'divider', label: 'Divider', icon: Minus, category: 'blocks', action: 'insert', payload: '\n---\n', description: 'Horizontal rule' },
  { id: 'bullet', label: 'Bullet List', icon: List, category: 'lists', action: 'prepend', payload: '- ', description: 'Simple bullet list' },
  { id: 'numbered', label: 'Numbered List', icon: ListOrdered, category: 'lists', action: 'prepend', payload: '1. ', description: 'Ordered list' },
  { id: 'checklist', label: 'Task Checklist', icon: CheckSquare, category: 'lists', action: 'prepend', payload: '- [ ] ', description: 'Track tasks with checkboxes' },
  { id: 'bold', label: 'Bold', icon: Bold, category: 'inline', shortcut: 'Ctrl+B', action: 'wrap', payload: '**', after: '**', description: 'Make text bold' },
  { id: 'italic', label: 'Italic', icon: Italic, category: 'inline', shortcut: 'Ctrl+I', action: 'wrap', payload: '*', after: '*', description: 'Make text italic' },
  { id: 'strikethrough', label: 'Strikethrough', icon: Strikethrough, category: 'inline', action: 'wrap', payload: '~~', after: '~~', description: 'Strike through text' },
  { id: 'code', label: 'Inline Code', icon: Code, category: 'inline', action: 'wrap', payload: '`', after: '`', description: 'Code snippet' },
  { id: 'codeblock', label: 'Code Block', icon: Code, category: 'code', action: 'insert', payload: '```\n', after: '\n```', description: 'Multi-line code block' },
  { id: 'link', label: 'Link', icon: Link2, category: 'inline', shortcut: 'Ctrl+K', action: 'wrap', payload: '[', after: '](url)', description: 'Add a hyperlink' },
];

const SLASH_CATEGORIES = [
  { id: 'blocks', label: 'Blocks' },
  { id: 'lists', label: 'Lists' },
  { id: 'inline', label: 'Formatting' },
  { id: 'code', label: 'Code' },
];

// ── Slash Command Palette ────────────────────────────────────────────────────
function SlashCommandPalette({
  query, onSelect, onClose, position,
}: {
  query: string;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
  position: { top: number; left: number };
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return SLASH_COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.category.includes(q)
    );
  }, [query]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => (i + 1) % Math.max(filtered.length, 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => (i - 1 + filtered.length) % Math.max(filtered.length, 1)); }
      else if (e.key === 'Enter' && filtered[selectedIdx]) { e.preventDefault(); onSelect(filtered[selectedIdx]); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', h, true);
    return () => document.removeEventListener('keydown', h, true);
  }, [filtered, selectedIdx, onSelect, onClose]);

  if (filtered.length === 0) return null;

  const grouped = SLASH_CATEGORIES.map(cat => ({
    ...cat,
    items: filtered.filter(cmd => cmd.category === cat.id),
  })).filter(cat => cat.items.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.12 }}
      className="absolute z-50 w-72 bg-surface-800 border border-surface-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-2 border-b border-surface-700/60">
        <div className="flex items-center gap-2 text-[11px] text-surface-400 font-medium">
          <Sparkles size={12} className="text-brand-400" />
          {query ? `Matching "${query}"` : 'Type to filter commands...'}
        </div>
      </div>
      <div ref={listRef} className="max-h-64 overflow-y-auto scrollbar-thin py-1">
        {grouped.map(cat => (
          <div key={cat.id}>
            <div className="px-3 py-1.5 text-[10px] font-bold text-surface-500 uppercase tracking-wider">{cat.label}</div>
            {cat.items.map(cmd => {
              const idx = filtered.indexOf(cmd);
              return (
                <button key={cmd.id}
                  onMouseDown={e => { e.preventDefault(); onSelect(cmd); }}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    idx === selectedIdx ? 'bg-brand-500/15 text-surface-50' : 'text-surface-300 hover:bg-surface-700/50'
                  }`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    idx === selectedIdx ? 'bg-brand-500/20 text-brand-400' : 'bg-surface-700/50 text-surface-400'
                  }`}>
                    <cmd.icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold">{cmd.label}</div>
                    <div className="text-[10px] text-surface-500 truncate">{cmd.description}</div>
                  </div>
                  {cmd.shortcut && (
                    <kbd className="text-[9px] bg-surface-700/60 border border-surface-600/40 rounded px-1.5 py-0.5 text-surface-400 font-mono flex-shrink-0">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Floating Selection Toolbar (Visual Mode) ─────────────────────────────────
function FloatingToolbar({ onAction, position }: {
  onAction: (cmd: string, val?: string) => void;
  position: { top: number; left: number };
}) {
  const tools = [
    { icon: Bold, label: 'Bold', cmd: 'bold' },
    { icon: Italic, label: 'Italic', cmd: 'italic' },
    { icon: Strikethrough, label: 'Strike', cmd: 'strikeThrough' },
    { icon: Code, label: 'Code', cmd: 'code' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="absolute z-50 flex items-center gap-0.5 bg-surface-800 border border-surface-700 rounded-xl p-1 shadow-xl shadow-black/30"
      style={{ top: position.top, left: position.left }}
    >
      {tools.map(t => (
        <button key={t.cmd} type="button" title={t.label} aria-label={t.label}
          onClick={() => onAction(t.cmd)}
          onMouseDown={e => e.preventDefault()}
          className="p-1.5 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-700/60 transition-all">
          <t.icon size={13} />
        </button>
      ))}
      <span className="w-px h-4 bg-surface-700 mx-0.5" />
      <button type="button" title="Link" aria-label="Link"
        onClick={() => {
          const url = prompt('Enter URL:');
          if (url) onAction('createLink', url);
        }}
        onMouseDown={e => e.preventDefault()}
        className="p-1.5 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-700/60 transition-all">
        <Link2 size={13} />
      </button>
    </motion.div>
  );
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
  placeholder = 'Start writing...',
  label,
  labelColor = 'text-surface-300',
  labelIcon: LabelIcon,
  minRows = 3,
  saving = false,
  saved = true,
  className = '',
}: ProEditorProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [mode, setMode] = useState<'visual' | 'markdown'>('visual');
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const [slashStartIdx, setSlashStartIdx] = useState(0);
  const [floatingToolbar, setFloatingToolbar] = useState<{ top: number; left: number } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === 'visual' && editorRef.current && !focused) {
      editorRef.current.innerHTML = value ? renderMarkdown(value) : '';
    }
  }, [value, mode, focused]);

  useEffect(() => { if (mode === 'markdown') autoResize(taRef.current, minRows); }, [value, minRows, mode]);

  useEffect(() => {
    if (!fullscreen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [fullscreen]);

  useEffect(() => {
    const styleId = 'prose-editor-preview-styles';
    if (!document.getElementById(styleId)) {
      const el = document.createElement('style');
      el.id = styleId;
      el.innerHTML = PROSE_STYLES;
      document.head.appendChild(el);
    }
  }, []);

  // Close slash palette on outside click
  useEffect(() => {
    if (!slashOpen) return;
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSlashOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [slashOpen]);

  // Floating toolbar on text selection (visual mode)
  useEffect(() => {
    if (mode !== 'visual' || fullscreen) { setFloatingToolbar(null); return; }
    const h = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount || !containerRef.current) { setFloatingToolbar(null); return; }
      const range = sel.getRangeAt(0);
      if (!containerRef.current.contains(range.commonAncestorContainer)) { setFloatingToolbar(null); return; }
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      setFloatingToolbar({
        top: rect.top - containerRect.top - 44,
        left: rect.left - containerRect.left + rect.width / 2 - 100,
      });
    };
    document.addEventListener('selectionchange', h);
    return () => document.removeEventListener('selectionchange', h);
  }, [mode, fullscreen]);

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
    onChange(el.value.slice(0, s) + text + value.slice(el.selectionEnd));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + text.length, s + text.length); });
  }, [onChange, value]);

  const execCmd = (command: string, val = '') => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      editorRef.current.focus();
      onChange(htmlToMarkdown(editorRef.current.innerHTML));
    }
  };

  // Get cursor position for slash palette
  const getCursorPos = useCallback(() => {
    const el = taRef.current;
    if (!el) return { top: 100, left: 50 };
    const text = el.value.slice(0, el.selectionStart);
    const lines = text.split('\n');
    const lineNum = lines.length;
    const colNum = lines[lines.length - 1].length;
    const lineHeight = 24;
    const charWidth = 8.4;
    return {
      top: Math.min(lineNum * lineHeight + 32, 200),
      left: Math.min(colNum * charWidth + 16, el.clientWidth - 290),
    };
  }, []);

  const executeSlashCommand = useCallback((cmd: SlashCommand) => {
    const el = taRef.current;
    if (!el) return;
    // Remove the slash and query text
    const beforeSlash = el.value.slice(0, slashStartIdx);
    const afterCursor = el.value.slice(el.selectionStart);
    let insert = '';
    if (cmd.action === 'prepend') {
      insert = cmd.payload;
    } else if (cmd.action === 'wrap') {
      insert = (cmd.payload || '') + 'text' + (cmd.after || '');
    } else {
      insert = cmd.payload + (cmd.after || '');
    }
    const newVal = beforeSlash + insert + afterCursor;
    onChange(newVal);
    setSlashOpen(false);
    setSlashQuery('');
    requestAnimationFrame(() => {
      el.focus();
      if (cmd.action === 'wrap') {
        const start = beforeSlash.length + cmd.payload!.length;
        el.setSelectionRange(start, start + 4);
      } else {
        const pos = beforeSlash.length + insert.length;
        el.setSelectionRange(pos, pos);
      }
    });
  }, [onChange, slashStartIdx]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ctrl = e.ctrlKey || e.metaKey;

    // Slash palette navigation
    if (slashOpen) {
      if (e.key === 'Escape') { e.preventDefault(); setSlashOpen(false); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') return; // handled by palette
    }

    if (ctrl && e.key === 'b') { e.preventDefault(); wrap('**', '**', 'bold text'); return; }
    if (ctrl && e.key === 'i') { e.preventDefault(); wrap('*', '*', 'italic text'); return; }
    if (ctrl && e.key === 'k') {
      e.preventDefault();
      const url = prompt('Enter URL:');
      if (url) wrap('[', `](${url})`, 'link text');
      return;
    }
    if (ctrl && e.key === 'Enter') { e.preventDefault(); setFullscreen(f => !f); return; }

    if (e.key === 'Tab') { e.preventDefault(); insertAt('  '); return; }

    if (e.key === 'Enter' && !slashOpen) {
      const el = taRef.current!;
      const line = el.value.slice(0, el.selectionStart).split('\n').pop() || '';
      const checklistMatch = line.match(/^(\s*)- \[( |x)\] /);
      const ulMatch = line.match(/^(\s*)- /);
      const olMatch = line.match(/^(\s*)(\d+)\. /);
      if (checklistMatch) { e.preventDefault(); insertAt('\n' + checklistMatch[1] + '- [ ] '); return; }
      if (ulMatch) { e.preventDefault(); insertAt('\n' + ulMatch[1] + '- '); return; }
      if (olMatch) { e.preventDefault(); insertAt('\n' + olMatch[1] + (parseInt(olMatch[2]) + 1) + '. '); return; }
    }
  }, [wrap, insertAt, slashOpen]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    autoResize(e.target, minRows);

    // Detect slash command trigger
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const lastLine = textBefore.split('\n').pop() || '';
    const slashMatch = lastLine.match(/^\/(.*)$/);

    if (slashMatch) {
      setSlashQuery(slashMatch[1]);
      setSlashStartIdx(cursorPos - lastLine.length);
      setSlashPos(getCursorPos());
      setSlashOpen(true);
    } else {
      setSlashOpen(false);
      setSlashQuery('');
    }
  }, [onChange, minRows, getCursorPos]);

  const wordCount = countWords(value);
  const charCount = value.length;

  const editorContent = (
    <div ref={containerRef} className={`flex flex-col relative ${fullscreen ? 'h-full' : ''}`}>
      {label && (
        <div className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${labelColor}`}>
          {LabelIcon && <LabelIcon size={12} />}
          {label}
        </div>
      )}

      <div className={`
        flex flex-col border rounded-xl overflow-hidden transition-all duration-200 bg-surface-800/60
        ${focused && !fullscreen
          ? 'border-brand-500/50 ring-1 ring-brand-500/20 bg-surface-800'
          : 'border-surface-700 bg-surface-800/60'}
        ${fullscreen ? 'flex-1' : ''}
      `}>
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-surface-700/60 bg-surface-900/40 px-3 py-2 flex-wrap gap-2 select-none">
          <div className="flex items-center gap-1 bg-surface-800 p-0.5 rounded-lg border border-surface-700/50">
            <button type="button" onClick={() => setMode('visual')}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                mode === 'visual' ? 'bg-brand-500 text-white shadow-sm' : 'text-surface-400 hover:text-surface-50'
              }`}>Visual</button>
            <button type="button" onClick={() => setMode('markdown')}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                mode === 'markdown' ? 'bg-brand-500 text-white shadow-sm' : 'text-surface-400 hover:text-surface-50'
              }`}>Source</button>
          </div>

          <div className="flex items-center gap-0.5 flex-wrap">
            {mode === 'visual' && (
              <>
                <ToolBtn icon={Bold} label="Bold" onClick={() => execCmd('bold')} />
                <ToolBtn icon={Italic} label="Italic" onClick={() => execCmd('italic')} />
                <ToolBtn icon={Link2} label="Link" onClick={() => { const url = prompt('Enter URL:'); if (url) execCmd('createLink', url); }} />
                <span className="w-px h-4 bg-surface-700 mx-1" />
                <select
                  onMouseDown={e => e.preventDefault()}
                  onChange={e => { editorRef.current?.focus(); execCmd('fontSize', e.target.value); }}
                  className="bg-surface-850 border border-surface-700 rounded px-1.5 py-0.5 text-[10px] text-surface-300 font-semibold outline-none cursor-pointer hover:border-surface-600 transition-colors"
                  defaultValue="3">
                  <option value="2">Small</option>
                  <option value="3">Normal</option>
                  <option value="5">Large</option>
                  <option value="6">XL</option>
                </select>
                <span className="w-px h-4 bg-surface-700 mx-1" />
                <div className="flex items-center gap-1.5 mx-1.5">
                  {[{ color: '#ffffff', title: 'White' }, { color: '#0ea5e9', title: 'Blue' }, { color: '#22c55e', title: 'Green' }, { color: '#8b5cf6', title: 'Purple' }, { color: '#f97316', title: 'Orange' }, { color: '#ef4444', title: 'Red' }].map(s => (
                    <button key={s.color} type="button" title={`Text color: ${s.title}`}
                      aria-label={`Text color: ${s.title}`}
                      onClick={() => execCmd('foreColor', s.color)}
                      onMouseDown={e => e.preventDefault()}
                      className="w-3.5 h-3.5 rounded-full border border-surface-700 transition-all hover:scale-125 hover:border-white"
                      style={{ backgroundColor: s.color }} />
                  ))}
                </div>
                <span className="w-px h-4 bg-surface-700 mx-1" />
                <ToolBtn icon={List} label="Bullet List" onClick={() => execCmd('insertUnorderedList')} />
                <ToolBtn icon={ListOrdered} label="Numbered List" onClick={() => execCmd('insertOrderedList')} />
              </>
            )}

            {mode === 'markdown' && (
              <>
                <ToolBtn icon={Bold} label="Bold" shortcut="Ctrl+B" onClick={() => wrap('**', '**', 'bold text')} />
                <ToolBtn icon={Italic} label="Italic" shortcut="Ctrl+I" onClick={() => wrap('*', '*', 'italic text')} />
                <ToolBtn icon={Code} label="Inline Code" onClick={() => wrap('`', '`', 'code')} />
                <ToolBtn icon={Link2} label="Link" shortcut="Ctrl+K" onClick={() => { const url = prompt('Enter URL:'); if (url) wrap('[', `](${url})`, 'link text'); }} />
                <span className="w-px h-4 bg-surface-700 mx-1" />
                <ToolBtn icon={Hash} label="Heading 2" onClick={() => prepend('## ')} />
                <ToolBtn icon={Type} label="Heading 3" onClick={() => prepend('### ')} />
                <ToolBtn icon={List} label="Bullet List" onClick={() => prepend('- ')} />
                <ToolBtn icon={ListOrdered} label="Numbered List" onClick={() => prepend('1. ')} />
                <ToolBtn icon={Quote} label="Blockquote" onClick={() => prepend('> ')} />
                <ToolBtn icon={Minus} label="Divider" onClick={() => insertAt('\n---\n')} />
              </>
            )}

            <span className="w-px h-4 bg-surface-700/60 mx-1.5" />

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

            <ToolBtn
              icon={fullscreen ? Minimize2 : Maximize2}
              label={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (Ctrl+Enter)'}
              active={fullscreen}
              onClick={() => setFullscreen(f => !f)}
            />
          </div>
        </div>

        {/* Edit / Preview Area */}
        <div className={`relative ${fullscreen ? 'flex-1 overflow-y-auto' : ''}`}>
          {mode === 'visual' ? (
            <div ref={editorRef} contentEditable
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              onInput={e => { onChange(htmlToMarkdown(e.currentTarget.innerHTML)); }}
              className={`w-full px-4 py-3 bg-transparent text-sm text-surface-50 outline-none prose-editor overflow-y-auto leading-relaxed ${
                fullscreen ? 'h-full min-h-0' : 'min-h-[96px]'
              }`}
              style={{ minHeight: `${minRows * 24 + 24}px` }} />
          ) : (
            <>
              <textarea ref={taRef} value={value} placeholder={placeholder}
                aria-label={label || 'Editor'}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                className={`w-full px-4 py-3 bg-transparent text-sm text-surface-50 placeholder:text-surface-600 resize-none outline-none font-mono leading-relaxed overflow-hidden ${
                  fullscreen ? 'h-full min-h-0' : ''
                }`}
                style={{ minHeight: `${minRows * 24 + 24}px` }}
                spellCheck />
              <AnimatePresence>
                {slashOpen && (
                  <SlashCommandPalette
                    query={slashQuery}
                    position={slashPos}
                    onSelect={executeSlashCommand}
                    onClose={() => setSlashOpen(false)} />
                )}
              </AnimatePresence>
            </>
          )}

          {/* Floating selection toolbar (visual mode) */}
          <AnimatePresence>
            {floatingToolbar && mode === 'visual' && (
              <FloatingToolbar
                position={floatingToolbar}
                onAction={(cmd, val) => execCmd(cmd, val)} />
            )}
          </AnimatePresence>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between border-t border-surface-700/60 bg-surface-900/20 px-3 py-1.5 text-[10px] text-surface-500">
          <div className="flex gap-3 overflow-hidden select-none">
            {focused && mode === 'markdown' && (
              <>
                <span><kbd className="text-[9px] bg-surface-800 border border-surface-700 rounded px-1">/</kbd> Commands</span>
                <span><kbd className="text-[9px] bg-surface-800 border border-surface-700 rounded px-1">Ctrl+B</kbd> Bold</span>
                <span><kbd className="text-[9px] bg-surface-800 border border-surface-700 rounded px-1">Ctrl+I</kbd> Italic</span>
                <span><kbd className="text-[9px] bg-surface-800 border border-surface-700 rounded px-1">Ctrl+K</kbd> Link</span>
              </>
            )}
            {focused && mode === 'visual' && (
              <span className="text-surface-500 font-medium">Select text for formatting toolbar</span>
            )}
            {focused && mode === 'markdown' && (
              <span className="text-brand-400/60 font-medium">Type / for commands</span>
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

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[60] bg-surface-950/95 backdrop-blur-sm flex flex-col p-6">
        <div className="flex items-center justify-between mb-4">
          {label && (
            <div className={`flex items-center gap-2 text-sm font-semibold ${labelColor}`}>
              {LabelIcon && <LabelIcon size={14} />}
              {label}
            </div>
          )}
          <button onClick={() => setFullscreen(false)}
            className="text-xs text-surface-400 hover:text-surface-50 flex items-center gap-1.5 ml-auto px-3 py-1.5 bg-surface-800 rounded-lg border border-surface-700 transition-colors">
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

// ── AutoSaveEditor — debounced auto-save wrapper (single source) ─────────────
export const AUTOSAVE_DEBOUNCE_MS = 750;

interface AutoSaveEditorProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  debounceMs?: number;
  children: (props: {
    value: string;
    onChange: (v: string) => void;
    saving: boolean;
    saved: boolean;
  }) => React.ReactNode;
}

export function AutoSaveEditor({
  value,
  onSave,
  debounceMs = AUTOSAVE_DEBOUNCE_MS,
  children,
}: AutoSaveEditorProps) {
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  useEffect(() => { setVal(value); }, [value]);

  useEffect(() => {
    if (val === value) return;
    setSaved(false);
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await onSave(val);
        setSaved(true);
      } catch (e) {
        console.error(e);
        setSaved(false);
      } finally {
        setSaving(false);
      }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [val, value, onSave, debounceMs]);

  return <>{children({ value: val, onChange: v => { setVal(v); setSaved(false); }, saving, saved })}</>;
}

// ── AutoProEditor — drop-in wrapper with debounced auto-save ─────────────────
interface AutoProEditorProps {
  logId: string;
  field: string;
  value: string;
  placeholder?: string;
  minRows?: number;
  label?: string;
  hint?: string;
  updateFn: (id: string, field: string, value: string) => Promise<void>;
}

export function AutoProEditor({
  logId, field, value, placeholder, minRows, label, updateFn,
}: AutoProEditorProps) {
  // WorkLog persists markdown but TextEditor is HTML-based. Render markdown ->
  // HTML for the editor and convert back to markdown on every edit, keeping the
  // last HTML we emitted so self-edits round-trip without resetting the caret.
  const lastHtmlRef = useRef('');
  const lastMdRef = useRef('');
  const [fullscreen, setFullscreen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Esc exits fullscreen.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const ctlBtn =
    'flex items-center justify-center rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-700/60 hover:text-surface-100';

  const editor = (val: string, onChange: (v: string) => void) => (
    <TextEditor
      className="journal-editor"
      value={val === lastMdRef.current ? lastHtmlRef.current : renderMarkdown(val)}
      onChange={html => {
        const md = htmlToMarkdown(html);
        lastHtmlRef.current = html;
        lastMdRef.current = md;
        onChange(md);
      }}
      placeholder={placeholder}
      minHeight={(minRows ?? 3) * 24 + 24}
    />
  );

  return (
    <AutoSaveEditor value={value} onSave={v => updateFn(logId, field, v)}>
      {({ value: val, onChange }) => {
        if (fullscreen) {
          return (
            <div className="je-fullscreen fixed inset-0 z-[60] flex flex-col bg-surface-950/95 p-4 backdrop-blur-sm sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="truncate text-sm font-semibold text-surface-100">
                  {label ?? placeholder ?? 'Editor'}
                </div>
                <button
                  type="button"
                  onClick={() => setFullscreen(false)}
                  className="flex items-center gap-1.5 rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-xs text-surface-400 transition-colors hover:text-surface-50"
                >
                  <Minimize2 size={13} /> Exit fullscreen
                  <kbd className="text-[10px] text-surface-600">Esc</kbd>
                </button>
              </div>
              <div className="relative min-h-0 flex-1">{editor(val, onChange)}</div>
            </div>
          );
        }

        if (minimized) {
          const preview = (val || placeholder || '')
            .replace(/[#*_`>\-[\]]/g, '')
            .replace(/\s*\n+\s*/g, ' ')
            .trim();
          return (
            <button
              type="button"
              onClick={() => setMinimized(false)}
              title="Expand editor"
              className="flex w-full items-center gap-2 rounded-xl border border-surface-700 bg-surface-800/60 px-3 py-2 text-left text-xs text-surface-400 transition-colors hover:border-surface-600 hover:text-surface-200"
            >
              <Maximize2 size={13} className="flex-shrink-0 text-surface-500" />
              <span className="truncate">{preview || 'Empty'}</span>
              <span className="ml-auto flex-shrink-0 text-surface-500">Click to expand</span>
            </button>
          );
        }

        return (
          <div>
            <div className="relative">{editor(val, onChange)}</div>
            <div className="mt-1.5 flex items-center justify-end gap-0.5">
              <button
                type="button"
                onClick={() => setMinimized(true)}
                title="Minimize"
                aria-label="Minimize editor"
                className={ctlBtn}
              >
                <Minimize2 size={13} />
              </button>
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                title="Fullscreen (Esc to exit)"
                aria-label="Fullscreen editor"
                className={ctlBtn}
              >
                <Maximize2 size={13} />
              </button>
            </div>
          </div>
        );
      }}
    </AutoSaveEditor>
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
.prose-editor u { text-decoration: underline; }
.prose-editor s  { text-decoration: line-through; color: var(--color-surface-500); }
.prose-editor [data-md-align="center"] { text-align: center; }
.prose-editor [data-md-align="right"] { text-align: right; }
.prose-editor [data-md-align="justify"] { text-align: justify; }
`;
