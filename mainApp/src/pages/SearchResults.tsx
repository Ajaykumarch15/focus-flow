import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, FolderOpen, CheckSquare, BookOpen, Hash, LayoutGrid, Loader2, ArrowRight, X } from 'lucide-react';
import { api } from '../utils/api';
import type { SearchResults, SearchResultItem } from '../types/collaboration';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';

const SECTION_ICONS: Record<SearchResultItem['kind'], ReactNode> = {
  project: <FolderOpen size={14} className="text-brand-400" />,
  task: <CheckSquare size={14} className="text-sky-400" />,
  worklog: <BookOpen size={14} className="text-amber-400" />,
  member: <Hash size={14} className="text-emerald-400" />,
  workspace: <LayoutGrid size={14} className="text-cyan-400" />,
  team: <FolderOpen size={14} className="text-purple-400" />,
};

const FACET_KEYS: SearchFacet[] = ['workspaces', 'projects', 'teams', 'tasks', 'worklogs', 'members'];
const FACET_LABELS: Record<string, string> = {
  workspaces: 'Workspaces',
  projects: 'Projects',
  teams: 'Teams',
  tasks: 'Tasks',
  worklogs: 'Work Logs',
  members: 'Members',
};

type SearchFacet = Exclude<keyof SearchResults, 'query' | 'workspaceId'>;

export function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const qParam = searchParams.get('q') ?? '';
  const workspaceIdParam = searchParams.get('workspaceId') ?? undefined;
  const [input, setInput] = useState(qParam);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInput(qParam);
  }, [qParam]);

  // IES-P2-06: fetch once per (query, scope) change; stale responses are dropped.
  useEffect(() => {
    const q = qParam.trim();
    if (!q) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    api.search
      .run(q, { workspaceId: workspaceIdParam, limit: 50 })
      .then((res) => { if (!cancelled) setResults(res); })
      .catch(() => { if (!cancelled) setResults(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [qParam, workspaceIdParam]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    const params = new URLSearchParams({ q });
    if (workspaceIdParam) params.set('workspaceId', workspaceIdParam);
    navigate(`${location.pathname}?${params.toString()}`);
  };

  const q = qParam.trim();
  const facets = FACET_KEYS
    .map((key) => ({ key, items: results ? results[key] : [] }))
    .filter((f) => f.items.length > 0);
  const totalResults = facets.reduce((sum, f) => sum + f.items.length, 0);

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-extrabold text-surface-50 flex items-center gap-2.5">
          <Search size={24} className="text-brand-400" /> Global Search
        </h1>
        <p className="text-xs text-surface-400 mt-1">
          {workspaceIdParam
            ? 'Searching inside the current workspace — projects, teams, and members.'
            : 'Searching your personal workspace — tasks, work logs, projects, and workspaces.'}
        </p>
      </div>

      <form onSubmit={submit} className="relative max-w-2xl">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search across your workspace..."
          className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-900 border border-surface-800 text-sm text-surface-50 placeholder-surface-500 focus:border-brand-500 focus:outline-none transition-colors"
        />
        {input && (
          <button type="button" onClick={() => setInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-200">
            <X size={14} />
          </button>
        )}
      </form>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-surface-400">
          <Loader2 size={14} className="animate-spin text-brand-400" /> Searching…
        </div>
      )}

      {!q ? (
        <EmptyState
          icon={<Search size={28} className="text-surface-500" />}
          title="Start searching"
          description="Type a query above to search across your workspace."
        />
      ) : !loading && totalResults === 0 ? (
        <EmptyState
          icon={<Search size={28} className="text-surface-500" />}
          title="No results found"
          description={`No results found for "${q}".`}
        />
      ) : (
        <div className="space-y-6">
          {facets.length === 0 && !loading && (
            <EmptyState
              icon={<Search size={28} className="text-surface-500" />}
              title="No results found"
              description={`No results found for "${q}".`}
            />
          )}
          {facets.map((facet) => (
            <div key={facet.key}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500 mb-2 flex items-center gap-1.5">
                {SECTION_ICONS[(facet.items[0] as SearchResultItem).kind]} {FACET_LABELS[facet.key]}
                <span className="text-surface-600 normal-case font-normal">({facet.items.length})</span>
              </p>
              <div className="rounded-3xl border border-surface-800 bg-surface-900 divide-y divide-surface-800/50 overflow-hidden">
                {facet.items.map((item) => (
                  <motion.button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => navigate(item.url)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-850 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-surface-100 truncate">{item.title}</p>
                      <p className="text-xs text-surface-400 truncate">{item.subtitle}</p>
                    </div>
                    <ArrowRight size={14} className="text-surface-500 flex-shrink-0" />
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
