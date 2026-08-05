import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, Lightbulb, CheckCircle2, X, ShieldAlert } from 'lucide-react';
import { useWorkLogStore, type StructuredBlocker } from '../../store/useWorkLogStore';
import {
  buildBlockerPayload,
  buildDecisionPayload,
  canCaptureOnPause,
  type CaptureKind,
} from '../../lib/focusCapture';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';

// ── PauseCapturePanel (S2-T2) ─────────────────────────────────────────────────
// The Focus shell's inline blocker + decision capture (ECIS §B.3 section 4).
// It appears only on an intentional pause — never during flow — and posts
// straight to the linked work log through the existing workLogs store actions.

interface PauseCapturePanelProps {
  paused: boolean;
  workLogId: string | null;
  workLogTitle: string | null;
}

const SEVERITIES: StructuredBlocker['severity'][] = ['low', 'medium', 'high', 'critical'];

export function PauseCapturePanel({ paused, workLogId, workLogTitle }: PauseCapturePanelProps) {
  const navigate = useNavigate();
  const { addBlocker, addDecision } = useWorkLogStore();

  const [dismissed, setDismissed] = useState(false);
  const [kind, setKind] = useState<CaptureKind>('blocker');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<CaptureKind | null>(null);

  const [blkTitle, setBlkTitle] = useState('');
  const [blkSeverity, setBlkSeverity] = useState<StructuredBlocker['severity']>('medium');
  const [blkNotes, setBlkNotes] = useState('');

  const [decTitle, setDecTitle] = useState('');
  const [decContext, setDecContext] = useState('');
  const [decDecision, setDecDecision] = useState('');
  const [decRationale, setDecRationale] = useState('');
  const [decAlternatives, setDecAlternatives] = useState('');

  if (!canCaptureOnPause(paused, workLogId)) {
    if (!paused) return null;
    return (
      <section aria-label="Capture on pause" className="rounded-3xl border border-surface-800/60 bg-surface-900 p-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-surface-800/70 flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={16} className="text-surface-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold text-surface-50 text-sm">Paused</h3>
            <p className="text-sm text-surface-400 mt-1">
              Link a work log to this task to capture blockers or decisions at the moment they happen.
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => navigate('/worklog')}>
              Open Work Logs
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const switchKind = (next: CaptureKind) => {
    setKind(next);
    setError(null);
    setSaved(null);
  };

  const dismiss = () => {
    setDismissed(true);
    setError(null);
    setSaved(null);
  };

  const handleBlockerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!workLogId || !blkTitle.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      await addBlocker(workLogId, buildBlockerPayload({ title: blkTitle, severity: blkSeverity, notes: blkNotes }));
      setSaved('blocker');
      setBlkTitle('');
      setBlkSeverity('medium');
      setBlkNotes('');
    } catch {
      setError('Could not record the blocker. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDecisionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!workLogId || !decTitle.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      await addDecision(workLogId, buildDecisionPayload({
        title: decTitle,
        context: decContext,
        decision: decDecision,
        rationale: decRationale,
        alternatives: decAlternatives,
      }));
      setSaved('decision');
      setDecTitle('');
      setDecContext('');
      setDecDecision('');
      setDecRationale('');
      setDecAlternatives('');
    } catch {
      setError('Could not log the decision. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (dismissed) {
    return (
      <section aria-label="Capture on pause" className="rounded-3xl border border-surface-800/60 bg-surface-900 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-surface-400">Paused — <span className="text-surface-200 font-medium">{workLogTitle ?? 'linked work log'}</span></p>
          <Button variant="ghost" size="xs" leftIcon={<AlertOctagon size={13} />} onClick={() => setDismissed(false)}>
            Capture blocker or decision
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Capture on pause" className="rounded-3xl border border-amber-500/20 bg-surface-900 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-surface-50 flex items-center gap-2">
            <AlertOctagon size={16} className="text-amber-400" />
            Paused — capture why
          </h3>
          <p className="text-xs text-surface-400 mt-1">
            Record it now so it lands in the work log. Never after the fact.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="p-1.5 rounded-lg text-surface-500 hover:text-surface-50 hover:bg-surface-800 transition-colors"
          aria-label="Dismiss capture prompt"
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 inline-flex rounded-xl border border-surface-800 bg-surface-950/60 p-1" role="group" aria-label="Capture type">
        <button
          type="button"
          onClick={() => switchKind('blocker')}
          aria-pressed={kind === 'blocker'}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            kind === 'blocker'
              ? 'bg-amber-500/15 text-amber-400'
              : 'text-surface-400 hover:text-surface-50'
          }`}
        >
          <AlertTriangle size={13} /> Blocker
        </button>
        <button
          type="button"
          onClick={() => switchKind('decision')}
          aria-pressed={kind === 'decision'}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            kind === 'decision'
              ? 'bg-brand-500/15 text-brand-400'
              : 'text-surface-400 hover:text-surface-50'
          }`}
        >
          <Lightbulb size={13} /> Decision
        </button>
      </div>

      {saved && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-success-400" role="status">
          <CheckCircle2 size={14} />
          {saved === 'blocker' ? 'Blocker recorded' : 'Decision logged'} to {workLogTitle ?? 'work log'}
        </p>
      )}

      {error && (
        <p className="mt-3 text-xs font-semibold text-danger-400" role="alert">{error}</p>
      )}

      {kind === 'blocker' ? (
        <form className="mt-4 space-y-3" onSubmit={handleBlockerSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              className="sm:col-span-2"
              placeholder="What are you blocked on?"
              value={blkTitle}
              onChange={(e) => setBlkTitle(e.target.value)}
              required
              aria-label="Blocker title"
            />
            <Select
              value={blkSeverity}
              onChange={(e) => setBlkSeverity(e.target.value as StructuredBlocker['severity'])}
              aria-label="Blocker severity"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{s[0].toUpperCase()}{s.slice(1)} severity</option>
              ))}
            </Select>
          </div>
          <Textarea
            rows={2}
            placeholder="Blocker details, error logs, or dependencies…"
            value={blkNotes}
            onChange={(e) => setBlkNotes(e.target.value)}
            aria-label="Blocker details"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-surface-500">Recorded as an open blocker in the work log.</span>
            <Button type="submit" size="sm" leftIcon={<AlertOctagon size={13} />} loading={saving} disabled={!blkTitle.trim()}>
              Record Blocker
            </Button>
          </div>
        </form>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={handleDecisionSubmit}>
          <Input
            placeholder="Decision title (e.g., Why Zustand for state management?)"
            value={decTitle}
            onChange={(e) => setDecTitle(e.target.value)}
            required
            aria-label="Decision title"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Textarea
              rows={2}
              placeholder="Context / problem…"
              value={decContext}
              onChange={(e) => setDecContext(e.target.value)}
              aria-label="Decision context"
            />
            <Textarea
              rows={2}
              placeholder="Chosen decision…"
              value={decDecision}
              onChange={(e) => setDecDecision(e.target.value)}
              aria-label="Chosen decision"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Textarea
              rows={2}
              placeholder="Rationale / why…"
              value={decRationale}
              onChange={(e) => setDecRationale(e.target.value)}
              aria-label="Decision rationale"
            />
            <Textarea
              rows={2}
              placeholder="Alternatives considered…"
              value={decAlternatives}
              onChange={(e) => setDecAlternatives(e.target.value)}
              aria-label="Alternatives considered"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" leftIcon={<Lightbulb size={13} />} loading={saving} disabled={!decTitle.trim()}>
              Log Decision
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
