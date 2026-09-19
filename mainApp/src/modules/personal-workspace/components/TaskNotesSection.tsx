import { useState } from 'react';
import { StickyNote, Maximize2 } from 'lucide-react';
import { Textarea } from '@shared/components/ui/Textarea';

interface TaskNotesSectionProps {
  taskId?: string;
}

export function TaskNotesSection(_props: TaskNotesSectionProps) {
  const [value, setValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      id="section-notes"
      className={`rounded-2xl border border-surface-800 bg-surface-900 overflow-hidden transition-all ${
        isExpanded ? 'fixed inset-4 z-50' : ''
      }`}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-surface-100">
          <StickyNote size={15} className="text-brand-400" />
          Notes
        </h3>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors"
        >
          <Maximize2 size={13} />
        </button>
      </div>
      <div className="px-5 pb-5">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Write notes, ideas, or anything related to this task..."
          className={`text-sm border-0 bg-surface-850/50 focus:bg-surface-850 transition-colors ${
            isExpanded ? 'min-h-[60vh]' : 'min-h-[120px]'
          }`}
        />
      </div>
    </div>
  );
}
