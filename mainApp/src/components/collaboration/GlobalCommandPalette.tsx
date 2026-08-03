import { useState, useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Search, FolderOpen, CheckSquare, BookOpen, ArrowRight, X, Loader2, Hash, LayoutGrid } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../utils/api';
import type { SearchResults, SearchResultItem } from '../../types/collaboration';

const SECTION_ICONS: Record<SearchResultItem['kind'], ReactNode> = {
  project: <FolderOpen size={12} className="text-brand-400" />,
  task: <CheckSquare size={12} className="text-sky-400" />,
  worklog: <BookOpen size={12} className="text-amber-400" />,
  member: <Hash size={12} className="text-emerald-400" />,
  workspace: <LayoutGrid size={12} className="text-cyan-400" />,
  team: <FolderOpen size={12} className="text-purple-400" />,
};

// Facet order mirrors the search contract (workspace scope fills project/team/
// member; personal scope fills task/worklog/workspace).
type SearchFacet = Exclude<keyof SearchResults, 'query' | 'workspaceId'>;
const FACET_KEYS: SearchFacet[] = ['workspaces', 'projects', 'teams', 'tasks', 'worklogs', 'members'];
const FACET_LABELS: Record<string, string> = {
  workspaces: 'Workspaces',
  projects: 'Projects',
  teams: 'Teams',
  tasks: 'Tasks',
  worklogs: 'Work Logs',
  members: 'Members',
};

export function GlobalCommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // IES-P2-06: inside a workspace route, search is workspace-scoped; otherwise
  // the server falls back to the caller's personal scope.
  const workspaceMatch = location.pathname.match(/^\/w\/([0-9a-fA-F]{24})/);
  const workspaceId = workspaceMatch ? workspaceMatch[1] : undefined;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  // IES-P2-06: debounced real search; only runs while the palette is open.
  useEffect(() => {
    if (!isOpen) return;
    const q = query.trim();
    if (!q) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      api.search
        .run(q, { workspaceId, limit: 8 })
        .then(setResults)
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, isOpen, workspaceId]);

  if (!isOpen) return null;

  const q = query.trim();
  const facets = FACET_KEYS
    .map((key) => ({ key, items: results ? results[key] : [] }))
    .filter((f) => f.items.length > 0);
  const totalResults = facets.reduce((sum, f) => sum + f.items.length, 0);

  const openResult = (item: SearchResultItem) => {
    navigate(item.url);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-start justify-center z-50 pt-20 p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: -16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -16 }}
        className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Input */}
        <div className="relative border-b border-surface-800 p-4 flex items-center gap-3">
          <Search size={18} className="text-surface-400" />
          <input
            className="w-full bg-transparent text-sm text-surface-50 placeholder-surface-500 focus:outline-none"
            placeholder="Search projects, tasks, work logs, members, workspaces... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {loading && <Loader2 size={15} className="text-brand-400 animate-spin flex-shrink-0" />}
          {query && !loading && (
            <button onClick={() => setQuery('')} className="p-1 text-surface-500 hover:text-surface-200">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {!q ? (
            <div className="text-center py-8 text-surface-500 text-xs">
              Type to search across the entire developer workspace...
            </div>
          ) : loading && !results ? (
            <div className="text-center py-8 text-surface-500 text-xs">Searching…</div>
          ) : totalResults === 0 ? (
            <div className="text-center py-8 text-surface-500 text-xs">
              No results found for "{q}"
            </div>
          ) : (
            facets.map((facet) => (
              <div key={facet.key}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500 mb-2 flex items-center gap-1.5">
                  {SECTION_ICONS[(facet.items[0] as SearchResultItem).kind]} {FACET_LABELS[facet.key]}
                </p>
                <div className="space-y-1">
                  {facet.items.map((item) => (
                    <div key={`${item.kind}-${item.id}`} onClick={() => openResult(item)}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-800 cursor-pointer transition-colors">
                      <div>
                        <p className="text-xs font-semibold text-surface-100">{item.title}</p>
                        <p className="text-[11px] text-surface-400 line-clamp-1">{item.subtitle}</p>
                      </div>
                      <ArrowRight size={13} className="text-surface-500" />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {q && (
          <div className="border-t border-surface-800 p-3 flex items-center justify-between text-xs bg-surface-900">
            <span className="text-surface-500">
              {loading ? 'Searching…' : `${totalResults} result${totalResults === 1 ? '' : 's'}`}
            </span>
            {totalResults > 0 && (
              <button
                onClick={() => {
                  navigate(`/search?q=${encodeURIComponent(q)}${workspaceId ? `&workspaceId=${workspaceId}` : ''}`);
                  onClose();
                }}
                className="text-brand-400 font-semibold hover:text-brand-300 flex items-center gap-1 transition-colors">
                View all results <ArrowRight size={13} />
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
