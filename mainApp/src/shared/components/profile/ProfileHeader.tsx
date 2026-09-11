import { motion } from 'framer-motion';
import { Edit, Globe, Github, Twitter, Linkedin, Calendar } from 'lucide-react';
import { Avatar } from '@shared/components/ui/Avatar';
import { Button } from '@shared/components/ui/Button';
import type { PublicProfile } from '@shared/types';

interface ProfileHeaderProps {
  profile: PublicProfile;
  isSelf: boolean;
  onEdit: () => void;
}

const SOCIAL_ICONS: Record<string, typeof Globe> = {
  website: Globe,
  github: Github,
  twitter: Twitter,
  linkedin: Linkedin,
};

const SOCIAL_LABELS: Record<string, string> = {
  website: 'Website',
  github: 'GitHub',
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
};

function formatJoinedDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function ProfileHeader({ profile, isSelf, onEdit }: ProfileHeaderProps) {
  const socialLinks = profile.socialLinks || {};
  const hasSocialLinks = Object.values(socialLinks).some(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row items-start gap-5">
        <Avatar name={profile.name} src={profile.avatar} size="xl" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-display font-bold text-surface-50 tracking-tight">
                {profile.name}
              </h1>
              <div className="flex items-center gap-2 mt-1 text-xs text-surface-400">
                <Calendar size={12} />
                <span>Joined {formatJoinedDate(profile.joinedAt)}</span>
              </div>
            </div>

            {isSelf && (
              <Button variant="outline" size="sm" onClick={onEdit} className="h-8 rounded-lg text-xs gap-1.5">
                <Edit size={12} />
                Edit Profile
              </Button>
            )}
          </div>

          {profile.bio && (
            <p className="mt-3 text-sm text-surface-300 leading-relaxed whitespace-pre-wrap">
              {profile.bio}
            </p>
          )}

          {hasSocialLinks && (
            <div className="flex items-center gap-3 mt-3">
              {Object.entries(socialLinks).map(([key, url]) => {
                if (!url) return null;
                const Icon = SOCIAL_ICONS[key];
                const label = SOCIAL_LABELS[key];
                const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
                return (
                  <a
                    key={key}
                    href={url.startsWith('http') ? url : `https://${url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-brand-400 transition-colors"
                    title={label}
                  >
                    <Icon size={13} />
                    <span className="hidden sm:inline">{displayUrl}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
