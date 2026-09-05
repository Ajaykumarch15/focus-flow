import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  BookOpen, Lightbulb, GraduationCap, Link2, Search, X,
  RefreshCw, ArrowRight, FileText,
} from 'lucide-react';
import type { KnowledgeDoc } from '@collab/types/collaboration';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import type { JournalEntry } from '@shared/types';
import { selectKnowledge, filterKnowledge, type KnowledgeDecision, type KnowledgeLesson, type KnowledgeLink } from '@worklog/services/knowledgeSelectors';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { Input } from '@shared/components/ui/Input';

// ── KnowledgePanel (S3-T2) ────────────────────────────────────────────────────
// The read-only Knowledge surface (ECIS §B.5 · IA §8.9-5): "What do we already
// know?" rendered from REAL captured data via selectKnowledge. Sections:
//   1. Knowledge docs (store docs)  2. Decision ledger (work-log decisions)
//   3. Lessons learned              4. Saved links
// Search filters every group through filterKnowledge (single matching contract).
// Presentational on its raw props, so both the personal L1 page and the
// workspace L2 page reuse the same panel. Every section is a labelled region
// (results-list landmark); the search input is labelled; empty/error/loading
// states are honest and never invent data.

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

function formatDay(ts: number): string {
  return format(new Date(ts), 'MMM d, yyyy');
}

function DecisionRow({ item, onOpenWorkLog }: { item: KnowledgeDecision; onOpenWorkLog?: (logId: string) => void }) {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900 p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-surface-50">{item.title}</p>
          <p className="text-[11px] text-surface-500 mt-0.5">
            {item.logTitle} · {formatDay(item.timestamp)}
          </p>
        </div>
        {onOpenWorkLog && (
          <Button
            variant="ghost"
            size="xs"
            className="flex-shrink-0 text-brand-300 hover:text-brand-200"
            aria-label={`Open ${item.title} in work log`}
            onClick={() => onOpenWorkLog(item.logId)}
            leftIcon={<ArrowRight size={12} />}
          >
            Open in work log
          </Button>
        )}
      </div>
      {item.decision && (
        <p className="text-xs text-surface-300 leading-relaxed">{item.decision}</p>
      )}
      {item.rationale && (
        <p className="text-[11px] text-surface-500 italic">{item.rationale}</p>
      )}
    </div>
  );
}

function LessonRow({ item, onOpenWorkLog }: { item: KnowledgeLesson; onOpenWorkLog?: (logId: string) => void }) {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900 p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-surface-200 leading-relaxed">{item.lesson}</p>
        <p className="text-[11px] text-surface-500 mt-1.5">{item.logTitle} · {formatDay(item.timestamp)}</p>
      </div>
      {onOpenWorkLog && (
        <Button
          variant="ghost"
          size="xs"
          className="flex-shrink-0 text-brand-300 hover:text-brand-200"
          aria-label={`Open lesson from ${item.logTitle} in work log`}
          onClick={() => onOpenWorkLog(item.logId)}
          leftIcon={<ArrowRight size={12} />}
        >
          Open in work log
        </Button>
      )}
    </div>
  );
}

function LinkRow({ item, onOpenWorkLog }: { item: KnowledgeLink; onOpenWorkLog?: (logId: string) => void }) {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900 p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <a href={item.url} target="_blank" rel="noreferrer"
          className="text-sm font-semibold text-brand-500 hover:text-brand-400 underline decoration-brand-500/40 underline-offset-2 break-all">
          {item.label}
        </a>
        <p className="text-[11px] text-surface-500 mt-1">
          {item.category} · {item.logTitle}
        </p>
      </div>
      {onOpenWorkLog && (
        <Button
          variant="ghost"
          size="xs"
          className="flex-shrink-0 text-brand-300 hover:text-brand-200"
          aria-label={`Open ${item.label} in work log`}
          onClick={() => onOpenWorkLog(item.logId)}
          leftIcon={<ArrowRight size={12} />}
        >
          Open in work log
        </Button>
      )}
    </div>
  );
}

