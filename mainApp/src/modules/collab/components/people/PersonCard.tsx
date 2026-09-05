import { motion } from 'framer-motion';
import { Users, CheckCircle2, Zap } from 'lucide-react';
import { Avatar } from '@shared/components/ui/Avatar';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Progress } from '@shared/components/ui/Progress';
import type { PersonStats } from './types';
import type { MemberStatus } from '@collab/types/collaboration';

const STATUS_TONE: Record<MemberStatus, BadgeTone> = {
  available: 'success',
  in_focus: 'warning',
  in_meeting: 'brand',
  away: 'warning',
  offline: 'neutral',
};

const STATUS_LABEL: Record<MemberStatus, string> = {
  available: 'Active',
  in_focus: 'In Focus',
  in_meeting: 'In Meeting',
  away: 'Away',
  offline: 'Offline',
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

interface PersonCardProps {
  stats: PersonStats;
  onClick: () => void;
}

export function PersonCard({ stats, onClick }: PersonCardProps) {
  const { member, projectCount, completedTasks, activeTasks, productivity } = stats;

  return (
    <motion.button
      variants={fadeUp}
      onClick={onClick}
      type="button"
      className="card card-hover w-full text-left p-6 flex flex-col items-center gap-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
    >
      {/* Avatar */}
      <Avatar src={member.avatar} name={member.name} size="lg" />

      {/* Name & Role */}
      <div className="text-center min-w-0 w-full">
        <h3 className="font-display font-bold text-surface-50 text-sm truncate">
          {member.name}
        </h3>
        <p className="text-[11px] text-surface-400 mt-0.5 truncate">
          {member.role}
          {member.teams.length > 0 && (
            <span className="text-surface-500"> · {member.teams[0]}</span>
          )}
        </p>
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-center gap-5 w-full">
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1 text-surface-400">
            <Users size={11} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Projects</span>
          </div>
          <span className="text-base font-display font-extrabold text-surface-50">
            {projectCount}
          </span>
        </div>

        <div className="w-px h-8 bg-surface-800" />

        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1 text-surface-400">
            <CheckCircle2 size={11} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Done</span>
          </div>
          <span className="text-base font-display font-extrabold text-success-400">
            {completedTasks}
          </span>
        </div>

        <div className="w-px h-8 bg-surface-800" />

        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1 text-surface-400">
            <Zap size={11} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Active</span>
          </div>
          <span className="text-base font-display font-extrabold text-brand-400">
            {activeTasks}
          </span>
        </div>
      </div>

      {/* Productivity */}
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
            Productivity
          </span>
          <span className="text-xs font-bold text-surface-200">{productivity}%</span>
        </div>
        <Progress value={productivity} tone="brand" className="h-1.5" />
      </div>

      {/* Status */}
      <Badge tone={STATUS_TONE[member.status]} className="text-[10px] font-extrabold uppercase tracking-wider">
        {STATUS_LABEL[member.status]}
      </Badge>
    </motion.button>
  );
}
