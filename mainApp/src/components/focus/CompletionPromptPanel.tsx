import { useState, type FormEvent } from 'react';
import { BookOpen, CheckCircle2, Sparkles, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  buildJournalEntry,
  type ReflectionDraft,
} from '../../lib/focusCompletion';
import type { Mood } from '../../types';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';

// ── CompletionPromptPanel (S2-T3) ─────────────────────────────────────────────
// The Focus shell's optional completion prompt (ECIS §B.3 section 5 · DCX §17:30).
// Shows only after the focused task is completed — never during flow — and asks
// one lightweight reflection (went well / slowed you / learned) that is written
// straight to the Journal. The prompt is optional: it can be skipped and
// reopened. The completed-item log itself is posted by the parent when the task
// is marked done, so this panel owns only the reflection → Journal write.

interface CompletionPromptPanelProps {
  completed: boolean;
  taskId: string | null;
  workLogTitle: string | null;
}

const MOOD_EMOJIS = ['😔', '😐', '🙂', '😊', '🔥'];
const MOOD_LABELS = ['Rough', 'Meh', 'Okay', 'Good', 'Great'];

function RatingRow({
  label, value, onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-surface-400">{label}</legend>
      <div className="flex items-center gap-1.5 mt-1.5">
        {([1, 2, 3, 4, 5] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={value === m}
            aria-label={`${label}: ${MOOD_LABELS[m - 1]} (${m} of 5)`}
            className={`w-9 h-9 rounded-lg border text-sm font-bold transition-colors ${
              value === m
                ? 'border-brand-500/50 bg-brand-500/15 text-brand-300'
                : 'border-surface-800 bg-surface-950/40 text-surface-500 hover:border-surface-700 hover:text-surface-300'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function CompletionPromptPanel({ completed, taskId, workLogTitle }: CompletionPromptPanelProps) {
  const { addJournal } = useStore();

  const [dismissed, setDismissed] = useState(false);
  const [wentWell, setWentWell] = useState('');
  const [slowedDown, setSlowedDown] = useState('');
  const [learned, setLearned] = useState('');
  const [mood, setMood] = useState<Mood>(3);
  const [focusRating, setFocusRating] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!completed || !taskId) return null;

  const draft: ReflectionDraft = { wentWell, slowedDown, learned };
  const canSave = wentWell.trim() !== '' || slowedDown.trim() !== '' || learned.trim() !== '';

  const dismiss = () => {
    setDismissed(true);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!taskId || !canSave) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await addJournal(buildJournalEntry(draft, taskId, mood, focusRating));
      setSaved(true);
      setWentWell('');
      setSlowedDown('');
      setLearned('');
      setMood(3);
      setFocusRating(3);
    } catch {
      setError('Could not save your reflection. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (dismissed) {
    return (
      <section aria-label="Completion reflection" className="rounded-3xl border border-success-500/20 bg-surface-900 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-surface-400">
            Task complete — <span className="text-surface-200 font-medium">reflect on it</span> while it's fresh.
          </p>
          <Button variant="ghost" size="xs" leftIcon={<Sparkles size={13} />} onClick={() => setDismissed(false)}>
            Write reflection
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Completion reflection" className="rounded-3xl border border-success-500/20 bg-surface-900 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-surface-50 flex items-center gap-2">
            <BookOpen size={16} className="text-success-400" />
            Done — one light reflection
          </h3>
          <p className="text-xs text-surface-400 mt-1">
            Optional. Capture it now so the knowledge lands in the journal{workLogTitle ? ` alongside ${workLogTitle}` : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="p-1.5 rounded-lg text-surface-500 hover:text-surface-50 hover:bg-surface-800 transition-colors"
          aria-label="Skip reflection"
          title="Skip reflection"
        >
          <X size={16} />
        </button>
      </div>

      {saved && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-success-400" role="status">
          <CheckCircle2 size={14} />
          Reflection saved to your journal
        </p>
      )}

      {error && (
        <p className="mt-3 text-xs font-semibold text-danger-400" role="alert">{error}</p>
      )}

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <Textarea
          rows={2}
          placeholder="What went well?"
          value={wentWell}
          onChange={(e) => setWentWell(e.target.value)}
          aria-label="What went well"
        />
        <Textarea
          rows={2}
          placeholder="What slowed you down?"
          value={slowedDown}
          onChange={(e) => setSlowedDown(e.target.value)}
          aria-label="What slowed you down"
        />
        <Textarea
          rows={2}
          placeholder="What did you learn?"
          value={learned}
          onChange={(e) => setLearned(e.target.value)}
          aria-label="What did you learn"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RatingRow label="Mood" value={mood} onChange={(m) => setMood(m as Mood)} />
          <RatingRow label="Focus" value={focusRating} onChange={setFocusRating} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={dismiss}>Skip</Button>
          <Button type="submit" size="sm" leftIcon={<BookOpen size={13} />} loading={saving} disabled={!canSave}>
            Save Reflection
          </Button>
        </div>
      </form>
      <p className="mt-3 text-[11px] text-surface-500" aria-hidden="true">
        {MOOD_EMOJIS[mood - 1]} {mood}/5 mood · {focusRating}/5 focus
      </p>
    </section>
  );
}
