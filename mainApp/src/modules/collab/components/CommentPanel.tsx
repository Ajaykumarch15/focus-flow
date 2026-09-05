import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquare, Send, Trash2 } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { Button } from '@shared/components/ui/Button';
import { Textarea } from '@shared/components/ui/Textarea';

// EEP2-P5.3.1: persisted async comment threads on a target (task/worklog/project/
// doc). The panel loads the target's roots + nested replies via loadDiscussions
// and writes through addComment/addReaction/resolveThread/deleteComment — the
// same store surface DiscussionsModal uses, so the data is shared and consistent.
export function CommentPanel({
  targetType,
  targetId,
}: {
  targetType: 'task' | 'worklog' | 'project' | 'doc';
  targetId: string;
}) {
  const {
    discussions,
    discussionsLoading,
    discussionsHasMore,
    discussionsNextCursor,
    discussionsError,
    loadDiscussions,
    addComment,
    addReaction,
    resolveThread,
    deleteComment,
  } = useCollaborationStore();
  const currentUserId = useAuthStore((s) => s.user?._id);
  const [content, setContent] = useState('');

  useEffect(() => {
    loadDiscussions(targetType, targetId).catch(() => {});
  }, [targetType, targetId, loadDiscussions]);

  const thread = discussions.filter((d) => d.targetType === targetType && d.targetId === targetId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;
    addComment(targetType, targetId, text).catch(() => {});
    setContent('');
  };

  const retry = () => loadDiscussions(targetType, targetId).catch(() => {});

  return (
    <div className="rounded-xl border border-surface-800 bg-surface-850/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800 bg-surface-850/60">
        <div className="flex items-center gap-2 text-sm font-semibold text-surface-200">
          <MessageSquare size={14} className="text-brand-400" />
          Comments
          {thread.length > 0 && (
            <span className="text-xs font-normal text-surface-500">({thread.length})</span>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 max-h-72 overflow-y-auto" data-testid="comment-list">
        {discussionsLoading && thread.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-xs text-surface-500">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading…
          </div>
        ) : discussionsError && thread.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-surface-400 mb-2">Couldn't load discussions.</p>
            <Button variant="ghost" size="sm" onClick={retry}>Retry</Button>
          </div>
        ) : thread.length === 0 ? (
          <p className="py-6 text-center text-xs text-surface-500">No comments yet.</p>
        ) : (
          <>
            {thread.map((comment) => (
              <div key={comment.id}
                className={`rounded-lg border p-3 ${
                  comment.isResolved ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-surface-800 bg-surface-900/40'
                }`}>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 shrink-0 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {comment.author.name.charAt(0)}
                    </div>
                    <span className="text-xs font-semibold text-surface-100 truncate">{comment.author.name}</span>
                    <span className="text-[10px] text-surface-500 shrink-0">
                      {new Date(comment.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => resolveThread(comment.id)}
                      title={comment.isResolved ? 'Resolved' : 'Mark resolved'}
                      className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border transition-all ${
                        comment.isResolved
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-surface-800 text-surface-400 border-surface-700 hover:text-surface-200'
                      }`}>
                      <CheckCircle2 size={10} /> {comment.isResolved ? 'Resolved' : 'Resolve'}
                    </button>
                    {comment.author.id === currentUserId && (
                      <button onClick={() => deleteComment(comment.id)}
                        title="Delete comment"
                        className="text-surface-500 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-surface-200 whitespace-pre-wrap leading-relaxed mb-2">
                  {comment.content}
                </p>

                <div className="flex items-center gap-1 flex-wrap">
                  {['👍', '🚀', '🙌', '🔥'].map((emoji) => {
                    const count = comment.reactions[emoji]?.length || 0;
                    return (
                      <button key={emoji} onClick={() => addReaction(comment.id, emoji)}
                        className={`text-[11px] px-2 py-0.5 rounded-md border transition-all ${
                          count > 0
                            ? 'bg-brand-500/15 border-brand-500/30 text-brand-300'
                            : 'bg-surface-800 border-surface-700/60 text-surface-400 hover:text-surface-200'
                        }`}>
                        {emoji} {count > 0 && <span className="font-bold ml-1">{count}</span>}
                      </button>
                    );
                  })}
                </div>

                {comment.replies.length > 0 && (
                  <div className="mt-2 pl-3 border-l-2 border-surface-700 space-y-1.5 pt-1.5">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="text-[11px] text-surface-300 flex items-start gap-1.5">
                        <span className="font-semibold text-brand-400 shrink-0">{reply.author.name}:</span>
                        <span className="whitespace-pre-wrap">{reply.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {discussionsHasMore && (
              <Button variant="ghost" size="sm"
                className="w-full text-xs"
                onClick={() =>
                  loadDiscussions(targetType, targetId, { limit: 20, cursor: discussionsNextCursor ?? undefined, append: true }).catch(() => {})
                }>
                Load more
              </Button>
            )}
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-surface-800 bg-surface-850/60">
        <div className="relative">
          <Textarea rows={2} className="text-xs rounded-lg pr-10 w-full resize-none"
            placeholder="Write a comment…"
            value={content} onChange={(e) => setContent(e.target.value)} />
          <Button type="submit" size="icon-sm" aria-label="Post comment" disabled={!content.trim()}
            className="absolute right-2 bottom-2 p-1.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-white rounded-md transition-all">
            <Send size={13} />
          </Button>
        </div>
      </form>
    </div>
  );
}
