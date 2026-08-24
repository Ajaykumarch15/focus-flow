import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

// EEP2-P3.4.2 (s3): the delete confirmation modal shared by the Roadmap,
// Milestone, Phase and Module pages. Delete actions are irreversible (they also
// orphan children per DDS §6.3), so they always require an explicit confirm.
// B12: `busy` disables both buttons while the destructive request is in flight,
// preventing double-submit duplicates.
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Delete', busy = false, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-surface-400">{description}</p>
    </Dialog>
  );
}
