import React, { useState, useEffect } from 'react';
import { Target, Plus, Trash2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { WorkLog, useWorkLogStore } from '../../store/useWorkLogStore';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

interface TomorrowPlanViewProps {
  workLog: WorkLog;
}

export function TomorrowPlanView({ workLog }: TomorrowPlanViewProps) {
  const { updateNestedField } = useWorkLogStore();
  const plan = workLog.tomorrowPlan || { topPriority: '', unfinishedItems: [], attentionRequired: '' };

  const [topPriority, setTopPriority] = useState(plan.topPriority || '');
  const [unfinishedItems, setUnfinishedItems] = useState<string[]>(plan.unfinishedItems || []);
  const [attentionRequired, setAttentionRequired] = useState(plan.attentionRequired || '');
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    setTopPriority(plan.topPriority || '');
    setUnfinishedItems(plan.unfinishedItems || []);
    setAttentionRequired(plan.attentionRequired || '');
  }, [workLog._id]);

  const saveTopPriority = (val: string) => {
    setTopPriority(val);
    updateNestedField(workLog._id, 'tomorrowPlan', 'topPriority', val);
  };

  const saveAttention = (val: string) => {
    setAttentionRequired(val);
    updateNestedField(workLog._id, 'tomorrowPlan', 'attentionRequired', val);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    const updated = [...unfinishedItems, newItemText.trim()];
    setUnfinishedItems(updated);
    updateNestedField(workLog._id, 'tomorrowPlan', 'unfinishedItems', updated);
    setNewItemText('');
  };

  const removeItem = (index: number) => {
    const updated = unfinishedItems.filter((_, i) => i !== index);
    setUnfinishedItems(updated);
    updateNestedField(workLog._id, 'tomorrowPlan', 'unfinishedItems', updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-surface-50 flex items-center gap-2">
          <Target size={18} className="text-brand-400" />
          Plan for Tomorrow & Carried-Forward Work
        </h3>
        <p className="text-xs text-surface-400">
          Prepare for tomorrow before wrapping up today. Carried-forward items will appear in tomorrow's log.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Priority */}
        <Card className="p-4 rounded-xl border border-brand-500/20 bg-surface-900/60 space-y-2">
          <label className="text-xs font-bold text-brand-400 flex items-center gap-1.5 uppercase tracking-wider">
            <ArrowRight size={14} /> 1. First Task Tomorrow
          </label>
          <Input
            className="text-sm w-full rounded-lg"
            placeholder="What single task should you tackle first tomorrow morning?"
            value={topPriority}
            onChange={e => setTopPriority(e.target.value)}
            onBlur={e => saveTopPriority(e.target.value)}
          />
        </Card>

        {/* Attention Required */}
        <Card className="p-4 rounded-xl border border-amber-500/20 bg-surface-900/60 space-y-2">
          <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Target size={14} /> 2. Requires Attention / Follow-up
          </label>
          <Input
            className="text-sm w-full rounded-lg"
            placeholder="PR reviews, team syncs, or pending emails requiring attention..."
            value={attentionRequired}
            onChange={e => setAttentionRequired(e.target.value)}
            onBlur={e => saveAttention(e.target.value)}
          />
        </Card>
      </div>

      {/* Unfinished Items List */}
      <Card className="p-4 rounded-xl border border-surface-800 bg-surface-900/60 space-y-3">
        <label className="text-xs font-semibold text-surface-200 block">
          3. Unfinished Deliverables (Carried Forward)
        </label>

        <form onSubmit={handleAddItem} className="flex gap-2">
          <Input
            className="text-sm flex-1 rounded-lg"
            placeholder="Add an unfinished task to carry forward to tomorrow..."
            value={newItemText}
            onChange={e => setNewItemText(e.target.value)}
          />
          <Button type="submit" size="xs" className="px-3" leftIcon={<Plus size={14} />}>Add</Button>
        </form>

        <div className="space-y-2">
          {unfinishedItems.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-800/50 border border-surface-700/50 text-xs text-surface-200 group">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-surface-500" />
                {item}
              </span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
