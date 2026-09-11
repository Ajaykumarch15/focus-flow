import { useState } from 'react';
import { cn } from '@shared/utils/cn';
import { Save } from 'lucide-react';

interface MeetingNotesTabProps {
  notes: string;
  canEdit?: boolean;
  onSave?: (notes: string) => void;
}

export function MeetingNotesTab({ notes, canEdit = false, onSave }: MeetingNotesTabProps) {
  const [content, setContent] = useState(notes);
  const [isDirty, setIsDirty] = useState(false);

  const handleSave = () => {
    onSave?.(content);
    setIsDirty(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-surface-400">Meeting Notes</label>
        {canEdit && isDirty && (
          <button
            onClick={handleSave}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand-500 hover:bg-brand-500/10"
          >
            <Save size={12} />
            Save
          </button>
        )}
      </div>
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setIsDirty(true); }}
        disabled={!canEdit}
        placeholder="Add meeting notes..."
        className={cn(
          'w-full resize-y rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 placeholder-surface-400 focus:border-brand-500 focus:outline-none disabled:opacity-50 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200',
          'min-h-[200px]',
        )}
      />
    </div>
  );
}
