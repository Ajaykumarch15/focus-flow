import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Plus, Trash2, Scale, BookOpen } from 'lucide-react';
import { WorkLog, useWorkLogStore } from '../../store/useWorkLogStore';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { EmptyState } from '../../components/ui/EmptyState';

interface TechnicalDecisionsViewProps {
  workLog: WorkLog;
}

export function TechnicalDecisionsView({ workLog }: TechnicalDecisionsViewProps) {
  const { addDecision, deleteDecision } = useWorkLogStore();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [decision, setDecision] = useState('');
  const [rationale, setRationale] = useState('');
  const [alternatives, setAlternatives] = useState('');

  const decisions = workLog.decisions || [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !decision.trim()) return;
    await addDecision(workLog._id, {
      title,
      context,
      decision,
      rationale,
      alternatives,
    });
    setTitle('');
    setContext('');
    setDecision('');
    setRationale('');
    setAlternatives('');
    setShowAdd(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-surface-50 flex items-center gap-2">
            <Lightbulb size={18} className="text-amber-400" />
            Architecture & Technical Decisions Log
          </h3>
          <p className="text-xs text-surface-400">
            Document trade-offs, architecture choices, and rationale for future reference.
          </p>
        </div>
        <Button
          size="xs"
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5"
          leftIcon={<Plus size={14} />}
        >
          Log Decision
        </Button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.form
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            onSubmit={handleAdd}
            className="card p-4 rounded-xl border border-amber-500/30 bg-surface-850 space-y-3"
          >
            <Input
              className="text-sm rounded-lg w-full"
              placeholder="Decision title (e.g., Why Zustand for state management?)"
              value={title} onChange={e => setTitle(e.target.value)} required
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Textarea
                className="text-sm rounded-lg resize-none" rows={2}
                placeholder="Context / Problem description..."
                value={context} onChange={e => setContext(e.target.value)}
              />
              <Textarea
                className="text-sm rounded-lg resize-none" rows={2}
                placeholder="Chosen Decision..."
                value={decision} onChange={e => setDecision(e.target.value)} required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Textarea
                className="text-sm rounded-lg resize-none" rows={2}
                placeholder="Rationale / Why this was chosen?"
                value={rationale} onChange={e => setRationale(e.target.value)}
              />
              <Textarea
                className="text-sm rounded-lg resize-none" rows={2}
                placeholder="Alternatives considered & rejected..."
                value={alternatives} onChange={e => setAlternatives(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="xs" onClick={() => setShowAdd(false)} className="px-3 py-1.5">Cancel</Button>
              <Button type="submit" size="xs" className="px-4 py-1.5">Save Decision</Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {decisions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-800 bg-surface-900 overflow-hidden">
          <EmptyState
            icon={<Scale size={32} className="text-surface-600" />}
            title="No technical decisions logged"
            description="Log architectural decisions, library choices, and trade-offs made during development."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {decisions.map(d => (
            <Card key={d._id} className="p-5 rounded-2xl border border-surface-800 bg-surface-900/60 space-y-3 group">
              <div className="flex items-start justify-between">
                <h4 className="text-sm font-bold text-surface-50 flex items-center gap-2">
                  <BookOpen size={16} className="text-amber-400" />
                  {d.title}
                </h4>
                <button
                  onClick={() => deleteDecision(workLog._id, d._id)}
                  className="p-1 rounded text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete decision"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {d.decision && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                  <span className="font-semibold text-amber-400">Decision: </span>
                  {d.decision}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {d.context && (
                  <div>
                    <span className="font-semibold text-surface-400 block mb-0.5">Context:</span>
                    <p className="text-surface-300">{d.context}</p>
                  </div>
                )}
                {d.rationale && (
                  <div>
                    <span className="font-semibold text-surface-400 block mb-0.5">Rationale:</span>
                    <p className="text-surface-300">{d.rationale}</p>
                  </div>
                )}
              </div>

              {d.alternatives && (
                <div className="text-xs border-t border-surface-800/80 pt-2 text-surface-400">
                  <span className="font-semibold text-surface-500">Alternatives Considered: </span>
                  {d.alternatives}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
