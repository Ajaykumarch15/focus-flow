
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookOpen, Trash2, Search } from 'lucide-react';
import { TextEditor } from '@maple1521/rich-text-editor';
import { RichContent } from '@shared/components/ui/RichContent';
import { stripHtml } from '@shared/utils/htmlContent';
import { useStore } from '@worklog/services/useStore';
import { MOOD_EMOJIS } from '@worklog/services/config';
import { PageHeader } from '@shared/components/ui/PageHeader';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { EmptyState } from '@shared/components/ui/EmptyState';
import type { Mood } from '@shared/types';

const MAX_CHARS = 20000;

export function Journal() {
  const { journals, tasks, addJournal, deleteJournal } = useStore();

  const [showAdd, setShowAdd] = useState(false);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<Mood>(3);
  const [taskId, setTaskId] = useState('');
  const [search, setSearch] = useState('');

  const handleChange = (value: string) => {
    setContent(value.slice(0, MAX_CHARS));
  };

  const handleAdd = () => {
    if (!stripHtml(content)) return;

    addJournal({
      taskId,
      content,
      mood,
      focusRating: mood,
    });

    setContent('');
    setMood(3);
    setTaskId('');
    setShowAdd(false);
  };

  const filtered = journals.filter(j =>
    !search || stripHtml(j.content).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      <PageHeader title="Journal" description={`${journals.length} Entries Logged`}
        icon={<span className="text-xl">📖</span>} iconColor="#f59e0b"
        actions={<Button onClick={() => setShowAdd(!showAdd)} leftIcon={<Plus size={18} />}>New Entry</Button>} />

      {/* Search */}
      <div className="relative mb-8">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400"
        />

        <Input
          className="pl-11 h-12 rounded-[14px]"
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
            <Select
              className="mb-3"
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
            >
              <option value="">Select task (optional)</option>

              {tasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>

            <TextEditor
              className="mb-2 journal-editor"
              value={content}
              onChange={handleChange}
              placeholder="Write your thoughts, progress, and reflections..."
              minHeight={160}
            />

            {/* Mood Selector */}
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <span className="text-sm text-surface-300">
                How are you feeling?
              </span>

              {([1, 2, 3, 4, 5] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  className={`text-2xl transition-all duration-200 ${
                    mood === m
                      ? 'scale-125 opacity-100'
                      : 'opacity-40 hover:opacity-80 hover:scale-105'
                  }`}
                >
                  {MOOD_EMOJIS[m - 1]}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowAdd(false)}
                className="flex-1"
              >
                Cancel
              </Button>

              <Button
                onClick={handleAdd}
                disabled={!content.trim()}
                className="flex-1"
              >
                Save Entry
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Journal Entries */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card"
        >
          <EmptyState
            icon={<BookOpen size={36} className="text-surface-600" />}
            title="No journal entries yet"
            description="Start writing to track your progress and reflections"
          />
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
                          {MOOD_EMOJIS[entry.mood - 1]}
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

                  {/* Content Render */}
                  <RichContent content={entry.content} className="text-surface-200 leading-7 text-[15px]" />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
