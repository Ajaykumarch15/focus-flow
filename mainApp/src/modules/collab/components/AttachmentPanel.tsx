import { useEffect, useState } from 'react';
import { File, FileText, Image, Paperclip, Plus, Trash2, Loader2 } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';

// EEP2-P5.3.2: persisted file attachments on a target (task/worklog/project/doc).
// The panel loads the target's files via loadAttachments and writes through
// uploadAttachment/deleteAttachment — the same store surface the worklog-style
// attachment UI uses, so the data is shared and consistent.
export function AttachmentPanel({
  targetType,
  targetId,
}: {
  targetType: 'task' | 'worklog' | 'project' | 'doc';
  targetId: string;
}) {
  const {
    attachments,
    attachmentsLoading,
    attachmentsHasMore,
    attachmentsNextCursor,
    attachmentsError,
    loadAttachments,
    uploadAttachment,
    deleteAttachment,
  } = useCollaborationStore();
  const currentUserId = useAuthStore((s) => s.user?._id);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadAttachments(targetType, targetId).catch(() => {});
  }, [targetType, targetId, loadAttachments]);

  const targetAttachments = attachments.filter((a) => a.targetType === targetType && a.targetId === targetId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    uploadAttachment(targetType, targetId, { name: name.trim(), url: url.trim(), description: description.trim() || undefined }).catch(() => {});
    setName('');
    setUrl('');
    setDescription('');
  };

  const retry = () => loadAttachments(targetType, targetId).catch(() => {});

  const fileIcon = (type: string) => {
    if (type.includes('image')) return <Image size={14} className="text-cyan-400" />;
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return <FileText size={14} className="text-purple-400" />;
    return <File size={14} className="text-brand-400" />;
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="rounded-xl border border-surface-800 bg-surface-850/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800 bg-surface-850/60">
        <div className="flex items-center gap-2 text-sm font-semibold text-surface-200">
          <Paperclip size={14} className="text-brand-400" />
          Attachments
          {targetAttachments.length > 0 && (
            <span className="text-xs font-normal text-surface-500">({targetAttachments.length})</span>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto" data-testid="attachment-list">
        {attachmentsLoading && targetAttachments.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-xs text-surface-500">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading…
          </div>
        ) : attachmentsError && targetAttachments.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-surface-400 mb-2">Couldn't load attachments.</p>
            <Button variant="ghost" size="sm" onClick={retry}>Retry</Button>
          </div>
        ) : targetAttachments.length === 0 ? (
          <p className="py-6 text-center text-xs text-surface-500">No attachments yet.</p>
        ) : (
          <>
            {targetAttachments.map((attachment) => (
              <div key={attachment.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-surface-800 bg-surface-900/40 px-3 py-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-md bg-surface-800 mt-0.5 shrink-0">{fileIcon(attachment.type)}</div>
                  <div className="min-w-0 space-y-0.5">
                    <a href={attachment.url} target="_blank" rel="noreferrer"
                      className="text-xs font-semibold text-surface-100 hover:text-brand-400 truncate block">
                      {attachment.name}
                    </a>
                    <div className="flex items-center gap-2 text-[10px] text-surface-500">
                      <span className="uppercase">{attachment.type.toUpperCase()}</span>
                      {attachment.sizeBytes > 0 && <span>{formatSize(attachment.sizeBytes)}</span>}
                      <span>· {attachment.uploadedBy.name}</span>
                      <span>· {new Date(attachment.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                    {attachment.description && (
                      <p className="text-[11px] text-surface-400 truncate">{attachment.description}</p>
                    )}
                  </div>
                </div>
                {attachment.uploadedBy.id === currentUserId && (
                  <button onClick={() => deleteAttachment(attachment.id)}
                    aria-label={`Delete attachment ${attachment.name}`}
                    title="Delete attachment"
                    className="text-surface-500 hover:text-red-400 transition-colors p-1 shrink-0">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}

            {attachmentsHasMore && (
              <Button variant="ghost" size="sm"
                className="w-full text-xs"
                onClick={() =>
                  loadAttachments(targetType, targetId, { limit: 20, cursor: attachmentsNextCursor ?? undefined, append: true }).catch(() => {})
                }>
                Load more
              </Button>
            )}
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-surface-800 bg-surface-850/60 space-y-2">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input className="text-xs rounded-lg w-full py-2"
            placeholder="File name (e.g. Auth flow diagram)" aria-label="Attachment name"
            value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" size="sm" aria-label="Add attachment"
            disabled={!name.trim() || !url.trim()} className="text-xs">
            <Plus size={13} className="mr-1" /> Add
          </Button>
        </div>
        <Input className="text-xs rounded-lg w-full py-2"
          placeholder="URL / file link (https://...)" aria-label="Attachment URL"
          value={url} onChange={(e) => setUrl(e.target.value)} />
        <Input className="text-xs rounded-lg w-full py-2"
          placeholder="Description / context (optional)" aria-label="Attachment description"
          value={description} onChange={(e) => setDescription(e.target.value)} />
      </form>
    </div>
  );
}
