import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, MessageSquare, AlertOctagon, GitPullRequest, Zap, CheckCircle2, X } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';

export function NotificationCenter() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useCollaborationStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = notifications.filter((n) => (filter === 'unread' ? !n.read : true));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'mentioned': return <MessageSquare size={14} className="text-brand-400" />;
      case 'review_requested': return <GitPullRequest size={14} className="text-purple-400" />;
      case 'blocker_added': return <AlertOctagon size={14} className="text-red-400" />;
      case 'completed': return <CheckCircle2 size={14} className="text-emerald-400" />;
      default: return <Zap size={14} className="text-amber-400" />;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all"
        aria-label="Notifications">
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-brand-500 ring-2 ring-surface-950 flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-surface-800 bg-surface-900 shadow-2xl overflow-hidden z-50">

            {/* Header */}
            <div className="p-4 border-b border-surface-800 flex items-center justify-between bg-surface-850/40">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-brand-400" />
                <span className="font-display font-bold text-surface-50 text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full border border-brand-500/30">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button onClick={markAllNotificationsRead} title="Mark all read"
                    className="p-1 text-surface-500 hover:text-brand-400 rounded-lg transition-colors">
                    <CheckCheck size={14} />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 text-surface-500 hover:text-surface-200 rounded-lg">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Filter tab */}
            <div className="flex border-b border-surface-800 text-xs font-semibold px-2 py-1 bg-surface-900">
              <button onClick={() => setFilter('all')}
                className={`flex-1 py-1.5 text-center rounded-lg transition-colors ${filter === 'all' ? 'bg-surface-800 text-surface-50' : 'text-surface-500 hover:text-surface-300'}`}>
                All ({notifications.length})
              </button>
              <button onClick={() => setFilter('unread')}
                className={`flex-1 py-1.5 text-center rounded-lg transition-colors ${filter === 'unread' ? 'bg-surface-800 text-surface-50' : 'text-surface-500 hover:text-surface-300'}`}>
                Unread ({unreadCount})
              </button>
            </div>

            {/* Items */}
            <div className="max-h-80 overflow-y-auto divide-y divide-surface-800/50">
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-surface-500 text-xs">
                  No {filter === 'unread' ? 'unread ' : ''}notifications
                </div>
              ) : (
                filtered.map((item) => (
                  <div key={item.id} onClick={() => markNotificationRead(item.id)}
                    className={`p-3.5 flex items-start gap-3 hover:bg-surface-850/60 cursor-pointer transition-colors ${
                      !item.read ? 'bg-brand-500/5' : ''
                    }`}>
                    <div className="w-8 h-8 rounded-xl bg-surface-800 flex items-center justify-center flex-shrink-0 border border-surface-700/50">
                      {getIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-xs font-semibold text-surface-100 truncate">{item.title}</p>
                        {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-surface-400 line-clamp-2 leading-relaxed">{item.body}</p>
                      <p className="text-[10px] text-surface-600 mt-1">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
