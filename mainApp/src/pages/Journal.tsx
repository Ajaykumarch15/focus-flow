import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookOpen, Trash2, Search } from 'lucide-react';
import { useStore } from '../store/useStore';
import { MOOD_LABELS } from '../utils/colors';

export function Journal() {
  const { journals, tasks, addJournal, deleteJournal } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState(3);
  const [taskId, setTaskId] = useState('');
  const [search, setSearch] = useState('');

  const activeTasks = tasks.filter(t => t.status !== 'completed');

  const handleAdd = () => {
    if (!content.trim()) return;
    addJournal({ taskId: taskId || (activeTasks[0]?.id ?? ''), content, mood: mood as any, focusRating: mood });
    setContent('');
    setMood(3);
    setShowAdd(false);
  };

  const filtered = journals.filter(j =>
    !search || j.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Journal</h1>
          <p className="text-surface-300 text-sm mt-1">{journals.length} entries</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          New Entry
        </button>
      </motion.div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          className="input pl-10"
          placeholder="Search journal entries..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* New Entry */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card p-5 mb-6 overflow-hidden"
          >
            <h3 className="font-medium text-white mb-4">New Journal Entry</h3>
            <select
              className="input mb-3"
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
            >
              <option value="">Select task (optional)</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <textarea
              className="input resize-none h-32 mb-3"
              placeholder="Write your thoughts, progress, and reflections..."
              value={content}
              onChange={e => setContent(e.target.value)}
              autoFocus
            />
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm text-surface-300">How are you feeling?</span>
              {[1, 2, 3, 4, 5].map(m => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  className={`text-2xl transition-all ${mood >= m ? 'scale-125' : 'opacity-30 scale-90'}`}
                >
                  {['😔', '😐', '🙂', '😊', '🔥'][m - 1]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleAdd} disabled={!content.trim()} className="btn-primary flex-1">Save Entry</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Journal Entries */}
      {filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-10 text-center">
          <BookOpen size={36} className="text-surface-600 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">No journal entries yet</p>
          <p className="text-surface-500 text-sm mt-1">Start writing to track your progress and reflections</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filtered.map(entry => {
              const task = tasks.find(t => t.id === entry.taskId);
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="card p-5 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {task && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `${task.color}20`, color: task.color }}
                          >
                            {task.title}
                          </span>
                        )}
                        <span className="text-2xl">{['😔', '😐', '🙂', '😊', '🔥'][entry.mood - 1]}</span>
                      </div>
                      <span className="text-xs text-surface-400">
                        {new Date(entry.createdAt).toLocaleDateString('en-US', {
                          weekday: 'long', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteJournal(entry.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-surface-200 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
