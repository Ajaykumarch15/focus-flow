import { ShieldCheck, User } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export function WorkspaceBadge() {
  const { workspace, user } = useAuthStore();
  if (user?.role !== 'admin') return null;

  const isAdmin = workspace === 'admin';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
      isAdmin ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
    }`}>
      {isAdmin ? <ShieldCheck size={11} /> : <User size={11} />}
      {isAdmin ? 'Admin' : 'Personal'}
    </span>
  );
}
