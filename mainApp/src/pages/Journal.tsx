
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookOpen, Trash2, Search, Bold, Italic } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../store/useStore';
import { MOOD_LABELS } from '../utils/colors';
import { PageHeader } from '../components/ui/PageHeader';

export function Journal() {
  const { journals, tasks, addJournal, deleteJournal } = useStore();

  const [showAdd, setShowAdd] = useState(false);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState(3);
  const [taskId, setTaskId] = useState('');
  const [search, setSearch] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeTasks = tasks.filter(t => t.status !== 'completed');

  const autoResize = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const wrapSelection = (wrapper: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selectedText = content.substring(start, end);

    const newText =
      content.substring(0, start) +
      wrapper +
      selectedText +
      wrapper +
      content.substring(end);

    setContent(newText);

    requestAnimationFrame(() => {
      autoResize();
      textarea.focus();
      textarea.selectionStart = start + wrapper.length;
      textarea.selectionEnd = end + wrapper.length;
    });
  };

  const handleAdd = () => {
    if (!content.trim()) return;

    addJournal({
      taskId: taskId || (activeTasks[0]?.id ?? ''),
      content,
      mood: mood as any,
      focusRating: mood,
    });

    setContent('');
    setMood(3);
    setShowAdd(false);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = '160px';
      }
    });
  };

  const filtered = journals.filter(j =>
    !search || j.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      <PageHeader title="Journal" description={`${journals.length} Entries Logged`}
        icon={<span className="text-xl">📖</span>} iconColor="#f59e0b"
        actions={<button onClick={() => setShowAdd(!showAdd)} className="btn-primary"><Plus size={18} /> New Entry</button>} />

      {/* Search */}
      <div className="relative mb-8">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400"
        />

        <input
          className="input pl-11 h-12 rounded-[14px]"
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
            className="card p-6 rounded-[22px] shadow-sm mb-8 overflow-hidden"
          >
            <h3 className="font-display font-bold text-lg text-surface-50 mb-4">
              New Journal Entry
            </h3>

            {/* Task Select */}
            <select
              className="input mb-3"
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
            >
              <option value="">Select task (optional)</option>

              {tasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>

            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-3 border border-surface-700 bg-surface-900/80 rounded-xl p-2">
              <button
                type="button"
                onClick={() => wrapSelection('**')}
                className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-50 transition-all"
                title="Bold"
              >
                <Bold size={16} />
              </button>

              <button
                type="button"
                onClick={() => wrapSelection('*')}
                className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-50 transition-all"
                title="Italic"
              >
                <Italic size={16} />
              </button>
            </div>

            {/* Auto Growing Textarea */}
            <textarea
              ref={textareaRef}
              className="
                input
                resize-none
                overflow-hidden
                min-h-[160px]
                max-h-[500px]
                mb-2
                leading-7
                text-[15px]
                transition-all
                duration-200
              "
              placeholder="Write your thoughts, progress, and reflections..."
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                autoResize();
              }}
              autoFocus
              rows={1}
            />

            {/* Character Count */}
            <div className="text-right text-xs text-surface-500 mb-4">
              {content.length} characters
            </div>

            {/* Mood Selector */}
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <span className="text-sm text-surface-300">
                How are you feeling?
              </span>

              {[1, 2, 3, 4, 5].map(m => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  className={`text-2xl transition-all duration-200 ${
                    mood === m
                      ? 'scale-125 opacity-100'
                      : 'opacity-40 hover:opacity-80 hover:scale-105'
                  }`}
                >
                  {['😔', '😐', '🙂', '😊', '🔥'][m - 1]}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>

              <button
                onClick={handleAdd}
                disabled={!content.trim()}
                className="btn-primary flex-1"
              >
                Save Entry
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Journal Entries */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card p-10 text-center"
        >
          <BookOpen
            size={36}
            className="text-surface-600 mx-auto mb-3"
          />

          <p className="text-surface-300 font-medium">
            No journal entries yet
          </p>

          <p className="text-surface-500 text-sm mt-1">
            Start writing to track your progress and reflections
          </p>
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
                  className="card p-6 rounded-[22px] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group border border-surface-800"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {task && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: `${task.color}20`,
                              color: task.color,
                            }}
                          >
                            {task.title}
                          </span>
                        )}

                        <span className="text-2xl">
                          {['😔', '😐', '🙂', '😊', '🔥'][entry.mood - 1]}
                        </span>
                      </div>

                      <span className="text-xs text-surface-400">
                        {new Date(entry.createdAt).toLocaleDateString(
                          'en-US',
                          {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteJournal(entry.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Markdown Render */}
                  <div className="prose prose-invert max-w-none text-surface-200 leading-7 text-[15px]">
                    <ReactMarkdown>
                      {entry.content}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
