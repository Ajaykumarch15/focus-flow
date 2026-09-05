import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { requestNotificationPermission } from '@shared/hooks/useNotifications';

const DISMISSED_KEY = 'ff_notification_banner_dismissed';

export function NotificationPermissionBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;
    setVisible(true);
  }, []);

  const handleEnable = async () => {
    await requestNotificationPermission();
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          className="mx-6 mt-4"
        >
          <div className="flex items-center gap-3 p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl">
            <Bell size={18} className="text-brand-400 flex-shrink-0" />
            <p className="text-sm text-brand-200 flex-1">
              Enable notifications for deadline reminders and focus timer alerts.
            </p>
            <button
              onClick={handleEnable}
              className="px-3 py-1.5 bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium rounded-lg transition-all"
            >
              Enable
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss notification permission prompt"
              className="p-1.5 text-surface-400 hover:text-surface-50 rounded-lg transition-all"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
