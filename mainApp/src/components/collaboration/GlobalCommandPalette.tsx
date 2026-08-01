import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FolderOpen, CheckSquare, Users, BookOpen, AlertOctagon, ArrowRight, X } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { useNavigate } from 'react-router-dom';

export function GlobalCommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { globalSearch } = useCollaborationStore();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

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

  if (!isOpen) return null;

  const results = globalSearch(query);
  const totalResults =
    results.projects.length +
    results.tasks.length +
    results.members.length +
    results.docs.length +
    results.blockers.length;

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
            placeholder="Search projects, tasks, members, docs, blockers... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 text-surface-500 hover:text-surface-200">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {!query.trim() ? (
            <div className="text-center py-8 text-surface-500 text-xs">
              Type to search across the entire developer workspace...
            </div>
          ) : totalResults === 0 ? (
            <div className="text-center py-8 text-surface-500 text-xs">
              No results found for "{query}"
            </div>
          ) : (
            <>
              {results.projects.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500 mb-2 flex items-center gap-1.5">
                    <FolderOpen size={12} className="text-brand-400" /> Projects
                  </p>
                  <div className="space-y-1">
                    {results.projects.map((p) => (
                      <div key={p.id} onClick={() => { navigate('/team'); onClose(); }}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-800 cursor-pointer transition-colors">
                        <div>
                          <p className="text-xs font-semibold text-surface-100">{p.name}</p>
                          <p className="text-[11px] text-surface-400">{p.description}</p>
                        </div>
                        <ArrowRight size={13} className="text-surface-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.tasks.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500 mb-2 flex items-center gap-1.5">
                    <CheckSquare size={12} className="text-sky-400" /> Tasks
                  </p>
                  <div className="space-y-1">
                    {results.tasks.map((t) => (
                      <div key={t.id} onClick={() => { navigate('/team'); onClose(); }}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-800 cursor-pointer transition-colors">
                        <div>
                          <p className="text-xs font-semibold text-surface-100">{t.title}</p>
                          <p className="text-[11px] text-surface-400">{t.description}</p>
                        </div>
                        <ArrowRight size={13} className="text-surface-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.docs.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500 mb-2 flex items-center gap-1.5">
                    <BookOpen size={12} className="text-amber-400" /> Knowledge Base Docs
                  </p>
                  <div className="space-y-1">
                    {results.docs.map((d) => (
                      <div key={d.id} onClick={() => { navigate('/team'); onClose(); }}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-800 cursor-pointer transition-colors">
                        <div>
                          <p className="text-xs font-semibold text-surface-100">{d.title}</p>
                          <p className="text-[11px] text-surface-400">{d.category}</p>
                        </div>
                        <ArrowRight size={13} className="text-surface-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.blockers.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500 mb-2 flex items-center gap-1.5">
                    <AlertOctagon size={12} className="text-red-400" /> Blockers
                  </p>
                  <div className="space-y-1">
                    {results.blockers.map((b) => (
                      <div key={b.id} onClick={() => { navigate('/team'); onClose(); }}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-800 cursor-pointer transition-colors">
                        <div>
                          <p className="text-xs font-semibold text-surface-100">{b.title}</p>
                          <p className="text-[11px] text-surface-400">{b.impactDescription}</p>
                        </div>
                        <ArrowRight size={13} className="text-surface-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
