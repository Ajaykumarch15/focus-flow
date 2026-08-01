import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, X } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { DocCategory, KnowledgeDoc } from '../../types/collaboration';

export function CreateDocModal({
  isOpen,
  onClose,
  docToEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  docToEdit?: KnowledgeDoc;
}) {
  const { createDoc, updateDoc } = useCollaborationStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocCategory>('Architecture');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (docToEdit) {
      setTitle(docToEdit.title);
      setCategory(docToEdit.category);
      setContent(docToEdit.content);
      setTagsInput(docToEdit.tags.join(', '));
    } else {
      setTitle('');
      setCategory('Architecture');
      setContent('');
      setTagsInput('');
    }
  }, [docToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (docToEdit) {
      updateDoc(docToEdit.id, title.trim(), content.trim(), tags);
    } else {
      createDoc(title.trim(), category, content.trim(), tags);
    }
    onClose();
  };

  const categories: DocCategory[] = [
    'Architecture',
    'Meeting Notes',
    'API Documentation',
    'Coding Standards',
    'Onboarding',
    'Retrospectives',
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-surface-50">
                {docToEdit ? 'Edit Engineering Document' : 'New Engineering Document'}
              </h2>
              <p className="text-xs text-surface-400">Knowledge Base with version history & Markdown</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-surface-500 hover:text-surface-200 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Document Title <span className="text-red-400">*</span>
            </label>
            <input className="input rounded-xl text-sm w-full font-semibold" placeholder="e.g. Architecture — FocusFlow Phase X System Design"
              value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">Category</label>
              <select className="input rounded-xl text-sm w-full" value={category} onChange={(e) => setCategory(e.target.value as DocCategory)}>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">Tags (Comma-separated)</label>
              <input className="input rounded-xl text-sm w-full" placeholder="Architecture, PhaseX, SystemDesign"
                value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Markdown Content <span className="text-red-400">*</span>
            </label>
            <textarea rows={10} className="input rounded-xl text-sm w-full font-mono resize-none leading-relaxed"
              placeholder="# Overview&#10;&#10;Write engineering specifications, API endpoints, or onboarding guides here..."
              value={content} onChange={(e) => setContent(e.target.value)} required />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 rounded-xl">Cancel</button>
            <button type="submit" disabled={!title.trim() || !content.trim()} className="btn-primary flex-1 rounded-xl">
              {docToEdit ? 'Save Changes' : 'Publish Document'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
