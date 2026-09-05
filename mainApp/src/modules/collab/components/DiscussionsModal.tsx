import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, MessageSquare, Send, CheckCircle2, Sparkles, X } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { Button } from '@shared/components/ui/Button';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Textarea } from '@shared/components/ui/Textarea';

export function DiscussionsModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  title,
}: {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'task' | 'worklog' | 'project' | 'doc';
  targetId: string;
  title: string;
}) {
  const { discussions, discussionsLoading, loadDiscussions, addComment, addReaction, resolveThread } = useCollaborationStore();
  const [content, setContent] = useState('');

  // EEP2-P5.3.1: threads are persisted — load them fresh each time the modal
  // opens so the panel reflects the latest comments from any collaborator.
  useEffect(() => {
    if (isOpen) loadDiscussions(targetType, targetId).catch(() => {});
  }, [isOpen, targetType, targetId, loadDiscussions]);

  if (!isOpen) return null;

  const targetDiscussions = discussions.filter(
    (d) => d.targetType === targetType && d.targetId === targetId
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    addComment(targetType, targetId, content.trim());
    setContent('');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <MessageSquare size={18} />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-surface-50 truncate max-w-md">
                Discussions: {title}
              </h2>
              <p className="text-xs text-surface-400 capitalize">
                Asynchronous engineering thread ({targetDiscussions.length} comments)
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="p-1.5 text-surface-500 hover:text-surface-200 rounded-lg transition-colors">
            <X size={18} />
          </Button>
        </div>

        {/* Body — Comment list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {discussionsLoading && targetDiscussions.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-surface-500">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading discussions…
            </div>
          ) : targetDiscussions.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={24} className="text-surface-600" />}
              title="No discussions yet"
              description="Start an async thread by leaving a note or mentioning a teammate with @Name."
              className="text-center py-10 border border-dashed border-surface-800 rounded-xl p-6"
            />
          ) : (
            targetDiscussions.map((comment) => (
              <div key={comment.id}
                className={`rounded-xl border p-4 transition-all ${
                  comment.isResolved ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-surface-800 bg-surface-850/60'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">
                      {comment.author.name.charAt(0)}
                    </div>
                    <span className="text-sm font-semibold text-surface-100">{comment.author.name}</span>
                    <span className="text-xs text-surface-500">
                      {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <button onClick={() => resolveThread(comment.id)}
                    className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all ${
                      comment.isResolved
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-surface-800 text-surface-400 border-surface-700 hover:text-surface-200'
                    }`}>
                    <CheckCircle2 size={12} /> {comment.isResolved ? 'Resolved' : 'Mark Resolved'}
                  </button>
                </div>

                <p className="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed mb-3">
                  {comment.content}
                </p>

                {/* Reactions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['👍', '🚀', '🙌', '🔥'].map((emoji) => {
                    const count = comment.reactions[emoji]?.length || 0;
                    return (
                      <button key={emoji} onClick={() => addReaction(comment.id, emoji)}
                        className={`text-xs px-2 py-0.5 rounded-lg border transition-all ${
                          count > 0 ? 'bg-brand-500/15 border-brand-500/30 text-brand-300' : 'bg-surface-800 border-surface-700/60 text-surface-400 hover:text-surface-200'
                        }`}>
                        {emoji} {count > 0 && <span className="font-bold ml-1">{count}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Replies */}
                {comment.replies.length > 0 && (
                  <div className="mt-3 pl-4 border-l-2 border-surface-700 space-y-2 pt-2">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="text-xs text-surface-300">
                        <span className="font-semibold text-brand-400 mr-2">{reply.author.name}:</span>
                        {reply.content}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Footer */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-surface-800 bg-surface-850/80">
          <div className="relative">
            <Textarea rows={2} className="text-sm rounded-xl pr-12 w-full resize-none"
              placeholder="Write a comment or mention (@Ajay, @Frontend)..."
              value={content} onChange={(e) => setContent(e.target.value)} />
            <Button type="submit" size="icon-sm" disabled={!content.trim()}
              className="absolute right-3 bottom-3 p-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-white rounded-lg transition-all shadow-md">
              <Send size={14} />
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-surface-500">
            <span>Supports Markdown & code blocks</span>
            <span>·</span>
            <span>Type <code className="bg-surface-800 text-brand-400 px-1 rounded">@Name</code> to notify teammates</span>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