interface KnowledgePanelProps {
  docs: KnowledgeDoc[];
  workLogs: WorkLog[];
  journals: JournalEntry[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpenWorkLog?: (logId: string) => void;
  title?: string;
  description?: string;
}

export function KnowledgePanel({
  docs, workLogs, journals,
  loading = false, error = null, onRetry,
  onOpenWorkLog,
  title = 'Knowledge',
  description = 'What do we already know?',
}: KnowledgePanelProps) {
  const [query, setQuery] = useState('');

  const view = useMemo(() => selectKnowledge(docs, workLogs, journals), [docs, workLogs, journals]);
  const filtered = useMemo(() => filterKnowledge(view, query), [view, query]);

  const searching = query.trim() !== '';
  const isLoading = loading && docs.length === 0 && workLogs.length === 0;
  const showError = !!error && view.total === 0;
  const hasData = view.total > 0;

  const stats = [
    { label: 'Docs', value: view.docs.length, color: 'text-purple-400' },
    { label: 'Decisions', value: view.decisions.length, color: 'text-amber-400' },
    { label: 'Lessons', value: view.lessons.length, color: 'text-emerald-400' },
    { label: 'Links', value: view.links.length, color: 'text-cyan-400' },
    { label: 'Journals', value: view.journalCount, color: 'text-sky-400' },
  ];

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-surface-800 bg-surface-900 p-5 space-y-3">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ Header + search (ECIS §B.5-1) ═══ */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 tracking-tight flex items-center gap-3">
              <BookOpen size={24} className="text-purple-400" /> {title}
            </h1>
            <p className="text-surface-400 text-sm mt-1">{description}</p>
          </div>
          <div className="relative w-full lg:w-80 flex-shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <Input
              className="h-10 pl-9 pr-9 rounded-xl text-sm"
              placeholder="Search docs, decisions, lessons, links…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search knowledge"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-200 transition-colors"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {hasData && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5">
            {stats.map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-surface-800 bg-surface-900 p-4">
                <p className={`text-xl font-display font-bold ${color}`}>{value}</p>
                <p className="text-[11px] text-surface-400 font-medium mt-0.5 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ═══ Error + retry (ECIS §B.5 error state) ═══ */}
      {showError && (
        <div className="rounded-2xl border border-danger-500/25 bg-danger-500/5 p-6 text-center">
          <p className="text-sm font-semibold text-danger-400">Knowledge could not be loaded</p>
          <p className="text-xs text-surface-400 mt-1 mb-4">{error}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RefreshCw size={13} />}>
              Retry
            </Button>
          )}
        </div>
      )}

      {/* ═══ Empty state (ECIS §B.5 copy) ═══ */}
      {!showError && !hasData && !searching && (
        <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/50 overflow-hidden">
          <EmptyState
            icon={<BookOpen size={28} className="text-surface-600" />}
            title="No knowledge captured yet"
            description="Capture a decision or lesson in your work log — or add a knowledge doc in a workspace — and it will surface here."
          />
        </div>
      )}

      {/* ═══ Search no-results ═══ */}
      {!showError && searching && filtered.total === 0 && (
        <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/50 overflow-hidden">
          <EmptyState
            icon={<Search size={24} className="text-surface-500" />}
            title="No knowledge matches"
            description={`Nothing in your docs, decisions, lessons, or links matches "${query.trim()}".`}
            action={
              <Button variant="secondary" size="sm" onClick={() => setQuery('')} leftIcon={<X size={13} />}>
                Clear search
              </Button>
            }
          />
        </div>
      )}

      {/* ═══ Sections ═══ */}
      {!showError && (hasData || searching) && filtered.total > 0 && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {/* ── 2. Knowledge docs ── */}
          <motion.section variants={fadeUp} role="region" aria-label="Knowledge docs" className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-purple-400" />
              <h2 className="text-sm font-bold text-surface-100">Knowledge Docs</h2>
              <span className="text-[10px] font-bold text-surface-500 bg-surface-800 px-2 py-0.5 rounded-md">{filtered.docs.length}</span>
            </div>
            {filtered.docs.length === 0 ? (
              <p className="text-xs text-surface-600 italic py-3 px-1">
                {view.docs.length === 0 ? 'No knowledge docs yet.' : `No docs match "${query.trim()}".`}
              </p>
            ) : (
              filtered.docs.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-surface-800 bg-surface-900 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="brand" className="text-[10px] font-bold uppercase tracking-wider">
                      {doc.category} · v{doc.version}
                    </Badge>
                    <span className="text-[10px] text-surface-500">{doc.updatedAt}</span>
                  </div>
                  <h3 className="text-sm font-bold text-surface-50">{doc.title}</h3>
                  {doc.content && (
                    <p className="text-xs text-surface-400 leading-relaxed line-clamp-4 whitespace-pre-wrap">{doc.content}</p>
                  )}
                  {doc.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {doc.tags.map((tag) => (
                        <span key={tag} className="text-[10px] text-surface-500 bg-surface-850 border border-surface-800 px-2 py-0.5 rounded-md">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </motion.section>

          {/* ── 3. Decision ledger ── */}
          <motion.section variants={fadeUp} role="region" aria-label="Decision ledger" className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb size={15} className="text-amber-400" />
              <h2 className="text-sm font-bold text-surface-100">Decision Ledger</h2>
              <span className="text-[10px] font-bold text-surface-500 bg-surface-800 px-2 py-0.5 rounded-md">{filtered.decisions.length}</span>
            </div>
            {filtered.decisions.length === 0 ? (
              <p className="text-xs text-surface-600 italic py-3 px-1">
                {view.decisions.length === 0 ? 'No decisions captured yet — record them in your work log.' : `No decisions match "${query.trim()}".`}
              </p>
            ) : (
              filtered.decisions.map((item) => (
                <DecisionRow key={item.id} item={item} onOpenWorkLog={onOpenWorkLog} />
              ))
            )}
          </motion.section>

          {/* ── 4. Lessons learned ── */}
          <motion.section variants={fadeUp} role="region" aria-label="Lessons learned" className="space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCap size={15} className="text-emerald-400" />
              <h2 className="text-sm font-bold text-surface-100">Lessons Learned</h2>
              <span className="text-[10px] font-bold text-surface-500 bg-surface-800 px-2 py-0.5 rounded-md">{filtered.lessons.length}</span>
            </div>
            {filtered.lessons.length === 0 ? (
              <p className="text-xs text-surface-600 italic py-3 px-1">
                {view.lessons.length === 0 ? 'No lessons captured yet.' : `No lessons match "${query.trim()}".`}
              </p>
            ) : (
              filtered.lessons.map((item) => (
                <LessonRow key={item.id} item={item} onOpenWorkLog={onOpenWorkLog} />
              ))
            )}
          </motion.section>

          {/* ── 5. Saved links ── */}
          <motion.section variants={fadeUp} role="region" aria-label="Saved links" className="space-y-3">
            <div className="flex items-center gap-2">
              <Link2 size={15} className="text-cyan-400" />
              <h2 className="text-sm font-bold text-surface-100">Saved Links</h2>
              <span className="text-[10px] font-bold text-surface-500 bg-surface-800 px-2 py-0.5 rounded-md">{filtered.links.length}</span>
            </div>
            {filtered.links.length === 0 ? (
              <p className="text-xs text-surface-600 italic py-3 px-1">
                {view.links.length === 0 ? 'No saved links yet.' : `No links match "${query.trim()}".`}
              </p>
            ) : (
              filtered.links.map((item) => (
                <LinkRow key={item.id} item={item} onOpenWorkLog={onOpenWorkLog} />
              ))
            )}
          </motion.section>
        </motion.div>
      )}
    </div>
  );
}
